// Runs sql/schema.sql against the database at DATABASE_URL.
// Usage: npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function migrate() {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('Running schema.sql against', process.env.DATABASE_URL ? 'DATABASE_URL' : '(no DATABASE_URL set!)');
  try {
    await pool.query(sql);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
