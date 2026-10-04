require('dotenv').config();
const { Pool } = require('pg');

async function inspect() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("--- ACADEMIC PROGRAMS ---");
  const progs = await pool.query('SELECT * FROM "ACADEMIC_PROGRAMS" ORDER BY program_id');
  console.log(progs.rows);

  console.log("\n--- COURSES ---");
  const courses = await pool.query('SELECT * FROM "COURSES" ORDER BY course_id');
  console.log(courses.rows);

  console.log("\n--- STUDENT COURSES (Enrolled Subjects Count) ---");
  const sc = await pool.query('SELECT count(*) FROM "STUDENT_COURSES"');
  console.log("Total enrolled student courses:", sc.rows[0].count);

  console.log("\n--- FACULTY COURSES ---");
  const fc = await pool.query('SELECT * FROM "FACULTY_COURSES"');
  console.log(fc.rows);

  await pool.end();
}

inspect().catch(console.error);
