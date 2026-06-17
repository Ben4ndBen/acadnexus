const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targets = await prisma.examTarget.findMany({ include: { exam: true } });
  console.log(JSON.stringify(targets, null, 2));

  const exams = await prisma.examination.findMany();
  console.log(JSON.stringify(exams, null, 2));

  const students = await prisma.student.findMany();
  console.log(JSON.stringify(students, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
