"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ExamStatus } from "@prisma/client";
import { getExpectedYearLevelForCourse, getExpectedYearAndSemForCourse } from "@/lib/bsitCurriculum";
import { getProgramsForDepartment } from "@/lib/courseDepartmentMapping";
import { getActiveAcademicPeriodCached } from "@/lib/cache";

export async function updateFacultyProfile(facultyId: number, firstName: string, lastName: string, middleName?: string) {
  if (!firstName || !lastName) {
    return { error: "First name and last name are required." };
  }

  try {
    const trimmedMiddle = middleName ? middleName.trim() : null;
    await db.faculty.update({
      where: { faculty_id: facultyId },
      data: {
        first_name: firstName.trim(),
        middle_name: trimmedMiddle,
        last_name: lastName.trim(),
      },
    });

    const mi = trimmedMiddle ? `${trimmedMiddle.charAt(0).toUpperCase()}. ` : "";
    // Log the profile update action
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Updated profile details: ${firstName.trim()} ${mi}${lastName.trim()}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating profile:", err);
    return { error: err.message || "Failed to update profile." };
  }
}

export async function updateExamStatus(examId: number, status: ExamStatus, userId: number) {
  try {
    return await db.$transaction(async (tx) => {
      const exam = await tx.examination.findUnique({
        where: { exam_id: examId },
      });

      if (!exam) {
        return { error: "Examination not found." };
      }

      if (exam.faculty_id !== userId) {
        return { error: "Unauthorized operation." };
      }

      // Allow submission for Chair review with integrated TOS matrix
      // Add or update ApprovalWorkflow record if needed
      if (status === "Pending_Chair") {
        // Find a Chair to assign (e.g. for the faculty's department)
        const faculty = await tx.faculty.findUnique({
          where: { faculty_id: userId },
          include: { department: true },
        });

        if (!faculty) {
          return { error: "Faculty profile not found. Please contact an admin." };
        }

        const examWithTargets = await tx.examination.findUnique({
          where: { exam_id: examId },
          include: {
            examTargets: { include: { program: true } },
            course: true,
          },
        });

        const targetProgramIds = examWithTargets?.examTargets?.map((t) => t.program_id) || [];
        let targetProgramId = targetProgramIds.length > 0 ? targetProgramIds[0] : null;

        // Fallback: If no target program ID explicitly set in examTargets, find program by course code
        if (!targetProgramId && examWithTargets?.course) {
          const courseCode = examWithTargets.course.course_code.trim().toUpperCase();
          if (courseCode.startsWith("ITC") || courseCode.startsWith("ITE") || courseCode.startsWith("ITM") || courseCode.startsWith("ITD") || courseCode === "ENT 403" || courseCode.includes("INFOTECH")) {
            const prog = await tx.academicProgram.findUnique({ where: { program_code: "BSInfoTech" } });
            if (prog) targetProgramId = prog.program_id;
          } else if (courseCode.startsWith("IND") || courseCode.startsWith("IT")) {
            const prog = await tx.academicProgram.findUnique({ where: { program_code: "BSIT" } });
            if (prog) targetProgramId = prog.program_id;
          } else if (courseCode.startsWith("EDUC")) {
            const prog = await tx.academicProgram.findFirst({ where: { program_code: { in: ["BEED", "BSED"] } } });
            if (prog) targetProgramId = prog.program_id;
          }
        }

        // Find Program Chair for this program (if any)
        let progChair = targetProgramId ? await tx.chair.findFirst({
          where: { program_id: targetProgramId, is_program_chair: true },
        }) : null;

        // Find Department Chair for this department (e.g. CITD for ICT/IT, TED for BEED/BSED, HTM, AGRI)
        let deptChair: any = null;
        const deptName = faculty.department.department_name.trim().toLowerCase();

        if (deptName.includes("ict") || deptName.includes("it department") || deptName.includes("citd") || deptName.includes("industrial")) {
          const citdDept = await tx.department.findFirst({ where: { department_name: "CITD" } });
          if (citdDept) {
            deptChair = await tx.chair.findFirst({
              where: { department_id: citdDept.department_id, is_program_chair: false },
            });
          }
        } else if (deptName.includes("teacher education") || deptName.includes("ted")) {
          const tedDept = await tx.department.findFirst({ where: { department_name: "Teacher Education Department" } });
          if (tedDept) {
            deptChair = await tx.chair.findFirst({
              where: { department_id: tedDept.department_id, is_program_chair: false },
            });
          }
        }

        if (!deptChair) {
          deptChair = await tx.chair.findFirst({
            where: { department_id: faculty.department_id, is_program_chair: false },
          }) || await tx.chair.findFirst({
            where: { department_id: faculty.department_id },
          });
        }

        if (!deptChair) {
          return { error: "No department chair found for your department. Cannot submit exam for review." };
        }

        if (progChair) {
          status = "Pending_Program_Chair";
        }

        await tx.approvalWorkflow.upsert({
          where: { exam_id: examId },
          update: {
            reviewed_by_prog_chair_id: progChair ? progChair.chair_id : null,
            prog_chair_review_status: progChair ? "Pending" : null,
            prog_chair_comments: null,
            prog_chair_action_timestamp: null,
            reviewed_by_chair_id: deptChair.chair_id,
            chair_review_status: "Pending",
            chair_comments: null,
            chair_action_timestamp: null,
            di_review_status: "Hold",
            di_action_timestamp: null,
            reviewed_by_di_id: null,
          },
          create: {
            exam_id: examId,
            reviewed_by_prog_chair_id: progChair ? progChair.chair_id : null,
            prog_chair_review_status: progChair ? "Pending" : null,
            reviewed_by_chair_id: deptChair.chair_id,
            chair_review_status: "Pending",
            di_review_status: "Hold",
          },
        });
      }

      // Update the examination status
      await tx.examination.update({
        where: { exam_id: examId },
        data: { current_status: status },
      });

      // Log the audit event
      await tx.auditLog.create({
        data: {
          user_id: userId,
          action_performed: `Updated exam (${exam.title}) status to ${status}`,
          ip_address: "127.0.0.1",
        },
      });

      revalidatePath("/dashboard/faculty");
      return { success: true };
    });
  } catch (err: any) {
    console.error("Error updating exam status:", err);
    return { error: err.message || "Failed to update exam status." };
  }
}

