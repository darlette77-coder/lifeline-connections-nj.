import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { zipCodeMappings } from "../../db/schema.js";

// api.weather.gov requires a descriptive User-Agent identifying the app and
// a contact. Replace the email with a real inbox you monitor.
export const NWS_USER_AGENT = "LifelineConnectionsNJ (contact@lifelineconnectionsnj.com)";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Resolve a US zip code to lat/long, place name and NWS grid, using the
 * database cache first and falling back to Zippopotam + NWS.
 */
export async function resolveZip(zipCode: string) {
  const [cached] = await db.select().from(zipCodeMappings).where(eq(zipCodeMappings.zipCode, zipCode));
  if (cached) return cached;

  // 1. Zip -> lat/long via Zippopotam (free, no API key, US zip codes)
  const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
  if (!geoRes.ok) throw new HttpError(404, `Unknown or invalid zip code: ${zipCode}`);
  const geo = await geoRes.json();
  const place = geo.places?.[0];
  if (!place) throw new HttpError(404, `No location data for zip code: ${zipCode}`);

  const latitude = parseFloat(place.latitude);
  const longitude = parseFloat(place.longitude);

  // 2. lat/long -> NWS grid (best-effort; alerts work via lat/long directly)
  let nwsGridId: string | null = null, nwsGridX: number | null = null, nwsGridY: number | null = null;
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, {
      headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
    });
    if (pointRes.ok) {
      const point = await pointRes.json();
      ({ gridId: nwsGridId, gridX: nwsGridX, gridY: nwsGridY } = point.properties);
    }
  } catch (e) {
    console.warn("NWS grid lookup failed for", zipCode, (e as Error).message);
  }

  const values = {
    zipCode,
    placeName: place["place name"],
    state: place["state abbreviation"],
    latitude: String(latitude),
    longitude: String(longitude),
    nwsGridId,
    nwsGridX,
    nwsGridY,
  };
  const [row] = await db
    .insert(zipCodeMappings)
    .values(values)
    .onConflictDoUpdate({ target: zipCodeMappings.zipCode, set: values })
    .returning();
  return row;
}
