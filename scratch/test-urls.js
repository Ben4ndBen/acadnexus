require('dotenv').config();
const { Pool } = require('pg');

const urls = [
  { name: '.env DATABASE_URL (Port 6543 pooler)', url: process.env.DATABASE_URL },
  { name: '.env DIRECT_URL (Port 5432 pooler)', url: process.env.DIRECT_URL },
  { name: 'Direct Host db.ref.supabase.co:5432', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@db.kdbahmqvvkmcfytmuhsb.supabase.co:5432/postgres" },
  { name: 'aws-0 pooler port 6543', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" },
  { name: 'aws-0 pooler port 5432', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" },
  { name: 'aws-1 pooler port 5432 with sslmode=require', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require" },
  { name: 'aws-1 pooler port 6543 with sslmode=require', url: "postgresql://postgres.kdbahmqvvkmcfytmuhsb:tweXONUBT5iV1n1n@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require" },
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
    console.log(`RESULT SUCCESS [${item.name}]:`, res.rows[0].current_database, res.rows[0].current_user);
    client.release();
  } catch (err) {
    console.error(`RESULT FAILED [${item.name}]:`, err.code, err.message);
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
