/**
 * Academic Department & Program to Course Mappings
 * Maps course codes to their respective departments and programs.
 */

export interface DepartmentProgramInfo {
  code: string;
  name: string;
}

export interface DepartmentInfo {
  id: number;
  name: string;
  programs: DepartmentProgramInfo[];
}

export const DEPARTMENT_PROGRAMS_MAP: Record<number, DepartmentProgramInfo[]> = {
  // ICT Department
  28: [
    { code: "BSInfoTech", name: "Bachelor of Science in Information Technology" },
  ],
  // Agriculture Department
  29: [
    { code: "BSA", name: "Bachelor of Science in Agriculture" },
  ],
  // Hospitality and Tourism Management Department
  30: [
    { code: "BSHM", name: "Bachelor of Science in Hospitality Management" },
    { code: "BSTM", name: "Bachelor of Science in Tourism Management" },
  ],
  // IT Department (Industrial Technology)
  31: [
    { code: "BSIT", name: "Bachelor of Science in Industrial Technology" },
  ],
  // Teacher Education Department
  32: [
    { code: "BEED", name: "Bachelor of Elementary Education" },
    { code: "BSED", name: "Bachelor of Secondary Education" },
  ],
};

/**
 * Checks if a course is a General Education or Common institutional course.
 */
export function isGeneralEducationCourse(courseCode: string): boolean {
  const code = (courseCode || "").trim().toUpperCase();
  return (
    code.startsWith("GE ") ||
    code.startsWith("NSTP") ||
    code.startsWith("PATHFIT") ||
    code === "ITCH" ||
    code === "CDRM" ||
    code === "TECH COMM"
  );
}

/**
 * Resolves normalized department key from either ID or Department Name.
 */
export function resolveDepartmentKey(departmentIdOrName?: number | string | null): number | null {
  if (departmentIdOrName === undefined || departmentIdOrName === null || departmentIdOrName === "") {
    return null;
  }

  const num = Number(departmentIdOrName);
  if (!isNaN(num) && DEPARTMENT_PROGRAMS_MAP[num]) {
    return num;
  }

  const str = String(departmentIdOrName).trim().toLowerCase();
  if (str.includes("industrial") || str.includes("itd")) return 31;
  if (str.includes("hospitality") || str.includes("tourism") || str.includes("htm")) return 30;
  if (str.includes("agriculture") || str.includes("agri")) return 29;
  if (str.includes("teacher") || str.includes("education") || str.includes("ted")) return 32;
  if (str.includes("ict") || str.includes("information technology") || str.includes("bsinfotech")) return 28;
  if (str === "it" || str.includes("it department")) return 31;

  return null;
}

/**
 * Gets list of programs for a given department.
 */
export function getProgramsForDepartment(departmentIdOrName?: number | string | null): DepartmentProgramInfo[] {
  const deptKey = resolveDepartmentKey(departmentIdOrName);
  if (!deptKey) return [];
  return DEPARTMENT_PROGRAMS_MAP[deptKey] || [];
}

/**
 * Determines whether a course belongs to a specific department and/or program.
 */
export function isCourseInDepartmentOrProgram(
  courseCode: string,
  departmentIdOrName?: number | string | null,
  programCode?: string | null,
  includeGeneralEducation: boolean = false
): boolean {
  if (!courseCode) return false;
  const code = courseCode.trim().toUpperCase();

  const isGE = isGeneralEducationCourse(code);
  if (isGE) {
    return includeGeneralEducation;
  }

  const deptKey = resolveDepartmentKey(departmentIdOrName);
  if (!deptKey) {
    // If no department is specified, nothing matches unless it's GE and GE is enabled
    return false;
  }

  const pCode = programCode ? programCode.trim().toUpperCase() : null;

  // 1. IT Department (deptId: 28)
  if (deptKey === 28) {
    const isITCourse =
      code.startsWith("ITC") ||
      code.startsWith("ITE") ||
      code.startsWith("ITM") ||
      code.startsWith("ITD") ||
      code === "ENT 403";
    return isITCourse;
  }

  // 2. Agriculture Department (deptId: 29)
  if (deptKey === 29) {
    const isAgriCourse =
      code.startsWith("AGRI") ||
      code.startsWith("AG EXT") ||
      code.startsWith("AGB") ||
      code.startsWith("AME") ||
      code.startsWith("ANSCI") ||
      code.startsWith("CROP PROT") ||
      code.startsWith("CROP SCI") ||
      code.startsWith("SOIL SCI") ||
      code.startsWith("THESIS") ||
      code === "PRACTICUM" ||
      code.startsWith("SEM ") ||
      code === "CA";
    return isAgriCourse;
  }

  // 3. Hospitality & Tourism Management Department (deptId: 30)
  if (deptKey === 30) {
    const isBSHMOnly = code.startsWith("HPC") || code.startsWith("HMPE") || code === "PRAC";
    const isBSTMOnly = code.startsWith("TPC") || code.startsWith("TPE") || code.startsWith("ITRM") || code === "OJT";
    const isHTMShared = code.startsWith("THC") || code.startsWith("BME");

    if (pCode === "BSHM") {
      return isBSHMOnly || isHTMShared;
    }
    if (pCode === "BSTM") {
      return isBSTMOnly || isHTMShared;
    }
    // All HTM department courses
    return isBSHMOnly || isBSTMOnly || isHTMShared;
  }

  // 4. Industrial Technology Department (deptId: 31)
  if (deptKey === 31) {
    return code.startsWith("IND");
  }

  // 5. Teacher Education Department (deptId: 32)
  if (deptKey === 32) {
    return code.startsWith("EDUC");
  }

  return false;
}

/**
 * Filter a course list according to department, program, search query, and GE inclusion.
 */
export function filterCoursesForDepartment<T extends { course_code: string; course_title: string }>(
  courses: T[],
  departmentIdOrName?: number | string | null,
  options?: {
    programCode?: string | null;
    includeGeneralEducation?: boolean;
    searchQuery?: string;
  }
): T[] {
  const { programCode = null, includeGeneralEducation = false, searchQuery = "" } = options || {};
  const query = searchQuery.trim().toLowerCase();

  return courses.filter((c) => {
    // 1. Department / Program match
    const matchesDept = isCourseInDepartmentOrProgram(
      c.course_code,
      departmentIdOrName,
      programCode,
      includeGeneralEducation
    );
    if (!matchesDept) return false;

    // 2. Search query match
    if (query) {
      const codeMatch = c.course_code.toLowerCase().includes(query);
      const titleMatch = c.course_title.toLowerCase().includes(query);
      if (!codeMatch && !titleMatch) return false;
    }

    return true;
  });
}
