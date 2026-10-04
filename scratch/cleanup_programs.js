const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function titleCaseProgramName(name) {
  if (!name) return "";
  const minorWords = new Set(["of", "in", "and", "for", "to", "a", "an", "the"]);
  const words = name.trim().split(/\s+/);
  return words
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && minorWords.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

async function main() {
  console.log("--- Academic Programs & Program Codes Cleanup ---");

  // 1. Fetch all academic programs
  const programs = await prisma.academicProgram.findMany();
  console.log("Current programs in DB:", programs);

  // Find canonical BSInfoTech program
  let bsitCanonical = programs.find((p) => p.program_code === "BSInfoTech");
  if (!bsitCanonical) {
    // Check if there is one with department
    const ictDept = await prisma.department.findFirst({
      where: {
        OR: [
          { department_name: { contains: "ICT", mode: "insensitive" } },
          { department_name: { contains: "Information", mode: "insensitive" } },
        ],
      },
    });

    const deptId = ictDept ? ictDept.department_id : 1;

    bsitCanonical = await prisma.academicProgram.create({
      data: {
        program_code: "BSInfoTech",
        program_name: "Bachelor of Science in Information Technology",
        department_id: deptId,
      },
    });
    console.log("Created canonical BSInfoTech program:", bsitCanonical);
  }

  // 2. Identify duplicate/non-canonical programs like "BS Info Tech", "BS INFO TECH", etc.
  const badPrograms = programs.filter(
    (p) => p.program_code !== "BSInfoTech" && p.program_code.replace(/\s+/g, "").toUpperCase() === "BSINFOTECH"
  );

  for (const badProg of badPrograms) {
    console.log(`Migrating students from bad program ID ${badProg.program_id} (${badProg.program_code}) to canonical ID ${bsitCanonical.program_id} (BSInfoTech)...`);
    
    // Update students
    const updatedStudents = await prisma.student.updateMany({
      where: { program_id: badProg.program_id },
      data: { program_id: bsitCanonical.program_id },
    });
    console.log(`Re-linked ${updatedStudents.count} students.`);

    // Delete bad program
    try {
      await prisma.academicProgram.delete({
        where: { program_id: badProg.program_id },
      });
      console.log(`Deleted duplicate program ID ${badProg.program_id}.`);
    } catch (err) {
      console.error(`Could not delete program ID ${badProg.program_id}:`, err.message);
    }
  }

  // 3. Format all program names with proper title capitalization (capitalize words except "of" and "in")
  const allProgs = await prisma.academicProgram.findMany();
  for (const p of allProgs) {
    const formattedName = titleCaseProgramName(p.program_name);
    if (formattedName !== p.program_name) {
      await prisma.academicProgram.update({
        where: { program_id: p.program_id },
        data: { program_name: formattedName },
      });
      console.log(`Updated program ID ${p.program_id} name to: "${formattedName}"`);
    }
  }

  console.log("--- Cleanup Complete ---");
}

main()
  .catch((e) => {
    console.error("Cleanup error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
