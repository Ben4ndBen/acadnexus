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
  const exams = await prisma.examination.findMany({
    include: {
      approvalWorkflow: true,
      faculty: true,
    }
  });
  console.log("Examinations:");
  exams.forEach(e => {
    console.log({
      exam_id: e.exam_id,
      title: e.title,
      current_status: e.current_status,
      faculty_id: e.faculty_id,
      faculty_name: `${e.faculty.first_name} ${e.faculty.last_name}`,
      workflow: e.approvalWorkflow ? {
        workflow_id: e.approvalWorkflow.workflow_id,
        chair_status: e.approvalWorkflow.chair_review_status,
        di_status: e.approvalWorkflow.di_review_status,
      } : null
    });
  });
  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
