/**
 * Academic Department & Program to Course Mappings
 * Maps course codes to their respective departments and programs.
 */

export interface DepartmentProgramInfo {
  code: string;
  name: string;
  majors?: string[];
}

export const DEPARTMENT_PROGRAMS_MAP: Record<string, DepartmentProgramInfo[]> = {
  ICT: [
    { code: "BSInfoTech", name: "Bachelor of Science in Information Technology" },
  ],
  ITD: [
    { 
      code: "BSIT", 
      name: "Bachelor of Science in Industrial Technology",
      majors: ["ARCHITECTURE TECHNOLOGY", "AUTOMOTIVE TECHNOLOGY", "ELECTRONICS TECHNOLOGY"] 
    },
  ],
  CITD: [
    { code: "BSInfoTech", name: "Bachelor of Science in Information Technology" },
    { 
      code: "BSIT", 
      name: "Bachelor of Science in Industrial Technology",
      majors: ["ARCHITECTURE TECHNOLOGY", "AUTOMOTIVE TECHNOLOGY", "ELECTRONICS TECHNOLOGY"] 
    },
  ],
  AGRI: [
    { code: "BSA", name: "Bachelor of Science in Agriculture" },
  ],
  HTM: [
    { code: "BSHM", name: "Bachelor of Science in Hospitality Management" },
    { code: "BSTM", name: "Bachelor of Science in Tourism Management" },
  ],
  TED: [
    { code: "BEED", name: "Bachelor of Elementary Education" },
    { 
      code: "BSED", 
      name: "Bachelor of Secondary Education",
      majors: ["English", "Science", "Mathematics"] 
    },
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

export type DeptKey = "ICT" | "ITD" | "CITD" | "AGRI" | "HTM" | "TED" | "ALL";

/**
 * Gets the corresponding Department Key for an Academic Program code.
 */
export function getDepartmentKeyForProgram(programCode: string): DeptKey {
  const code = (programCode || "").trim().toUpperCase();
  if (code === "BSINFOTECH") return "ICT";
  if (code === "BSIT") return "ITD";
  if (code === "BEED" || code === "BSED") return "TED";
  if (code === "BSA") return "AGRI";
  if (code === "BSHM" || code === "BSTM") return "HTM";
  return "ALL";
}

/**
 * Resolves normalized department key from either ID or Department Name.
 */
export function resolveDepartmentKey(departmentIdOrName?: number | string | null, departmentName?: string | null): DeptKey {
  if (!departmentIdOrName && !departmentName) {
    return "ALL";
  }

  const str = `${departmentIdOrName || ""} ${departmentName || ""}`.trim().toLowerCase();

  if (str.includes("citd") || str.includes("college of information")) return "CITD";
  if (str.includes("ict") || str.includes("bsinfotech") || (str.includes("information technology") && !str.includes("industrial"))) return "ICT";
  if (str.includes("industrial") || str.includes("bsit") || str.includes("indtech") || (str.includes("it department") && !str.includes("ict")) || (/\b(itd|it)\b/.test(str) && !str.includes("citd") && !str.includes("ict"))) return "ITD";
  if (str.includes("hospitality") || str.includes("tourism") || str.includes("htm")) return "HTM";
  if (str.includes("agriculture") || str.includes("agri")) return "AGRI";
  if (str.includes("teacher") || str.includes("education") || str.includes("ted")) return "TED";

  // Numeric ID checks matching database autoincrement IDs
  const numId = Number(departmentIdOrName);
  if (!isNaN(numId) && numId > 0) {
    if (numId === 1) return "CITD";
    if (numId === 2) return "ICT";
    if (numId === 3) return "ITD";
    if (numId === 4) return "TED";
    if (numId === 5) return "AGRI";
    if (numId === 6) return "HTM";
  }

  return "ALL";
}

/**
 * Gets list of programs for a given department and optional specific program code.
 */
export function getProgramsForDepartment(
  departmentIdOrName?: number | string | null,
  departmentName?: string | null,
  programCode?: string | null
): DepartmentProgramInfo[] {
  const pCode = (programCode || "").trim().toUpperCase();
  const deptKey = resolveDepartmentKey(departmentIdOrName, departmentName);

  let rawList = deptKey === "ALL" 
    ? Object.values(DEPARTMENT_PROGRAMS_MAP).flat() 
    : (DEPARTMENT_PROGRAMS_MAP[deptKey] || []);

  if (pCode) {
    const filteredByProg = rawList.filter((p) => p.code.toUpperCase() === pCode);
    if (filteredByProg.length > 0) {
      return filteredByProg;
    }
  }

  const seen = new Set<string>();
  return rawList.filter((p) => {
    if (seen.has(p.code)) return false;
    seen.add(p.code);
    return true;
  });
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
  const pCode = programCode ? programCode.trim().toUpperCase() : null;

  // If specific programCode is selected
  if (pCode === "BSINFOTECH") {
    return code.startsWith("ITC") || code.startsWith("ITE") || code.startsWith("ITM") || code.startsWith("ITD") || code === "ENT 403";
  }
  if (pCode === "BSIT") {
    return (code.startsWith("IND") || code.startsWith("IT")) && !code.startsWith("ITC") && !code.startsWith("ITE") && !code.startsWith("ITM");
  }
  if (pCode === "BSA") {
    return (
      code.startsWith("AGRI") || code.startsWith("AG EXT") || code.startsWith("AGB") || code.startsWith("AME") ||
      code.startsWith("ANSCI") || code.startsWith("CROP PROT") || code.startsWith("CROP SCI") || code.startsWith("SOIL SCI") ||
      code.startsWith("THESIS") || code === "PRACTICUM" || code.startsWith("SEM ") || code === "CA"
    );
  }
  if (pCode === "BSHM") {
    return code.startsWith("HPC") || code.startsWith("HMPE") || code === "PRAC" || code.startsWith("THC") || code.startsWith("BME");
  }
  if (pCode === "BSTM") {
    return code.startsWith("TPC") || code.startsWith("TPE") || code.startsWith("ITRM") || code === "OJT" || code.startsWith("THC") || code.startsWith("BME");
  }
  if (pCode === "BEED" || pCode === "BSED") {
    return code.startsWith("EDUC");
  }

  // By DeptKey
  if (deptKey === "ICT") {
    return code.startsWith("ITC") || code.startsWith("ITE") || code.startsWith("ITM") || code.startsWith("ITD") || code === "ENT 403";
  }
  if (deptKey === "ITD") {
    return (code.startsWith("IND") || code.startsWith("IT")) && !code.startsWith("ITC") && !code.startsWith("ITE") && !code.startsWith("ITM");
  }
  if (deptKey === "CITD") {
    return code.startsWith("ITC") || code.startsWith("ITE") || code.startsWith("ITM") || code.startsWith("ITD") || code === "ENT 403" || code.startsWith("IND");
  }
  if (deptKey === "AGRI") {
    return (
      code.startsWith("AGRI") || code.startsWith("AG EXT") || code.startsWith("AGB") || code.startsWith("AME") ||
      code.startsWith("ANSCI") || code.startsWith("CROP PROT") || code.startsWith("CROP SCI") || code.startsWith("SOIL SCI") ||
      code.startsWith("THESIS") || code === "PRACTICUM" || code.startsWith("SEM ") || code === "CA"
    );
  }
  if (deptKey === "HTM") {
    return code.startsWith("HPC") || code.startsWith("HMPE") || code === "PRAC" || code.startsWith("TPC") || code.startsWith("TPE") || code.startsWith("ITRM") || code === "OJT" || code.startsWith("THC") || code.startsWith("BME");
  }
  if (deptKey === "TED") {
    return code.startsWith("EDUC");
  }

  return true;
}

import { getExpectedYearAndSemForCourse } from "./bsitCurriculum";

/**
 * Filter a course list according to department, program, search query, GE inclusion, year level, and semester.
 */
export function filterCoursesForDepartment<T extends { course_code: string; course_title: string }>(
  courses: T[],
  departmentIdOrName?: number | string | null,
  options?: {
    programCode?: string | null;
    includeGeneralEducation?: boolean;
    searchQuery?: string;
    yearLevel?: number | null;
    semester?: number | null;
  }
): T[] {
  const { programCode = null, includeGeneralEducation = false, searchQuery = "", yearLevel = null, semester = null } = options || {};
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

    // 2. Year level & semester match
    if (yearLevel || semester) {
      const yearSem = getExpectedYearAndSemForCourse(c.course_code, c.course_title, programCode || undefined);
      if (yearSem) {
        if (yearLevel && yearSem.yearLevel !== yearLevel) return false;
        if (semester && yearSem.semester !== semester) return false;
      }
    }

    // 3. Search query match
    if (query) {
      const codeMatch = c.course_code.toLowerCase().includes(query);
      const titleMatch = c.course_title.toLowerCase().includes(query);
      if (!codeMatch && !titleMatch) return false;
    }

    return true;
  });
}
