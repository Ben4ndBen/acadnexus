process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config();
const { Pool } = require('pg');

const urls = [
  { name: 'aws-0 pooler 6543', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" },
  { name: 'aws-0 pooler 5432', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" },
  { name: 'aws-1 pooler 5432', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" },
  { name: 'aws-1 pooler 6543', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" },
  { name: 'db.kdbahmqvvkmcfytmuhsb.supabase.co:5432', url: "postgresql://postgres:tweXONUBT5iV1n1n@db.kdbahmqvvkmcfytmuhsb.supabase.co:5432/postgres" }
];

async function testOne(item) {
  console.log(`\n=== Testing: ${item.name} ===`);
  const pool = new Pool({
    connectionString: item.url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT current_database(), current_user, version()');
    console.log(`SUCCESS [${item.name}]:`, res.rows[0].current_database, res.rows[0].current_user);
    client.release();
  } catch (err) {
    console.error(`FAILED [${item.name}]:`, err.code, err.message);
  } finally {
    await pool.end();
  }
}

async function run() {
  for (const item of urls) {
    await testOne(item);
  }
}

run();
