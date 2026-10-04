import db from "@/lib/db";
import { unstable_cache } from "next/cache";
import { cache } from "react";

/**
 * Cached fetch for all academic programs.
 * Uses Next.js Data Cache with a 1-hour TTL and 'academic-programs' tag.
 */
export const getAcademicProgramsCached = unstable_cache(
  async () => {
    return db.academicProgram.findMany({
      orderBy: { program_name: "asc" },
    });
  },
  ["academic-programs-all"],
  {
    revalidate: 3600,
    tags: ["academic-programs"],
  }
);

/**
 * Cached fetch for all courses.
 * Uses Next.js Data Cache with a 1-hour TTL and 'courses' tag.
 */
export const getCoursesCached = unstable_cache(
  async () => {
    return db.course.findMany({
      orderBy: { course_code: "asc" },
    });
  },
  ["courses-all"],
  {
    revalidate: 3600,
    tags: ["courses"],
  }
);

/**
 * Cached fetch for departments.
 * Uses Next.js Data Cache with a 1-hour TTL and 'departments' tag.
 */
export const getDepartmentsCached = unstable_cache(
  async () => {
    return db.department.findMany({
      orderBy: { department_name: "asc" },
    });
  },
  ["departments-all"],
  {
    revalidate: 3600,
    tags: ["departments"],
  }
);

/**
 * Cached fetch for system settings by key.
 * Uses Next.js Data Cache with a 60-second TTL and 'system-settings' tag.
 */
export const getSystemSettingCached = (key: string) =>
  unstable_cache(
    async () => {
      return db.systemSetting.findUnique({
        where: { key },
      });
    },
    [`system-setting-${key}`],
    {
      revalidate: 60,
      tags: ["system-settings", `system-setting-${key}`],
    }
  )();

/**
 * Per-request memoized lookup for DB user by institutional ID using React cache().
 */
export const getCachedUserByInstitutionalId = cache(async (institutionalId: string) => {
  if (!institutionalId) return null;
  return db.user.findUnique({
    where: { institutional_id: institutionalId },
  });
});

import type { AcademicPeriodSettings } from "@/lib/academicUtils";

/**
 * Cached fetch for active academic period settings.
 * Uses Next.js Data Cache with a 5-minute TTL and 'academic-period' tag.
 */
export const getActiveAcademicPeriodCached = unstable_cache(
  async (): Promise<AcademicPeriodSettings> => {
    try {
      const settings = await db.systemSetting.findMany({
        where: {
          key: {
            in: [
              "active_academic_year",
              "active_semester",
              "active_term",
              "sem1_start",
              "sem1_end",
              "sem2_start",
              "sem2_end",
            ],
          },
        },
      });

      const map = new Map(settings.map(s => [s.key, s.value]));

      const now = new Date();
      const currentYear = now.getFullYear();
      const defaultAY = now.getMonth() >= 5 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;

      return {
        active_academic_year: map.get("active_academic_year") || defaultAY,
        active_semester: map.get("active_semester") || (now.getMonth() >= 7 ? "1st Semester" : "2nd Semester"),
        active_term: map.get("active_term") || "Midterm",
        sem1_start: map.get("sem1_start") || `${currentYear}-08-01`,
        sem1_end: map.get("sem1_end") || `${currentYear}-12-31`,
        sem2_start: map.get("sem2_start") || `${currentYear + 1}-01-01`,
        sem2_end: map.get("sem2_end") || `${currentYear + 1}-05-31`,
      };
    } catch (err) {
      console.error("Error fetching cached academic period:", err);
      return {
        active_academic_year: "2026-2027",
        active_semester: "1st Semester",
        active_term: "Midterm",
        sem1_start: "2026-08-01",
        sem1_end: "2026-12-31",
        sem2_start: "2027-01-01",
        sem2_end: "2027-05-31",
      };
    }
  },
  ["active-academic-period-v1"],
  {
    revalidate: 300,
    tags: ["academic-period", "system-settings"],
  }
);

/**
 * Per-request memoized lookup for full Student user profile using React cache().
 */
export const getCachedStudentUser = cache(async (institutionalId: string) => {
  if (!institutionalId) return null;
  return db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      student: {
        include: {
          program: {
            include: {
              department: true,
            },
          },
          studentCourses: {
            include: {
              course: true,
            },
          },
        },
      },
    },
  });
});

