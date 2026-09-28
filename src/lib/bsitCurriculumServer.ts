import db from "@/lib/db";
import { ALL_CURRICULUMS } from "./bsitCurriculum";

/** Ensures all program curriculum courses (BSIT, BSHM, etc.) exist in the database table COURSES */
export async function ensureBsitCoursesExist() {
  try {
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
