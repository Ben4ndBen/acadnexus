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

  // 2. Seed 5 Departments
  console.log("Seeding departments...");
  const itDept = await prisma.department.create({
    data: { department_name: "IT Department" },
  });
  const agriDept = await prisma.department.create({
    data: { department_name: "Agriculture Department" },
  });
  const hospitalityDept = await prisma.department.create({
    data: { department_name: "Hospitality and Tourism Management Department" },
  });
  const industrialDept = await prisma.department.create({
    data: { department_name: "Industrial Technology Department" },
  });
  const teacherEduDept = await prisma.department.create({
    data: { department_name: "Teacher Education Department" },
  });

  // 3. Seed Programs
  console.log("Seeding programs...");
  const bsitProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSIT",
      program_name: "Bachelor of Science in Information Technology",
      department_id: itDept.department_id,
    },
  });
  const bsaProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSA",
      program_name: "Bachelor of Science in Agriculture",
      department_id: agriDept.department_id,
    },
  });
  const bshmProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSHM",
      program_name: "Bachelor of Science in Hospitality Management",
      department_id: hospitalityDept.department_id,
    },
  });
  const bstmProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSTM",
      program_name: "Bachelor of Science in Tourism Management",
      department_id: hospitalityDept.department_id,
    },
  });
  const bsindtechProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSINDTECH",
      program_name: "Bachelor of Science in Industrial Technology",
      department_id: industrialDept.department_id,
    },
  });
  const beedProg = await prisma.academicProgram.create({
    data: {
      program_code: "BEED",
      program_name: "Bachelor of Elementary Education",
      department_id: teacherEduDept.department_id,
    },
  });
  const bsedProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSED",
      program_name: "Bachelor of Secondary Education",
      department_id: teacherEduDept.department_id,
    },
  });

  // 4. Seed User Accounts & Roles
  console.log("Seeding user accounts...");

  // --- Student ---
  const studentUser = await prisma.user.create({
    data: {
      institutional_id: "2023-0001-AB",
      password_hash: passwordHash,
      role: "Student",
    },
  });

  await prisma.student.create({
    data: {
      student_id: studentUser.user_id,
      first_name: "Janice",
      last_name: "Delfin",
      program_id: bsitProg.program_id,
      year_level: 4,
      section: "General",
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

  // --- Chairs & Faculty for all 5 Departments ---

  // 1. IT Department Chair & Faculty
  const itChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-001",
      username: "chair_it",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const itChair = await prisma.chair.create({
    data: { chair_id: itChairUser.user_id, department_id: itDept.department_id },
  });
  const itFacultyUser = await prisma.user.create({
    data: {
      institutional_id: "FACULTY-001",
      username: "faculty_it",
      password_hash: passwordHash,
      role: "Faculty",
    },
  });
  const itFaculty = await prisma.faculty.create({
    data: {
      faculty_id: itFacultyUser.user_id,
      first_name: "Mark",
      last_name: "Abad",
      department_id: itDept.department_id,
    },
  });

  // 2. Agriculture Department Chair & Faculty
  const agriChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-AGRI",
      username: "chair_agri",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const agriChair = await prisma.chair.create({
    data: { chair_id: agriChairUser.user_id, department_id: agriDept.department_id },
  });
  const agriFacultyUser = await prisma.user.create({
    data: {
      institutional_id: "FACULTY-AGRI",
      username: "faculty_agri",
      password_hash: passwordHash,
      role: "Faculty",
    },
  });
  const agriFaculty = await prisma.faculty.create({
    data: {
      faculty_id: agriFacultyUser.user_id,
      first_name: "Maria",
      last_name: "Santos",
      department_id: agriDept.department_id,
    },
  });

  // 3. Hospitality & Tourism Chair & Faculty
  const htmChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-HTM",
      username: "chair_htm",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const htmChair = await prisma.chair.create({
    data: { chair_id: htmChairUser.user_id, department_id: hospitalityDept.department_id },
  });
  const htmFacultyUser = await prisma.user.create({
    data: {
      institutional_id: "FACULTY-HTM",
      username: "faculty_htm",
      password_hash: passwordHash,
      role: "Faculty",
    },
  });
  const htmFaculty = await prisma.faculty.create({
    data: {
      faculty_id: htmFacultyUser.user_id,
      first_name: "Carlos",
      last_name: "Reyes",
      department_id: hospitalityDept.department_id,
    },
  });

  // 4. Industrial Technology Chair & Faculty
  const indtechChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-INDTECH",
      username: "chair_indtech",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const indtechChair = await prisma.chair.create({
    data: { chair_id: indtechChairUser.user_id, department_id: industrialDept.department_id },
  });
  const indtechFacultyUser = await prisma.user.create({
    data: {
      institutional_id: "FACULTY-INDTECH",
      username: "faculty_indtech",
      password_hash: passwordHash,
      role: "Faculty",
    },
  });
  const indtechFaculty = await prisma.faculty.create({
    data: {
      faculty_id: indtechFacultyUser.user_id,
      first_name: "Elena",
      last_name: "Cruz",
      department_id: industrialDept.department_id,
    },
  });

  // 5. Teacher Education (TED) Chair & Faculty
  const tedChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-TED",
      username: "chair_ted",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const tedChair = await prisma.chair.create({
    data: { chair_id: tedChairUser.user_id, department_id: teacherEduDept.department_id },
  });
  const tedFacultyUser = await prisma.user.create({
    data: {
      institutional_id: "FACULTY-TED",
      username: "faculty_ted",
      password_hash: passwordHash,
      role: "Faculty",
    },
  });
  const tedFaculty = await prisma.faculty.create({
    data: {
      faculty_id: tedFacultyUser.user_id,
      first_name: "Joseph",
      last_name: "Garcia",
      department_id: teacherEduDept.department_id,
    },
  });

  // 5. Seed Courses
  console.log("Seeding courses...");
  const dbCourse = await prisma.course.create({
    data: { course_code: "CS411", course_title: "Advanced Database Systems" },
  });
  const seCourse = await prisma.course.create({
    data: { course_code: "CS412", course_title: "Software Engineering II" },
  });
  const agriCourse = await prisma.course.create({
    data: { course_code: "AGRI101", course_title: "Principles of Agricultural Extension" },
  });
  const htmCourse = await prisma.course.create({
    data: { course_code: "THC1", course_title: "Macro Perspective of Tourism and Hospitality" },
  });
  const indCourse = await prisma.course.create({
    data: { course_code: "IND101", course_title: "Basic Electronics and Circuitry" },
  });
  const tedCourse = await prisma.course.create({
    data: { course_code: "EDUC101", course_title: "Child and Adolescent Learners and Learning Principles" },
  });

  // 6. Seed Examinations & Pending Approval Workflows for Each Department

  // IT Dept Exam (Pending Chair Review)
  const itExam = await prisma.examination.create({
    data: {
      title: "Midterm Exam - Software Development Lifecycle",
      course_id: seCourse.course_id,
      faculty_id: itFaculty.faculty_id,
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
          reviewed_by_chair_id: itChair.chair_id,
          chair_review_status: "Pending",
          di_review_status: "Hold",
        },
      },
    },
  });

  // Agriculture Exam (Pending Chair Review)
  const agriExam = await prisma.examination.create({
    data: {
      title: "Midterm Exam - Agricultural Extension Principles",
      course_id: agriCourse.course_id,
      faculty_id: agriFaculty.faculty_id,
      tos_file_path: "/uploads/tos/agri_midterm.pdf",
      time_limit_minutes: 60,
      randomize_items: true,
      current_status: "Pending_Chair",
      questionBank: {
        create: [
          {
            question_text: "What is the primary role of agricultural extension officers?",
            question_type: "Multiple_Choice",
            correct_answer: "Technology transfer and farmer education",
            points: 10,
          },
        ],
      },
      approvalWorkflow: {
        create: {
          reviewed_by_chair_id: agriChair.chair_id,
          chair_review_status: "Pending",
          di_review_status: "Hold",
        },
      },
    },
  });

  // Hospitality Exam (Pending Chair Review)
  const htmExam = await prisma.examination.create({
    data: {
      title: "Midterm Exam - Macro Perspective of Tourism",
      course_id: htmCourse.course_id,
      faculty_id: htmFaculty.faculty_id,
      tos_file_path: "/uploads/tos/htm_midterm.pdf",
      time_limit_minutes: 60,
      randomize_items: true,
      current_status: "Pending_Chair",
      questionBank: {
        create: [
          {
            question_text: "Define sustainable tourism management in heritage destinations.",
            question_type: "Essay",
            correct_answer: "Preserving natural and cultural heritage while ensuring economic viability.",
            points: 15,
          },
        ],
      },
      approvalWorkflow: {
        create: {
          reviewed_by_chair_id: htmChair.chair_id,
          chair_review_status: "Pending",
          di_review_status: "Hold",
        },
      },
    },
  });

  // Industrial Tech Exam (Pending Chair Review)
  const indtechExam = await prisma.examination.create({
    data: {
      title: "Midterm Exam - Electronic Circuits and Wiring",
      course_id: indCourse.course_id,
      faculty_id: indtechFaculty.faculty_id,
      tos_file_path: "/uploads/tos/ind_midterm.pdf",
      time_limit_minutes: 60,
      randomize_items: true,
      current_status: "Pending_Chair",
      questionBank: {
        create: [
          {
            question_text: "Ohm's law relates voltage, current, and resistance. True or False?",
            question_type: "True_False",
            correct_answer: "True",
            points: 5,
          },
        ],
      },
      approvalWorkflow: {
        create: {
          reviewed_by_chair_id: indtechChair.chair_id,
          chair_review_status: "Pending",
          di_review_status: "Hold",
        },
      },
    },
  });

  // Teacher Education Exam (Pending Chair Review)
  const tedExam = await prisma.examination.create({
    data: {
      title: "Midterm Exam - Child & Adolescent Development",
      course_id: tedCourse.course_id,
      faculty_id: tedFaculty.faculty_id,
      tos_file_path: "/uploads/tos/ted_midterm.pdf",
      time_limit_minutes: 60,
      randomize_items: true,
      current_status: "Pending_Chair",
      questionBank: {
        create: [
          {
            question_text: "Who proposed the stages of cognitive development?",
            question_type: "Multiple_Choice",
            correct_answer: "Jean Piaget",
            points: 10,
          },
        ],
      },
      approvalWorkflow: {
        create: {
          reviewed_by_chair_id: tedChair.chair_id,
          chair_review_status: "Pending",
          di_review_status: "Hold",
        },
      },
    },
  });

  // Active Approved Exam for Student Testing
  const activeExam = await prisma.examination.create({
    data: {
      title: "Midterm Examination in Database Systems",
      course_id: dbCourse.course_id,
      faculty_id: itFaculty.faculty_id,
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
            program_id: bsitProg.program_id,
            year_level: 4,
            section: "General",
            scheduled_date: new Date(),
            start_time: new Date(new Date().setHours(0, 0, 0, 0)),
            end_time: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        ],
      },
    },
  });

  console.log("Database seeding completed successfully!");
  console.log("Created test accounts (all passwords are 'password123'):");
  console.log("  - Director: DIRECTOR-001");
  console.log("  - Student: 2023-0001-AB (Janice Delfin)");
  console.log("  - IT Chair: CHAIR-001 | Faculty: FACULTY-001");
  console.log("  - Agriculture Chair: CHAIR-AGRI | Faculty: FACULTY-AGRI");
  console.log("  - Hospitality & Tourism Chair: CHAIR-HTM | Faculty: FACULTY-HTM");
  console.log("  - Industrial Tech Chair: CHAIR-INDTECH | Faculty: FACULTY-INDTECH");
  console.log("  - Teacher Education (TED) Chair: CHAIR-TED | Faculty: FACULTY-TED");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