export async function createExamDraft(facultyId: number, courseId?: number) {
  try {
    // Ensure faculty record exists in DB for facultyId (especially for Program/Department Chair accounts)
    let facultyRecord = await db.faculty.findUnique({
      where: { faculty_id: facultyId },
      select: { faculty_id: true, department_id: true },
    });

    if (!facultyRecord) {
      const user = await db.user.findUnique({ where: { user_id: facultyId } });
      const defaultDept = await db.department.findFirst({ select: { department_id: true } });
      facultyRecord = await db.faculty.create({
        data: {
          faculty_id: facultyId,
          first_name: user?.username || "Chair",
          last_name: "Faculty",
          department_id: defaultDept?.department_id || 1,
        },
        select: { faculty_id: true, department_id: true },
      });
    }
    // If courseId is not provided, check faculty's assigned courses first
    let targetCourseId = courseId;
    if (!targetCourseId) {
      const assignedFc = await db.facultyCourse.findFirst({
        where: { faculty_id: facultyId },
        select: { course_id: true },
      });
      if (assignedFc) {
        targetCourseId = assignedFc.course_id;
      } else {
        let fallbackCourse = await db.course.findFirst({
          select: { course_id: true },
        });

        if (fallbackCourse) {
          targetCourseId = fallbackCourse.course_id;
        } else {
          return { error: "No curriculum subjects found in the database. Please contact your Campus Director or Administrator." };
        }
      }
    }

    // Fetch target course details
    const course = await db.course.findUnique({
      where: { course_id: targetCourseId },
      select: { course_code: true, course_title: true },
    });

    // Retrieve active academic period settings
    const activePeriod = await getActiveAcademicPeriodCached();
    const activeTerm = activePeriod.active_term || "Midterm";
    const activeSemester = activePeriod.active_semester || "1st Semester";
    const activeAY = activePeriod.active_academic_year || "2026-2027";

    // Count existing exams for this faculty, course, and term to generate a draft sequence number
    const existingCount = await db.examination.count({
      where: {
        faculty_id: facultyId,
        course_id: targetCourseId,
        term: activeTerm,
      },
    });

    const draftNum = existingCount + 1;
    const courseTitleStr = course?.course_title || course?.course_code || "";
    const courseStr = courseTitleStr ? ` in ${courseTitleStr}` : "";
    const generatedTitle = `${activeTerm} Examination${courseStr} (Draft #${draftNum})`;

    const newExam = await db.examination.create({
      data: {
        title: generatedTitle,
        course_id: targetCourseId,
        faculty_id: facultyId,
        term: activeTerm,
        semester: activeSemester,
        academic_year: activeAY,
        tos_file_path: "", // starts empty
        time_limit_minutes: 60, // default time limit
        randomize_items: true,
        current_status: "Draft",
      },
    });

    // Create a corresponding audit log
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Created exam draft: "${newExam.title}" (ID: ${newExam.exam_id})`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    return { success: true, exam_id: newExam.exam_id };
  } catch (err: any) {
    console.error("Error in createExamDraft:", err);
    return { error: err.message || "Failed to create examination draft." };
  }
}

export async function saveExamConfig(formData: FormData) {
  try {
    const { writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");

    const examId = Number(formData.get("examId"));
    const facultyId = Number(formData.get("facultyId"));
    const title = formData.get("title") as string;
    const courseId = Number(formData.get("courseId"));
    const timeLimitMinutes = Number(formData.get("timeLimitMinutes"));
    const randomizeItems = formData.get("randomizeItems") === "true";
    const tosFile = formData.get("tosFile") as File | null;
    const timePenaltySeconds = Number(formData.get("timePenaltySeconds") || "60");
    const scorePenaltyPoints = Number(formData.get("scorePenaltyPoints") || "2");

    const term = formData.get("term") as string | null;
    const examDate = formData.get("examDate") as string | null;
    const semester = formData.get("semester") as string | null;
    const academicYear = formData.get("academicYear") as string | null;
    const documentReference = formData.get("documentReference") as string | null;
    const selectedStudentIdsRaw = formData.get("selectedStudentIds") as string | null;

    let parsedStudentIds: number[] = [];
    if (selectedStudentIdsRaw) {
      try {
        parsedStudentIds = JSON.parse(selectedStudentIdsRaw);
      } catch {
        parsedStudentIds = selectedStudentIdsRaw.split(",").map(Number).filter(n => !isNaN(n));
      }
    }

    if (!examId || !facultyId || !title || !courseId || !timeLimitMinutes) {
      return { error: "Missing required configuration fields." };
    }

    // Verify ownership
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }
    if (exam.faculty_id !== facultyId) {
      return { error: "Unauthorized operation." };
    }

    let tosFilePath = exam.tos_file_path; // Default to existing path

    const tosDataJson = formData.get("tosDataJson") as string | null;
    if (tosDataJson && tosDataJson.trim() !== "" && (!tosFilePath || !tosFilePath.startsWith("/uploads/"))) {
      tosFilePath = tosDataJson;
    }

    if (tosFile && tosFile.size > 0 && tosFile.name !== "undefined") {
      const bytes = await tosFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      const uniqueFilename = `${Date.now()}-${tosFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const absolutePath = join(uploadDir, uniqueFilename);
      await writeFile(absolutePath, buffer);
      tosFilePath = `/uploads/${uniqueFilename}`;
    }

    const parsedExamDate = examDate ? new Date(`${examDate}T00:00:00.000Z`) : null;

    const updatedExam = await db.examination.update({
      where: { exam_id: examId },
      data: {
        title,
        course_id: courseId,
        time_limit_minutes: timeLimitMinutes,
        randomize_items: randomizeItems,
        tos_file_path: tosFilePath,
        time_penalty_seconds: timePenaltySeconds,
        score_penalty_points: scorePenaltyPoints,
        term: term || undefined,
        exam_date: parsedExamDate || undefined,
        semester: semester || undefined,
        academic_year: academicYear || undefined,
        document_reference: documentReference || undefined,
        selected_student_ids: parsedStudentIds,
      },
    });

    // Automatically sync ExamTarget if examDate is provided
    if (parsedExamDate) {
      let programId = 1;
      let yearLevel = 1;
      let section = "All Sections";

      if (parsedStudentIds.length > 0) {
        const studentSample = await db.student.findFirst({
          where: { student_id: { in: parsedStudentIds } },
        });
        if (studentSample) {
          programId = studentSample.program_id;
          yearLevel = studentSample.year_level;
          section = studentSample.section || "All Sections";
        }
      }

      const existingTarget = await db.examTarget.findFirst({
        where: { exam_id: examId },
      });

      const startTime = new Date("1970-01-01T00:00:00.000Z");
      const endTime = new Date("1970-01-01T23:59:59.000Z");

      if (existingTarget) {
        await db.examTarget.update({
          where: { target_id: existingTarget.target_id },
          data: {
            scheduled_date: parsedExamDate,
            program_id: programId,
            year_level: yearLevel,
            section: section,
          },
        });
      } else {
        await db.examTarget.create({
          data: {
            exam_id: examId,
            program_id: programId,
            year_level: yearLevel,
            section: section,
            scheduled_date: parsedExamDate,
            start_time: startTime,
            end_time: endTime,
          },
        });
      }
    }

    // Log audit
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Updated exam config for "${title}" (ID: ${examId}, Ref: ${documentReference || "N/A"})`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath(`/dashboard/faculty/exams/${examId}/builder`);

    return { success: true, exam: updatedExam };
  } catch (err: any) {
    console.error("Error in saveExamConfig:", err);
    return { error: err.message || "Failed to save exam configurations." };
  }
}

export async function getTargetProgramsForCourseAndFaculty(courseId: number, facultyId?: number): Promise<string[]> {
  const course = await db.course.findUnique({
    where: { course_id: courseId },
  });

  if (!course) return [];

  const programCodes = new Set<string>();

  // 1. If facultyId is provided, resolve department & programs for faculty
  if (facultyId) {
    const faculty = await db.faculty.findUnique({
      where: { faculty_id: facultyId },
      include: { department: true },
    });
    if (faculty?.department) {
      const deptProgs = getProgramsForDepartment(faculty.department.department_id, faculty.department.department_name);
      deptProgs.forEach((p) => programCodes.add(p.code));
    }
  }

  // 2. If no program codes resolved from facultyId, check faculty assigned to this course
  if (programCodes.size === 0) {
    const fc = await db.facultyCourse.findFirst({
      where: { course_id: courseId },
      include: {
        faculty: {
          include: { department: true },
        },
      },
    });
    if (fc?.faculty?.department) {
      const deptProgs = getProgramsForDepartment(fc.faculty.department.department_id, fc.faculty.department.department_name);
      deptProgs.forEach((p) => programCodes.add(p.code));
    }
  }

  // 3. Fallback / Override based on course code conventions
  const code = course.course_code.trim().toUpperCase();
  if (code.startsWith("AGRI") || code.startsWith("AG EXT") || code.startsWith("AGB") || code.startsWith("AME") ||
      code.startsWith("ANSCI") || code.startsWith("CROP PROT") || code.startsWith("CROP SCI") || code.startsWith("SOIL SCI") ||
      code.startsWith("THESIS") || code === "PRACTICUM" || code.startsWith("SEM ") || code === "CA") {
    programCodes.clear();
    programCodes.add("BSA");
  } else if (code.startsWith("ITC") || code.startsWith("ITE") || code.startsWith("ITM") || code.startsWith("ITD") || code === "ENT 403") {
    programCodes.clear();
    programCodes.add("BSInfoTech");
  } else if ((code.startsWith("IND") || code.startsWith("IT")) && !code.startsWith("ITC") && !code.startsWith("ITE") && !code.startsWith("ITM")) {
    programCodes.clear();
    programCodes.add("BSIT");
  } else if (code.startsWith("HPC") || code.startsWith("HMPE") || code === "PRAC" || code.startsWith("TPC") || code.startsWith("TPE") || code.startsWith("ITRM") || code === "OJT" || code.startsWith("THC") || code.startsWith("BME")) {
    programCodes.clear();
    programCodes.add("BSHM");
    programCodes.add("BSTM");
  } else if (code.startsWith("EDUC")) {
    programCodes.clear();
    programCodes.add("BEED");
    programCodes.add("BSED");
  }

  return Array.from(programCodes);
}

async function syncAndGetYearLevelEnrolledStudents(courseId: number, facultyId?: number) {
  const course = await db.course.findUnique({
    where: { course_id: courseId },
  });

  if (!course) return { course: null, targetYearLevel: null, targetSemester: null, targetPrograms: [] };

  const expectedInfo = getExpectedYearAndSemForCourse(course.course_code, course.course_title);
  const targetYearLevel = expectedInfo?.yearLevel ?? getExpectedYearLevelForCourse(course.course_code, course.course_title);
  const targetSemester = expectedInfo?.semester ?? null;
  const targetPrograms = await getTargetProgramsForCourseAndFaculty(courseId, facultyId);

  // Auto-sync students taking this subject (matching expected year level and target department/programs) into studentCourse
  const studentWhere: any = {};
  if (targetYearLevel) {
    studentWhere.year_level = targetYearLevel;
  }
  if (targetPrograms.length > 0) {
    studentWhere.program = {
      program_code: { in: targetPrograms },
    };
  }

  const eligibleStudents = await db.student.findMany({
    where: studentWhere,
    select: { student_id: true },
  });

  if (eligibleStudents.length > 0) {
    const existingEnrollments = await db.studentCourse.findMany({
      where: { course_id: courseId },
      select: { student_id: true },
    });

    const existingSet = new Set(existingEnrollments.map((e) => e.student_id));
    const missingIds = eligibleStudents.map((s) => s.student_id).filter((id) => !existingSet.has(id));

    if (missingIds.length > 0) {
      await db.studentCourse.createMany({
        data: missingIds.map((studentId) => ({
          student_id: studentId,
          course_id: courseId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return { course, targetYearLevel, targetSemester, targetPrograms };
}

export async function getAssignedStudentsForCourse(courseId: number, facultyId?: number) {
  try {
    if (facultyId) {
      const assignedCount = await db.facultyCourse.count({ where: { faculty_id: facultyId } });
      if (assignedCount === 0) {
        return { success: true, students: [] };
      }
      const isCourseAssigned = await db.facultyCourse.findFirst({
        where: { faculty_id: facultyId, course_id: courseId },
      });
      if (!isCourseAssigned) {
        return { success: true, students: [] };
      }
    }
    const { course, targetYearLevel, targetPrograms } = await syncAndGetYearLevelEnrolledStudents(courseId, facultyId);

    const studentFilter: any = {};
    if (targetYearLevel) {
      studentFilter.year_level = targetYearLevel;
    }
    if (targetPrograms.length > 0) {
      studentFilter.program = {
        program_code: { in: targetPrograms },
      };
    }

    const whereCondition: any = { course_id: courseId };
    if (Object.keys(studentFilter).length > 0) {
      whereCondition.student = studentFilter;
    }

    const enrolled = await db.studentCourse.findMany({
      where: whereCondition,
      include: {
        student: {
          include: {
            user: true,
            program: true,
          },
        },
      },
      orderBy: {
        student: {
          last_name: "asc",
        },
      },
    });

    return {
      success: true,
      students: enrolled.map((e) => ({
        student_id: e.student.student_id,
        institutional_id: e.student.user.institutional_id,
        first_name: e.student.first_name,
        middle_name: e.student.middle_name,
        last_name: e.student.last_name,
        program_code: e.student.program.program_code,
        program_name: e.student.program.program_name,
        year_level: e.student.year_level,
        section: e.student.section,
      })),
    };
  } catch (err: any) {
    console.error("Error getting assigned students for course:", err);
    return { error: err.message || "Failed to fetch class students." };
  }
}

export async function saveExamQuestions(examId: number, questions: any[], facultyId: number) {
  try {
    // Verify ownership
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }
    if (exam.faculty_id !== facultyId) {
      return { error: "Unauthorized operation." };
    }

    // Sync questions in a database transaction
    await db.$transaction(async (tx) => {
      // Get existing questions in DB
      const existingQuestions = await tx.questionBank.findMany({
        where: { exam_id: examId },
        select: { question_id: true },
      });
      const existingIds = existingQuestions.map((q) => q.question_id);

      const incomingIds = questions
        .map((q) => q.question_id)
        .filter((id) => typeof id === "number" && id > 0) as number[];

      // Identify IDs to delete
      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

      if (idsToDelete.length > 0) {
        await tx.questionBank.deleteMany({
          where: {
            question_id: { in: idsToDelete },
          },
        });
      }

      // Insert or update incoming questions
      for (const q of questions) {
        const data = {
          exam_id: examId,
          question_text: q.question_text,
          question_type: q.question_type,
          correct_answer: q.correct_answer,
          points: Number(q.points) || 1,
          course_id: exam.course_id,
          topic: q.topic || null,
          year_level: q.year_level ? Number(q.year_level) : null,
        };

        if (q.question_id && existingIds.includes(q.question_id)) {
          // Update
          await tx.questionBank.update({
            where: { question_id: q.question_id },
            data,
          });
        } else {
          // Create new
          await tx.questionBank.create({
            data,
          });
        }
      }
    });

    // Log audit
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Saved ${questions.length} questions for exam ID: ${examId}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath(`/dashboard/faculty/exams/${examId}/builder`);

    return { success: true };
  } catch (err: any) {
    console.error("Error in saveExamQuestions:", err);
    return { error: err.message || "Failed to save examination questions." };
  }
}

export async function getExamWithQuestions(examId: number) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
      include: {
        course: true,
        questionBank: {
          orderBy: { question_id: "asc" },
        },
      },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }

    return { success: true, exam };
  } catch (err: any) {
    console.error("Error in getExamWithQuestions:", err);
    return { error: err.message || "Failed to retrieve examination." };
  }
}

export async function deleteExam(examId: number, facultyId: number) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }
    if (exam.faculty_id !== facultyId) {
      return { error: "Unauthorized operation." };
    }

    // Delete child dependencies in transaction, then delete the exam itself
    await db.$transaction(async (tx) => {
      await tx.questionBank.deleteMany({
        where: { exam_id: examId },
      });
      await tx.approvalWorkflow.deleteMany({
        where: { exam_id: examId },
      });
      await tx.examTarget.deleteMany({
        where: { exam_id: examId },
      });
      await tx.studentExam.deleteMany({
        where: { exam_id: examId },
      });
      await tx.examination.delete({
        where: { exam_id: examId },
      });
    });

    // Log audit
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Deleted examination draft: "${exam.title}" (ID: ${examId})`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteExam:", err);
    return { error: err.message || "Failed to delete examination." };
  }
}

