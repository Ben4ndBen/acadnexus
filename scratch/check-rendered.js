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
  // 1. Fetch student
  const student = await prisma.student.findFirst({
    where: { first_name: "Janice", last_name: "Delfin" }
  });
  if (!student) {
    console.error("Student Janice Delfin not found.");
    return;
  }
  console.log("Student details:", {
    student_id: student.student_id,
    program_id: student.program_id,
    year_level: student.year_level,
    section: student.section,
  });

  // 2. Fetch completed exams
  const completedExams = await prisma.studentExam.findMany({
    where: { student_id: student.student_id }
  });
  const completedExamIds = new Set(completedExams.map(se => se.exam_id));
  console.log("Completed Exam IDs:", Array.from(completedExamIds));

  // 3. Fetch targets
  const targets = await prisma.examTarget.findMany({
    where: {
      program_id: student.program_id,
      year_level: student.year_level,
      section: student.section,
      exam: {
        current_status: "Approved",
      },
    },
    include: {
      exam: true
    }
  });
  console.log("Targets found:", targets.length);

  const activeExams = [];
  const upcomingExams = [];

  const now = new Date();
  console.log("Current time used in JS:", now.toISOString());
  console.log("Current local hours:", now.getHours(), "minutes:", now.getMinutes());
  const currentMin = now.getHours() * 60 + now.getMinutes();

  targets.forEach(t => {
    console.log(`Analyzing target for exam: "${t.exam.title}" (ID: ${t.exam_id})`);
    if (completedExamIds.has(t.exam_id)) {
      console.log(`-> Skipped: Exam ID ${t.exam_id} is in completedExamIds.`);
      return;
    }

    const scheduledDate = new Date(t.scheduled_date);
    const schedYear = scheduledDate.getUTCFullYear();
    const schedMonth = scheduledDate.getUTCMonth();
    const schedDateVal = scheduledDate.getUTCDate();

    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDateVal = now.getDate();

    const isToday = schedYear === nowYear && schedMonth === nowMonth && schedDateVal === nowDateVal;
    
    const isFuture = 
      schedYear > nowYear ||
      (schedYear === nowYear && schedMonth > nowMonth) ||
      (schedYear === nowYear && schedMonth === nowMonth && schedDateVal > nowDateVal);

    console.log(`-> scheduledDate: ${scheduledDate.toISOString()} (UTC: ${schedYear}-${schedMonth+1}-${schedDateVal})`);
    console.log(`-> isToday: ${isToday}, isFuture: ${isFuture}`);

    if (isToday) {
      const start = new Date(t.start_time);
      const end = new Date(t.end_time);

      const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
      const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
      console.log(`-> time window: startMin=${startMin} (${start.getUTCHours()}:${start.getUTCMinutes()}), endMin=${endMin} (${end.getUTCHours()}:${end.getUTCMinutes()})`);
      console.log(`-> currentMin: ${currentMin}`);

      if (currentMin >= startMin && currentMin <= endMin) {
        console.log("-> MATCHED AS ACTIVE");
        activeExams.push(t.exam.title);
      } else if (currentMin < startMin) {
        console.log("-> MATCHED AS UPCOMING");
        upcomingExams.push(t.exam.title);
      } else {
        console.log("-> MISSED (ended today)");
      }
    } else if (isFuture) {
      console.log("-> MATCHED AS UPCOMING (future date)");
      upcomingExams.push(t.exam.title);
    } else {
      console.log("-> MISSED (past date)");
    }
  });

  console.log("Active Exams:", activeExams);
  console.log("Upcoming Exams:", upcomingExams);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
