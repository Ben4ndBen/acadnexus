require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log("Using DB connection string:", connectionString ? "Found connection string" : "None");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log("Connected to database successfully!");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS "STUDENT_COURSES" (
        "student_id" INTEGER NOT NULL,
        "course_id" INTEGER NOT NULL,
        "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "STUDENT_COURSES_pkey" PRIMARY KEY ("student_id", "course_id"),
        CONSTRAINT "STUDENT_COURSES_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "STUDENTS" ("student_id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "STUDENT_COURSES_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "COURSES" ("course_id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log("STUDENT_COURSES table created successfully!");
    client.release();
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
