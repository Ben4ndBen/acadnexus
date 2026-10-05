require('dotenv').config();
const { Pool } = require('pg');

async function updateDb() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("Adding middle_name column to STUDENTS table if not exists...");
  await pool.query('ALTER TABLE "STUDENTS" ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);');
  console.log("Column added successfully!");

  await pool.end();
}

updateDb().catch(console.error);
