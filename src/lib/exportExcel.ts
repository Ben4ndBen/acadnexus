import * as XLSX from "xlsx";

export interface StudentRosterItem {
  course_id: number;
  course_code: string;
  course_title: string;
  student_id: number;
  first_name: string;
  last_name: string;
  institutional_id: string;
  institutional_email: string;
  program_code: string;
  year_level: number;
  section: string;
  exams: Array<{
    exam_id: number;
    exam_title: string;
    max_score: number;
    scheduled_date: string | null;
    status: "Took Exam" | "Missed Exam" | "Upcoming";
    student_score: number | null;
    percentage: number | null;
    submitted_at: string | null;
  }>;
  average_grade_percentage: number | null;
  total_took: number;
  total_missed: number;
}

/**
 * Download Enrolled Students & Grades Roster as an organized Excel (.xlsx) file
 * Layout: Student Name FIRST, followed by Student ID, Program, Individual Exam Scores, Average Grade %
 */
export function exportStudentGradesRosterToExcel(
  students: StudentRosterItem[],
  filenamePrefix: string = "Student_Grades_Roster"
) {
  if (!students || students.length === 0) return;

  // Extract all unique exam titles across all students in the roster
  const allExamMap = new Map<number, { title: string; max_score: number }>();
  students.forEach((s) => {
    s.exams?.forEach((ex) => {
      if (!allExamMap.has(ex.exam_id)) {
        allExamMap.set(ex.exam_id, { title: ex.exam_title, max_score: ex.max_score });
      }
    });
  });

  const mainSheetRows = students.map((s) => {
    const fullName = `${s.last_name}, ${s.first_name}`;
    const row: Record<string, any> = {
      "Student Name": fullName,
      "Student ID": s.institutional_id,
      "Program & Section": `${s.program_code} ${s.year_level}-${s.section}`,
      "Subject Code": s.course_code,
      "Subject Title": s.course_title,
    };

    // Add dedicated score column for each exam right after student details
    allExamMap.forEach((examInfo, examId) => {
      const attempt = s.exams?.find((e) => e.exam_id === examId);
      if (attempt) {
        if (attempt.status === "Took Exam") {
          row[`${examInfo.title} Score`] = `${attempt.student_score} / ${attempt.max_score} (${attempt.percentage}%)`;
        } else if (attempt.status === "Missed Exam") {
          row[`${examInfo.title} Score`] = `0 / ${attempt.max_score} (0% - Missed)`;
        } else {
          row[`${examInfo.title} Score`] = "Upcoming";
        }
      } else {
        row[`${examInfo.title} Score`] = "N/A";
      }
    });

    row["Average Grade (%)"] = s.average_grade_percentage !== null ? `${s.average_grade_percentage}%` : "N/A";
    row["Exams Taken"] = s.total_took;
    row["Exams Missed"] = s.total_missed;
    row["Email"] = s.institutional_email;

    return row;
  });

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(mainSheetRows);

  // Set column widths based on headers and content length
  const keys = Object.keys(mainSheetRows[0] || {});
  summarySheet["!cols"] = keys.map((k) => ({
    wch: Math.max(k.length + 4, 18),
  }));

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Student Grades Roster");

  // Create detailed per-subject sheets if multiple subjects exist
  const coursesMap = new Map<string, StudentRosterItem[]>();
  students.forEach((s) => {
    const key = `${s.course_code}`;
    if (!coursesMap.has(key)) {
      coursesMap.set(key, []);
    }
    coursesMap.get(key)!.push(s);
  });

  if (coursesMap.size > 1) {
    coursesMap.forEach((courseStudents, courseCode) => {
      const courseExamMap = new Map<number, { title: string; max_score: number }>();
      courseStudents.forEach((cs) => {
        cs.exams?.forEach((ex) => {
          if (!courseExamMap.has(ex.exam_id)) {
            courseExamMap.set(ex.exam_id, { title: ex.exam_title, max_score: ex.max_score });
          }
        });
      });

      const courseRows = courseStudents.map((cs) => {
        const fullName = `${cs.last_name}, ${cs.first_name}`;
        const row: Record<string, any> = {
          "Student Name": fullName,
          "Student ID": cs.institutional_id,
          "Program & Section": `${cs.program_code} ${cs.year_level}-${cs.section}`,
        };

        courseExamMap.forEach((examInfo, examId) => {
          const attempt = cs.exams?.find((e) => e.exam_id === examId);
          if (attempt) {
            if (attempt.status === "Took Exam") {
              row[`${examInfo.title} Score`] = `${attempt.student_score} / ${attempt.max_score} (${attempt.percentage}%)`;
            } else if (attempt.status === "Missed Exam") {
              row[`${examInfo.title} Score`] = `0 / ${attempt.max_score} (0% - Missed)`;
            } else {
              row[`${examInfo.title} Score`] = "Upcoming";
            }
          } else {
            row[`${examInfo.title} Score`] = "N/A";
          }
        });

        row["Average Grade (%)"] = cs.average_grade_percentage !== null ? `${cs.average_grade_percentage}%` : "N/A";
        row["Email"] = cs.institutional_email;

        return row;
      });

      const courseSheet = XLSX.utils.json_to_sheet(courseRows);
      const cKeys = Object.keys(courseRows[0] || {});
      courseSheet["!cols"] = cKeys.map((k) => ({ wch: Math.max(k.length + 4, 18) }));
      const cleanSheetName = courseCode.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, courseSheet, cleanSheetName);
    });
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `${filenamePrefix}_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Download Exam Submissions as an Excel (.xlsx) file
 * Organized with Student Name FIRST, followed by ID, Score, Max Points, and Grade %
 */
export function exportExamSubmissionsToExcel(
  examTitle: string,
  courseCode: string,
  submissions: Array<{
    student_exam_id: number;
    student: {
      first_name: string;
      last_name: string;
      user: { institutional_id: string; institutional_email?: string };
      program: { program_code: string };
      year_level: number;
      section: string;
    };
    exam: { title: string; course: { course_code: string } };
    submission_trigger: string;
    violations_count: number;
    total_score: number;
    started_at: string | Date;
    submitted_at: string | Date | null;
  }>,
  maxExamScore?: number
) {
  if (!submissions) return;

  const rows = submissions.map((se) => {
    const studentName = `${se.student.last_name}, ${se.student.first_name}`;
    const pct = maxExamScore && maxExamScore > 0
      ? `${Math.round((se.total_score / maxExamScore) * 100)}%`
      : "N/A";

    return {
      "Student Name": studentName,
      "Student ID": se.student.user.institutional_id,
      "Score (pts)": se.total_score,
      "Max Score (pts)": maxExamScore || "N/A",
      "Percentage Grade": pct,
      "Program & Section": `${se.student.program.program_code} ${se.student.year_level}-${se.student.section}`,
      "Submission Trigger": se.submission_trigger.replace("_", " "),
      "Violations Count": se.violations_count,
      "Started At": new Date(se.started_at).toLocaleString(),
      "Submitted At": se.submitted_at ? new Date(se.submitted_at).toLocaleString() : "In Progress",
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  const keys = Object.keys(rows[0] || {});
  worksheet["!cols"] = keys.map((k) => ({ wch: Math.max(k.length + 4, 18) }));

  XLSX.utils.book_append_sheet(workbook, worksheet, "Exam Submissions");

  const cleanExamTitle = examTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 25);
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${courseCode}_${cleanExamTitle}_Scores_${timestamp}.xlsx`);
}

