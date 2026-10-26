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
    const resources = await db.sql`
      SELECT id, organization_name, nims_category, nims_type, zip_code, address,
             latitude, longitude, phone_number, operating_hours
      FROM resources
      WHERE zip_code = ${zip} AND is_active = TRUE
        AND (${category}::text IS NULL OR nims_category = ${category})
        AND (${type}::int IS NULL OR nims_type = ${type})
      ORDER BY nims_type ASC, organization_name ASC`;

    // place name is a nice-to-have; never fail the search over it
    const place = await resolveZip(zip).then((l) => l.place_name, () => null);

    // search log is best-effort; never fail the search over it
    try {
      await db.sql`INSERT INTO search_log (zip_code) VALUES (${zip})`;
    } catch (e) {
      console.warn("search_log insert failed:", e.message);
    }

    return Response.json({ zip, place, count: resources.length, resources });
  } catch (err) {
    console.error("GET /api/resources failed:", err);
    return Response.json({ error: "Could not load resources right now." }, { status: 500 });
  }
};

export const config = { path: "/api/resources" };
