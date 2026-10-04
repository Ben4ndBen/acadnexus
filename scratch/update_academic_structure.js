const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function updateStructure() {
  console.log("Updating academic department and program structures in database...");

  // 1. Update/Rename Departments
  // Department for InfoTech -> "ICT Department"
  // Department for Industrial -> "IT Department"

  let ictDept = await prisma.department.findFirst({
    where: { OR: [{ department_name: "IT Department" }, { department_name: "ICT Department" }] }
  });
  if (ictDept) {
    await prisma.department.update({
      where: { department_id: ictDept.department_id },
      data: { department_name: "ICT Department" }
    });
    console.log(`Updated ICT Department (ID: ${ictDept.department_id})`);
  }

  let industrialDept = await prisma.department.findFirst({
    where: { OR: [{ department_name: "Industrial Technology Department" }, { department_name: "IT Department" }] }
  });
  if (industrialDept && industrialDept.department_id !== ictDept?.department_id) {
    await prisma.department.update({
      where: { department_id: industrialDept.department_id },
      data: { department_name: "IT Department" }
    });
    console.log(`Updated Industrial IT Department (ID: ${industrialDept.department_id})`);
  }

  // 2. Update Academic Programs
  // BSInfoTech (no space)
  await prisma.academicProgram.updateMany({
    where: {
      OR: [
        { program_code: "BS Info Tech" },
        { program_code: "BSInfo Tech" },
        { program_code: "BSInfoTech" },
        { program_name: { contains: "Information Technology", mode: "insensitive" } }
      ]
    },
    data: {
      program_code: "BSInfoTech",
      program_name: "Bachelor of Science in Information Technology"
    }
  });

  // BEED
  await prisma.academicProgram.updateMany({
    where: {
      OR: [
        { program_code: "BEED" },
        { program_name: { contains: "Elementary", mode: "insensitive" } }
      ]
    },
    data: {
      program_code: "BEED",
      program_name: "Bachelor of Elementary Education"
    }
  });

  // BSED
  await prisma.academicProgram.updateMany({
    where: {
      OR: [
        { program_code: "BSED" },
        { program_name: { contains: "Secondary", mode: "insensitive" } }
      ]
    },
    data: {
      program_code: "BSED",
      program_name: "Bachelor of Secondary Education"
    }
  });

  // BSIT (Industrial)
  await prisma.academicProgram.updateMany({
    where: {
      OR: [
        { program_code: "BSIT" },
        { program_code: "BSINDTECH" },
        { program_name: { contains: "Industrial Technology", mode: "insensitive" } }
      ]
    },
    data: {
      program_code: "BSIT",
      program_name: "Bachelor of Science in Industrial Technology"
    }
  });

  // BSA
  await prisma.academicProgram.updateMany({
    where: {
      OR: [
        { program_code: "BSA" },
        { program_name: { contains: "Agriculture", mode: "insensitive" } }
      ]
    },
    data: {
      program_code: "BSA",
      program_name: "Bachelor of Science in Agriculture"
    }
  });

  // BSHM
  await prisma.academicProgram.updateMany({
    where: {
      OR: [
        { program_code: "BSHM" },
        { program_name: { contains: "Hospitality", mode: "insensitive" } }
      ]
    },
    data: {
      program_code: "BSHM",
      program_name: "Bachelor of Science in Hospitality Management"
    }
  });

  // BSTM
  await prisma.academicProgram.updateMany({
    where: {
      OR: [
        { program_code: "BSTM" },
        { program_name: { contains: "Tourism", mode: "insensitive" } }
      ]
    },
    data: {
      program_code: "BSTM",
      program_name: "Bachelor of Science in Tourism Management"
    }
  });

  console.log("Database update completed! Verifying departments & programs...");
  const depts = await prisma.department.findMany({
    include: { academicPrograms: true }
  });
  console.log(JSON.stringify(depts, null, 2));
}

updateStructure()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