export async function scheduleExamTarget(
  facultyId: number,
  examId: number,
  programId: number,
  yearLevel: number,
  section: string,
  scheduledDate: string,
  startTime: string,
  endTime: string
) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
      include: {
        course: true,
      },
    });

    if (!exam) return { error: "Examination not found." };
    if (exam.faculty_id !== facultyId) return { error: "Unauthorized operation." };
    if (exam.current_status !== "Approved") return { error: "Only approved examinations can be scheduled." };

    const dateObj = new Date(`${scheduledDate}T00:00:00.000Z`);
    const startObj = new Date(`1970-01-01T${startTime}:00.000Z`);
    const endObj = new Date(`1970-01-01T${endTime}:00.000Z`);

    const targetSection = section?.trim() || "All Sections";

    // Check if an ExamTarget already exists for this exam
    const existingTarget = await db.examTarget.findFirst({
      where: { exam_id: examId }
    });

    if (existingTarget) {
      await db.examTarget.update({
        where: { target_id: existingTarget.target_id },
        data: {
          program_id: programId,
          year_level: yearLevel,
          section: targetSection,
          scheduled_date: dateObj,
          start_time: startObj,
          end_time: endObj,
        }
      });
    } else {
      await db.examTarget.create({
        data: {
          exam_id: examId,
          program_id: programId,
          year_level: yearLevel,
          section: targetSection,
          scheduled_date: dateObj,
          start_time: startObj,
          end_time: endObj,
        },
      });
    }

    // Query matching students by program and year level
    const isTargetingAll = !targetSection || ["all", "all sections", "any", "all section", ""].includes(targetSection.toLowerCase());

    let targetStudents = await db.student.findMany({
      where: {
        program_id: programId,
        year_level: yearLevel,
        ...(!isTargetingAll
          ? {
              OR: [
                { section: { equals: targetSection, mode: "insensitive" } },
                { section: "General" },
                { section: "All Sections" },
              ]
            }
          : {}),
      },
      include: {
        user: true,
      },
    });

    // Fallback if specific section yielded no students: notify all students in the targeted program and year level
    if (targetStudents.length === 0) {
      targetStudents = await db.student.findMany({
        where: {
          program_id: programId,
          year_level: yearLevel,
        },
        include: {
          user: true,
        },
      });
    }

    const formatTimeToAMPM = (timeStr: string) => {
      try {
        const [h, m] = timeStr.split(":").map(Number);
        const period = h >= 12 ? "PM" : "AM";
        const hour12 = h % 12 || 12;
        return `${hour12}:${m < 10 ? '0' : ''}${m} ${period}`;
      } catch {
        return timeStr;
      }
    };

    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

    const timeRangeStr = `${formatTimeToAMPM(startTime)} - ${formatTimeToAMPM(endTime)}`;
    const courseCodeStr = exam.course?.course_code ? ` (${exam.course.course_code})` : "";

    // Create notifications for all targeted students
    if (targetStudents.length > 0) {
      await db.notification.createMany({
        data: targetStudents.map((s) => ({
          user_id: s.student_id,
          title: "Upcoming Examination Scheduled",
          message: `The examination "${exam.title}"${courseCodeStr} has been scheduled for your program and year level on ${formattedDate} from ${timeRangeStr}.`,
          is_read: false,
        })),
      });
    }

    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Scheduled/updated exam target for "${exam.title}" (ID: ${examId}) on ${scheduledDate} (${timeRangeStr}) notifying ${targetStudents.length} student(s)`,
        ip_address: "127.0.0.1",
      },
    });

    try {
      revalidatePath("/dashboard/faculty");
      revalidatePath("/dashboard/student");
    } catch {
      // Invariant: outside Next.js request context
    }
    return { success: true, notifiedCount: targetStudents.length };
  } catch (err: any) {
    console.error("Error in scheduleExamTarget:", err);
    return { error: err.message || "Failed to schedule the examination." };
  }
}

export async function gradeEssayAnswer(
  facultyId: number,
  answerId: number,
  pointsAwarded: number,
  isCorrect: boolean
) {
  try {
    const answer = await db.studentAnswer.findUnique({
      where: { answer_id: answerId },
      include: {
        studentExam: {
          include: {
            exam: true
          }
        }
      }
    });

    if (!answer) {
      return { error: "Answer not found." };
    }

    if (answer.studentExam.exam.faculty_id !== facultyId) {
      return { error: "Unauthorized operation." };
    }

    await db.$transaction(async (tx) => {
      await tx.studentAnswer.update({
        where: { answer_id: answerId },
        data: {
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
          last_updated_at: new Date()
        }
      });

      const allAnswers = await tx.studentAnswer.findMany({
        where: { student_exam_id: answer.student_exam_id },
        include: { question: true }
      });

      const totalScore = allAnswers.reduce((sum, ans) => {
        let points = ans.points_awarded;
        if (points === null && ans.is_correct === true) {
           points = ans.question.points;
        } else if (points === null) {
           points = 0;
        }
        return sum + (points || 0);
      }, 0);

      // Fetch student exam and apply penalty configurations
      const studentExam = await tx.studentExam.findUnique({
        where: { student_exam_id: answer.student_exam_id },
        include: { exam: true }
      });

      const violationsCount = studentExam?.violations_count ?? 0;
      const scorePenaltyPoints = studentExam?.exam.score_penalty_points ?? 2;
      const totalPenalty = violationsCount * scorePenaltyPoints;
      const penalizedScore = Math.max(0, totalScore - totalPenalty);

      await tx.studentExam.update({
        where: { student_exam_id: answer.student_exam_id },
        data: { total_score: penalizedScore }
      });

      await tx.auditLog.create({
        data: {
          user_id: facultyId,
          action_performed: `Manually graded essay answer (ID: ${answerId}) with ${pointsAwarded} points.`,
          ip_address: "127.0.0.1",
        },
      });
    });

    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error grading essay answer:", err);
    return { error: err.message || "Failed to grade essay answer." };
  }
}

export async function configureFacultyAccount(facultyId: number, formData: FormData) {
  const newPassword = formData.get("newPassword") as string;
  const institutionalEmail = formData.get("institutionalEmail") as string;
  const profileImageFile = formData.get("profileImage") as File | null;

  if (!newPassword || !institutionalEmail) {
    return { error: "New password and institutional email are required." };
  }

  try {
    const { writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");
    const bcrypt = await import("bcryptjs");

    // 1. Verify that the user exists
    const user = await db.user.findUnique({
      where: { user_id: facultyId },
      include: { faculty: true },
    });

    if (!user || !user.faculty) {
      return { error: "Faculty user not found." };
    }

    // 2. Handle profile image upload if provided
    let profileImagePath = user.faculty.profile_image;

    if (profileImageFile && profileImageFile.size > 0 && profileImageFile.name !== "undefined") {
      const bytes = await profileImageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const uploadDir = join(process.cwd(), "public", "uploads", "profiles");
      await mkdir(uploadDir, { recursive: true });
      
      const uniqueFilename = `${facultyId}-${Date.now()}-${profileImageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const absolutePath = join(uploadDir, uniqueFilename);
      await writeFile(absolutePath, buffer);
      
      profileImagePath = `/uploads/profiles/${uniqueFilename}`;
    }

    // 3. Hash the new password and update User + Faculty tables
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.$transaction(async (tx) => {
      // Update password hash and clear requirement flag
      await tx.user.update({
        where: { user_id: facultyId },
        data: {
          password_hash: passwordHash,
          require_password_update: false,
        },
      });

      // Update faculty specific configuration details
      await tx.faculty.update({
        where: { faculty_id: facultyId },
        data: {
          institutional_email: institutionalEmail,
          profile_image: profileImagePath,
        },
      });
    });

    // 4. Log the configuration action to audit logs
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: "Completed secure account configuration and updated password",
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Account configuration error:", err);
    return { error: err.message || "Failed to configure account." };
  }
}

