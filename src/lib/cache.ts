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
