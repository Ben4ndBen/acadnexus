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
  CITD: [
    { code: "BSInfoTech", name: "Bachelor of Science in Information Technology" },
    { 
      code: "BSIT", 
      name: "Bachelor of Science in Industrial Technology",
      majors: ["ARCHITECTURE TECHNOLOGY", "AUTOMOTIVE TECHNOLOGY", "ELECTRONICS TECHNOLOGY"] 
    },
  ],
  ICT: [
    { code: "BSInfoTech", name: "Bachelor of Science in Information Technology" },
    { 
      code: "BSIT", 
      name: "Bachelor of Science in Industrial Technology",
      majors: ["ARCHITECTURE TECHNOLOGY", "AUTOMOTIVE TECHNOLOGY", "ELECTRONICS TECHNOLOGY"] 
    },
  ],
  ITD: [
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
  if (code === "BSINFOTECH" || code === "BSIT") return "CITD";
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

  if (
    str.includes("citd") ||
    str.includes("computing") ||
    str.includes("ict") ||
    str.includes("information technology") ||
    str.includes("industrial") ||
    str.includes("bsinfotech") ||
    str.includes("bsit") ||
    str.includes("itd") ||
    str.includes("indtech")
  ) {
    return "CITD";
  }

  if (str.includes("hospitality") || str.includes("tourism") || str.includes("htm")) return "HTM";
  if (str.includes("agriculture") || str.includes("agri")) return "AGRI";
  if (str.includes("teacher") || str.includes("education") || str.includes("ted")) return "TED";

  // Numeric ID checks matching database autoincrement IDs
  const numId = Number(departmentIdOrName);
  if (!isNaN(numId) && numId > 0) {
    if (numId === 1 || numId === 2 || numId === 3) return "CITD";
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

  return (courses || []).filter((c) => {
    if (!c || !c.course_code) return false;
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

import { ALL_CURRICULUMS } from "./bsitCurriculum";

/**
 * Normalizes program codes (e.g. BSINFOTECH -> BSInfoTech, BSINDTECH -> BSIT)
 */
export function normalizeProgramCode(code?: string | null): string {
  if (!code) return "BSInfoTech";
  const upper = code.trim().toUpperCase();
  if (upper === "BSINFOTECH" || upper === "INFOTECH") return "BSInfoTech";
  if (upper === "BSIT" || upper === "BSINDTECH" || upper === "INDTECH") return "BSIT";
  if (upper === "BEED") return "BEED";
  if (upper === "BSED") return "BSED";
  if (upper === "BSA" || upper === "AGRI") return "BSA";
  if (upper === "BSHM" || upper === "HM") return "BSHM";
  if (upper === "BSTM" || upper === "TM") return "BSTM";
  if (upper === "PEU") return "PEU";
  return code.trim();
}

/**
 * Resolves the official Academic Program Code (e.g. "BSInfoTech", "BSIT", "BSA", "BEED", "BSED", "BSHM", "BSTM")
 * from an examination, course, student roster, or department context.
 * Guaranteed to match the Program determined during Exam Creation.
 */
export function determineProgramCodeFromCourseOrExam(
  input?: {
    course?: { course_code?: string; course_title?: string } | null;
    course_code?: string;
    course_title?: string;
    title?: string;
    selected_student_ids?: number[] | null;
    examTargets?: Array<{ program_id?: number; program?: { program_code?: string } | null }> | null;
    faculty?: any;
    department_name?: string | null;
    [key: string]: any;
  } | null,
  context?: {
    students?: Array<{ student_id?: number; program_code?: string; program?: { program_code?: string } }>;
    studentExams?: Array<any>;
    facultyDepartment?: string;
  }
): string {
  if (!input) return "BSInfoTech";

  const courseCode = (
    input.course?.course_code ||
    input.course_code ||
    ""
  ).trim().toUpperCase();

  const courseTitle = (
    input.course?.course_title ||
    input.course_title ||
    input.title ||
    ""
  ).trim().toUpperCase();

  // 1. Check students in selected_student_ids or context students
  const selectedIds = input.selected_student_ids || [];
  if (Array.isArray(selectedIds) && selectedIds.length > 0 && context) {
    if (context.students && context.students.length > 0) {
      const match = context.students.find(s => s.student_id && selectedIds.includes(s.student_id));
      const pCode = match?.program_code || match?.program?.program_code;
      if (pCode) return normalizeProgramCode(pCode);
    }
    if (context.studentExams && context.studentExams.length > 0) {
      const match = context.studentExams.find(se => {
        const sId = se.student_id || se.student?.student_id;
        return sId && selectedIds.includes(sId);
      });
      const pCode = match?.student?.program?.program_code || match?.student?.program_code;
      if (pCode) return normalizeProgramCode(pCode);
    }
  }

  // 2. Explicit course code & title matching (Exact match with Exam Creation Wizard)
  // BSInfoTech (Bachelor of Science in Information Technology - CITD/ICT)
  if (
    courseCode.startsWith("ITC") ||
    courseCode.startsWith("ITE") ||
    courseCode.startsWith("ITM") ||
    courseCode.startsWith("ITD") ||
    courseCode === "ENT 403" ||
    courseCode.includes("INFOTECH") ||
    courseCode === "BSINFOTECH" ||
    courseTitle.includes("INFORMATION TECHNOLOGY") ||
    courseTitle.includes("COMPUTING") ||
    courseTitle.includes("CAPSTONE")
  ) {
    return "BSInfoTech";
  }

  // BSIT (Bachelor of Science in Industrial Technology - CITD/ITD)
  if (
    courseCode.startsWith("IND") ||
    courseCode.startsWith("BIT") ||
    courseCode === "BSIT" ||
    courseCode === "BSINDTECH" ||
    courseTitle.includes("INDUSTRIAL TECHNOLOGY") ||
    courseTitle.includes("AUTOMOTIVE") ||
    courseTitle.includes("ELECTRONICS") ||
    courseTitle.includes("ARCHITECTURE")
  ) {
    return "BSIT";
  }

  // BSA (Bachelor of Science in Agriculture)
  if (
    courseCode.startsWith("AGRI") ||
    courseCode.startsWith("AG EXT") ||
    courseCode.startsWith("AGB") ||
    courseCode.startsWith("AME") ||
    courseCode.startsWith("ANSCI") ||
    courseCode.startsWith("CROP PROT") ||
    courseCode.startsWith("CROP SCI") ||
    courseCode.startsWith("SOIL SCI") ||
    courseCode.startsWith("THESIS") ||
    courseCode === "PRACTICUM" ||
    courseCode.startsWith("SEM ") ||
    courseCode === "CA" ||
    courseCode === "BSA" ||
    courseTitle.includes("AGRICULTURE") ||
    courseTitle.includes("AGRICULTURAL")
  ) {
    return "BSA";
  }

  // BEED (Bachelor of Elementary Education)
  if (
    courseCode.startsWith("BEED") ||
    courseTitle.includes("ELEMENTARY EDUCATION") ||
    courseTitle.includes("ELEMENTARY")
  ) {
    return "BEED";
  }

  // BSED (Bachelor of Secondary Education)
  if (
    courseCode.startsWith("BSED") ||
    courseTitle.includes("SECONDARY EDUCATION") ||
    courseTitle.includes("SECONDARY")
  ) {
    return "BSED";
  }

  // EDUC prefix
  if (courseCode.startsWith("EDUC") || courseTitle.includes("EDUCATION")) {
    const isSec =
      courseTitle.includes("SEC") ||
      courseTitle.includes("SECONDARY") ||
      courseTitle.includes("HIGH SCHOOL");
    return isSec ? "BSED" : "BEED";
  }

  // BSHM (Hospitality Management)
  if (
    courseCode.startsWith("HPC") ||
    courseCode.startsWith("HMPE") ||
    courseCode === "PRAC" ||
    courseCode === "BSHM" ||
    courseTitle.includes("HOSPITALITY")
  ) {
    return "BSHM";
  }

  // BSTM (Tourism Management)
  if (
    courseCode.startsWith("TPC") ||
    courseCode.startsWith("TPE") ||
    courseCode.startsWith("ITRM") ||
    courseCode === "OJT" ||
    courseCode === "BSTM" ||
    courseTitle.includes("TOURISM")
  ) {
    return "BSTM";
  }

  // Check official curriculum
  if (courseCode) {
    const cleanNoSpaces = courseCode.replace(/\s+/g, "");
    const curItem = ALL_CURRICULUMS.find(
      (item) => item.code.replace(/\s+/g, "").toUpperCase() === cleanNoSpaces
    );
    if (curItem) {
      if (curItem.programCode === "BSIT") {
        if (
          courseCode.startsWith("ITC") ||
          courseCode.startsWith("ITE") ||
          courseCode.startsWith("ITM") ||
          courseCode.startsWith("ITD") ||
          courseCode === "ENT 403"
        ) {
          return "BSInfoTech";
        }
        return "BSIT";
      }
      if (curItem.programCode === "BSHM") return "BSHM";
      if (curItem.programCode === "BSA") return "BSA";
      if (curItem.programCode === "BSTM") return "BSTM";
    }
  }

  // 3. Fallback to department if provided
  const dept = input.faculty?.department?.department_name || input.department_name || context?.facultyDepartment;
  if (dept) {
    const deptKey = resolveDepartmentKey(dept);
    if (deptKey === "CITD" || deptKey === "ICT") return "BSInfoTech";
    if (deptKey === "ITD") return "BSIT";
    if (deptKey === "AGRI") return "BSA";
    if (deptKey === "TED") return "BEED";
    if (deptKey === "HTM") return "BSHM";
  }

  return "BSInfoTech";
}

/**
 * Resolves the full AcademicProgram record for an examination matching what was on exam creation.
 */
export function resolveTargetProgramForExam(
  exam: any,
  programs: Array<{ program_id: number; program_code: string; program_name: string; department_id?: number }>,
  studentExams?: any[],
  facultyDepartment?: string
): { program_id: number; program_code: string; program_name: string } | null {
  if (!programs || programs.length === 0) return null;

  const targetCode = determineProgramCodeFromCourseOrExam(exam, {
    studentExams,
    facultyDepartment
  });

  const normalizedTargetCode = normalizeProgramCode(targetCode).toUpperCase();

  // 1. Exact match on normalized program code
  const exactMatch = programs.find(
    p => normalizeProgramCode(p.program_code).toUpperCase() === normalizedTargetCode
  );
  if (exactMatch) return exactMatch;

  // 2. Contains match
  const containsMatch = programs.find(
    p => p.program_code.toUpperCase().includes(normalizedTargetCode) ||
         normalizedTargetCode.includes(p.program_code.toUpperCase())
  );
  if (containsMatch) return containsMatch;

  // 3. Fallback to department programs
  if (facultyDepartment) {
    const deptProgs = getProgramsForDepartment(facultyDepartment);
    for (const dp of deptProgs) {
      const match = programs.find(p => p.program_code.toUpperCase() === dp.code.toUpperCase());
      if (match) return match;
    }
  }

  return programs[0] || null;
}

