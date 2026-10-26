import { getDatabase } from "@netlify/database";

// api.weather.gov requires a descriptive User-Agent identifying the app and a contact.
export const NWS_USER_AGENT = "LifelineConnectionsNJ (contact@lifelineconnectionsnj.com)";

export const isValidZip = (zip) => typeof zip === "string" && /^\d{5}$/.test(zip);

/**
 * Resolve a US zip code to its place name, lat/long and NWS grid, using the
 * zip_code_mappings cache first and falling back to Zippopotam + NWS.
 */
export async function resolveZip(zip) {
  const db = getDatabase();
  const [cached] = await db.sql`SELECT * FROM zip_code_mappings WHERE zip_code = ${zip}`;
  if (cached) return cached;

  const geoRes = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!geoRes.ok) {
    const err = new Error(`Unknown or invalid zip code: ${zip}`);
    err.status = 404;
    throw err;
  }
  const geo = await geoRes.json();
  const place = geo.places && geo.places[0];
  if (!place) {
    const err = new Error(`No location data for zip code: ${zip}`);
    err.status = 404;
    throw err;
  }
  const latitude = parseFloat(place.latitude);
  const longitude = parseFloat(place.longitude);
  const placeName = place["place name"];
  const state = place["state abbreviation"];

  // lat/long -> NWS grid is best-effort; alerts work by point regardless
  let gridId = null, gridX = null, gridY = null;
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, {
      headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
    });
    if (pointRes.ok) {
      const point = await pointRes.json();
      gridId = point.properties.gridId;
      gridX = point.properties.gridX;
      gridY = point.properties.gridY;
    }
  } catch (e) {
    console.warn("NWS grid lookup failed for", zip, e.message);
  }

  const [row] = await db.sql`
    INSERT INTO zip_code_mappings
      (zip_code, place_name, state, latitude, longitude, nws_grid_id, nws_grid_x, nws_grid_y)
    VALUES (${zip}, ${placeName}, ${state}, ${latitude}, ${longitude}, ${gridId}, ${gridX}, ${gridY})
    ON CONFLICT (zip_code) DO UPDATE SET
      latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
      nws_grid_id = EXCLUDED.nws_grid_id, nws_grid_x = EXCLUDED.nws_grid_x, nws_grid_y = EXCLUDED.nws_grid_y
    RETURNING *`;
  return row;
}
