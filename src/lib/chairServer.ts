import db from "@/lib/db";
import bcrypt from "bcryptjs";

let seededChairsFlag = false;
let lastSeededTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // Cache for 1 hour

export async function ensureChairsAndDepartmentsExist(force = false) {
  const now = Date.now();
  if (!force && seededChairsFlag && (now - lastSeededTime < CACHE_TTL_MS)) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("password123", salt);

    const deptsData = [
      {
        name: "Agriculture Department",
        chairId: "CHAIR-AGRI",
        chairUsername: "chair_agri",
        facultyId: "FACULTY-AGRI",
        facultyFirstName: "Maria",
        facultyLastName: "Santos",
        programs: [
          { code: "BSA", name: "Bachelor of Science in Agriculture" },
        ],
      },
      {
        name: "Hospitality and Tourism Management Department",
        chairId: "CHAIR-HTM",
        chairUsername: "chair_htm",
        facultyId: "FACULTY-HTM",
        facultyFirstName: "Carlos",
        facultyLastName: "Reyes",
        programs: [
          { code: "BSHM", name: "Bachelor of Science in Hospitality Management" },
          { code: "BSTM", name: "Bachelor of Science in Tourism Management" },
        ],
      },
      {
        name: "IT Department",
        chairId: "CHAIR-001",
        chairUsername: "chair_it",
        facultyId: "FACULTY-001",
        facultyFirstName: "Mark",
        facultyLastName: "Abad",
        programs: [
          { code: "BS Info Tech", name: "Bachelor of Science in Information Technology" },
        ],
      },
      {
        name: "Industrial Technology Department",
        chairId: "CHAIR-INDTECH",
        chairUsername: "chair_indtech",
        facultyId: "FACULTY-INDTECH",
        facultyFirstName: "Elena",
        facultyLastName: "Cruz",
        programs: [
          { code: "BSIT", name: "Bachelor of Science in Industrial Technology" },
        ],
      },
      {
        name: "Teacher Education Department",
        chairId: "CHAIR-TED",
        chairUsername: "chair_ted",
        facultyId: "FACULTY-TED",
        facultyFirstName: "Joseph",
        facultyLastName: "Garcia",
        programs: [
          { code: "BEED", name: "Bachelor of science in elementary education" },
          { code: "BSED", name: "Bachelor of Science in Secondary education" },
        ],
      },
    ];

    // Migrate program codes if needed:
    // 1. Old BSIT (Information Technology) -> "BS Info Tech"
    await db.academicProgram.updateMany({
      where: {
        program_code: "BSIT",
        OR: [
          { program_name: { contains: "Information", mode: "insensitive" } },
          { department: { department_name: { contains: "IT", mode: "insensitive" } } },
        ],
      },
      data: {
        program_code: "BS Info Tech",
        program_name: "Bachelor of Science in Information Technology",
      },
    });

    // 2. Old BSINDTECH (Industrial Technology) -> "BSIT"
    await db.academicProgram.updateMany({
      where: {
        OR: [
          { program_code: "BSINDTECH" },
          {
            AND: [
              { program_name: { contains: "Industrial", mode: "insensitive" } },
              { program_code: { not: "BSIT" } },
            ],
          },
        ],
      },
      data: {
        program_code: "BSIT",
        program_name: "Bachelor of Science in Industrial Technology",
      },
    });

    // 3. Teacher Education Department names
    await db.academicProgram.updateMany({
      where: {
        OR: [
          { program_code: "BSED" },
          { program_name: { contains: "Secondary", mode: "insensitive" } },
        ],
      },
      data: {
        program_name: "Bachelor of Science in Secondary education",
      },
    });

    await db.academicProgram.updateMany({
      where: {
        OR: [
          { program_code: "BEED" },
          { program_name: { contains: "Elementary", mode: "insensitive" } },
        ],
      },
      data: {
        program_name: "Bachelor of science in elementary education",
      },
    });

    for (const d of deptsData) {
      // 1. Ensure department exists
      let dept = await db.department.findFirst({
        where: { department_name: d.name },
      });

      if (!dept) {
        dept = await db.department.create({
          data: { department_name: d.name },
        });
      }

      // 2. Ensure academic programs exist
      for (const p of d.programs) {
        const prog = await db.academicProgram.findUnique({
          where: { program_code: p.code },
        });
        if (!prog) {
          await db.academicProgram.create({
            data: {
              program_code: p.code,
              program_name: p.name,
              department_id: dept.department_id,
            },
          });
        } else if (prog.program_name !== p.name) {
          await db.academicProgram.update({
            where: { program_id: prog.program_id },
            data: { program_name: p.name },
          });
        }
      }

      // 3. Ensure Chair user & chair record exist
      let chairUser = await db.user.findUnique({
        where: { institutional_id: d.chairId },
      });

      if (!chairUser) {
        chairUser = await db.user.create({
          data: {
            institutional_id: d.chairId,
            username: d.chairUsername,
            password_hash: passwordHash,
            role: "Chair",
            require_password_update: false,
          },
        });
      }

      const chairRecord = await db.chair.findUnique({
        where: { chair_id: chairUser.user_id },
      });

      if (!chairRecord) {
        const existingDeptChair = await db.chair.findUnique({
          where: { department_id: dept.department_id },
        });

        if (!existingDeptChair) {
          await db.chair.create({
            data: {
              chair_id: chairUser.user_id,
              department_id: dept.department_id,
            },
          });
        }
      }

      // 4. Ensure Faculty user & faculty record exist
      let facultyUser = await db.user.findUnique({
        where: { institutional_id: d.facultyId },
      });

      if (!facultyUser) {
        facultyUser = await db.user.create({
          data: {
            institutional_id: d.facultyId,
            username: `faculty_${d.facultyId.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
            password_hash: passwordHash,
            role: "Faculty",
            require_password_update: false,
          },
        });
      }

      const facultyRecord = await db.faculty.findUnique({
        where: { faculty_id: facultyUser.user_id },
      });

      if (!facultyRecord) {
        await db.faculty.create({
          data: {
            faculty_id: facultyUser.user_id,
            first_name: d.facultyFirstName,
            last_name: d.facultyLastName,
            department_id: dept.department_id,
          },
        });
      }
    }
    seededChairsFlag = true;
    lastSeededTime = now;
  } catch (err) {
    console.error("Error in ensureChairsAndDepartmentsExist:", err);
  }
}
