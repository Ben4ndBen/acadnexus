export type ProgramHeaderCategory = "htm" | "ict" | "itd" | "agri" | "educ";

export interface ProgramHeaderInfo {
  key: ProgramHeaderCategory;
  image: string;
  departmentName: string;
  label: string;
  programCodes: string[];
}

export const PROGRAM_HEADER_MAP: Record<ProgramHeaderCategory, ProgramHeaderInfo> = {
  htm: {
    key: "htm",
    image: "/bsc-header-htm.png",
    departmentName: "Hospitality and Tourism Department",
    label: "Hospitality & Tourism (HTM)",
    programCodes: ["BSHM", "BSTM", "HTM"],
  },
  ict: {
    key: "ict",
    image: "/bsc-header-ict.png",
    departmentName: "Computing and Industrial Technology Department",
    label: "Information & Communications Technology (ICT)",
    programCodes: ["BSInfoTech", "ICT", "BSCS", "ACT"],
  },
  itd: {
    key: "itd",
    image: "/bsc-header-itd.png",
    departmentName: "Computing and Industrial Technology Department",
    label: "Industrial Technology Department (ITD)",
    programCodes: ["BSIT", "BSINDTECH", "ITD"],
  },
  agri: {
    key: "agri",
    image: "/bsc-header-agri.png",
    departmentName: "Agriculture Department",
    label: "Agriculture Department (Agri)",
    programCodes: ["BSA", "BAT", "AGRI"],
  },
  educ: {
    key: "educ",
    image: "/bsc-header-educ.png",
    departmentName: "Teacher Education Department",
    label: "Teacher Education Department (Educ)",
    programCodes: ["BEED", "BSED", "TED", "EDUC"],
  },
};

/**
 * Resolves the program category ('htm' | 'ict' | 'itd' | 'agri' | 'educ')
 * from any identifier: program code, program name, department name, course code, student list, or object.
 */
export function getProgramHeaderCategory(identifier?: any): ProgramHeaderCategory {
  if (!identifier) return "ict";

  // If array of items passed (e.g., assigned students list)
  if (Array.isArray(identifier)) {
    for (const item of identifier) {
      if (item) {
        const cat = getProgramHeaderCategory(item);
        if (cat) return cat;
      }
    }
    return "ict";
  }

  // If object passed (e.g., student, exam, course, faculty, or chair)
  if (typeof identifier === "object") {
    // 1. Direct program code / name
    if (identifier.program_code) return getProgramHeaderCategory(identifier.program_code);
    if (identifier.program_name) return getProgramHeaderCategory(identifier.program_name);
    if (identifier.programCode) return getProgramHeaderCategory(identifier.programCode);
    if (identifier.program?.program_code) return getProgramHeaderCategory(identifier.program.program_code);
    if (identifier.program?.program_name) return getProgramHeaderCategory(identifier.program.program_name);

    // 2. Exam targets or student courses if present
    if (Array.isArray(identifier.examTargets) && identifier.examTargets.length > 0) {
      const targetProg = identifier.examTargets[0]?.program_code || identifier.examTargets[0]?.program?.program_code;
      if (targetProg) return getProgramHeaderCategory(targetProg);
    }
    if (Array.isArray(identifier.assignedStudents) && identifier.assignedStudents.length > 0) {
      const studentProg = identifier.assignedStudents[0]?.program_code;
      if (studentProg) return getProgramHeaderCategory(studentProg);
    }

    // 3. Course code prefix
    if (identifier.course_code) return getProgramHeaderCategory(identifier.course_code);
    if (identifier.course?.course_code) return getProgramHeaderCategory(identifier.course.course_code);

    // 4. Department name
    if (identifier.department_name) return getProgramHeaderCategory(identifier.department_name);
    if (identifier.departmentName) return getProgramHeaderCategory(identifier.departmentName);
    if (identifier.department?.department_name) return getProgramHeaderCategory(identifier.department.department_name);
  }

  const str = String(identifier).trim().toLowerCase();

  // 1. HTM (Hospitality & Tourism)
  if (
    str.includes("htm") ||
    str.includes("hospitality") ||
    str.includes("tourism") ||
    str.includes("bshm") ||
    str.includes("bstm") ||
    str === "hm" ||
    str === "tm" ||
    str.startsWith("hm ") ||
    str.startsWith("tm ") ||
    str.startsWith("thm ")
  ) {
    return "htm";
  }

  // 2. AGRI (Agriculture & Fisheries)
  if (
    str.includes("agri") ||
    str.includes("agriculture") ||
    str.includes("bsa") ||
    str.includes("bat") ||
    str.includes("fisheries") ||
    str.startsWith("ag ") ||
    str.startsWith("agr ") ||
    str.startsWith("agro ")
  ) {
    return "agri";
  }

  // 3. EDUC (Teacher Education / TED)
  if (
    str.includes("educ") ||
    str.includes("teacher") ||
    str.includes("ted") ||
    str.includes("beed") ||
    str.includes("bsed") ||
    str.startsWith("ed ") ||
    str.startsWith("educ ") ||
    str.startsWith("profed ")
  ) {
    return "educ";
  }

  // 4. ITD vs ICT (Under CITD: Batanes State College distinguishes BSInfoTech for ICT, and BSIT/BSINDTECH for ITD)
  // ITD (Industrial Technology):
  if (
    str.includes("industrial") ||
    str.includes("indtech") ||
    str.includes("itd") ||
    str === "bsit" || // In BSC, BSIT denotes Bachelor of Science in Industrial Technology
    str.includes("bsindtech") ||
    str.includes("sato") ||
    str.startsWith("indtech ") ||
    str.startsWith("itd ")
  ) {
    return "itd";
  }

  // ICT (Information & Communications Technology):
  if (
    str.includes("infotech") ||
    str.includes("ict") ||
    str.includes("information technology") ||
    str.includes("computing") ||
    str.includes("bsinfotech") ||
    str.includes("bscs") ||
    str.includes("comtech") ||
    str.includes("citd") ||
    str.startsWith("it ") ||
    str.startsWith("cc ") ||
    str.startsWith("cs ") ||
    str.startsWith("cpe ")
  ) {
    return "ict";
  }

  return "ict";
}

/**
 * Returns the appropriate header image path for the given program or department identifier.
 */
export function getProgramHeaderImage(identifier?: any): string {
  const category = getProgramHeaderCategory(identifier);
  return PROGRAM_HEADER_MAP[category]?.image || "/bsc-header-ict.png";
}
