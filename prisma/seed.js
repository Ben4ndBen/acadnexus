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

const { ALL_CURRICULUMS } = require("../src/lib/bsitCurriculum");

async function main() {
  console.log("Starting database seeding with updated Batanes State College academic structure...");

  // Hashing default password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("password123", salt);
  const studentPasswordHash = await bcrypt.hash("dukay", salt);

  // 1. Clear existing database entries in correct topological order
  console.log("Cleaning up existing data...");
  await prisma.auditLog.deleteMany({});
  await prisma.studentAnswer.deleteMany({});
  await prisma.studentExam.deleteMany({});
  await prisma.approvalWorkflow.deleteMany({});
  await prisma.questionBank.deleteMany({});
  await prisma.examTarget.deleteMany({});
  await prisma.examination.deleteMany({});
  await prisma.studentCourse.deleteMany({});
  await prisma.facultyCourse.deleteMany({});
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
  const citdDept = await prisma.department.create({
    data: { department_name: "CITD" },
  });
  const ictDept = await prisma.department.create({
    data: { department_name: "ICT Department" },
  });
  const itdDept = await prisma.department.create({
    data: { department_name: "IT Department" },
  });
  const tedDept = await prisma.department.create({
    data: { department_name: "Teacher Education Department" },
  });
  const agriDept = await prisma.department.create({
    data: { department_name: "Agriculture Department" },
  });
  const htmDept = await prisma.department.create({
    data: { department_name: "Hospitality and Tourism Management Department" },
  });

  // 3. Seed Programs
  console.log("Seeding academic programs...");
  const bsinfotechProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSInfoTech",
      program_name: "Bachelor of Science in Information Technology",
      department_id: ictDept.department_id,
    },
  });
  const bsitProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSIT",
      program_name: "Bachelor of Science in Industrial Technology",
      department_id: itdDept.department_id,
    },
  });
  const beedProg = await prisma.academicProgram.create({
    data: {
      program_code: "BEED",
      program_name: "Bachelor of Elementary Education",
      department_id: tedDept.department_id,
    },
  });
  const bsedProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSED",
      program_name: "Bachelor of Secondary Education",
      department_id: tedDept.department_id,
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
      department_id: htmDept.department_id,
    },
  });
  const bstmProg = await prisma.academicProgram.create({
    data: {
      program_code: "BSTM",
      program_name: "Bachelor of Science in Tourism Management",
      department_id: htmDept.department_id,
    },
  });

  // 4. Seed User Accounts & Roles

  // A. Director for Instruction (DI)
  console.log("Seeding Director...");
  const directorUser = await prisma.user.create({
    data: {
      institutional_id: "DIRECTOR-001",
      password_hash: passwordHash,
      role: "Director",
    },
  });
  await prisma.director.create({
    data: { director_id: directorUser.user_id },
  });

  // B. Department Chairpersons
  console.log("Seeding Department Chairpersons...");
  // CITD Department Chair
  const citdChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-CITD",
      username: "chair_citd",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const citdChair = await prisma.chair.create({
    data: {
      chair_id: citdChairUser.user_id,
      department_id: citdDept.department_id,
      is_program_chair: false,
    },
  });

  // ICT Department Chair
  const ictChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-ICT",
      username: "chair_ict",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  await prisma.chair.create({
    data: {
      chair_id: ictChairUser.user_id,
      department_id: ictDept.department_id,
      is_program_chair: false,
    },
  });

  // ITD Department Chair
  const itdChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-ITD",
      username: "chair_itd",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  await prisma.chair.create({
    data: {
      chair_id: itdChairUser.user_id,
      department_id: itdDept.department_id,
      is_program_chair: false,
    },
  });

  // TED Department Chair
  const tedChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-TED",
      username: "chair_ted",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const tedChair = await prisma.chair.create({
    data: {
      chair_id: tedChairUser.user_id,
      department_id: tedDept.department_id,
      is_program_chair: false,
    },
  });

  // Agriculture Department Chair
  const agriChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-AGRI",
      username: "chair_agri",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const agriChair = await prisma.chair.create({
    data: {
      chair_id: agriChairUser.user_id,
      department_id: agriDept.department_id,
      is_program_chair: false,
    },
  });

  // HTM Department Chair
  const htmChairUser = await prisma.user.create({
    data: {
      institutional_id: "CHAIR-HTM",
      username: "chair_htm",
      password_hash: passwordHash,
      role: "Chair",
    },
  });
  const htmChair = await prisma.chair.create({
    data: {
      chair_id: htmChairUser.user_id,
      department_id: htmDept.department_id,
      is_program_chair: false,
    },
  });

  // C. Program Chairpersons
  console.log("Seeding Program Chairpersons...");
  // BSInfoTech Program Chair (ICT Department)
  const ictProgChairUser = await prisma.user.create({
    data: {
      institutional_id: "PC-ICT",
      username: "progchair_ict",
      password_hash: passwordHash,
      role: "ProgramChair",
    },
  });
  const ictProgChair = await prisma.chair.create({
    data: {
      chair_id: ictProgChairUser.user_id,
      department_id: ictDept.department_id,
      program_id: bsinfotechProg.program_id,
      is_program_chair: true,
    },
  });

  // BSIT Program Chair (IT Department / Industrial Tech)
  const itdProgChairUser = await prisma.user.create({
    data: {
      institutional_id: "PC-ITD",
      username: "progchair_itd",
      password_hash: passwordHash,
      role: "ProgramChair",
    },
  });
  const itdProgChair = await prisma.chair.create({
    data: {
      chair_id: itdProgChairUser.user_id,
      department_id: itdDept.department_id,
      program_id: bsitProg.program_id,
      is_program_chair: true,
    },
  });

  // BEED Program Chair (Teacher Education)
  const beedProgChairUser = await prisma.user.create({
    data: {
      institutional_id: "PC-BEED",
      username: "progchair_beed",
      password_hash: passwordHash,
      role: "ProgramChair",
    },
  });
  const beedProgChair = await prisma.chair.create({
    data: {
      chair_id: beedProgChairUser.user_id,
      department_id: tedDept.department_id,
      program_id: beedProg.program_id,
      is_program_chair: true,
    },
  });

  // BSED Program Chair (Teacher Education)
  const bsedProgChairUser = await prisma.user.create({
    data: {
      institutional_id: "PC-BSED",
      username: "progchair_bsed",
      password_hash: passwordHash,
      role: "ProgramChair",
    },
  });
  const bsedProgChair = await prisma.chair.create({
    data: {
      chair_id: bsedProgChairUser.user_id,
      department_id: tedDept.department_id,
      program_id: bsedProg.program_id,
      is_program_chair: true,
    },
  });

  // D. Faculty Members
  console.log("Seeding Faculty...");
  const ictFacultyUser = await prisma.user.create({
    data: {
      institutional_id: "FACULTY-ICT",
      username: "faculty_ict",
      password_hash: passwordHash,
      role: "Faculty",
    },
  });
  const ictFaculty = await prisma.faculty.create({
    data: {
      faculty_id: ictFacultyUser.user_id,
      first_name: "Mark",
      last_name: "Abad",
      department_id: ictDept.department_id,
    },
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
      department_id: htmDept.department_id,
    },
  });

  const itdFacultyUser = await prisma.user.create({
    data: {
      institutional_id: "FACULTY-ITD",
      username: "faculty_itd",
      password_hash: passwordHash,
      role: "Faculty",
    },
  });
  const itdFaculty = await prisma.faculty.create({
    data: {
      faculty_id: itdFacultyUser.user_id,
      first_name: "Elena",
      last_name: "Cruz",
      department_id: itdDept.department_id,
    },
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
      department_id: tedDept.department_id,
    },
  });

  // 5. Seed Courses (All 141+ items from ALL_CURRICULUMS)
  console.log("Seeding all 141+ curriculum courses into DB...");
  for (const item of ALL_CURRICULUMS) {
    await prisma.course.upsert({
      where: { course_code: item.code },
      update: { course_title: item.title },
      create: {
        course_code: item.code,
        course_title: item.title,
      },
    });
  }

  // 6. Seed BSInfoTech Student Accounts (140 Accounts)
  console.log("Seeding BSInfoTech student accounts...");
  const initialStudents = [
    { inst_id: "2023-1140-AB", last_name: "Abad", first_name: "Siena Marie", middle_name: null, year_level: 4 },
    { inst_id: "2026-3189-AB", last_name: "Acebes", first_name: "Benedict John", middle_name: "Hostallero", year_level: 1 },
    { inst_id: "2025-3014-AB", last_name: "Alariao", first_name: "John Martin", middle_name: "Ponce", year_level: 1 },
    { inst_id: "2026-3175-AB", last_name: "Alariao", first_name: "Florenz Jay", middle_name: "Ponce", year_level: 2 },
    { inst_id: "2024-1232-AB", last_name: "Alcantara", first_name: "Josue", middle_name: null, year_level: 2 },
    { inst_id: "2023-1243-AB", last_name: "Alcantara", first_name: "Marivic", middle_name: "Arca", year_level: 4 },
    { inst_id: "2024-1087-AB", last_name: "Alcazar", first_name: "Angela", middle_name: "Asa", year_level: 3 },
    { inst_id: "2025-1309-AB", last_name: "Alcon", first_name: "Alianny Alexa", middle_name: "Bata", year_level: 2 },
    { inst_id: "2023-1141-AB", last_name: "Alcoy", first_name: "Joseph Marie", middle_name: "Meonada", year_level: 4 },
    { inst_id: "2026-3114-AB", last_name: "Alueta", first_name: "Princess", middle_name: "Hubalde", year_level: 1 },
    { inst_id: "2025-1389-AB", last_name: "Amboy", first_name: "Gladwin Dave", middle_name: "Balles", year_level: 2 },
    { inst_id: "2026-3037-AB", last_name: "Arnado", first_name: "Jonalyn", middle_name: "Prado", year_level: 1 },
    { inst_id: "2026-3045-AB", last_name: "Asa", first_name: "Fritzi Paul", middle_name: "Salamagos", year_level: 1 },
    { inst_id: "2023-1022-AB", last_name: "Balderas", first_name: "Mariz", middle_name: "Arca", year_level: 4 },
    { inst_id: "2025-1369-AB", last_name: "Baliday", first_name: "Katrice Glaiza", middle_name: "Nipaya", year_level: 2 },
    { inst_id: "2026-3147-AB", last_name: "Ballado", first_name: "Jhon Philip", middle_name: "Servillon", year_level: 1 },
    { inst_id: "2023-1143-AB", last_name: "Balles", first_name: "John Wayne", middle_name: "Makinano", year_level: 4 },
    { inst_id: "2024-1140-AB", last_name: "Barcelona", first_name: "Daniel", middle_name: null, year_level: 3 },
    { inst_id: "2025-1376-AB", last_name: "Bayonito", first_name: "Jomarie", middle_name: null, year_level: 2 },
    { inst_id: "2024-1096-AB", last_name: "Binalon", first_name: "Melody", middle_name: "Horcajo", year_level: 3 },
    { inst_id: "2023-1187-AB", last_name: "Bohol", first_name: "Glen", middle_name: "Lombres", year_level: 2 },
    { inst_id: "2025-2010-AB", last_name: "Brillo", first_name: "Shena", middle_name: "Diocton", year_level: 2 },
    { inst_id: "2023-1144-AB", last_name: "Brillo", first_name: "Paul Joshua", middle_name: "Diocton", year_level: 4 },
    { inst_id: "2024-1043-AB", last_name: "Bunod", first_name: "Salonica", middle_name: "Manera", year_level: 3 },
    { inst_id: "2025-1360-AB", last_name: "Cabaltera", first_name: "Arabelle", middle_name: "Acaya", year_level: 2 },
    { inst_id: "2024-1190-AB", last_name: "Cabilin", first_name: "Dexter", middle_name: "Valiente", year_level: 2 },
    { inst_id: "2026-3122-AB", last_name: "Cabizon", first_name: "Shekeniah", middle_name: "Alcazar", year_level: 1 },
    { inst_id: "2023-1029-AB", last_name: "Cabrera", first_name: "Vina Marie", middle_name: "Agresor", year_level: 4 },
    { inst_id: "2026-3146-AB", last_name: "Cabugao", first_name: "Maria Angelica", middle_name: null, year_level: 1 },
    { inst_id: "2024-1217-AB", last_name: "Cabugao", first_name: "Peter Kim", middle_name: "Escalona", year_level: 3 },
    { inst_id: "2025-1387-AB", last_name: "Cacayan", first_name: "Rissa Mae", middle_name: "Ratera", year_level: 2 },
    { inst_id: "2024-1039-AB", last_name: "Calma", first_name: "Lyra", middle_name: "Alcoy", year_level: 2 },
    { inst_id: "2026-3113-AB", last_name: "Camaya", first_name: "Angelica Lyka", middle_name: null, year_level: 1 },
    { inst_id: "2026-3057-AB", last_name: "Cantero", first_name: "Maria Shatherine", middle_name: "Galolo", year_level: 1 },
    { inst_id: "2023-1147-AB", last_name: "Cardona", first_name: "John Ryan", middle_name: "Horiondo", year_level: 4 },
    { inst_id: "2023-1011-AB", last_name: "Cariaso", first_name: "Paul Benedict", middle_name: "Hornedo", year_level: 4 },
    { inst_id: "2025-1342-AB", last_name: "Carzon", first_name: "Sharlene", middle_name: "Cariaso", year_level: 2 },
    { inst_id: "2024-1078-AB", last_name: "Carzon", first_name: "Carmie Denise", middle_name: "Enego", year_level: 3 },
    { inst_id: "2024-1093-AB", last_name: "Castaño", first_name: "Eiren Luxiel", middle_name: "Areola", year_level: 3 },
    { inst_id: "2025-3020-AB", last_name: "Castillejos", first_name: "Mark Anthony", middle_name: "Viola", year_level: 1 },
    { inst_id: "2024-1240-AB", last_name: "Castillo", first_name: "Maria Nicole", middle_name: "Eriful", year_level: 2 },
    { inst_id: "2019-1170-AB", last_name: "Castillo", first_name: "Michael", middle_name: "Mina", year_level: 2 },
    { inst_id: "2026-3164-AB", last_name: "Castro", first_name: "Monica", middle_name: "Roniño", year_level: 1 },
    { inst_id: "2024-1237-AB", last_name: "Catabay", first_name: "Rheany", middle_name: "Quitola", year_level: 2 },
    { inst_id: "2026-3092-AB", last_name: "Cataluña", first_name: "Marjhon", middle_name: "Cabas", year_level: 1 },
    { inst_id: "2025-1292-AB", last_name: "Comision", first_name: "Julie Jane", middle_name: "Padilla", year_level: 2 },
    { inst_id: "2023-1055-AB", last_name: "Cultura", first_name: "Kryza Anne", middle_name: "Gaza", year_level: 4 },
    { inst_id: "2025-1405-AB", last_name: "Danila", first_name: "Wilbert Paul", middle_name: "Aguas", year_level: 2 },
    { inst_id: "2024-1076-AB", last_name: "Daroca", first_name: "Rhobie Gayle", middle_name: "Castillo", year_level: 3 },
    { inst_id: "2023-1150-AB", last_name: "Daroca", first_name: "Yaniley Rhobie", middle_name: "Castillo", year_level: 4 },
    { inst_id: "2023-1059-AB", last_name: "De Guzman", first_name: "Sheena Rose", middle_name: "Manzo", year_level: 4 },
    { inst_id: "2024-1082-AB", last_name: "Dela Cruz", first_name: "Alfred John", middle_name: "Alavado", year_level: 3 },
    { inst_id: "2026-3139-AB", last_name: "Delatado", first_name: "Joshiane", middle_name: "Intervalo", year_level: 1 },
    { inst_id: "2026-3199-AB", last_name: "Domingo", first_name: "Mamico", middle_name: "Padduyao", year_level: 1 },
    { inst_id: "2023-1151-AB", last_name: "Ebalin", first_name: "Carlo", middle_name: "Tubice", year_level: 4 },
    { inst_id: "2024-1011-AB", last_name: "Elcano", first_name: "Zack", middle_name: "Hortiz", year_level: 3 },
    { inst_id: "2023-1152-AB", last_name: "Elento", first_name: "Rachel", middle_name: "Ballada", year_level: 4 },
    { inst_id: "2024-1172-AB", last_name: "Elica", first_name: "Jan Raven", middle_name: "Hortiz", year_level: 3 },
    { inst_id: "2026-3056-AB", last_name: "Elvinia", first_name: "Janela", middle_name: "Derecho", year_level: 1 },
    { inst_id: "2026-3034-AB", last_name: "Escobido", first_name: "Camille", middle_name: "Pajudpud", year_level: 1 },
    { inst_id: "2023-1018-AB", last_name: "Espera", first_name: "James Kelly", middle_name: "Ebina", year_level: 4 },
    { inst_id: "2023-1153-AB", last_name: "Evina", first_name: "Stephen", middle_name: "Doniapon", year_level: 4 },
    { inst_id: "2026-3053-AB", last_name: "Fernandez", first_name: "Gerald", middle_name: "Agabin", year_level: 1 },
    { inst_id: "2026-3149-AB", last_name: "Fidel", first_name: "Shyloh Adine", middle_name: null, year_level: 1 },
    { inst_id: "2023-1154-AB", last_name: "Gabas", first_name: "Marx Nathaniel", middle_name: null, year_level: 4 },
    { inst_id: "2024-1129-AB", last_name: "Gabotero", first_name: "Joland", middle_name: "Haro", year_level: 3 },
    { inst_id: "2026-3148-AB", last_name: "Gamboa", first_name: "Icyer", middle_name: null, year_level: 1 },
    { inst_id: "2024-1243-AB", last_name: "Garcia", first_name: "John Maverick", middle_name: "Diente", year_level: 2 },
    { inst_id: "2025-1329-AB", last_name: "Gato", first_name: "Vanessa", middle_name: "Villena", year_level: 2 },
    { inst_id: "2024-1138-AB", last_name: "Gonzales", first_name: "Jacob", middle_name: "Caddarrao", year_level: 3 },
    { inst_id: "2024-1263-AB", last_name: "Gordo", first_name: "Lloyd William", middle_name: "Valiente", year_level: 2 },
    { inst_id: "2024-1026-AB", last_name: "Gordo", first_name: "Jess Christopher", middle_name: "Gulaga", year_level: 3 },
    { inst_id: "2024-1091-AB", last_name: "Graiz", first_name: "Joshua", middle_name: "Atunay", year_level: 3 },
    { inst_id: "2022-1017-AB", last_name: "Guerrero", first_name: "John Paul", middle_name: "Ballada", year_level: 2 },
    { inst_id: "2024-1071-AB", last_name: "Guisando", first_name: "Charles Mikko", middle_name: null, year_level: 3 },
    { inst_id: "2024-1069-AB", last_name: "Gulaga", first_name: "Mark Patrick", middle_name: "Velayo", year_level: 3 },
    { inst_id: "2024-1204-AB", last_name: "Gulaga", first_name: "Mike Jave", middle_name: "Salamagos", year_level: 2 },
    { inst_id: "2025-1354-AB", last_name: "Habana", first_name: "Camille", middle_name: "Beronque", year_level: 2 },
    { inst_id: "2024-1086-AB", last_name: "Heruela", first_name: "Jamela Aisha", middle_name: "Castro", year_level: 3 },
    { inst_id: "2024-1084-AB", last_name: "Honesta", first_name: "Seigfrid", middle_name: "Falces", year_level: 3 },
    { inst_id: "2024-1144-AB", last_name: "Horiondo", first_name: "Joel Jr.", middle_name: "Valiente", year_level: 3 },
    { inst_id: "2019-1233-AB", last_name: "Hostallero", first_name: "Lynette Mae", middle_name: "Adami", year_level: 2 },
    { inst_id: "2024-1152-AB", last_name: "Hubalde", first_name: "Gaspar Jr.", middle_name: "Hoyos", year_level: 3 },
    { inst_id: "2024-1280-AB", last_name: "Intervalo", first_name: "Luis Dominic", middle_name: "Alcazar", year_level: 2 },
    { inst_id: "2025-3011-AB", last_name: "Javier", first_name: "Denver Russell", middle_name: "Ceballos", year_level: 1 },
    { inst_id: "2025-3002-AB", last_name: "Jurabal", first_name: "Malex", middle_name: "Duerme", year_level: 2 },
    { inst_id: "2024-1101-AB", last_name: "Lagundino", first_name: "Jacob Clancy", middle_name: "Batiforra", year_level: 3 },
    { inst_id: "2024-1189-AB", last_name: "Lampas", first_name: "Lexter", middle_name: "Labrador", year_level: 3 },
    { inst_id: "2024-1214-AB", last_name: "Lavengco", first_name: "Carlito", middle_name: "Velaño", year_level: 3 },
    { inst_id: "2024-1088-AB", last_name: "Librero", first_name: "Maria Karyle", middle_name: "Eriful", year_level: 3 },
    { inst_id: "2023-1157-AB", last_name: "Librero", first_name: "John", middle_name: "Eriful", year_level: 4 },
    { inst_id: "2024-1012-AB", last_name: "Manana", first_name: "Sam Silver", middle_name: "Ugaddan", year_level: 2 },
    { inst_id: "2025-1374-AB", last_name: "Manzo", first_name: "John Jezreel", middle_name: "De La Torre", year_level: 2 },
    { inst_id: "2026-3138-AB", last_name: "Mata", first_name: "Jhana Steff", middle_name: "Acebes", year_level: 1 },
    { inst_id: "2025-1335-AB", last_name: "Mata", first_name: "Hareitte Mae", middle_name: "Zureta", year_level: 2 },
    { inst_id: "2026-3107-AB", last_name: "Meman", first_name: "Janelle", middle_name: "Baletin", year_level: 1 },
    { inst_id: "2024-1136-AB", last_name: "Mergal", first_name: "Lyca", middle_name: "Niño", year_level: 3 },
    { inst_id: "2025-1340-AB", last_name: "Merin", first_name: "Francine Kae", middle_name: "Cabugao", year_level: 2 },
    { inst_id: "2024-1222-AB", last_name: "Merina", first_name: "Dholian", middle_name: "Intervalo", year_level: 2 },
    { inst_id: "2020-1005-AB", last_name: "Mina", first_name: "Jenefer", middle_name: "Gonzales", year_level: 4 },
    { inst_id: "2024-1171-AB", last_name: "Moro", first_name: "Aramae", middle_name: "Quinto", year_level: 3 },
    { inst_id: "2025-1349-AB", last_name: "Nico", first_name: "Clint Adrian", middle_name: "Salengua", year_level: 2 },
    { inst_id: "2026-3173-AB", last_name: "Nicolas", first_name: "Mark Wilben", middle_name: "Cruz", year_level: 1 },
    { inst_id: "2026-3174-AB", last_name: "Nicolas", first_name: "Ariana Caxiopeia", middle_name: "Cruz", year_level: 1 },
    { inst_id: "2024-1153-AB", last_name: "Niño", first_name: "John Ivan", middle_name: "Cabugao", year_level: 1 },
    { inst_id: "2024-1085-AB", last_name: "Noblejas", first_name: "Dominick", middle_name: "Apresto", year_level: 3 },
    { inst_id: "2026-3165-AB", last_name: "Nola", first_name: "John Amiel", middle_name: "Castillo", year_level: 1 },
    { inst_id: "2021-2014-AB", last_name: "Nola", first_name: "Gloria Beth", middle_name: "Alcantara", year_level: 3 },
    { inst_id: "2024-1212-AB", last_name: "Noleal", first_name: "Karen", middle_name: "Cultura", year_level: 3 },
    { inst_id: "2025-1372-AB", last_name: "Ortiz", first_name: "Dominic Excel", middle_name: "Comaya", year_level: 2 },
    { inst_id: "2026-3196-AB", last_name: "Pajudpud", first_name: "Ma. Alliyah", middle_name: null, year_level: 1 },
    { inst_id: "2026-3124-AB", last_name: "Pama", first_name: "Niel Axel", middle_name: "Mayor", year_level: 1 },
    { inst_id: "2024-1116-AB", last_name: "Paradeza", first_name: "Matt Benmar", middle_name: "Valdesancho", year_level: 2 },
    { inst_id: "2025-1337-AB", last_name: "Pedronan", first_name: "Justine", middle_name: "Dela Cruz", year_level: 2 },
    { inst_id: "2024-1089-AB", last_name: "Perez", first_name: "John Lee", middle_name: "Feliciano", year_level: 3 },
    { inst_id: "2026-3169-AB", last_name: "Pimentel", first_name: "Neil Gabriel", middle_name: "Nuñez", year_level: 1 },
    { inst_id: "2026-3072-AB", last_name: "Ponce", first_name: "Gian Steve", middle_name: null, year_level: 1 },
    { inst_id: "2025-1415-AB", last_name: "Poncio", first_name: "Khanley", middle_name: null, year_level: 3 },
    { inst_id: "2024-1193-AB", last_name: "Reyes", first_name: "Cherylee", middle_name: "Libaton", year_level: 2 },
    { inst_id: "2024-1254-AB", last_name: "Roniño", first_name: "Maria Regene", middle_name: "Gulaga", year_level: 2 },
    { inst_id: "2025-1368-AB", last_name: "Salamagos", first_name: "Tracy Nicole", middle_name: null, year_level: 2 },
    { inst_id: "2024-1154-AB", last_name: "Salengua", first_name: "Jared", middle_name: "Navarro", year_level: 3 },
    { inst_id: "2024-1020-AB", last_name: "Simon", first_name: "Mark", middle_name: "Dican", year_level: 3 },
    { inst_id: "2024-1203-AB", last_name: "Sotto", first_name: "Teresa Jane", middle_name: "Umayam", year_level: 4 },
    { inst_id: "2024-1206-AB", last_name: "Tabuso", first_name: "Pio Luis", middle_name: "Salengua", year_level: 3 },
    { inst_id: "2024-1253-AB", last_name: "Tabuso", first_name: "John David", middle_name: null, year_level: 2 },
    { inst_id: "2026-3070-AB", last_name: "Tolentino", first_name: "Aldrin Paul", middle_name: "Cabrito", year_level: 1 },
    { inst_id: "2026-3130-AB", last_name: "Trinidad", first_name: "Davin Adriel", middle_name: "Hordoñez", year_level: 1 },
    { inst_id: "2024-1108-AB", last_name: "Valiente", first_name: "Adrian Louie", middle_name: null, year_level: 3 },
    { inst_id: "2026-3106-AB", last_name: "Vargas", first_name: "Ella Mae", middle_name: "Servillon", year_level: 1 },
    { inst_id: "2024-1074-AB", last_name: "Vargas", first_name: "Jacob Keegan", middle_name: "Visaya", year_level: 2 },
    { inst_id: "2025-1290-AB", last_name: "Verana", first_name: "Jan Dominic", middle_name: "Abas", year_level: 2 },
    { inst_id: "2023-1227-AB", last_name: "Verzon", first_name: "Aiza", middle_name: "Laderas", year_level: 4 },
    { inst_id: "2024-1075-AB", last_name: "Villacruzada", first_name: "Anthony", middle_name: "Danila", year_level: 3 },
    { inst_id: "2026-3089-AB", last_name: "Villacruzada", first_name: "Thomas", middle_name: "Danila", year_level: 1 },
    { inst_id: "2024-1068-AB", last_name: "Villarta", first_name: "Roxie Mae", middle_name: "Bongay", year_level: 2 },
    { inst_id: "2024-1164-AB", last_name: "Villegas", first_name: "Rachelle Anne", middle_name: "Marigondon", year_level: 3 },
    { inst_id: "2023-1161-AB", last_name: "Villegas", first_name: "Roselle Anne", middle_name: "Marigondon", year_level: 4 },
    { inst_id: "2019-1080-AB", last_name: "Viola", first_name: "Samantha Grace", middle_name: "Gato", year_level: 2 },
    { inst_id: "2024-1032-AB", last_name: "Ybay", first_name: "Zyrah", middle_name: "Adami", year_level: 3 }
  ];

  for (const s of initialStudents) {
    const sUser = await prisma.user.create({
      data: {
        institutional_id: s.inst_id,
        password_hash: studentPasswordHash,
        role: "Student",
        require_password_update: false,
      },
    });
    await prisma.student.create({
      data: {
        student_id: sUser.user_id,
        first_name: s.first_name,
        middle_name: s.middle_name,
        last_name: s.last_name,
        program_id: bsinfotechProg.program_id,
        year_level: s.year_level,
        section: "Section A",
      },
    });
  }

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
