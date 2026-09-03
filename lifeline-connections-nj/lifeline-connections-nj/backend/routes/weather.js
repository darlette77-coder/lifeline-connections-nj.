const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { resolveZip, NWS_USER_AGENT } = require('../zipResolver');

const CACHE_TTL_MINUTES = 10;

// GET /api/weather/alerts?zip=07302
router.get('/alerts', async (req, res) => {
  const { zip } = req.query;
  if (!zip || !/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'A valid 5-digit zip code is required.' });
  }

  try {
    const location = await resolveZip(zip);

    // Check cache first
    const cached = await pool.query(
      `SELECT * FROM weather_alerts
       WHERE zip_code = $1 AND fetched_at > NOW() - INTERVAL '${CACHE_TTL_MINUTES} minutes'
       ORDER BY effective DESC`,
      [zip]
    );
    if (cached.rows.length > 0) {
      return res.json({ zip, place: location.place_name, alerts: formatAlerts(cached.rows), source: 'cache' });
    }

    // Cache miss/stale: pull fresh alerts from NWS by lat/long point
    const nwsRes = await fetch(
      `https://api.weather.gov/alerts/active?point=${location.latitude},${location.longitude}`,
      { headers: { 'User-Agent': NWS_USER_AGENT, 'Accept': 'application/geo+json' } }
    );

    if (!nwsRes.ok) {
      throw new Error(`NWS API returned ${nwsRes.status}`);
    }
    const nwsData = await nwsRes.json();
    const features = nwsData.features || [];

    // Replace this zip's cached rows with the fresh set
    await pool.query('DELETE FROM weather_alerts WHERE zip_code = $1', [zip]);

    const inserted = [];
    for (const feature of features) {
      const p = feature.properties;
      const row = await pool.query(
        `INSERT INTO weather_alerts
          (zip_code, nws_id, event_type, severity, headline, description, effective, expires, raw_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [zip, p.id, p.event, p.severity, p.headline, p.description, p.effective, p.expires, JSON.stringify(p)]
      );
      inserted.push(row.rows[0]);
    }

    res.json({ zip, place: location.place_name, alerts: formatAlerts(inserted), source: 'live' });
  } catch (err) {
    console.error('GET /api/weather/alerts failed:', err);
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    res.status(502).json({ error: 'Could not reach the National Weather Service right now.' });
  }
});

function formatAlerts(rows) {
  return rows.map(r => ({
    id: r.nws_id,
    eventType: r.event_type,
    severity: r.severity,
    headline: r.headline,
    description: r.description,
    effective: r.effective,
    expires: r.expires
  }));
}

module.exports = router;
