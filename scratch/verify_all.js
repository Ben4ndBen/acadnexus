const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function verifyAll() {
  console.log("=== ACADNEXUS STUDENT VERIFICATION REPORT ===");

  const totalUsers = await prisma.user.count({ where: { role: "Student" } });
  const totalStudents = await prisma.student.count();

  console.log(`1. Total Student User Accounts: ${totalUsers}`);
  console.log(`2. Total Student Profile Records: ${totalStudents}`);

  const studentsWithMiddleName = await prisma.student.count({
    where: {
      AND: [
        { middle_name: { not: null } },
        { middle_name: { not: "" } },
        { middle_name: { not: "NONE" } },
        { middle_name: { not: "None" } }
      ]
    }
  });

  console.log(`3. Students with Middle Name registered: ${studentsWithMiddleName}`);

  // Fetch sample students showing middle name & middle initial formatting
  const sample = await prisma.student.findMany({
    take: 10,
    include: { user: true, program: true },
    orderBy: { last_name: "asc" }
  });

  console.log("\nSample Student Roster Entries:");
  sample.forEach(s => {
    const mi = s.middle_name && s.middle_name.trim().toUpperCase() !== "NONE" ? `${s.middle_name.trim().charAt(0).toUpperCase()}.` : "";
    const formattedLastFirst = mi ? `${s.last_name}, ${s.first_name} ${mi}` : `${s.last_name}, ${s.first_name}`;
    console.log(` - ID: ${s.user.institutional_id} | Name: ${formattedLastFirst.padEnd(35)} | Program: ${s.program.program_code} | Year: ${s.year_level}`);
  });

  console.log("\nVerification complete!");
}

verifyAll()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
