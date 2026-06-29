const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    where: { role: 'Student' },
    include: { student: true }
  });
  
  for (const u of users) {
    if (!u.student) continue;
    const s = u.student;
    const targets = await db.examTarget.findMany({
      where: {
        program_id: s.program_id,
        year_level: s.year_level,
        section: s.section,
        exam: { current_status: "Approved" }
      },
      include: { exam: true }
    });
    console.log(`Student ${s.first_name} ${s.last_name} (${u.institutional_id}) - program: ${s.program_id}, year: ${s.year_level}, section: ${s.section}`);
    console.log(`Targets: ${targets.length}`);
    targets.forEach((t: any) => console.log(`  - ${t.exam.title}`));
  }
}

main();
