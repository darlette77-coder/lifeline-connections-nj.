import { getDatabase } from "@netlify/database";
import { isValidZip, resolveZip, NWS_USER_AGENT } from "./lib/zip-resolver.js";

// GET /api/weather/alerts?zip=07302
export default async (req) => {
  const zip = new URL(req.url).searchParams.get("zip");
  if (!isValidZip(zip)) {
    return Response.json({ error: "A valid 5-digit zip code is required." }, { status: 400 });
  }

  const db = getDatabase();
  try {
    const location = await resolveZip(zip);

    const cached = await db.sql`
      SELECT * FROM weather_alerts
      WHERE zip_code = ${zip} AND fetched_at > NOW() - INTERVAL '10 minutes'
      ORDER BY effective DESC`;
    if (cached.length > 0) {
      return Response.json({ zip, place: location.place_name, alerts: formatAlerts(cached), source: "cache" });
    }

    const nwsRes = await fetch(
      `https://api.weather.gov/alerts/active?point=${location.latitude},${location.longitude}`,
      { headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" } }
    );
    if (!nwsRes.ok) throw new Error(`NWS API returned ${nwsRes.status}`);
    const features = (await nwsRes.json()).features || [];

    // Replace this zip's cached rows with the fresh set
    await db.sql`DELETE FROM weather_alerts WHERE zip_code = ${zip}`;
    const inserted = [];
    for (const { properties: p } of features) {
      const [row] = await db.sql`
        INSERT INTO weather_alerts
          (zip_code, nws_id, event_type, severity, headline, description, effective, expires, raw_payload)
        VALUES (${zip}, ${p.id}, ${p.event}, ${p.severity}, ${p.headline}, ${p.description},
                ${p.effective}, ${p.expires}, ${JSON.stringify(p)})
        RETURNING *`;
      inserted.push(row);
    }

    return Response.json({ zip, place: location.place_name, alerts: formatAlerts(inserted), source: "live" });
  } catch (err) {
    console.error("GET /api/weather/alerts failed:", err);
    if (err.status === 404) return Response.json({ error: err.message }, { status: 404 });
    return Response.json({ error: "Could not reach the National Weather Service right now." }, { status: 502 });
  }
};

function formatAlerts(rows) {
  return rows.map((r) => ({
    id: r.nws_id,
    eventType: r.event_type,
    severity: r.severity,
    headline: r.headline,
    description: r.description,
    effective: r.effective,
    expires: r.expires,
  }));
}

export const config = { path: "/api/weather/alerts" };
