export interface AcademicPeriodSettings {
  active_academic_year: string;
  active_semester: string;
  active_term?: string;
  sem1_start: string;
  sem1_end: string;
  sem2_start: string;
  sem2_end: string;
}

export function determineSemesterFromDate(
  dateStr: string,
  settings: AcademicPeriodSettings
): { semester: string; academicYear: string; label: string } {
  if (!dateStr) {
    return {
      semester: settings.active_semester,
      academicYear: settings.active_academic_year,
      label: `${settings.active_semester}, AY ${settings.active_academic_year}`
    };
  }

  const d = new Date(`${dateStr}T00:00:00`);
  const time = d.getTime();

  if (settings.sem1_start && settings.sem1_end) {
    const s1Start = new Date(`${settings.sem1_start}T00:00:00`).getTime();
    const s1End = new Date(`${settings.sem1_end}T23:59:59`).getTime();
    if (time >= s1Start && time <= s1End) {
      return {
        semester: "1st Semester",
        academicYear: settings.active_academic_year,
        label: `1st Semester, AY ${settings.active_academic_year}`
      };
    }
  }

  if (settings.sem2_start && settings.sem2_end) {
    const s2Start = new Date(`${settings.sem2_start}T00:00:00`).getTime();
    const s2End = new Date(`${settings.sem2_end}T23:59:59`).getTime();
    if (time >= s2Start && time <= s2End) {
      return {
        semester: "2nd Semester",
        academicYear: settings.active_academic_year,
        label: `2nd Semester, AY ${settings.active_academic_year}`
      };
    }
  }

  const month = d.getMonth(); // 0 = Jan, 7 = Aug, 11 = Dec
  if (month >= 7 && month <= 11) {
    return {
      semester: "1st Semester",
      academicYear: settings.active_academic_year,
      label: `1st Semester, AY ${settings.active_academic_year}`
    };
  } else if (month >= 0 && month <= 4) {
    return {
      semester: "2nd Semester",
      academicYear: settings.active_academic_year,
      label: `2nd Semester, AY ${settings.active_academic_year}`
    };
  } else {
    return {
      semester: "Midyear / Summer",
      academicYear: settings.active_academic_year,
      label: `Midyear / Summer, AY ${settings.active_academic_year}`
    };
  }
}

export function getStudentMiddleInitial(middleName?: string | null): string {
  if (!middleName) return "";
  const trimmed = middleName.trim();
  if (!trimmed || trimmed.toUpperCase() === "NONE" || trimmed.toUpperCase() === "N/A") return "";
  return `${trimmed.charAt(0).toUpperCase()}.`;
}

export const getMiddleInitial = getStudentMiddleInitial;

export function formatStudentName(
  studentOrFirstName: { first_name: string; last_name: string; middle_name?: string | null } | string,
  middleNameOrFormat?: string | null | "lastFirst" | "firstLast",
  lastName?: string
): string {
  if (typeof studentOrFirstName === "object" && studentOrFirstName !== null) {
    const student = studentOrFirstName;
    const format = middleNameOrFormat === "firstLast" ? "firstLast" : "lastFirst";
    const mi = getStudentMiddleInitial(student.middle_name);
    if (format === "lastFirst") {
      return mi ? `${student.last_name}, ${student.first_name} ${mi}` : `${student.last_name}, ${student.first_name}`;
    } else {
      return mi ? `${student.first_name} ${mi} ${student.last_name}` : `${student.first_name} ${student.last_name}`;
    }
  }

  const mi = getStudentMiddleInitial(middleNameOrFormat as string | null);
  const midStr = mi ? `${mi} ` : "";
  return `${studentOrFirstName} ${midStr}${lastName || ""}`.trim();
}

export interface SubmissionTimingInfo {
  scheduledEnd: Date | null;
  isLateSubmission: boolean;
  minsLate: number;
  isActivePastSchedule: boolean;
  timingLabel: string;
}

