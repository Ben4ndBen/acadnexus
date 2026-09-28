import db from "@/lib/db";
import { BSIT_CURRICULUM } from "./bsitCurriculum";

/** Ensures all BSIT courses exist in the database table COURSES */
export async function ensureBsitCoursesExist() {
  try {
    for (const item of BSIT_CURRICULUM) {
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
    console.error("Error ensuring BSIT courses exist in DB:", error);
  }
}
