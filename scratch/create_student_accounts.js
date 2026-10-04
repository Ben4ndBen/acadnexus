process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { ALL_CURRICULUMS, getCurriculumForProgram } = require("../src/lib/bsitCurriculum");

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== STARTING STUDENT ACCOUNTS & AUTOMATIC SUBJECT ASSIGNMENT SETUP ===");

  // 1. Ensure all curriculum courses exist in the database
  console.log(`Seeding/upserting ${ALL_CURRICULUMS.length} curriculum courses...`);
  for (const item of ALL_CURRICULUMS) {
    await prisma.course.upsert({
      where: { course_code: item.code },
      update: { course_title: item.title },
      create: {
        course_code: item.code,
        course_title: item.title,
      }
    });
  }
  console.log("Curriculum courses verified.");

  // Fetch all courses from DB for fast lookup by course_code
  const allDbCourses = await prisma.course.findMany();
  const courseCodeToIdMap = new Map(allDbCourses.map(c => [c.course_code.trim().toUpperCase(), c.course_id]));

  // 2. Load student list
  const rawData = fs.readFileSync(path.join(__dirname, "students_data.json"), "utf8");
  const students = JSON.parse(rawData);
  console.log(`Loaded ${students.length} students from students_data.json.`);

  const validInstitutionalIds = new Set(students.map(s => s.id.trim().toUpperCase()));

  // Find Academic Program for BS Info Tech
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
  let totalAssignedSubjectsCount = 0;

  for (const s of students) {
    const formattedId = s.id.trim().toUpperCase();
    const firstName = s.firstName.trim();
    const rawMiddle = (s.middleName || "").trim();
    const middleName = (!rawMiddle || rawMiddle.toUpperCase() === "NONE") ? null : rawMiddle;
    const lastName = s.lastName.trim();
    const yearLevel = Number(s.yearLevel) || 1;
    const section = "A";

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(formattedId, salt);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { institutional_id: formattedId },
      include: { student: true }
    });

    let userId;

    if (existingUser) {
      userId = existingUser.user_id;
      await prisma.user.update({
        where: { user_id: userId },
        data: {
          password_hash: passwordHash,
          require_password_update: true,
          is_active: true
        }
      });

      if (existingUser.student) {
        await prisma.student.update({
          where: { student_id: userId },
          data: {
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            program_id: program.program_id,
            year_level: yearLevel,
            section: section
          }
        });
      } else {
        await prisma.student.create({
          data: {
            student_id: userId,
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            program_id: program.program_id,
            year_level: yearLevel,
            section: section
          }
        });
      }
      updatedCount++;
    } else {
      const newUser = await prisma.user.create({
        data: {
          institutional_id: formattedId,
          password_hash: passwordHash,
          role: "Student",
          require_password_update: true,
          is_active: true
        }
      });
      userId = newUser.user_id;

      await prisma.student.create({
        data: {
          student_id: userId,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          program_id: program.program_id,
          year_level: yearLevel,
          section: section
        }
      });
      createdCount++;
    }

    // AUTOMATICALLY ASSIGN SUBJECTS (CURRICULUM COURSES) FOR THIS STUDENT
    const curriculumItems = getCurriculumForProgram("BSIT", yearLevel);
    const courseIdsToEnroll = [];

    for (const item of curriculumItems) {
      const cId = courseCodeToIdMap.get(item.code.trim().toUpperCase());
      if (cId) {
        courseIdsToEnroll.push(cId);
      }
    }

    // Re-sync student courses (delete existing and insert assigned curriculum courses)
    await prisma.studentCourse.deleteMany({
      where: { student_id: userId }
    });

    if (courseIdsToEnroll.length > 0) {
      await prisma.studentCourse.createMany({
        data: courseIdsToEnroll.map(cId => ({
          student_id: userId,
          course_id: cId
        }))
      });
      totalAssignedSubjectsCount += courseIdsToEnroll.length;
    }
  }

  console.log(`\nStudent Sync & Subject Assignment Complete:`);
  console.log(`  - Students Created: ${createdCount}`);
  console.log(`  - Students Updated: ${updatedCount}`);
  console.log(`  - Total Students Processed: ${createdCount + updatedCount}`);
  console.log(`  - Total Student Enrolled Subject Records Created: ${totalAssignedSubjectsCount}`);

  // 3. REMOVE OLD MOCK DATA
  console.log("\n--- REMOVING OLD MOCK DATA ---");

  // A. Find old student accounts not in students_data.json
  const allDbStudents = await prisma.user.findMany({
    where: { role: "Student" },
    include: { student: true }
  });

  const oldStudentUsers = allDbStudents.filter(u => !validInstitutionalIds.has(u.institutional_id.trim().toUpperCase()));
  console.log(`Found ${oldStudentUsers.length} old mock student accounts to remove:`, oldStudentUsers.map(u => `${u.institutional_id} (${u.student?.first_name} ${u.student?.last_name})`));

  for (const oldUser of oldStudentUsers) {
    const uId = oldUser.user_id;
    // Cascade delete dependent records
    await prisma.studentAnswer.deleteMany({ where: { studentExam: { student_id: uId } } });
    await prisma.studentExam.deleteMany({ where: { student_id: uId } });
    await prisma.studentOverride.deleteMany({ where: { student_id: uId } });
    await prisma.studentCourse.deleteMany({ where: { student_id: uId } });
    await prisma.notification.deleteMany({ where: { user_id: uId } });
    await prisma.auditLog.deleteMany({ where: { user_id: uId } });
    await prisma.student.deleteMany({ where: { student_id: uId } });
    await prisma.user.delete({ where: { user_id: uId } });
  }

  // B. Remove old mock programs like BSCS if any exist
  const bscsProgram = await prisma.academicProgram.findFirst({
    where: {
      OR: [
        { program_code: "BSCS" },
        { program_name: { contains: "Computer Science", mode: "insensitive" } }
      ]
    }
  });

  if (bscsProgram) {
    console.log(`Removing old mock program: ${bscsProgram.program_code} (${bscsProgram.program_name})...`);
    await prisma.academicProgram.delete({ where: { program_id: bscsProgram.program_id } });
  }

  // C. Remove old non-curriculum mock courses (e.g. Intro to AI or legacy mock codes like AGRI101, IND101, EDUC101)
  const validCurriculumCodes = new Set(ALL_CURRICULUMS.map(c => c.code.trim().toUpperCase()));
  const allCourses = await prisma.course.findMany({
    include: {
      examinations: true,
      studentCourses: true,
      facultyCourses: true,
    }
  });

  let oldCoursesRemoved = 0;
  for (const c of allCourses) {
    const codeUpper = c.course_code.trim().toUpperCase();
    const titleUpper = c.course_title.trim().toUpperCase();

    const isOldMockCourse =
      titleUpper.includes("INTRO TO AI") ||
      titleUpper.includes("ARTIFICIAL INTELLIGENCE") ||
      codeUpper === "CS101" ||
      codeUpper === "AGRI101" ||
      codeUpper === "IND101" ||
      codeUpper === "EDUC101" ||
      codeUpper === "THC1";

    if (isOldMockCourse) {
      console.log(`Removing old mock course: ${c.course_code} - ${c.course_title}`);
      await prisma.studentCourse.deleteMany({ where: { course_id: c.course_id } });
      await prisma.facultyCourse.deleteMany({ where: { course_id: c.course_id } });
      await prisma.questionBank.deleteMany({ where: { course_id: c.course_id } });
      await prisma.examination.deleteMany({ where: { course_id: c.course_id } });
      await prisma.course.delete({ where: { course_id: c.course_id } });
      oldCoursesRemoved++;
    }
  }

  console.log(`Removed ${oldCoursesRemoved} old mock courses.`);
  console.log("\n=== ALL SETUP & CLEANUP COMPLETED SUCCESSFULLY ===");

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error("Error during setup script:", err);
  process.exit(1);
});
