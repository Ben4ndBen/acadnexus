const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const students = await db.student.findMany({
    include: { user: true, program: true }
  });
  console.log(JSON.stringify(students.map(s => ({
    id: s.student_id,
    inst_id: s.user.institutional_id,
    name: `${s.first_name} ${s.last_name}`,
    program: s.program.program_code,
    year: s.year_level,
    section: s.section
  })), null, 2));
}

main();
