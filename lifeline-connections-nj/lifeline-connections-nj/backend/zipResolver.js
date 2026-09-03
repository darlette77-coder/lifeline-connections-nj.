const { pool } = require('./db');

// api.weather.gov requires a descriptive User-Agent identifying the app and
// a contact. Replace the email with a real inbox you monitor.
const NWS_USER_AGENT = 'LifelineConnectionsNJ (contact@lifelineconnectionsnj.com)';

/**
 * Resolve a US zip code to { latitude, longitude, placeName, state, county,
 * nwsGridId, nwsGridX, nwsGridY }, using the local cache first and falling
 * back to free public APIs (Zippopotam for geocoding, NWS for the grid).
 */
async function resolveZip(zipCode) {
  const cached = await pool.query(
    'SELECT * FROM zip_code_mappings WHERE zip_code = $1',
    [zipCode]
  );
  if (cached.rows.length > 0) {
    return cached.rows[0];
  }

  // 1. Zip -> lat/long via Zippopotam (free, no API key, US zip codes)
  const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
  if (!geoRes.ok) {
    const err = new Error(`Unknown or invalid zip code: ${zipCode}`);
    err.status = 404;
    throw err;
  }
  const geo = await geoRes.json();
  const place = geo.places && geo.places[0];
  if (!place) {
    const err = new Error(`No location data for zip code: ${zipCode}`);
    err.status = 404;
    throw err;
  }
  const latitude = parseFloat(place.latitude);
  const longitude = parseFloat(place.longitude);
  const placeName = place['place name'];
  const state = place['state abbreviation'];

  // 2. lat/long -> NWS grid (needed for forecast endpoints; alerts can also
  //    be queried directly by point, see weather.js)
  let nwsGridId = null, nwsGridX = null, nwsGridY = null;
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, {
      headers: { 'User-Agent': NWS_USER_AGENT, 'Accept': 'application/geo+json' }
    });
    if (pointRes.ok) {
      const point = await pointRes.json();
      nwsGridId = point.properties.gridId;
      nwsGridX = point.properties.gridX;
      nwsGridY = point.properties.gridY;
    }
  } catch (e) {
    // NWS grid lookup is best-effort — alerts still work via lat/long directly
    console.warn('NWS grid lookup failed for', zipCode, e.message);
  }

  const insert = await pool.query(
    `INSERT INTO zip_code_mappings
      (zip_code, county, place_name, state, latitude, longitude, nws_grid_id, nws_grid_x, nws_grid_y)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (zip_code) DO UPDATE SET
       latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
       nws_grid_id = EXCLUDED.nws_grid_id, nws_grid_x = EXCLUDED.nws_grid_x, nws_grid_y = EXCLUDED.nws_grid_y
     RETURNING *`,
    [zipCode, place['state abbreviation'] || null, placeName, state, latitude, longitude, nwsGridId, nwsGridX, nwsGridY]
  );

  return insert.rows[0];
}

module.exports = { resolveZip, NWS_USER_AGENT };
