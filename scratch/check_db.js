process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const students = await prisma.student.findMany({
    include: { program: true }
  });
  console.log("=== STUDENTS PROGRAM COUNTS ===");
  const counts = {};
  students.forEach(s => {
    const key = `${s.program_id}: ${s.program?.program_code} - ${s.program?.program_name}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  console.log(counts);

  const faculty = await prisma.faculty.findMany({
    include: { department: true }
  });
  console.log("=== FACULTY DEPARTMENTS ===");
  faculty.forEach(f => {
    console.log(`Faculty ID: ${f.faculty_id}, Dept: ${f.department_id} (${f.department?.department_name})`);
  });
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
