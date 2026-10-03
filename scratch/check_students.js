require('dotenv').config();
const { Pool } = require('pg');

async function check() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const allStudents = await pool.query(`
    SELECT u.user_id, u.institutional_id, u.require_password_update, s.first_name, s.last_name, s.year_level, s.section, p.program_code
    FROM "USERS" u
    JOIN "STUDENTS" s ON u.user_id = s.student_id
    JOIN "ACADEMIC_PROGRAMS" p ON s.program_id = p.program_id
    ORDER BY u.institutional_id;
  `);
  console.log('Total students in DB:', allStudents.rowCount);
  console.log(allStudents.rows);

  await pool.end();
}

check().catch(console.error);
