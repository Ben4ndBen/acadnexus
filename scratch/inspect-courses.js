require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT course_id, course_code, course_title FROM "COURSES" ORDER BY course_code;');
    console.log(res.rows.map(r => `${r.course_id}: ${r.course_code} - ${r.course_title}`));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
