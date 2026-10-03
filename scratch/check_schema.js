require('dotenv').config();
const { Pool } = require('pg');

async function check() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const colsUsers = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'USERS';
  `);
  console.log('USERS columns:', colsUsers.rows);

  const colsStudents = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'STUDENTS';
  `);
  console.log('STUDENTS columns:', colsStudents.rows);

  const programs = await pool.query(`SELECT * FROM "ACADEMIC_PROGRAMS";`);
  console.log('ACADEMIC_PROGRAMS:', programs.rows);

  const existingStudents = await pool.query(`
    SELECT u.institutional_id, s.first_name, s.last_name, s.year_level, s.section, p.program_code
    FROM "USERS" u
    JOIN "STUDENTS" s ON u.user_id = s.student_id
    JOIN "ACADEMIC_PROGRAMS" p ON s.program_id = p.program_id
    LIMIT 5;
  `);
  console.log('Existing students sample:', existingStudents.rows);

  await pool.end();
}

check().catch(console.error);