export function getSubmissionScheduleTiming(studentExam: any): SubmissionTimingInfo {
  let scheduledEnd: Date | null = null;

  // 1. Check if student had an override for this exam
  const override = studentExam?.student?.studentOverrides?.find(
    (o: any) => o.exam_id === studentExam.exam_id
  );
  if (override?.new_end_time) {
    scheduledEnd = new Date(override.new_end_time);
  }

  // 2. Otherwise find the target for student's program and year level
  if (!scheduledEnd && studentExam?.exam?.examTargets && studentExam.exam.examTargets.length > 0) {
    const targets = studentExam.exam.examTargets;
    const target = targets.find(
      (t: any) =>
        t.program_id === studentExam.student?.program_id &&
        t.year_level === studentExam.student?.year_level
    ) || targets[0];

    if (target?.scheduled_date && target?.end_time) {
      const schedDate = new Date(target.scheduled_date);
      const endTime = new Date(target.end_time);
      scheduledEnd = new Date(
        schedDate.getUTCFullYear(),
        schedDate.getUTCMonth(),
        schedDate.getUTCDate(),
        endTime.getUTCHours(),
        endTime.getUTCMinutes(),
        0
      );
    }
  }

  // 3. Fallback to exam.exam_date
  if (!scheduledEnd && studentExam?.exam?.exam_date) {
    const d = new Date(studentExam.exam.exam_date);
    d.setHours(23, 59, 59, 999);
    scheduledEnd = d;
  }

  const isSubmitted = Boolean(studentExam?.submitted_at);
  const submittedTime = studentExam?.submitted_at ? new Date(studentExam.submitted_at).getTime() : null;
  const scheduledEndTime = scheduledEnd ? scheduledEnd.getTime() : null;

  const isLateSubmission = Boolean(
    isSubmitted &&
    submittedTime &&
    scheduledEndTime &&
    submittedTime > scheduledEndTime
  );

  const minsLate = isLateSubmission && submittedTime && scheduledEndTime
    ? Math.max(1, Math.round((submittedTime - scheduledEndTime) / 60000))
    : 0;

  const isActivePastSchedule = Boolean(
    !isSubmitted &&
    scheduledEndTime &&
    Date.now() > scheduledEndTime
  );

  let timingLabel = "On Schedule";
  if (isLateSubmission) {
    timingLabel = `Late (+${minsLate}m)`;
  } else if (isActivePastSchedule) {
    timingLabel = "Active (Past Schedule)";
  } else if (!isSubmitted) {
    timingLabel = "Active In Progress";
  }

  return {
    scheduledEnd,
    isLateSubmission,
    minsLate,
    isActivePastSchedule,
    timingLabel,
  };
}

/**
 * Format Student Program, Year Level, and Section cleanly.
 * Automatically suppresses generic or default sections (such as "GENERAL", "General", "N/A", "A", etc.)
 * especially for BSINFOTECH / BSIT which does not use sections.
 */
export function formatStudentProgramAndYear(
  programCode?: string | null,
  yearLevel?: number | string | null,
  section?: string | null
): string {
  const pCode = (programCode || "").trim();
  const yr = yearLevel ? `Yr ${yearLevel}` : "";
  const pUpper = pCode.toUpperCase();
  const sec = (section || "").trim();
  const secUpper = sec.toUpperCase();

  // For BSINFOTECH / BSIT / Information Technology, or if section is "GENERAL", "GEN", "N/A", "NONE", etc., suppress section
  const isBsInfoTech =
    pUpper === "BSINFOTECH" ||
    pUpper === "BSIT" ||
    pUpper === "BS_INFO_TECH" ||
    pUpper.includes("INFOTECH");
  const isGenericSection =
    !sec ||
    secUpper === "GENERAL" ||
    secUpper === "GEN" ||
    secUpper === "N/A" ||
    secUpper === "NONE";

  if (isBsInfoTech || isGenericSection) {
    return [pCode, yr].filter(Boolean).join(" - ");
  }

  return `${[pCode, yr].filter(Boolean).join(" - ")} • Sec ${sec}`;
}

