import { getDatabase } from "@netlify/database";
import { isValidZip, resolveZip } from "./lib/zip-resolver.js";

// GET /api/resources?zip=07302&category=Emergency+Housing&type=1
export default async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const params = new URL(req.url).searchParams;
  const zip = params.get("zip");
  const category = params.get("category");
  const type = params.get("type") ? parseInt(params.get("type"), 10) : null;

  if (!isValidZip(zip)) {
    return Response.json({ error: "A valid 5-digit zip code is required." }, { status: 400 });
  }

  const db = getDatabase();
  try {
    // town/county are nice-to-have; never fail the search over them
    const location = await resolveZip(zip).catch(() => null);
    const county = location?.county ?? null;

    // resources for this zip, plus anything covering its county or all of NJ
    const resources = await db.sql`
      SELECT id, organization_name, nims_category, nims_type, service_area, county, zip_code,
             address, latitude, longitude, phone_number, operating_hours
      FROM resources
      WHERE is_active = TRUE
        AND (zip_code = ${zip}
             OR (service_area = 'county' AND county = ${county})
             OR service_area = 'statewide')
        AND (${category}::text IS NULL OR nims_category = ${category})
        AND (${type}::int IS NULL OR nims_type = ${type})
      ORDER BY CASE WHEN zip_code = ${zip} THEN 0 WHEN service_area = 'county' THEN 1 ELSE 2 END,
               nims_type ASC, organization_name ASC`;
    const place = location?.place_name ?? null;

    // search log is best-effort; never fail the search over it
    try {
      await db.sql`INSERT INTO search_log (zip_code) VALUES (${zip})`;
    } catch (e) {
      console.warn("search_log insert failed:", e.message);
    }

    return Response.json({ zip, place, county, count: resources.length, resources });
  } catch (err) {
    console.error("GET /api/resources failed:", err);
    return Response.json({ error: "Could not load resources right now." }, { status: 500 });
  }
};

export const config = { path: "/api/resources" };
