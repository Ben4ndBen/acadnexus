process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const departments = await prisma.department.findMany();
  console.log("Departments:", departments);

  const chairs = await prisma.chair.findMany({
    include: {
      user: true,
      department: true,
    }
  });
  console.log("Chairs:");
  chairs.forEach(c => {
    console.log({
      chair_id: c.chair_id,
      institutional_id: c.user.institutional_id,
      department_id: c.department_id,
      department_name: c.department.department_name,
    });
  });

  const faculty = await prisma.faculty.findMany({
    include: {
      user: true,
      department: true,
    }
  });
  console.log("Faculty:");
  faculty.forEach(f => {
    console.log({
      faculty_id: f.faculty_id,
      institutional_id: f.user.institutional_id,
      first_name: f.first_name,
      last_name: f.last_name,
      department_id: f.department_id,
      department_name: f.department.department_name,
    });
  });

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