export async function uploadQuestionAttachment(facultyId: number, formData: FormData) {
  try {
    const { writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { error: "No file uploaded." };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = join(process.cwd(), "public", "uploads", "questions");
    await mkdir(uploadDir, { recursive: true });
    const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const absolutePath = join(uploadDir, uniqueFilename);
    await writeFile(absolutePath, buffer);

    const fileUrl = `/uploads/questions/${uniqueFilename}`;
    return { success: true, url: fileUrl };
  } catch (err: any) {
    console.error("Error in uploadQuestionAttachment:", err);
    return { error: err.message || "Failed to upload file." };
  }
}

export async function uploadTosFileAction(examId: number, facultyId: number, formData: FormData) {
  try {
    const { writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { error: "No file uploaded." };
    }

    // Strictly validate PDF extension / mime type
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return { error: "Strict Requirement: Only PDF files (.pdf) are allowed for Table of Specifications (TOS) upload." };
    }

    // Validate maximum file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { error: "File Size Limit Exceeded: TOS PDF file must not exceed 10MB." };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = join(process.cwd(), "public", "uploads", "tos");
    await mkdir(uploadDir, { recursive: true });
    const uniqueFilename = `TOS-Exam${examId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const absolutePath = join(uploadDir, uniqueFilename);
    await writeFile(absolutePath, buffer);

    const tosFilePath = `/uploads/tos/${uniqueFilename}`;

    await db.examination.update({
      where: { exam_id: examId },
      data: { tos_file_path: tosFilePath },
    });

    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Uploaded TOS PDF file (${file.name}) for Exam ID: ${examId}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath(`/dashboard/faculty/exams/${examId}/builder`);

    return { success: true, tos_file_path: tosFilePath };
  } catch (err: any) {
    console.error("Error uploading TOS PDF:", err);
    return { error: err.message || "Failed to upload TOS PDF file." };
  }
}

export async function getStudentExamLogs(studentId: number, examId: number) {
  try {
    const logs = await db.auditLog.findMany({
      where: {
        user_id: studentId,
        OR: [
          {
            action_performed: {
              contains: `Exam (ID: ${examId})`
            }
          },
          {
            action_performed: {
              contains: `Exam ID: ${examId}`
            }
          }
        ]
      },
      orderBy: {
        timestamp: "desc"
      }
    });
    return { success: true, logs: logs.map(l => ({ ...l, log_id: l.log_id.toString(), timestamp: l.timestamp.toISOString() })) };
  } catch (err: any) {
    console.error("Error fetching logs:", err);
    return { error: err.message || "Failed to fetch logs." };
  }
}

export async function getMissedStudentsForExam(facultyId: number, examId: number) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
      include: {
        course: true,
        examTargets: true,
        studentOverrides: {
          where: { is_active: true }
        }
      }
    });

    if (!exam || exam.faculty_id !== facultyId) {
      return { error: "Examination not found or unauthorized." };
    }

    const selectedIds = exam.selected_student_ids || [];
    const students: any[] = [];
    const seenStudentIds = new Set<number>();

    // 1. Always include all students who TOOK or attempted this specific exam
    const examTakers = await db.studentExam.findMany({
      where: { exam_id: examId },
      include: {
        student: {
          include: {
            user: true,
            studentExams: {
              where: { exam_id: examId }
            },
            studentOverrides: {
              where: { exam_id: examId, is_active: true }
            }
          }
        }
      }
    });
    for (const record of examTakers) {
      if (record.student && !seenStudentIds.has(record.student.student_id)) {
        seenStudentIds.add(record.student.student_id);
        students.push(record.student);
      }
    }

    // 2. Include students explicitly assigned via selected_student_ids
    if (selectedIds.length > 0) {
      const assignedStudents = await db.student.findMany({
        where: {
          student_id: { in: selectedIds }
        },
        include: {
          user: true,
          studentExams: {
            where: { exam_id: examId }
          },
          studentOverrides: {
            where: { exam_id: examId, is_active: true }
          }
        }
      });
      for (const s of assignedStudents) {
        if (!seenStudentIds.has(s.student_id)) {
          seenStudentIds.add(s.student_id);
          students.push(s);
        }
      }
    }

    // 3. Include students enrolled in this specific course
    if (exam.course_id) {
      const courseEnrollees = await db.studentCourse.findMany({
        where: { course_id: exam.course_id },
        include: {
          student: {
            include: {
              user: true,
              studentExams: {
                where: { exam_id: examId }
              },
              studentOverrides: {
                where: { exam_id: examId, is_active: true }
              }
            }
          }
        }
      });
      for (const record of courseEnrollees) {
        if (record.student && !seenStudentIds.has(record.student.student_id)) {
          seenStudentIds.add(record.student.student_id);
          students.push(record.student);
        }
      }
    }

    // 4. Include students matching exam targets
    for (const target of exam.examTargets) {
      const targetFilter: any = {
        program_id: target.program_id,
        year_level: target.year_level,
      };
      if (target.section && target.section !== "All Sections") {
        targetFilter.section = target.section;
      }
      const studentListForTarget = await db.student.findMany({
        where: targetFilter,
        include: {
          user: true,
          studentExams: {
            where: { exam_id: examId }
          },
          studentOverrides: {
            where: { exam_id: examId, is_active: true }
          }
        }
      });
      
      for (const s of studentListForTarget) {
        if (!seenStudentIds.has(s.student_id)) {
          seenStudentIds.add(s.student_id);
          students.push(s);
        }
      }
    }

    // 5. Include students with active overrides
    for (const override of exam.studentOverrides) {
      if (!seenStudentIds.has(override.student_id)) {
        const studentRecord = await db.student.findUnique({
          where: { student_id: override.student_id },
          include: {
            user: true,
            studentExams: {
              where: { exam_id: examId }
            },
            studentOverrides: {
              where: { exam_id: examId, is_active: true }
            }
          }
        });
        if (studentRecord && !seenStudentIds.has(studentRecord.student_id)) {
          seenStudentIds.add(studentRecord.student_id);
          students.push(studentRecord);
        }
      }
    }

    const studentList = students.map(s => {
      const attempt = s.studentExams?.[0] || null;
      const override = s.studentOverrides?.[0] || null;
      return {
        student_id: s.student_id,
        first_name: s.first_name,
        middle_name: s.middle_name,
        last_name: s.last_name,
        institutional_email: s.user?.institutional_email,
        institutional_id: s.user?.institutional_id,
        has_taken: !!attempt,
        attempt: attempt ? {
          student_exam_id: attempt.student_exam_id,
          started_at: attempt.started_at.toISOString(),
          submitted_at: attempt.submitted_at ? attempt.submitted_at.toISOString() : null,
          submission_trigger: attempt.submission_trigger,
          total_score: attempt.total_score !== null && attempt.total_score !== undefined ? Number(attempt.total_score) : null
        } : null,
        override: override ? {
          override_id: override.override_id,
          new_start_time: override.new_start_time.toISOString(),
          new_end_time: override.new_end_time.toISOString(),
          is_active: override.is_active
        } : null
      };
    });

    // Sort students alphabetically by last name, then first name
    studentList.sort((a, b) => {
      const ln = (a.last_name || "").localeCompare(b.last_name || "");
      if (ln !== 0) return ln;
      return (a.first_name || "").localeCompare(b.first_name || "");
    });

    const firstTarget = exam.examTargets[0];
    const officialDateIso = exam.exam_date
      ? exam.exam_date.toISOString()
      : (firstTarget ? firstTarget.scheduled_date.toISOString() : null);

    return {
      success: true,
      examTitle: exam.title,
      course: exam.course ? {
        course_id: exam.course.course_id,
        course_code: exam.course.course_code,
        course_title: exam.course.course_title,
      } : null,
      officialDateIso,
      officialTargetSchedule: firstTarget ? {
        scheduled_date: firstTarget.scheduled_date.toISOString(),
        start_time: firstTarget.start_time.toISOString(),
        end_time: firstTarget.end_time.toISOString(),
      } : null,
      students: studentList
    };
  } catch (err: any) {
    console.error("Error in getMissedStudentsForExam:", err);
    return { error: err.message || "Failed to fetch assigned student list." };
  }
}

export async function grantStudentOverride(
  facultyId: number,
  studentId: number,
  examId: number,
  startTimeStr: string,
  endTimeStr: string
) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId }
    });

    if (!exam || exam.faculty_id !== facultyId) {
      return { error: "Examination not found or unauthorized." };
    }

    // Ensure student is added to selected_student_ids if restricted list is active
    if (exam.selected_student_ids && exam.selected_student_ids.length > 0) {
      if (!exam.selected_student_ids.includes(studentId)) {
        await db.examination.update({
          where: { exam_id: examId },
          data: {
            selected_student_ids: {
              push: studentId
            }
          }
        });
      }
    }

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    await db.$transaction(async (tx) => {
      // 1. Delete existing student exam attempt and answers to clean state for reopening
      const studentExam = await tx.studentExam.findFirst({
        where: { student_id: studentId, exam_id: examId }
      });
      if (studentExam) {
        await tx.studentAnswer.deleteMany({
          where: { student_exam_id: studentExam.student_exam_id }
        });
        await tx.studentExam.delete({
          where: { student_exam_id: studentExam.student_exam_id }
        });
      }

      // 2. Upsert override record strictly targeting the selected student
      await tx.studentOverride.upsert({
        where: {
          student_id_exam_id: {
            student_id: studentId,
            exam_id: examId
          }
        },
        update: {
          new_start_time: startTime,
          new_end_time: endTime,
          is_active: true
        },
        create: {
          student_id: studentId,
          exam_id: examId,
          new_start_time: startTime,
          new_end_time: endTime,
          is_active: true
        }
      });

      // 3. Log audit event
      await tx.auditLog.create({
        data: {
          user_id: facultyId,
          action_performed: `Reopened examination (Exam ID: ${examId}, Title: "${exam.title}") strictly for Student ID: ${studentId}. Individual Reopened Window: ${startTimeStr} to ${endTimeStr}. Official exam date and TOS preserved.`,
          ip_address: "127.0.0.1"
        }
      });
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/student");
    return { success: true };
  } catch (err: any) {
    console.error("Error in grantStudentOverride:", err);
    return { error: err.message || "Failed to reopen examination for student." };
  }
}

export async function revokeStudentOverride(
  facultyId: number,
  studentId: number,
  examId: number
) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId }
    });

    if (!exam || exam.faculty_id !== facultyId) {
      return { error: "Examination not found or unauthorized." };
    }

    await db.studentOverride.updateMany({
      where: {
        student_id: studentId,
        exam_id: examId,
      },
      data: {
        is_active: false,
      }
    });

    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Revoked individual reopened exam window for Student ID: ${studentId} on Exam ID: ${examId}`,
        ip_address: "127.0.0.1"
      }
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/student");
    return { success: true };
  } catch (err: any) {
    console.error("Error in revokeStudentOverride:", err);
    return { error: err.message || "Failed to revoke reopened access." };
  }
}

