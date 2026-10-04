require('dotenv').config();
const { Pool } = require('pg');

async function inspectAll() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("=== USERS & ROLES ===");
  const users = await pool.query(`
    SELECT u.user_id, u.institutional_id, u.role, s.first_name, s.last_name, s.year_level, p.program_code
    FROM "USERS" u
    LEFT JOIN "STUDENTS" s ON u.user_id = s.student_id
    LEFT JOIN "ACADEMIC_PROGRAMS" p ON s.program_id = p.program_id
    ORDER BY u.role, u.user_id
  `);
  console.log(`Total users: ${users.rowCount}`);
  const rolesCount = {};
  users.rows.forEach(r => {
    rolesCount[r.role] = (rolesCount[r.role] || 0) + 1;
  });
  console.log("Roles breakdown:", rolesCount);

  console.log("\n=== STUDENTS NOT IN STUDENTS_DATA.JSON ===");
  const jsonStudents = require('./students_data.json');
  const jsonIds = new Set(jsonStudents.map(s => s.id.trim().toUpperCase()));
  const dbStudents = users.rows.filter(r => r.role === 'Student');
  const oldStudents = dbStudents.filter(s => !jsonIds.has(s.institutional_id));
  console.log(`Students in DB not in JSON (${oldStudents.length}):`, oldStudents);

  console.log("\n=== ALL COURSES IN DB ===");
  const courses = await pool.query('SELECT course_id, course_code, course_title FROM "COURSES" ORDER BY course_code');
  console.log(`Total courses in DB: ${courses.rowCount}`);
  console.log("Sample courses:", courses.rows.slice(0, 15));

  await pool.end();
}

inspectAll().catch(console.error);
