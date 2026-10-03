const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const programs = await prisma.academicProgram.findMany();
  console.log('Programs:', JSON.stringify(programs, null, 2));

  const sampleStudent = await prisma.student.findFirst({
    include: { user: true }
  });
  console.log('Sample student:', JSON.stringify(sampleStudent, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