export async function getCurrentAcademicYear(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed, 5 is June
  if (month >= 5) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

export async function getQuestionBankQuestions(filters: { course_id?: number; topic?: string; year_level?: number }) {
  try {
    const where: any = {};
    if (filters.course_id) {
      where.course_id = Number(filters.course_id);
    }
    if (filters.topic) {
      where.topic = { contains: filters.topic, mode: "insensitive" };
    }
    if (filters.year_level) {
      where.year_level = Number(filters.year_level);
    }

    const questions = await db.questionBank.findMany({
      where,
      include: {
        course: true,
        exam: true,
      },
      orderBy: { question_id: "desc" },
    });

    return { success: true, questions };
  } catch (err: any) {
    console.error("Error in getQuestionBankQuestions:", err);
    return { error: err.message || "Failed to fetch question bank." };
  }
}

export async function saveQuestionBankQuestion(
  facultyId: number,
  questionData: {
    question_id?: number;
    course_id: number;
    question_text: string;
    question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type" | "Essay" | "Fill_In_The_Blanks";
    correct_answer: string;
    points: number;
    topic?: string;
    year_level?: number;
  }
) {
  try {
    const data = {
      course_id: Number(questionData.course_id),
      question_text: questionData.question_text,
      question_type: questionData.question_type,
      correct_answer: questionData.correct_answer,
      points: Number(questionData.points) || 1,
      topic: questionData.topic || null,
      year_level: questionData.year_level ? Number(questionData.year_level) : null,
    };

    if (questionData.question_id) {
      await db.questionBank.update({
        where: { question_id: questionData.question_id },
        data,
      });
      await db.auditLog.create({
        data: {
          user_id: facultyId,
          action_performed: `Updated question ID ${questionData.question_id} in Question Bank`,
          ip_address: "127.0.0.1",
        },
      });
    } else {
      await db.questionBank.create({
        data,
      });
      await db.auditLog.create({
        data: {
          user_id: facultyId,
          action_performed: `Created new question in Question Bank for course ID ${questionData.course_id}`,
          ip_address: "127.0.0.1",
        },
      });
    }

    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error in saveQuestionBankQuestion:", err);
    return { error: err.message || "Failed to save question bank item." };
  }
}

export async function deleteQuestionBankQuestion(questionId: number, facultyId: number) {
  try {
    await db.questionBank.delete({
      where: { question_id: questionId },
    });

    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Deleted question ID ${questionId} from Question Bank`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteQuestionBankQuestion:", err);
    return { error: err.message || "Failed to delete question bank item." };
  }
}

export async function importQuestionsToExam(examId: number, questionIds: number[], facultyId: number) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }
    if (exam.faculty_id !== facultyId) {
      return { error: "Unauthorized." };
    }

    // Fetch the questions to copy
    const sourceQuestions = await db.questionBank.findMany({
      where: { question_id: { in: questionIds } },
    });

    // Copy/clone them
    await db.$transaction(async (tx) => {
      for (const sq of sourceQuestions) {
        await tx.questionBank.create({
          data: {
            exam_id: examId,
            question_text: sq.question_text,
            question_type: sq.question_type,
            correct_answer: sq.correct_answer,
            points: sq.points,
            course_id: exam.course_id,
            topic: sq.topic,
            year_level: sq.year_level,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          user_id: facultyId,
          action_performed: `Imported ${sourceQuestions.length} questions into exam ID: ${examId}`,
          ip_address: "127.0.0.1",
        },
      });
    });

    revalidatePath(`/dashboard/faculty/exams/${examId}/builder`);
    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error in importQuestionsToExam:", err);
    return { error: err.message || "Failed to import questions." };
  }
}

export async function archiveExamination(examId: number, academicYear: string, facultyId: number) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }
    if (exam.faculty_id !== facultyId) {
      return { error: "Unauthorized." };
    }

    await db.examination.update({
      where: { exam_id: examId },
      data: {
        is_archived: true,
        academic_year: academicYear,
      },
    });

    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Archived exam ID ${examId} for Academic Year ${academicYear}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error in archiveExamination:", err);
    return { error: err.message || "Failed to archive examination." };
  }
}

export async function reuseArchivedExamination(examId: number, facultyId: number) {
  try {
    const sourceExam = await db.examination.findUnique({
      where: { exam_id: examId },
      include: { questionBank: true },
    });

    if (!sourceExam) {
      return { error: "Source examination not found." };
    }

    // Create new examination draft copy
    const newExam = await db.examination.create({
      data: {
        title: `${sourceExam.title} (Reused)`,
        course_id: sourceExam.course_id,
        faculty_id: facultyId,
        tos_file_path: sourceExam.tos_file_path,
        time_limit_minutes: sourceExam.time_limit_minutes,
        randomize_items: sourceExam.randomize_items,
        time_penalty_seconds: sourceExam.time_penalty_seconds,
        score_penalty_points: sourceExam.score_penalty_points,
        current_status: "Draft",
        academic_year: await getCurrentAcademicYear(),
        is_archived: false,
      },
    });

    // Clone the questions
    if (sourceExam.questionBank.length > 0) {
      await db.questionBank.createMany({
        data: sourceExam.questionBank.map((q) => ({
          exam_id: newExam.exam_id,
          question_text: q.question_text,
          question_type: q.question_type,
          correct_answer: q.correct_answer,
          points: q.points,
          course_id: sourceExam.course_id,
          topic: q.topic,
          year_level: q.year_level,
        })),
      });
    }

    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Reused archived exam ID ${examId} to create new draft exam ID ${newExam.exam_id}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    return { success: true, exam_id: newExam.exam_id };
  } catch (err: any) {
    console.error("Error in reuseArchivedExamination:", err);
    return { error: err.message || "Failed to reuse archived examination." };
  }
}

export async function getArchivedExaminations(courseId?: number) {
  try {
    const where: any = {
      is_archived: true
    };
    if (courseId) {
      where.course_id = Number(courseId);
    }
    const exams = await db.examination.findMany({
      where,
      include: {
        course: true,
        faculty: true,
        _count: {
          select: { questionBank: true }
        }
      },
      orderBy: { exam_id: "desc" }
    });
    return { success: true, exams };
  } catch (err: any) {
    console.error("Error in getArchivedExaminations:", err);
    return { error: err.message || "Failed to fetch archived exams." };
  }
}

export async function getFacultyEnrolledStudentsAndGrades(facultyId: number) {
  try {
    const exams = await db.examination.findMany({
      where: { faculty_id: facultyId },
      include: {
        course: true,
        examTargets: {
          include: { program: true }
        },
        questionBank: {
          select: { points: true }
        },
        studentExams: {
          include: {
            student: {
              include: {
                user: true,
                program: true,
              }
            }
          }
        }
      },
      orderBy: { exam_id: "desc" }
    });

    const now = new Date();

    // Map course_id -> list of exams for that course
    const courseMap = new Map<number, {
      course: { course_id: number; course_code: string; course_title: string };
      exams: typeof exams;
    }>();

    for (const exam of exams) {
      if (!courseMap.has(exam.course_id)) {
        courseMap.set(exam.course_id, {
          course: exam.course,
          exams: []
        });
      }
      courseMap.get(exam.course_id)!.exams.push(exam);
    }

    const aggregatedList: any[] = [];

    for (const [courseId, { course, exams: courseExams }] of courseMap.entries()) {
      const targetGroups: Array<{ program_id: number; year_level: number; section: string }> = [];
      const groupKeySet = new Set<string>();

      for (const ex of courseExams) {
        for (const target of ex.examTargets) {
          const key = `${target.program_id}-${target.year_level}-${target.section}`;
          if (!groupKeySet.has(key)) {
            groupKeySet.add(key);
            targetGroups.push({
              program_id: target.program_id,
              year_level: target.year_level,
              section: target.section
            });
          }
        }
      }

      const studentsMap = new Map<number, any>();

      if (targetGroups.length > 0) {
        const groupStudents = await db.student.findMany({
          where: {
            OR: targetGroups.map(tc => ({
              program_id: tc.program_id,
              year_level: tc.year_level,
              section: tc.section
            }))
          },
          include: {
            user: true,
            program: true
          }
        });

        for (const s of groupStudents) {
          studentsMap.set(s.student_id, s);
        }
      }

      for (const ex of courseExams) {
        for (const se of ex.studentExams) {
          if (!studentsMap.has(se.student.student_id)) {
            studentsMap.set(se.student.student_id, se.student);
          }
        }
      }

      for (const student of studentsMap.values()) {
        const studentExamRecords: any[] = [];
        let totalTookCount = 0;
        let totalMissedCount = 0;
        let sumPercentages = 0;
        let percentageCount = 0;

        for (const ex of courseExams) {
          const maxScore = ex.questionBank.reduce((acc, q) => acc + q.points, 0);
          const studentAttempt = ex.studentExams.find(se => se.student_id === student.student_id);

          const target = ex.examTargets.find(
            t => t.program_id === student.program_id && t.year_level === student.year_level && t.section === student.section
          );

          const scheduledDate = target ? target.scheduled_date : null;
          const endTime = target ? target.end_time : null;

          let status: "Took Exam" | "Missed Exam" | "Upcoming" = "Upcoming";
          let score: number | null = null;
          let pct: number | null = null;
          let submittedAt: string | null = null;

          if (studentAttempt) {
            status = "Took Exam";
            score = studentAttempt.total_score;
            pct = maxScore > 0 ? Math.round((studentAttempt.total_score / maxScore) * 100) : 100;
            submittedAt = studentAttempt.submitted_at ? studentAttempt.submitted_at.toISOString() : studentAttempt.started_at.toISOString();
            totalTookCount++;
            sumPercentages += pct;
            percentageCount++;
          } else {
            const isPassed = endTime ? new Date(endTime) < now : (scheduledDate ? new Date(scheduledDate) < now : false);
            if (isPassed) {
              status = "Missed Exam";
              score = 0;
              pct = 0;
              totalMissedCount++;
              sumPercentages += 0;
              percentageCount++;
            } else {
              status = "Upcoming";
            }
          }

          studentExamRecords.push({
            exam_id: ex.exam_id,
            exam_title: ex.title,
            max_score: maxScore,
            scheduled_date: scheduledDate ? scheduledDate.toISOString() : null,
            status,
            student_score: score,
            percentage: pct,
            submitted_at: submittedAt
          });
        }

        const avgGrade = percentageCount > 0 ? Math.round(sumPercentages / percentageCount) : null;

        aggregatedList.push({
          course_id: course.course_id,
          course_code: course.course_code,
          course_title: course.course_title,
          student_id: student.student_id,
          first_name: student.first_name,
          middle_name: student.middle_name,
          last_name: student.last_name,
          institutional_id: student.user.institutional_id,
          institutional_email: student.user.institutional_email || `${student.user.institutional_id.toLowerCase()}@acadnexus.bsc.edu.ph`,
          program_code: student.program.program_code,
          year_level: student.year_level,
          section: student.section,
          exams: studentExamRecords,
          average_grade_percentage: avgGrade,
          total_took: totalTookCount,
          total_missed: totalMissedCount
        });
      }
    }

    return { success: true, enrolledStudents: aggregatedList };
  } catch (err: any) {
    console.error("Error in getFacultyEnrolledStudentsAndGrades:", err);
    return { error: err.message || "Failed to fetch enrolled students and grades." };
  }
}

export async function getCourseRoster(courseId: number, facultyId?: number) {
  try {
    if (facultyId) {
      const assignedCount = await db.facultyCourse.count({ where: { faculty_id: facultyId } });
      if (assignedCount === 0) {
        return { success: true, students: [] };
      }
      const isCourseAssigned = await db.facultyCourse.findFirst({
        where: { faculty_id: facultyId, course_id: courseId },
      });
      if (!isCourseAssigned) {
        return { success: true, students: [] };
      }
    }
    const { course, targetYearLevel, targetPrograms } = await syncAndGetYearLevelEnrolledStudents(courseId, facultyId);

    const studentFilter: any = {};
    if (targetYearLevel) {
      studentFilter.year_level = targetYearLevel;
    }
    if (targetPrograms.length > 0) {
      studentFilter.program = {
        program_code: { in: targetPrograms },
      };
    }

    const whereCondition: any = { course_id: courseId };
    if (Object.keys(studentFilter).length > 0) {
      whereCondition.student = studentFilter;
    }

    const enrollments = await db.studentCourse.findMany({
      where: whereCondition,
      include: {
        student: {
          include: {
            user: true,
            program: true,
          },
        },
      },
      orderBy: {
        student: {
          last_name: "asc",
        },
      },
    });

    const students = enrollments.map((e) => ({
      student_id: e.student.student_id,
      institutional_id: e.student.user.institutional_id,
      first_name: e.student.first_name,
      middle_name: e.student.middle_name,
      last_name: e.student.last_name,
      program_id: e.student.program_id,
      program_code: e.student.program.program_code,
      program_name: e.student.program.program_name,
      year_level: e.student.year_level,
      section: e.student.section,
      enrolled_at: e.enrolled_at.toISOString(),
    }));

    return { success: true, students };
  } catch (err: any) {
    console.error("Error in getCourseRoster:", err);
    return { error: err.message || "Failed to fetch course roster." };
  }
}

export async function enrollStudentInCourse(
  facultyId: number,
  courseId: number,
  data: {
    institutionalId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    programId?: number;
    yearLevel?: number;
    section?: string;
  }
) {
  const rawId = data.institutionalId?.trim();
  if (!rawId) {
    return { error: "Student ID number is required." };
  }

  const formattedId = rawId.toUpperCase();

  try {
    if (facultyId) {
      const assignedCount = await db.facultyCourse.count({
        where: { faculty_id: facultyId },
      });
      if (assignedCount === 0) {
        return { error: "UNASSIGNED_TEACHING_LOAD: No teaching subjects/courses have been assigned to your faculty account yet by the Campus Director." };
      }
      const isAssigned = await db.facultyCourse.findFirst({
        where: { faculty_id: facultyId, course_id: courseId },
      });
      if (!isAssigned) {
        return { error: "UNASSIGNED_TEACHING_LOAD: This specific course/subject is not assigned to your teaching load by the Campus Director." };
      }
    }

    const bcrypt = await import("bcryptjs");

    // 1. Verify that course exists
    const course = await db.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      return { error: "Selected course was not found." };
    }

    const courseExpected = getExpectedYearAndSemForCourse(course.course_code, course.course_title);
    const defaultYear = courseExpected?.yearLevel || 1;

    // 2. Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { institutional_id: formattedId },
      include: { student: true },
    });

    let targetStudentId: number;

    if (existingUser) {
      if (existingUser.role !== "Student") {
        return {
          error: `Institutional ID ${formattedId} is already assigned to a ${existingUser.role} account.`,
        };
      }

      targetStudentId = existingUser.user_id;

      // Check if already enrolled in this specific course
      const existingEnrollment = await db.studentCourse.findUnique({
        where: {
          student_id_course_id: {
            student_id: targetStudentId,
            course_id: courseId,
          },
        },
      });

      if (existingEnrollment) {
        return {
          error: `Student ${formattedId} is already enrolled in ${course.course_code}.`,
        };
      }

      // Enroll existing student
      await db.studentCourse.create({
        data: {
          student_id: targetStudentId,
          course_id: courseId,
        },
      });

      // Update student profile details if provided
      if (data.firstName?.trim() || data.lastName?.trim()) {
        await db.student.update({
          where: { student_id: targetStudentId },
          data: {
            first_name: data.firstName.trim() || undefined,
            middle_name: data.middleName?.trim() || undefined,
            last_name: data.lastName.trim() || undefined,
            year_level: data.yearLevel ? Number(data.yearLevel) : undefined,
            section: data.section ? data.section.trim() : undefined,
          },
        });
      }
    } else {
      // 3. User does not exist: Provision new Student user account
      // Initial default password is set to 'dukay'
      const salt = await bcrypt.genSalt(10);
      const defaultPasswordHash = await bcrypt.hash("dukay", salt);

      // Determine default program if not specified
      let programId = data.programId ? Number(data.programId) : undefined;
      if (!programId) {
        const defaultProg = await db.academicProgram.findFirst({
          orderBy: { program_id: "asc" },
        });
        programId = defaultProg?.program_id || 1;
      }

      const created = await db.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            institutional_id: formattedId,
            password_hash: defaultPasswordHash,
            role: "Student",
            require_password_update: true,
            is_active: true,
          },
        });

        await tx.student.create({
          data: {
            student_id: newUser.user_id,
            first_name: data.firstName?.trim() || "Student",
            middle_name: data.middleName?.trim() || null,
            last_name: data.lastName?.trim() || formattedId,
            program_id: programId!,
            year_level: Number(data.yearLevel) || defaultYear,
            section: data.section?.trim() || "A",
          },
        });

        await tx.studentCourse.create({
          data: {
            student_id: newUser.user_id,
            course_id: courseId,
          },
        });

        return newUser;
      });

      targetStudentId = created.user_id;
    }

    // 4. Log audit log
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Faculty enrolled student ${formattedId} into Course ${course.course_code} (${course.course_title})`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/faculty/exams");
    revalidatePath("/dashboard/student");

    return {
      success: true,
      message: `Student ${formattedId} successfully enrolled in ${course.course_code}!`,
      studentId: targetStudentId,
    };
  } catch (err: any) {
    console.error("Error in enrollStudentInCourse:", err);
    return { error: err.message || "Failed to enroll student." };
  }
}

export async function bulkEnrollStudentsInCourse(
  facultyId: number,
  courseId: number,
  rawInput: string,
  defaultProgramId?: number,
  defaultYearLevel?: number,
  defaultSection?: string
) {
  if (!rawInput?.trim()) {
    return { error: "Please enter at least one Student ID number." };
  }

  try {
    const lines = rawInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let enrolledCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const line of lines) {
      // Support comma, tab, or pipe separated values: ID, FirstName, LastName
      const parts = line.split(/[,|\t]+/).map((p) => p.trim());
      const instId = parts[0]?.toUpperCase();
      const fName = parts[1] || "";
      const lName = parts[2] || "";

      if (!instId) continue;

      const res = await enrollStudentInCourse(facultyId, courseId, {
        institutionalId: instId,
        firstName: fName,
        lastName: lName,
        programId: defaultProgramId,
        yearLevel: defaultYearLevel,
        section: defaultSection,
      });

      if (res.success) {
        enrolledCount++;
      } else {
        skippedCount++;
        errors.push(`${instId}: ${res.error}`);
      }
    }

    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/student");

    return {
      success: true,
      enrolledCount,
      skippedCount,
      errors: errors.slice(0, 5),
      message: `Enrolled ${enrolledCount} student(s)${skippedCount > 0 ? ` (${skippedCount} skipped or already enrolled)` : ""}.`,
    };
  } catch (err: any) {
    console.error("Error in bulkEnrollStudentsInCourse:", err);
    return { error: err.message || "Failed to perform bulk enrollment." };
  }
}

