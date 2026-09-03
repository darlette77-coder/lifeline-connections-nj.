const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/resources?zip=07302&category=Emergency+Housing&type=1
router.get('/', async (req, res) => {
  const { zip, category, type } = req.query;

  if (!zip || !/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'A valid 5-digit zip code is required.' });
  }

  const conditions = ['zip_code = $1', 'is_active = TRUE'];
  const params = [zip];

  if (category) {
    params.push(category);
    conditions.push(`nims_category = $${params.length}`);
  }
  if (type) {
    params.push(parseInt(type, 10));
    conditions.push(`nims_type = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT id, organization_name, nims_category, nims_type, zip_code, address,
              latitude, longitude, phone_number, operating_hours
       FROM resources
       WHERE ${conditions.join(' AND ')}
       ORDER BY nims_type ASC, organization_name ASC`,
      params
    );

    // fire-and-forget search log, never blocks the response
    pool.query('INSERT INTO search_log (zip_code) VALUES ($1)', [zip]).catch(() => {});

    res.json({ zip, count: result.rows.length, resources: result.rows });
  } catch (err) {
    console.error('GET /api/resources failed:', err);
    res.status(500).json({ error: 'Could not load resources right now.' });
  }
});

// GET /api/resources/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resources WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/resources/:id failed:', err);
    res.status(500).json({ error: 'Could not load this resource right now.' });
  }
});

// POST /api/resources  (admin — add auth middleware before going live)
router.post('/', async (req, res) => {
  const { organization_name, nims_category, nims_type, zip_code, address,
          latitude, longitude, phone_number, operating_hours } = req.body;

  if (!organization_name || !nims_category || !nims_type || !zip_code || !address) {
    return res.status(400).json({ error: 'organization_name, nims_category, nims_type, zip_code, and address are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO resources
        (organization_name, nims_category, nims_type, zip_code, address, latitude, longitude, phone_number, operating_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [organization_name, nims_category, nims_type, zip_code, address,
       latitude || null, longitude || null, phone_number || null, operating_hours || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/resources failed:', err);
    res.status(500).json({ error: 'Could not save this resource.' });
  }
});

module.exports = router;
