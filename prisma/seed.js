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

  const faculty = await prisma.faculty.create({
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

  const chair = await prisma.chair.create({
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

  // 5. Seed Courses
  console.log("Seeding courses...");
  const dbCourse = await prisma.course.create({
    data: {
      course_code: "CS411",
      course_title: "Advanced Database Systems",
    },
  });

  const seCourse = await prisma.course.create({
    data: {
      course_code: "CS412",
      course_title: "Software Engineering II",
    },
  });

  const aiCourse = await prisma.course.create({
    data: {
      course_code: "CS413",
      course_title: "Artificial Intelligence",
    },
  });

  // 6. Seed Examinations, QuestionBank, and ExamTargets
  console.log("Seeding examinations...");

  // Exam 1: Active (Midterm Database Systems)
  const activeExam = await prisma.examination.create({
    data: {
      title: "Midterm Examination in Database Systems",
      course_id: dbCourse.course_id,
      faculty_id: faculty.faculty_id,
      tos_file_path: "/uploads/tos/db_midterm.pdf",
      time_limit_minutes: 60,
      randomize_items: true,
      current_status: "Approved",
      questionBank: {
        create: [
          {
            question_text: "What does SQL stand for?",
            question_type: "Multiple_Choice",
            correct_answer: "Structured Query Language",
            points: 5,
          },
          {
            question_text: "A primary key can contain null values. True or False?",
            question_type: "True_False",
            correct_answer: "False",
            points: 5,
          },
        ],
      },
      examTargets: {
        create: [
          {
            program_id: bscsProg.program_id,
            year_level: 4,
            section: "A",
            scheduled_date: new Date(),
            start_time: new Date(new Date().setHours(0, 0, 0, 0)),
            end_time: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        ],
      },
    },
  });

  // Exam 2: Upcoming (Final Software Engineering)
  const upcomingExam = await prisma.examination.create({
    data: {
      title: "Final Examination in Software Engineering II",
      course_id: seCourse.course_id,
      faculty_id: faculty.faculty_id,
      tos_file_path: "/uploads/tos/se_final.pdf",
      time_limit_minutes: 120,
      randomize_items: false,
      current_status: "Approved",
      questionBank: {
        create: [
          {
            question_text: "What is CI/CD?",
            question_type: "Identification",
            correct_answer: "Continuous Integration and Continuous Deployment",
            points: 10,
          },
        ],
      },
      examTargets: {
        create: [
          {
            program_id: bscsProg.program_id,
            year_level: 4,
            section: "A",
            scheduled_date: new Date(new Date().setDate(new Date().getDate() + 2)), // 2 days from now
            start_time: new Date(new Date().setHours(9, 0, 0, 0)),
            end_time: new Date(new Date().setHours(12, 0, 0, 0)),
          },
        ],
      },
    },
  });

  // Exam 3: Completed (Quiz 1 - AI)
  const completedExam = await prisma.examination.create({
    data: {
      title: "Quiz 1 - Introduction to AI",
      course_id: aiCourse.course_id,
      faculty_id: faculty.faculty_id,
      tos_file_path: "/uploads/tos/ai_quiz1.pdf",
      time_limit_minutes: 30,
      randomize_items: true,
      current_status: "Approved",
      questionBank: {
        create: [
          {
            question_text: "Who is known as the father of AI?",
            question_type: "Multiple_Choice",
            correct_answer: "John McCarthy",
            points: 10,
          },
        ],
      },
      examTargets: {
        create: [
          {
            program_id: bscsProg.program_id,
            year_level: 4,
            section: "A",
            scheduled_date: new Date(new Date().setDate(new Date().getDate() - 1)), // yesterday
            start_time: new Date(new Date().setHours(10, 0, 0, 0)),
            end_time: new Date(new Date().setHours(11, 0, 0, 0)),
          },
        ],
      },
    },
  });

  // Exam 4: Draft (Quiz 2 - Database Systems)
  const draftExam = await prisma.examination.create({
    data: {
      title: "Quiz 2 - SQL Joins and Aggregations",
      course_id: dbCourse.course_id,
      faculty_id: faculty.faculty_id,
      tos_file_path: "/uploads/tos/db_quiz2.pdf",
      time_limit_minutes: 20,
      randomize_items: true,
      current_status: "Draft",
      questionBank: {
        create: [
          {
            question_text: "Which SQL join returns all records when there is a match in either left or right table?",
            question_type: "Multiple_Choice",
            correct_answer: "FULL OUTER JOIN",
            points: 10,
          },
        ],
      },
    },
  });

  // Exam 5: Pending Chair (Midterm Software Engineering)
  const pendingChairExam = await prisma.examination.create({
    data: {
      title: "Midterm Exam - Software Development Lifecycle",
      course_id: seCourse.course_id,
      faculty_id: faculty.faculty_id,
      tos_file_path: "/uploads/tos/se_midterm.pdf",
      time_limit_minutes: 60,
      randomize_items: true,
      current_status: "Pending_Chair",
      questionBank: {
        create: [
          {
            question_text: "Describe the differences between Agile and Waterfall methodologies.",
            question_type: "Identification",
            correct_answer: "Agile is iterative while Waterfall is linear.",
            points: 20,
          },
        ],
      },
      approvalWorkflow: {
        create: {
          reviewed_by_chair_id: chair.chair_id,
          chair_review_status: "Pending",
          di_review_status: "Hold",
        },
      },
    },
  });

  // Exam 6: Returned (Midterm AI)
  const returnedExam = await prisma.examination.create({
    data: {
      title: "Midterm Exam - Search Algorithms and Heuristics",
      course_id: aiCourse.course_id,
      faculty_id: faculty.faculty_id,
      tos_file_path: "/uploads/tos/ai_midterm.pdf",
      time_limit_minutes: 90,
      randomize_items: true,
      current_status: "Returned",
      questionBank: {
        create: [
          {
            question_text: "A* search is always optimal. True or False?",
            question_type: "True_False",
            correct_answer: "True",
            points: 10,
          },
        ],
      },
      approvalWorkflow: {
        create: {
          reviewed_by_chair_id: chair.chair_id,
          chair_review_status: "Returned",
          chair_comments: "Please rewrite Question 1. The true/false statement needs clarification regarding the admissibility of the heuristic function.",
          chair_action_timestamp: new Date(),
          di_review_status: "Hold",
        },
      },
    },
  });

  // Create completed student exam record
  await prisma.studentExam.create({
    data: {
      student_id: studentUser.user_id,
      exam_id: completedExam.exam_id,
      started_at: new Date(new Date().setDate(new Date().getDate() - 1)),
      submitted_at: new Date(new Date().setDate(new Date().getDate() - 1)),
      total_score: 10, // 100% score
      submission_trigger: "Manual",
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