export async function unenrollStudentFromCourse(
  facultyId: number,
  courseId: number,
  studentId: number
) {
  try {
    const course = await db.course.findUnique({
      where: { course_id: courseId },
    });

    const student = await db.student.findUnique({
      where: { student_id: studentId },
      include: { user: true },
    });

    await db.studentCourse.delete({
      where: {
        student_id_course_id: {
          student_id: studentId,
          course_id: courseId,
        },
      },
    });

    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Faculty removed student ${student?.user.institutional_id || studentId} from Course ${course?.course_code || courseId}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/student");

    return { success: true };
  } catch (err: any) {
    console.error("Error in unenrollStudentFromCourse:", err);
    return { error: err.message || "Failed to unenroll student." };
  }
}

export async function acknowledgeAssignedCoursesAction(facultyId: number) {
  try {
    await db.faculty.update({
      where: { faculty_id: facultyId },
      data: { has_seen_course_assignment: true },
    });
    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error acknowledging assigned courses:", err);
    return { error: err.message || "Failed to acknowledge assigned courses." };
  }
}

export async function assignCoursesToFacultyAction(facultyId: number, courseIds: number[]) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return { error: "Unauthorized. Please log in first." };

    const currentRole = currentUser.user_metadata?.role;
    if (currentRole !== "Director" && currentRole !== "Chair" && currentRole !== "ProgramChair") {
      return { error: "Unauthorized. Only Director or Chair can assign courses to faculty." };
    }

    await db.$transaction(async (tx) => {
      // Delete previous assignments
      await tx.facultyCourse.deleteMany({
        where: { faculty_id: facultyId },
      });

      // Insert new assignments
      if (courseIds && courseIds.length > 0) {
        await tx.facultyCourse.createMany({
          data: courseIds.map((cId) => ({
            faculty_id: facultyId,
            course_id: Number(cId),
          })),
        });
      }

      // Reset has_seen_course_assignment so the faculty sees the newly assigned courses modal on next visit!
      await tx.faculty.update({
        where: { faculty_id: facultyId },
        data: { has_seen_course_assignment: false },
      });
    });

    revalidatePath("/dashboard/director");
    revalidatePath("/dashboard/chair");
    revalidatePath("/dashboard/faculty");

    return { success: true };
  } catch (err: any) {
    console.error("Error assigning courses to faculty:", err);
    return { error: err.message || "Failed to update course assignments." };
  }
}






