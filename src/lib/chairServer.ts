import db from "@/lib/db";
import bcrypt from "bcryptjs";

let seededChairsFlag = false;
let lastSeededTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // Cache for 24 hours

export async function ensureChairsAndDepartmentsExist(force = false) {
  const now = Date.now();
  if (!force && seededChairsFlag && (now - lastSeededTime < CACHE_TTL_MS)) {
    return;
  }

  try {
    let cachedHash: string | null = null;
    const getPasswordHash = async () => {
      if (!cachedHash) {
        const salt = await bcrypt.genSalt(10);
        cachedHash = await bcrypt.hash("password123", salt);
      }
      return cachedHash;
    };

    // 1. Ensure basic Departments exist
    const deptsToEnsure = [
      { name: "CITD" },
      { name: "Teacher Education Department" },
      { name: "Agriculture Department" },
      { name: "Hospitality and Tourism Management Department" },
    ];

    const deptMap: Record<string, number> = {};
    for (const d of deptsToEnsure) {
      let dept = await db.department.findFirst({
        where: { department_name: d.name },
      });
      if (!dept) {
        dept = await db.department.create({
          data: { department_name: d.name },
        });
      }
      deptMap[d.name] = dept.department_id;
    }

    // 2. Ensure Academic Programs exist and map to correct departments
    const programsToEnsure = [
      { code: "BSInfoTech", name: "Bachelor of Science in Information Technology", deptName: "CITD" },
      { code: "BSIT", name: "Bachelor of Science in Industrial Technology", deptName: "CITD" },
      { code: "BEED", name: "Bachelor of Elementary Education", deptName: "Teacher Education Department" },
      { code: "BSED", name: "Bachelor of Secondary Education", deptName: "Teacher Education Department" },
      { code: "BSA", name: "Bachelor of Science in Agriculture", deptName: "Agriculture Department" },
      { code: "BSHM", name: "Bachelor of Science in Hospitality Management", deptName: "Hospitality and Tourism Management Department" },
      { code: "BSTM", name: "Bachelor of Science in Tourism Management", deptName: "Hospitality and Tourism Management Department" },
    ];

    const progMap: Record<string, number> = {};
    for (const p of programsToEnsure) {
      let prog = await db.academicProgram.findUnique({
        where: { program_code: p.code },
      });
      const deptId = deptMap[p.deptName];
      if (!prog) {
        prog = await db.academicProgram.create({
          data: {
            program_code: p.code,
            program_name: p.name,
            department_id: deptId,
          },
        });
      } else {
        if (prog.program_name !== p.name || (deptId && prog.department_id !== deptId)) {
          prog = await db.academicProgram.update({
            where: { program_id: prog.program_id },
            data: {
              program_name: p.name,
              department_id: deptId || prog.department_id,
            },
          });
        }
      }
      progMap[p.code] = prog.program_id;
    }

    // 3. Define specific Department Chairs and Program Chairs
    const deptChairsData = [
      {
        institutionalId: "CHAIR-CITD",
        username: "chair_citd",
        deptName: "CITD",
        firstName: "CITD",
        lastName: "Department Chairperson",
      },
      {
        institutionalId: "CHAIR-TED",
        username: "chair_ted",
        deptName: "Teacher Education Department",
        firstName: "TED",
        lastName: "Department Chairperson",
      },
      {
        institutionalId: "CHAIR-AGRI",
        username: "chair_agri",
        deptName: "Agriculture Department",
        firstName: "Agri",
        lastName: "Department Chairperson",
      },
      {
        institutionalId: "CHAIR-HTM",
        username: "chair_htm",
        deptName: "Hospitality and Tourism Management Department",
        firstName: "HTM",
        lastName: "Department Chairperson",
      },
    ];

    const progChairsData = [
      {
        institutionalId: "PC-ICT",
        username: "progchair_ict",
        role: "ProgramChair" as const,
        deptName: "CITD",
        programCode: "BSInfoTech",
        firstName: "BSInfoTech",
        lastName: "Program Chairperson",
      },
      {
        institutionalId: "PC-ITD",
        username: "progchair_itd",
        role: "ProgramChair" as const,
        deptName: "CITD",
        programCode: "BSIT",
        firstName: "BSIT",
        lastName: "Program Chairperson",
      },
      {
        institutionalId: "PC-BEED",
        username: "progchair_beed",
        role: "ProgramChair" as const,
        deptName: "Teacher Education Department",
        programCode: "BEED",
        firstName: "BEED",
        lastName: "Program Chairperson",
      },
      {
        institutionalId: "PC-BSED",
        username: "progchair_bsed",
        role: "ProgramChair" as const,
        deptName: "Teacher Education Department",
        programCode: "BSED",
        firstName: "BSED",
        lastName: "Program Chairperson",
      },
    ];

    // 3. First, convert all pre-existing chair records to Department Chairs (clear program_id = null)
    // except for the designated Program Chair accounts.
    const designatedProgChairInstIds = progChairsData.map((pc) => pc.institutionalId);
    const existingProgUsers = await db.user.findMany({
      where: { institutional_id: { in: designatedProgChairInstIds } },
      select: { user_id: true },
    });
    const designatedProgUserIds = existingProgUsers.map((u) => u.user_id);

    await db.chair.updateMany({
      where: {
        chair_id: { notIn: designatedProgUserIds },
      },
      data: {
        is_program_chair: false,
        program_id: null,
      },
    });

    await db.user.updateMany({
      where: {
        user_id: { notIn: designatedProgUserIds },
        role: "ProgramChair",
      },
      data: {
        role: "Chair",
      },
    });

    // 4. Create / Update Program Chairs
    const programChairUserIds: number[] = [];

    for (const pc of progChairsData) {
      let user = await db.user.findFirst({
        where: {
          OR: [
            { institutional_id: pc.institutionalId },
            { username: pc.username },
          ],
        },
      });

      if (!user) {
        user = await db.user.create({
          data: {
            institutional_id: pc.institutionalId,
            username: pc.username,
            password_hash: await getPasswordHash(),
            role: "ProgramChair",
            require_password_update: false,
          },
        });
      } else {
        user = await db.user.update({
          where: { user_id: user.user_id },
          data: {
            institutional_id: pc.institutionalId,
            role: "ProgramChair",
          },
        });
      }

      programChairUserIds.push(user.user_id);
      const programId = progMap[pc.programCode];
      const deptId = deptMap[pc.deptName];

      await db.chair.upsert({
        where: { chair_id: user.user_id },
        update: {
          department_id: deptId,
          program_id: programId,
          is_program_chair: true,
        },
        create: {
          chair_id: user.user_id,
          department_id: deptId,
          program_id: programId,
          is_program_chair: true,
        },
      });

      // Ensure Program Chair also has a Faculty record so DI can assign subjects to them
      await db.faculty.upsert({
        where: { faculty_id: user.user_id },
        update: {
          department_id: deptId,
        },
        create: {
          faculty_id: user.user_id,
          first_name: pc.firstName,
          last_name: pc.lastName,
          department_id: deptId,
        },
      });
    }

    // 5. Create / Update Department Chairs
    for (const dc of deptChairsData) {
      let user = await db.user.findFirst({
        where: {
          OR: [
            { institutional_id: dc.institutionalId },
            { username: dc.username },
          ],
        },
      });

      if (!user) {
        user = await db.user.create({
          data: {
            institutional_id: dc.institutionalId,
            username: dc.username,
            password_hash: await getPasswordHash(),
            role: "Chair",
            require_password_update: false,
          },
        });
      } else if (user.role !== "Chair" || user.institutional_id !== dc.institutionalId) {
        user = await db.user.update({
          where: { user_id: user.user_id },
          data: {
            institutional_id: dc.institutionalId,
            role: "Chair",
          },
        });
      }

      const deptId = deptMap[dc.deptName];
      await db.chair.upsert({
        where: { chair_id: user.user_id },
        update: {
          department_id: deptId,
          program_id: null,
          is_program_chair: false,
        },
        create: {
          chair_id: user.user_id,
          department_id: deptId,
          program_id: null,
          is_program_chair: false,
        },
      });

      // Ensure Department Chair also has a Faculty record so DI can assign subjects to them
      await db.faculty.upsert({
        where: { faculty_id: user.user_id },
        update: {
          department_id: deptId,
        },
        create: {
          faculty_id: user.user_id,
          first_name: dc.firstName,
          last_name: dc.lastName,
          department_id: deptId,
        },
      });
    }

    // 6. Ensure sample Faculty exist for each department
    const sampleFaculty = [
      { facultyId: "FACULTY-ICT", firstName: "Mark", lastName: "Abad", deptName: "CITD" },
      { facultyId: "FACULTY-ITD", firstName: "Elena", lastName: "Cruz", deptName: "CITD" },
      { facultyId: "FACULTY-TED", firstName: "Joseph", lastName: "Garcia", deptName: "Teacher Education Department" },
      { facultyId: "FACULTY-AGRI", firstName: "Maria", lastName: "Santos", deptName: "Agriculture Department" },
      { facultyId: "FACULTY-HTM", firstName: "Carlos", lastName: "Reyes", deptName: "Hospitality and Tourism Management Department" },
    ];

    for (const f of sampleFaculty) {
      let fUser = await db.user.findUnique({
        where: { institutional_id: f.facultyId },
      });
      if (!fUser) {
        fUser = await db.user.create({
          data: {
            institutional_id: f.facultyId,
            username: `faculty_${f.facultyId.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
            password_hash: await getPasswordHash(),
            role: "Faculty",
            require_password_update: false,
          },
        });
      }

      const deptId = deptMap[f.deptName];
      const fRecord = await db.faculty.findUnique({
        where: { faculty_id: fUser.user_id },
      });

      if (!fRecord) {
        await db.faculty.create({
          data: {
            faculty_id: fUser.user_id,
            first_name: f.firstName,
            last_name: f.lastName,
            department_id: deptId,
          },
        });
      } else if (fRecord.department_id !== deptId) {
        await db.faculty.update({
          where: { faculty_id: fUser.user_id },
          data: { department_id: deptId },
        });
      }
    }

    seededChairsFlag = true;
    lastSeededTime = now;
  } catch (err) {
    console.error("Error in ensureChairsAndDepartmentsExist:", err);
  }
}

