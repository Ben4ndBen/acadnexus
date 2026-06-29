import "dotenv/config";
import db from "./src/lib/db";

async function main() {
  const student = await db.student.findFirst({
    where: { student_id: 21 } // Janice Delfin
  });

  if (!student) {
    console.error("Student Janice Delfin not found");
    return;
  }

  // Let's schedule the "SQL Examination" (exam_id: 46) for today
  const examId = 46; 
  
  // Clean up any existing targets for this exam to avoid key conflicts or clutter
  await db.examTarget.deleteMany({
    where: { exam_id: examId }
  });

  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })); // Current date in Asia/Manila timezone
  
  // Set scheduled_date to today at midnight UTC
  const scheduledDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  
  // Set start_time to 00:00:00 UTC and end_time to 23:59:59 UTC so it is active all day
  const startTime = new Date("1970-01-01T00:00:00.000Z");
  const endTime = new Date("1970-01-01T23:59:59.000Z");

  const target = await db.examTarget.create({
    data: {
      exam_id: examId,
      program_id: student.program_id,
      year_level: student.year_level,
      section: student.section,
      scheduled_date: scheduledDate,
      start_time: startTime,
      end_time: endTime
    }
  });

  console.log("Successfully scheduled exam!");
  console.log({
    examId,
    title: "SQL Examination",
    targetId: target.target_id,
    programId: target.program_id,
    yearLevel: target.year_level,
    section: target.section,
    scheduledDate: target.scheduled_date.toISOString(),
    startTime: target.start_time.toISOString(),
    endTime: target.end_time.toISOString()
  });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
