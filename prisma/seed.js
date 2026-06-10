const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  // Hashing password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("password123", salt);

  // 1. Clear existing database entries in correct topological order
  console.log("Cleaning up existing data...");
  await prisma.auditLog.deleteMany({});
  await prisma.studentAnswer.deleteMany({});
  await prisma.studentExam.deleteMany({});
  await prisma.approvalWorkflow.deleteMany({});
  await prisma.questionBank.deleteMany({});
  await prisma.examTarget.deleteMany({});
  await prisma.examination.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.facultyPortfolio.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.faculty.deleteMany({});
  await prisma.chair.deleteMany({});
  await prisma.director.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.academicProgram.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.sample.deleteMany({});

  console.log("Clean up completed.");

  // 2. Seed Departments
  console.log("Seeding departments...");
  const csDept = await prisma.department.create({
    data: { department_name: "Department of Computer Studies" },
  });
  
  const eduDept = await prisma.department.create({
    data: { department_name: "Department of Teacher Education" },
  });

  // 3. Seed Programs
  console.log("Seeding programs...");
  const bscsProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSCS",
      program_name: "Bachelor of Science in Computer Science",
      department_id: csDept.department_id,
    },
  });

  const bsedProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSED",
      program_name: "Bachelor of Secondary Education",
      department_id: eduDept.department_id,
    },
  });

  // 4. Seed User Accounts
  console.log("Seeding user accounts...");

  // --- Student ---
  const studentUser = await prisma.user.create({
    data: {
      institutional_id: "STUDENT-001",
      password_hash: passwordHash,
      role: "Student",
    },
  });

  await prisma.student.create({
    data: {
      student_id: studentUser.user_id,
      first_name: "Janice",
      last_name: "Delfin",
      program_id: bscsProg.program_id,
      year_level: 4,
      section: "A",
    },
  });

  // --- Faculty ---
  const facultyUser = await prisma.user.create({
    data: {
      institutional_id: "FACULTY-001",
      password_hash: passwordHash,
      role: "Faculty",
    },
  });

  await prisma.faculty.create({
    data: {
      faculty_id: facultyUser.user_id,
      first_name: "Mark",
      last_name: "Abad",
      department_id: csDept.department_id,
    },
  });

  // --- Chair ---
  const chairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-001",
      password_hash: passwordHash,
      role: "Chair",
    },
  });

  await prisma.chair.create({
    data: {
      chair_id: chairUser.user_id,
      department_id: csDept.department_id,
    },
  });

  // --- Director ---
  const directorUser = await prisma.user.create({
    data: {
      institutional_id: "DIRECTOR-001",
      password_hash: passwordHash,
      role: "Director",
    },
  });

  await prisma.director.create({
    data: {
      director_id: directorUser.user_id,
    },
  });

  console.log("Database seeding completed successfully!");
  console.log("Created test accounts (all passwords are 'password123'):");
  console.log("  - Student: STUDENT-001 (Janice Delfin - BSCS Year 4 Section A)");
  console.log("  - Faculty: FACULTY-001 (Mark Abad - Department of Computer Studies)");
  console.log("  - Chair: CHAIR-001 (Department of Computer Studies Chair)");
  console.log("  - Director: DIRECTOR-001 (Office of the Director)");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
