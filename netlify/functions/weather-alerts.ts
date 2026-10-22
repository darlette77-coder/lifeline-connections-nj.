import type { Config } from "@netlify/functions";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { weatherAlerts } from "../../db/schema.js";
import { HttpError, NWS_USER_AGENT, resolveZip } from "../lib/zip-resolver.js";

const CACHE_TTL_MINUTES = 10;

// GET /api/weather/alerts?zip=07302
export default async (req: Request) => {
  const zip = new URL(req.url).searchParams.get("zip") ?? "";
  if (!/^\d{5}$/.test(zip)) {
    return Response.json({ error: "A valid 5-digit zip code is required." }, { status: 400 });
  }

  try {
    const location = await resolveZip(zip);

    // Serve from cache if fetched within the TTL
    const cached = await db
      .select()
      .from(weatherAlerts)
      .where(and(
        eq(weatherAlerts.zipCode, zip),
        gt(weatherAlerts.fetchedAt, sql`NOW() - make_interval(mins => ${CACHE_TTL_MINUTES})`),
      ))
      .orderBy(desc(weatherAlerts.effective));
    if (cached.length > 0) {
      return Response.json({ zip, place: location.placeName, alerts: formatAlerts(cached), source: "cache" });
    }

    // Cache miss/stale: pull fresh alerts from NWS by lat/long point
    const nwsRes = await fetch(
      `https://api.weather.gov/alerts/active?point=${location.latitude},${location.longitude}`,
      { headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" } },
    );
    if (!nwsRes.ok) throw new Error(`NWS API returned ${nwsRes.status}`);
    const features: any[] = (await nwsRes.json()).features ?? [];

    // Replace this zip's cached rows with the fresh set
    await db.delete(weatherAlerts).where(eq(weatherAlerts.zipCode, zip));
    const inserted = features.length
      ? await db
          .insert(weatherAlerts)
          .values(features.map(({ properties: p }) => ({
            zipCode: zip,
            nwsId: p.id,
            eventType: p.event,
            severity: p.severity,
            headline: p.headline,
            description: p.description,
            effective: p.effective ? new Date(p.effective) : null,
            expires: p.expires ? new Date(p.expires) : null,
            rawPayload: p,
          })))
          .returning()
      : [];

    return Response.json({ zip, place: location.placeName, alerts: formatAlerts(inserted), source: "live" });
  } catch (err) {
    console.error("GET /api/weather/alerts failed:", err);
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Could not reach the National Weather Service right now." }, { status: 502 });
  }
};

function formatAlerts(rows: (typeof weatherAlerts.$inferSelect)[]) {
  return rows.map((r) => ({
    id: r.nwsId,
    eventType: r.eventType,
    severity: r.severity,
    headline: r.headline,
    description: r.description,
    effective: r.effective,
    expires: r.expires,
  }));
}

export const config: Config = {
  path: "/api/weather/alerts",
};
