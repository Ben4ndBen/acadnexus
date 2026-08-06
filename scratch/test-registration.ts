import "dotenv/config";
import db from "../src/lib/db";
import bcrypt from "bcryptjs";

async function testRegistrationFlow() {
  const testStudentId = "2026-9999-AB";
  console.log("Starting registration test for student ID:", testStudentId);

  // Clean up any existing test user
  const existing = await db.user.findUnique({ where: { institutional_id: testStudentId } });
  if (existing) {
    await db.studentCourse.deleteMany({ where: { student_id: existing.user_id } });
    await db.student.deleteMany({ where: { student_id: existing.user_id } });
    await db.user.delete({ where: { user_id: existing.user_id } });
    console.log("Cleaned up existing test user.");
  }

  // Get 3 sample courses
  const sampleCourses = await db.course.findMany({ take: 3 });
  if (sampleCourses.length === 0) {
    console.error("No sample courses found in database!");
    process.exit(1);
  }
  const courseIds = sampleCourses.map(c => c.course_id);
  console.log(`Selected ${courseIds.length} sample courses:`, sampleCourses.map(c => c.course_code).join(", "));

  // Get sample program
  const program = await db.academicProgram.findFirst();
  if (!program) {
    console.error("No academic program found!");
    process.exit(1);
  }

  // Create test user and student with enrolled courses in transaction (simulating registerAction)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("Password123!", salt);

  const newUser = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        institutional_id: testStudentId,
        password_hash: passwordHash,
        role: "Student",
        require_password_update: false,
      },
    });

    await tx.student.create({
      data: {
        student_id: user.user_id,
        first_name: "Test",
        last_name: "Student",
        program_id: program.program_id,
        year_level: 1,
        section: "General Major",
      },
    });

    await tx.studentCourse.createMany({
      data: courseIds.map((cId) => ({
        student_id: user.user_id,
        course_id: cId,
      })),
    });

    return user;
  });

  console.log("Successfully created user ID:", newUser.user_id);

  // Fetch dbUser with studentCourses relation (simulating student dashboard query)
  const dbUser = await db.user.findUnique({
    where: { institutional_id: testStudentId },
    include: {
      student: {
        include: {
          program: true,
          studentCourses: {
            include: { course: true }
          }
        }
      }
    }
  });

  const enrolledCourseMap = new Map<number, any>();
  dbUser?.student?.studentCourses?.forEach(sc => {
    if (sc.course) {
      enrolledCourseMap.set(sc.course.course_id, sc.course);
    }
  });

  const enrolledSubjectsCount = enrolledCourseMap.size;
  console.log("Enrolled Subjects Count on Dashboard:", enrolledSubjectsCount);
  console.log("Enrolled Subjects List:", Array.from(enrolledCourseMap.values()).map(c => c.course_code).join(", "));

  if (enrolledSubjectsCount === courseIds.length) {
    console.log("✅ TEST PASSED: Enrolled subjects count accurately reflects registered subjects!");
  } else {
    console.error(`❌ TEST FAILED: Expected ${courseIds.length}, got ${enrolledSubjectsCount}`);
  }

  // Cleanup test user
  await db.studentCourse.deleteMany({ where: { student_id: newUser.user_id } });
  await db.student.delete({ where: { student_id: newUser.user_id } });
  await db.user.delete({ where: { user_id: newUser.user_id } });
  console.log("Cleanup finished.");

  process.exit(0);
}

testRegistrationFlow().catch(console.error);
