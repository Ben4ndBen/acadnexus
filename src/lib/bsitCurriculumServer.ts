import db from "@/lib/db";
import { ALL_CURRICULUMS } from "./bsitCurriculum";

/** Ensures all program curriculum courses (BSIT, BSHM, BSA, BSTM, etc.) and programs exist in DB */
export async function ensureBsitCoursesExist() {
  try {
    // A. Rename old Information Technology (if it still has code BSIT) to "BS Info Tech"
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

    // B. Rename old Industrial Technology (if it still has code BSINDTECH) to "BSIT"
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

    // 1. Ensure BSTM academic program exists
    const bstmExists = await db.academicProgram.findFirst({
      where: {
        OR: [
          { program_code: "BSTM" },
          { program_name: { contains: "Tourism", mode: "insensitive" } },
        ],
      },
    });

    if (!bstmExists) {
      let htmDept = await db.department.findFirst({
        where: {
          OR: [
            { department_name: { contains: "Hospitality", mode: "insensitive" } },
            { department_name: { contains: "Tourism", mode: "insensitive" } },
          ],
        },
      });

      if (!htmDept) {
        htmDept = await db.department.create({
          data: { department_name: "Hospitality and Tourism Management Department" },
        });
      }

      await db.academicProgram.create({
        data: {
          program_code: "BSTM",
          program_name: "Bachelor of Science in Tourism Management",
          department_id: htmDept.department_id,
        },
      });
    }

    // 2. Ensure all curriculum courses exist
    for (const item of ALL_CURRICULUMS) {
      await db.course.upsert({
        where: { course_code: item.code },
        update: { course_title: item.title },
        create: {
          course_code: item.code,
          course_title: item.title,
        },
      });
    }
  } catch (error) {
    console.error("Error ensuring curriculum courses exist in DB:", error);
  }
}
