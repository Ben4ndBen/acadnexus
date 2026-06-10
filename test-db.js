const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  console.log("Connected to the database successfully!");
  
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log("Tables in 'public' schema:");
  console.log(res.rows.map(r => r.table_name));
  
  await client.end();
}

main().catch(err => {
  console.error("Database connection error:", err);
  process.exit(1);
});
