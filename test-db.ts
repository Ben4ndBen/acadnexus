import "dotenv/config";
import db from "./src/lib/db";

async function main() {
  const students = await db.student.findMany({ include: { program: true } });
  console.log("Students:");
  console.log(JSON.stringify(students, null, 2));

  const targets = await db.examTarget.findMany({ include: { exam: true } });
  console.log("\nExam Targets:");
  console.log(JSON.stringify(targets, null, 2));

  const exams = await db.examination.findMany();
  console.log("\nExams:");
  console.log(JSON.stringify(exams, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
