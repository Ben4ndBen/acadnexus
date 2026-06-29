import "dotenv/config";
import db from "./src/lib/db";

async function main() {
  console.log("=== STUDENTS ===");
  const students = await db.student.findMany({
    include: {
      user: true,
      program: true
    }
  });
  console.log(JSON.stringify(students, null, 2));

  console.log("=== EXAMS ===");
  const exams = await db.examination.findMany({
    include: {
      course: true
    }
  });
  console.log(JSON.stringify(exams, null, 2));

  console.log("=== TARGETS ===");
  const targets = await db.examTarget.findMany({
    include: {
      exam: true,
      program: true
    }
  });
  console.log(JSON.stringify(targets, null, 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