/**
 * Export Missed Student Cohort to Excel
 * Organized with Student Name FIRST, followed by ID, Score, and Status
 */
export function exportMissedStudentsToExcel(
  examTitle: string,
  students: Array<{
    student_id: number;
    first_name: string;
    last_name: string;
    institutional_id: string;
    institutional_email: string;
    attempt: {
      student_exam_id: number;
      started_at: string;
      submitted_at: string | null;
      submission_trigger: string;
      total_score: number;
    } | null;
  }>
) {
  if (!students) return;

  const rows = students.map((s) => {
    let statusText = "Missed Exam";
    let scoreText: string | number = "0 (Missed)";

    if (s.attempt) {
      if (s.attempt.submitted_at) {
        statusText = "Completed Exam";
        scoreText = `${s.attempt.total_score} pts`;
      } else {
        statusText = "Ongoing / Active";
        scoreText = "In Progress";
      }
    }

    return {
      "Student Name": `${s.last_name}, ${s.first_name}`,
      "Student ID": s.institutional_id,
      "Score": scoreText,
      "Exam Status": statusText,
      "Email": s.institutional_email,
      "Submitted Timestamp": s.attempt?.submitted_at ? new Date(s.attempt.submitted_at).toLocaleString() : "N/A",
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  const keys = Object.keys(rows[0] || {});
  worksheet["!cols"] = keys.map((k) => ({ wch: Math.max(k.length + 4, 18) }));

  XLSX.utils.book_append_sheet(workbook, worksheet, "Cohort Exam Status");

  const cleanTitle = examTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 25);
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${cleanTitle}_Cohort_Scores_${timestamp}.xlsx`);
}
