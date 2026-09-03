const { Pool } = require('pg');

// Most hosted Postgres providers (Supabase, Railway, Neon, Render) give you
// a single DATABASE_URL connection string. Put it in your .env file.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false } // most hosted providers need this
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres error on idle client', err);
});

module.exports = { pool };
