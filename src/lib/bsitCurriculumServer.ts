import db from "@/lib/db";
import { ALL_CURRICULUMS } from "./bsitCurriculum";

let seededBsitCoursesFlag = false;
let lastBsitSeededTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/** Ensures all program curriculum courses (BSIT, BSHM, BSA, BSTM, etc.) and programs exist in DB */
export async function ensureBsitCoursesExist(force = false) {
  const now = Date.now();
  if (!force && seededBsitCoursesFlag && (now - lastBsitSeededTime < CACHE_TTL_MS)) {
    return;
  }

  try {
    // A. Rename old Information Technology (if it still has code BSIT) to "BSInfoTech" safely
    try {
      const targetBsInfoTech = await db.academicProgram.findUnique({
        where: { program_code: "BSInfoTech" },
      });

      if (!targetBsInfoTech) {
        const legacyIT = await db.academicProgram.findFirst({
          where: {
            program_code: "BSIT",
            OR: [
              { program_name: { contains: "Information", mode: "insensitive" } },
              { department: { department_name: { contains: "IT", mode: "insensitive" } } },
            ],
          },
        });
        if (legacyIT) {
          await db.academicProgram.update({
            where: { program_id: legacyIT.program_id },
            data: {
              program_code: "BSInfoTech",
              program_name: "Bachelor of Science in Information Technology",
            },
          });
        }
      }

      // B. Rename old Industrial Technology (if it still has code BSINDTECH) to "BSIT" safely
      const targetBsit = await db.academicProgram.findUnique({
        where: { program_code: "BSIT" },
      });

      if (!targetBsit) {
        const legacyIndTech = await db.academicProgram.findFirst({
          where: {
            program_code: { not: "BSIT" },
            OR: [
              { program_code: "BSINDTECH" },
              { program_name: { contains: "Industrial", mode: "insensitive" } },
            ],
          },
        });
        if (legacyIndTech) {
          await db.academicProgram.update({
            where: { program_id: legacyIndTech.program_id },
            data: {
              program_code: "BSIT",
              program_name: "Bachelor of Science in Industrial Technology",
            },
          });
        }
      }
    } catch (migErr) {
      console.warn("Curriculum program code migration notice:", migErr);
    }

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
    seededBsitCoursesFlag = true;
    lastBsitSeededTime = now;
  } catch (error) {
    console.error("Error ensuring curriculum courses exist in DB:", error);
  }
}
