process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const rawData = fs.readFileSync(path.join(__dirname, "students_data.json"), "utf8");
  const students = JSON.parse(rawData);

  console.log(`Loaded ${students.length} students from JSON.`);

  // Check duplicates
  const ids = new Set();
  const duplicates = [];
  for (const s of students) {
    if (ids.has(s.id)) {
      duplicates.push(s.id);
    }
    ids.add(s.id);
  }
  if (duplicates.length > 0) {
    console.error("Duplicate IDs found in list:", duplicates);
    return;
  }
  console.log("No duplicate IDs in student list. Unique count:", ids.size);

  // Find program ID for BS Info Tech
  const program = await prisma.academicProgram.findFirst({
    where: {
      OR: [
        { program_code: "BS Info Tech" },
        { program_name: { contains: "Information Technology", mode: "insensitive" } }
      ]
    }
  });

  if (!program) {
    throw new Error("Academic Program for BS Info Tech not found!");
  }
  console.log(`Using Academic Program: ID ${program.program_id} - ${program.program_code} (${program.program_name})`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const s of students) {
    const formattedId = s.id.trim().toUpperCase();
    const firstName = s.firstName.trim();
    const lastName = s.lastName.trim();
    const yearLevel = Number(s.yearLevel) || 1;
    const section = "A";

    if (isDryRun) {
      console.log(`[DRY RUN] Would process: ${formattedId} - ${firstName} ${lastName} (Year: ${yearLevel}, Sec: ${section})`);
      continue;
    }

    // Default password is institutional_id
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(formattedId, salt);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { institutional_id: formattedId },
      include: { student: true }
    });

    if (existingUser) {
      // Update existing user password and requirement
      await prisma.user.update({
        where: { user_id: existingUser.user_id },
        data: {
          password_hash: passwordHash,
          require_password_update: true,
          is_active: true
        }
      });

      if (existingUser.student) {
        await prisma.student.update({
          where: { student_id: existingUser.user_id },
          data: {
            first_name: firstName,
            last_name: lastName,
            program_id: program.program_id,
            year_level: yearLevel,
            section: section
          }
        });
      } else {
        await prisma.student.create({
          data: {
            student_id: existingUser.user_id,
            first_name: firstName,
            last_name: lastName,
            program_id: program.program_id,
            year_level: yearLevel,
            section: section
          }
        });
      }
      updatedCount++;
    } else {
      // Create new user and student
      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            institutional_id: formattedId,
            password_hash: passwordHash,
            role: "Student",
            require_password_update: true,
            is_active: true
          }
        });

        await tx.student.create({
          data: {
            student_id: newUser.user_id,
            first_name: firstName,
            last_name: lastName,
            program_id: program.program_id,
            year_level: yearLevel,
            section: section
          }
        });
      });
      createdCount++;
    }
  }

  console.log(`\nExecution complete!`);
  console.log(`Created: ${createdCount}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Total: ${createdCount + updatedCount}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error("Error creating student accounts:", err);
  process.exit(1);
});
