import type { Config, Context } from "@netlify/functions";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { resources, searchLog } from "../../db/schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });

  // GET /api/resources/:id
  const { id } = context.params;
  if (id) {
    if (!UUID_RE.test(id)) return Response.json({ error: "Resource not found." }, { status: 404 });
    try {
      const [row] = await db.select().from(resources).where(eq(resources.id, id));
      if (!row) return Response.json({ error: "Resource not found." }, { status: 404 });
      return Response.json(toApi(row));
    } catch (err) {
      console.error("GET /api/resources/:id failed:", err);
      return Response.json({ error: "Could not load this resource right now." }, { status: 500 });
    }
  }

  // GET /api/resources?zip=07302&category=Emergency+Housing&type=1
  const params = new URL(req.url).searchParams;
  const zip = params.get("zip") ?? "";
  const category = params.get("category");
  const type = params.get("type");

  if (!/^\d{5}$/.test(zip)) {
    return Response.json({ error: "A valid 5-digit zip code is required." }, { status: 400 });
  }

  const conditions = [eq(resources.zipCode, zip), eq(resources.isActive, true)];
  if (category) conditions.push(eq(resources.nimsCategory, category));
  if (type && /^\d+$/.test(type)) conditions.push(eq(resources.nimsType, parseInt(type, 10)));

  try {
    const rows = await db
      .select()
      .from(resources)
      .where(and(...conditions))
      .orderBy(asc(resources.nimsType), asc(resources.organizationName));

    // search log never blocks or fails the response
    context.waitUntil(db.insert(searchLog).values({ zipCode: zip }).then(() => {}, () => {}));

    return Response.json({ zip, count: rows.length, resources: rows.map(toApi) });
  } catch (err) {
    console.error("GET /api/resources failed:", err);
    return Response.json({ error: "Could not load resources right now." }, { status: 500 });
  }
};

// Keep the snake_case response shape the frontend expects
function toApi(r: typeof resources.$inferSelect) {
  return {
    id: r.id,
    organization_name: r.organizationName,
    nims_category: r.nimsCategory,
    nims_type: r.nimsType,
    zip_code: r.zipCode,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    phone_number: r.phoneNumber,
    operating_hours: r.operatingHours,
  };
}

export const config: Config = {
  path: ["/api/resources", "/api/resources/:id"],
};
