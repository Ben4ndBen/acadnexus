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
  const student = await prisma.student.findFirst({
    where: { first_name: "Janice", last_name: "Delfin" }
  });
  if (!student) {
    console.error("Student Janice Delfin not found.");
    return;
  }
  
  console.log("Found student ID:", student.student_id);

  // Delete all answers associated with the student's exams
  const studentExams = await prisma.studentExam.findMany({
    where: { student_id: student.student_id }
  });

  const studentExamIds = studentExams.map(se => se.student_exam_id);
  console.log("Deleting answers for student exam IDs:", studentExamIds);
  if (studentExamIds.length > 0) {
    await prisma.studentAnswer.deleteMany({
      where: {
        student_exam_id: { in: studentExamIds }
      }
    });
  }

  // Delete all exam attempts for the student
  console.log("Deleting student exam attempts...");
  const deleteResult = await prisma.studentExam.deleteMany({
    where: { student_id: student.student_id }
  });
  console.log("Deleted exam attempts count:", deleteResult.count);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
