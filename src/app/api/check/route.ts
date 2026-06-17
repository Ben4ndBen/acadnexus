import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const students = await db.student.findMany({
    include: {
      user: true,
      program: true
    }
  });

  const studentTargets = [];

  for (const s of students) {
    const targets = await db.examTarget.findMany({
      where: {
        program_id: s.program_id,
        year_level: s.year_level,
        section: s.section,
        exam: { current_status: "Approved" }
      },
      include: { exam: true }
    });
    studentTargets.push({
      institutional_id: s.user.institutional_id,
      name: `${s.first_name} ${s.last_name}`,
      program: s.program.program_code,
      year: s.year_level,
      section: s.section,
      targetCount: targets.length,
      targets: targets.map(t => t.exam.title)
    });
  }

  return NextResponse.json({ studentTargets });
}
