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
  try {
    const res = await prisma.examination.findUnique({
      where: { exam_id: 99999 },
      include: {
        course: true,
        questionBank: {
          orderBy: { question_id: "asc" },
        },
      },
    });
    console.log("Result for non-existent ID:", res);
  } catch (err) {
    console.error("Query failed with error:", err);
  }
  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
