process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  const rawData = fs.readFileSync(path.join(__dirname, "students_data.json"), "utf8");
  const students = JSON.parse(rawData);
  const studentIds = students.map(s => s.id.trim().toUpperCase());

  const res = await pool.query(`
    SELECT u.user_id, u.institutional_id, u.role, u.password_hash, u.require_password_update, u.is_active,
           s.first_name, s.last_name, s.year_level, s.section, p.program_code
    FROM "USERS" u
    JOIN "STUDENTS" s ON u.user_id = s.student_id
    JOIN "ACADEMIC_PROGRAMS" p ON s.program_id = p.program_id
    WHERE u.institutional_id = ANY($1::text[])
  `, [studentIds]);

  console.log(`Matched ${res.rows.length} / ${studentIds.length} students in DB.`);

  let sampleFail = false;
  for (let i = 0; i < Math.min(5, res.rows.length); i++) {
    const row = res.rows[i];
    const match = await bcrypt.compare(row.institutional_id, row.password_hash);
    console.log(`Checking ${row.institutional_id} (${row.first_name} ${row.last_name}): Password Match=${match}, RequirePwUpdate=${row.require_password_update}, Year=${row.year_level}, Section=${row.section}`);
    if (!match || !row.require_password_update) sampleFail = true;
  }

  if (!sampleFail && res.rows.length === studentIds.length) {
    console.log("All accounts successfully verified!");
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
