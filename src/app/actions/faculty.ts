"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ExamStatus } from "@prisma/client";

export async function updateFacultyProfile(facultyId: number, firstName: string, lastName: string) {
  if (!firstName || !lastName) {
    return { error: "First name and last name are required." };
  }

  try {
    await db.faculty.update({
      where: { faculty_id: facultyId },
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    // Log the profile update action
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Updated profile details: ${firstName} ${lastName}`,
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
<<<<<<< Updated upstream
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }

    if (exam.faculty_id !== userId) {
      return { error: "Unauthorized operation." };
    }

    // Require Table of Specifications (TOS) before submitting for Chair review
    if (status === "Pending_Chair") {
      if (!exam.tos_file_path || exam.tos_file_path.trim() === "") {
        return { error: "You cannot submit this examination for review without uploading a Table of Specifications (TOS) first." };
      }
    }

    await db.examination.update({
      where: { exam_id: examId },
      data: { current_status: status },
    });

    // Add or update ApprovalWorkflow record if needed
    if (status === "Pending_Chair") {
      // Find a Chair to assign (e.g. for the faculty's department)
      const faculty = await db.faculty.findUnique({
        where: { faculty_id: userId },
=======
    return await db.$transaction(async (tx) => {
      const exam = await tx.examination.findUnique({
        where: { exam_id: examId },
>>>>>>> Stashed changes
      });

      if (!exam) {
        return { error: "Examination not found." };
      }

      if (exam.faculty_id !== userId) {
        return { error: "Unauthorized operation." };
      }

      // Add or update ApprovalWorkflow record if needed
      if (status === "Pending_Chair") {
        // Find a Chair to assign (e.g. for the faculty's department)
        const faculty = await tx.faculty.findUnique({
          where: { faculty_id: userId },
        });

        if (!faculty) {
          return { error: "Faculty profile not found. Please contact an admin." };
        }

        const chair = await tx.chair.findUnique({
          where: { department_id: faculty.department_id },
        });

        if (!chair) {
          return { error: "No department chair found for your department. Cannot submit exam for review." };
        }

        await tx.approvalWorkflow.upsert({
          where: { exam_id: examId },
          update: {
            reviewed_by_chair_id: chair.chair_id,
            chair_review_status: "Pending",
            chair_comments: null,
            chair_action_timestamp: null,
            di_review_status: "Hold",
            di_action_timestamp: null,
            reviewed_by_di_id: null,
          },
          create: {
            exam_id: examId,
            reviewed_by_chair_id: chair.chair_id,
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
    // If courseId is not provided, find the first course in the database
    let targetCourseId = courseId;
    if (!targetCourseId) {
      const firstCourse = await db.course.findFirst();
      if (!firstCourse) {
        return { error: "No courses found in the database. Please contact an admin." };
      }
      targetCourseId = firstCourse.course_id;
    }

    const newExam = await db.examination.create({
      data: {
        title: "New Examination Draft",
        course_id: targetCourseId,
        faculty_id: facultyId,
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
      },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Updated exam config for "${title}" (ID: ${examId})`,
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
    });

    if (!exam) return { error: "Examination not found." };
    if (exam.faculty_id !== facultyId) return { error: "Unauthorized operation." };
    if (exam.current_status !== "Approved") return { error: "Only approved examinations can be scheduled." };

    const dateObj = new Date(`${scheduledDate}T00:00:00.000Z`);
    const startObj = new Date(`1970-01-01T${startTime}:00.000Z`);
    const endObj = new Date(`1970-01-01T${endTime}:00.000Z`);

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
          section: section,
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
          section: section,
          scheduled_date: dateObj,
          start_time: startObj,
          end_time: endObj,
        },
      });
    }

    await db.auditLog.create({
      data: {
        user_id: facultyId,
        action_performed: `Scheduled/updated exam target for "${exam.title}" (ID: ${examId}) on ${scheduledDate}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/student");
    return { success: true };
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
      include: { examTargets: true }
    });

    if (!exam || exam.faculty_id !== facultyId) {
      return { error: "Examination not found or unauthorized." };
    }

    const students: any[] = [];
    const seenStudentIds = new Set<number>();

    for (const target of exam.examTargets) {
      const cohort = await db.student.findMany({
        where: {
          program_id: target.program_id,
          year_level: target.year_level,
          section: target.section
        },
        include: {
          user: true,
          studentExams: {
            where: { exam_id: examId }
          }
        }
      });
      
      for (const s of cohort) {
        if (!seenStudentIds.has(s.student_id)) {
          seenStudentIds.add(s.student_id);
          students.push(s);
        }
      }
    }

    const studentList = students.map(s => {
      const attempt = s.studentExams[0] || null;
      return {
        student_id: s.student_id,
        first_name: s.first_name,
        last_name: s.last_name,
        institutional_email: s.user.institutional_email,
        institutional_id: s.user.institutional_id,
        attempt: attempt ? {
          student_exam_id: attempt.student_exam_id,
          started_at: attempt.started_at.toISOString(),
          submitted_at: attempt.submitted_at ? attempt.submitted_at.toISOString() : null,
          submission_trigger: attempt.submission_trigger,
          total_score: attempt.total_score
        } : null
      };
    });

    return { success: true, students: studentList };
  } catch (err: any) {
    console.error("Error in getMissedStudentsForExam:", err);
    return { error: err.message || "Failed to fetch missed student cohort." };
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

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    await db.$transaction(async (tx) => {
      // 1. Delete existing student exam attempt and answers to clean state
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

      // 2. Upsert override record
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
          action_performed: `Granted administrative exam override for Student ID: ${studentId} on Exam ID: ${examId} (Window: ${startTimeStr} to ${endTimeStr})`,
          ip_address: "127.0.0.1"
        }
      });
    });

    revalidatePath("/dashboard/faculty");
    revalidatePath("/dashboard/student");
    return { success: true };
  } catch (err: any) {
    console.error("Error in grantStudentOverride:", err);
    return { error: err.message || "Failed to grant override access." };
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
    question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type" | "Essay";
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



