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
