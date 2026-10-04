process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== STARTING EXACT DEPARTMENTS & PROGRAMS SYNC ===");

  // 1. Clean up legacy program "BS Info Tech" (id: 42 or code: "BS Info Tech")
  const legacyProgs = await prisma.academicProgram.findMany({
    where: { program_code: "BS Info Tech" }
  });

  const mainBsInfoTech = await prisma.academicProgram.findFirst({
    where: { program_code: "BSInfoTech" }
  });

  if (mainBsInfoTech) {
    for (const leg of legacyProgs) {
      console.log(`Re-linking students from legacy program ${leg.program_id} (${leg.program_code}) to ${mainBsInfoTech.program_id}...`);
      await prisma.student.updateMany({
        where: { program_id: leg.program_id },
        data: { program_id: mainBsInfoTech.program_id }
      });
      await prisma.academicProgram.delete({
        where: { program_id: leg.program_id }
      });
      console.log(`Deleted legacy program ${leg.program_id}.`);
    }
  }

  // 2. Department name updates
  // Dept 28: ICT Department
  await prisma.department.update({
    where: { department_id: 28 },
    data: { department_name: "ICT Department" }
  }).catch(() => {});

  // Dept 29: Agriculture Department
  await prisma.department.update({
    where: { department_id: 29 },
    data: { department_name: "Agriculture Department" }
  }).catch(() => {});

  // Dept 30: HTM Department
  await prisma.department.update({
    where: { department_id: 30 },
    data: { department_name: "HTM Department" }
  }).catch(() => {});

  // Dept 31: ITD Department
  await prisma.department.update({
    where: { department_id: 31 },
    data: { department_name: "ITD Department" }
  }).catch(() => {});

  // Dept 32: Teacher Education Department (TED)
  await prisma.department.update({
    where: { department_id: 32 },
    data: { department_name: "Teacher Education Department (TED)" }
  }).catch(() => {});

  // Handle Dept 33 if it exists: move faculty/programs to 31 and delete 33 if empty
  const dept33 = await prisma.department.findUnique({ where: { department_id: 33 } });
  if (dept33) {
    console.log("Migrating Dept 33 to Dept 31 (ITD Department)...");
    await prisma.faculty.updateMany({
      where: { department_id: 33 },
      data: { department_id: 31 }
    });
    await prisma.chair.updateMany({
      where: { department_id: 33 },
      data: { department_id: 31 }
    });
    await prisma.academicProgram.updateMany({
      where: { department_id: 33 },
      data: { department_id: 31 }
    });
    await prisma.department.delete({ where: { department_id: 33 } }).catch(err => console.log("Dept 33 delete note:", err.message));
  }

  // 3. Ensure Academic Programs match exact titles and codes
  const desiredPrograms = [
    { code: "BSA", name: "Bachelor of Science in Agriculture", deptId: 29 },
    { code: "BEED", name: "Bachelor of Elementary Education", deptId: 32 },
    { code: "BSED", name: "Bachelor of Secondary Education", deptId: 32 },
    { code: "BSInfoTech", name: "Bachelor of Science in Information Technology", deptId: 28 },
    { code: "BSIT", name: "Bachelor of Science in Industrial Technology", deptId: 31 },
    { code: "BSHM", name: "Bachelor of Science in Hospitality Management", deptId: 30 },
    { code: "BSTM", name: "Bachelor of Science in Tourism Management", deptId: 30 }
  ];

  for (const p of desiredPrograms) {
    const existing = await prisma.academicProgram.findFirst({
      where: { program_code: p.code }
    });

    if (existing) {
      await prisma.academicProgram.update({
        where: { program_id: existing.program_id },
        data: {
          program_name: p.name,
          department_id: p.deptId
        }
      });
      console.log(`Updated program ${p.code}: "${p.name}" (Dept ${p.deptId})`);
    } else {
      await prisma.academicProgram.create({
        data: {
          program_code: p.code,
          program_name: p.name,
          department_id: p.deptId
        }
      });
      console.log(`Created program ${p.code}: "${p.name}" (Dept ${p.deptId})`);
    }
  }

  console.log("\n=== VERIFYING FINAL DEPARTMENTS & PROGRAMS ===");
  const finalDepts = await prisma.department.findMany({
    include: { academicPrograms: true }
  });
  console.log(JSON.stringify(finalDepts, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
