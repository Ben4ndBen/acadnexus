"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { SubmissionType } from "@prisma/client";
import { parseExamResultSettings } from "@/lib/examResultSettings";

// Helper for deterministic shuffling using student_exam_id as seed
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let m = shuffled.length, t, i;
  let currentSeed = seed;
  const random = () => {
    // Deterministic sine-based pseudo-random generator
    let x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };
  while (m) {
    i = Math.floor(random() * m--);
    t = shuffled[m];
    shuffled[m] = shuffled[i];
    shuffled[i] = t;
  }
  return shuffled;
}

export async function startStudentExam(examId: number, studentId: number) {
  try {
    // 1. Fetch student details to get their program, year, and section
    const student = await db.student.findUnique({
      where: { student_id: studentId },
    });

    if (!student) {
      return { error: "Student profile not found." };
    }

    // 2. Check if there is an active student override first
    const override = await db.studentOverride.findFirst({
      where: {
        student_id: studentId,
        exam_id: examId,
        is_active: true,
      },
      include: {
        exam: {
          include: {
            course: true,
            examTargets: true,
            tableOfSpecifications: true,
            questionBank: {
              select: { points: true },
            },
          },
        },
      },
    });

    // 2. Fetch the examination record to check approval and assigned student list
    const examRecord = await db.examination.findUnique({
      where: { exam_id: examId },
      include: {
        course: true,
        examTargets: true,
        tableOfSpecifications: true,
        questionBank: {
          select: { points: true },
        },
      },
    });

    if (!examRecord) {
      return { error: "Examination not found." };
    }

    // Respect the exam's approval status
    if (examRecord.current_status !== "Approved") {
      return { error: `This exam is not available yet because it has not been approved by the school administrator.` };
    }

    // Make exam availability depend on the students selected by the instructor who created the examination
    // Only students assigned to that specific exam should access it.
    // Do not make an exam available to all students taking the same course unless they were actually assigned to that examination.
    const selectedIds = examRecord.selected_student_ids;
    const isExplicitlyAssigned = Array.isArray(selectedIds) && selectedIds.includes(studentId);
    const hasActiveOverride = Boolean(override);

    if (!isExplicitlyAssigned && !hasActiveOverride) {
      return { error: "You are not assigned to this exam. Only students selected by the teacher can take this exam." };
    }

    let exam: any;
    let examStart: Date;
    let examEnd: Date;

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));

    if (override) {
      exam = override.exam;
      examStart = override.new_start_time;
      examEnd = override.new_end_time;
    } else {
      // Find target schedule for this exam
      const target = examRecord.examTargets.find(
        (t) => t.program_id === student.program_id && t.year_level === student.year_level
      ) || examRecord.examTargets[0];

      if (!target) {
        return { error: "This exam is approved, but the date and time have not been set by your teacher yet. Please check back later." };
      }

      exam = examRecord;

      examStart = new Date(
        target.scheduled_date.getUTCFullYear(),
        target.scheduled_date.getUTCMonth(),
        target.scheduled_date.getUTCDate(),
        target.start_time.getUTCHours(),
        target.start_time.getUTCMinutes(),
        0
      );

      examEnd = new Date(
        target.scheduled_date.getUTCFullYear(),
        target.scheduled_date.getUTCMonth(),
        target.scheduled_date.getUTCDate(),
        target.end_time.getUTCHours(),
        target.end_time.getUTCMinutes(),
        0
      );
    }

    // 3. Fetch or check existing StudentExam attempt FIRST
    let studentExam = await db.studentExam.findFirst({
      where: {
        student_id: studentId,
        exam_id: examId,
      },
      include: {
        studentAnswers: true,
      },
    });

    let remainingSeconds = exam.time_limit_minutes * 60;
    let isResumedAttempt = false;

    if (studentExam) {
      // If exam already completed, return completed status respecting exam result visibility settings
      if (studentExam.submitted_at) {
        const resultVisibility = parseExamResultSettings({
          tos_file_path: exam.tos_file_path,
          tableOfSpecifications: exam.tableOfSpecifications,
          examTargets: exam.examTargets,
          current_status: exam.current_status,
        });

        const maxPoints = exam.questionBank ? exam.questionBank.reduce((sum: number, q: any) => sum + (q.points || 0), 0) : 0;

        return {
          isCompleted: true,
          totalScore: resultVisibility.canShowResults ? studentExam.total_score : undefined,
          canShowResults: resultVisibility.canShowResults,
          resultReleaseMode: resultVisibility.releaseMode,
          resultStatusLabel: resultVisibility.statusLabel,
          resultExplanation: resultVisibility.explanation,
          submittedAt: studentExam.submitted_at,
          trigger: studentExam.submission_trigger,
          violationsCount: studentExam.violations_count,
          maxPoints,
        };
      }

      isResumedAttempt = true;

      // Resume attempt:
      // Keep the scheduled availability window separate from the individual student's attempt timer.
      // Once the student starts the exam, record the attempt's start time and calculate the deadline
      // based on the configured time limit and any applicable anti-cheating time deductions.
      const elapsedMs = now.getTime() - studentExam.started_at.getTime();
      const timePenaltySeconds = (studentExam.violations_count || 0) * (exam.time_penalty_seconds ?? 60);
      const totalAllowedSeconds = Math.max(0, (exam.time_limit_minutes * 60) - timePenaltySeconds);
      const calculatedRemaining = totalAllowedSeconds - Math.floor(elapsedMs / 1000);

      // Do not allow refreshing the page or reopening the browser to reset the timer.
      remainingSeconds = Math.max(0, Math.min(calculatedRemaining, studentExam.remaining_seconds ?? calculatedRemaining));

      if (remainingSeconds <= 0) {
        // Time limit reached zero: automatically submit attempt
        const submitResult = await submitStudentExam(studentExam.student_exam_id, "Timeout");
        if (submitResult.error) {
          return { error: submitResult.error };
        }
        return {
          isCompleted: true,
          totalScore: submitResult.canShowResults ? submitResult.totalScore : undefined,
          canShowResults: submitResult.canShowResults,
          resultReleaseMode: submitResult.resultReleaseMode,
          resultStatusLabel: submitResult.resultStatusLabel,
          resultExplanation: submitResult.resultExplanation,
          submittedAt: new Date(),
          trigger: "Timeout" as SubmissionType,
          maxPoints: submitResult.maxPoints,
        };
      }
    } else {
      // Starting a NEW attempt:
      // Allow assigned students to start an examination only during its scheduled availability window.
      if (now < examStart) {
        const startTimeString = examStart.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit'
        });
        return { error: `This exam has not started yet. It is scheduled to start at ${startTimeString}.` };
      }

      // If the student has not started by the end of the scheduled availability window, mark as Missed
      if (now >= examEnd) {
        return { 
          error: "The scheduled time for this exam has passed. You missed this exam because you did not start before the examination schedule ended." 
        };
      }

      // Create new student exam attempt when student actually opens/starts the exam
      studentExam = await db.studentExam.create({
        data: {
          student_id: studentId,
          exam_id: examId,
          started_at: now,
          remaining_seconds: remainingSeconds,
          submission_trigger: "Manual",
        },
        include: {
          studentAnswers: true,
        },
      });
    }

    // 5. Fetch questions from question bank (exclude correct_answer to prevent inspection)
    const dbQuestions = await db.questionBank.findMany({
      where: { exam_id: examId },
      select: {
        question_id: true,
        question_text: true,
        question_type: true,
        points: true,
      },
    });

    // Shuffle questions deterministically based on student_exam_id if randomize_items is enabled
    const questions = exam.randomize_items
      ? shuffleWithSeed(dbQuestions, studentExam.student_exam_id)
      : dbQuestions;

    const savedAnswers = studentExam.studentAnswers.map((ans) => ({
      question_id: ans.question_id,
      submitted_response: ans.submitted_response,
    }));

    return {
      success: true,
      studentExamId: studentExam.student_exam_id,
      remainingSeconds,
      questions,
      savedAnswers,
      examTitle: exam.title,
      courseTitle: exam.course.course_title,
      courseCode: exam.course.course_code,
      timePenaltySeconds: exam.time_penalty_seconds ?? 60,
      scorePenaltyPoints: exam.score_penalty_points ?? 2,
      timeLimitMinutes: exam.time_limit_minutes,
      isInProgress: isResumedAttempt,
    };
  } catch (err: any) {
    console.error("Error starting exam:", err);
    return { error: err.message || "Failed to start examination." };
  }
}

export async function saveStudentAnswers(
  studentExamId: number,
  answers: { question_id: number; submitted_response: string }[]
) {
  try {
    const studentExam = await db.studentExam.findUnique({
      where: { student_exam_id: studentExamId },
    });

    if (!studentExam) {
      return { error: "Student examination record not found." };
    }

    if (studentExam.submitted_at) {
      return { error: "Examination has already been submitted. Modifications are locked." };
    }

    await db.$transaction(async (tx) => {
      // Retrieve existing answers for updates
      const existingAnswers = await tx.studentAnswer.findMany({
        where: { student_exam_id: studentExamId },
      });

      const existingMap = new Map(existingAnswers.map((ans) => [ans.question_id, ans.answer_id]));

      for (const ans of answers) {
        const answerId = existingMap.get(ans.question_id);
        if (answerId !== undefined) {
          await tx.studentAnswer.update({
            where: { answer_id: answerId },
            data: {
              submitted_response: ans.submitted_response,
              last_updated_at: new Date(),
            },
          });
        } else {
          await tx.studentAnswer.create({
            data: {
              student_exam_id: studentExamId,
              question_id: ans.question_id,
              submitted_response: ans.submitted_response,
              last_updated_at: new Date(),
            },
          });
        }
      }
    });

    return { success: true, savedCount: answers.length };
  } catch (err: any) {
    console.error("Error saving answers:", err);
    return { error: err.message || "Failed to save answers." };
  }
}

export type SubmitExamResult =
  | {
      success: true;
      totalScore: number;
      rawScore: number;
      penaltyPoints: number;
      scorePenaltyPoints: number;
      violationsCount: number;
      maxPoints: number;
      trigger: SubmissionType;
      submittedAt: string;
      canShowResults: boolean;
      resultReleaseMode: string;
      resultStatusLabel: string;
      resultExplanation: string;
      error?: undefined;
    }
  | {
      success: false;
      error: string;
      totalScore?: undefined;
      rawScore?: undefined;
      penaltyPoints?: undefined;
      scorePenaltyPoints?: undefined;
      violationsCount?: undefined;
      maxPoints?: undefined;
      trigger?: undefined;
      submittedAt?: undefined;
      canShowResults?: undefined;
      resultReleaseMode?: undefined;
      resultStatusLabel?: undefined;
      resultExplanation?: undefined;
    };

export async function submitStudentExam(
  studentExamId: number,
  trigger: SubmissionType,
  finalAnswers?: { question_id: number; submitted_response: string }[]
): Promise<SubmitExamResult> {
  try {
    const studentExam = await db.studentExam.findUnique({
      where: { student_exam_id: studentExamId },
      include: {
        exam: {
          include: {
            questionBank: true,
            tableOfSpecifications: true,
            examTargets: true,
          },
        },
      },
    });

    if (!studentExam) {
      return { success: false, error: "Student examination record not found." };
    }

    if (studentExam.submitted_at) {
      return { success: false, error: "Examination has already been submitted." };
    }

    const exam = studentExam.exam;

    // 1. Save final answers if provided
    if (finalAnswers && finalAnswers.length > 0) {
      await saveStudentAnswers(studentExamId, finalAnswers);
    }

    // 2. Grade objective questions automatically and save correctness
    const studentAnswers = await db.studentAnswer.findMany({
      where: { student_exam_id: studentExamId },
    });

    const answersMap = new Map(studentAnswers.map((ans) => [ans.question_id, ans]));
    let totalScore = 0;
    const violationsCount = studentExam.violations_count ?? 0;
    // Follow the configured penalty dynamically: if 0, deduct 0; if 2, deduct 2; if any other value, follow that configuration
    const scorePenaltyPoints = typeof exam.score_penalty_points === "number" ? exam.score_penalty_points : 2;
    const totalPenalty = violationsCount * scorePenaltyPoints;
    let penalizedScore = 0;

    await db.$transaction(async (tx) => {
      for (const q of exam.questionBank) {
        const ans = answersMap.get(q.question_id);
        const response = ans?.submitted_response || "";
        const correct = q.correct_answer || "";

        let isCorrect: boolean | null = false;
        let pointsAwarded: number | null = 0;

        if (q.question_type === "Essay") {
          isCorrect = null;
          pointsAwarded = null;
        } else if (q.question_type === "Fill_In_The_Blanks") {
          try {
            const parsedCorrect = JSON.parse(correct);
            const expectedBlanks: Array<{ id: number | string; answer: string; points: number }> = parsedCorrect.blanks || [];
            
            let studentBlanks: Record<string, string> = {};
            if (response.trim().startsWith("{")) {
              const parsedResp = JSON.parse(response);
              studentBlanks = parsedResp.blanks || {};
            } else if (response.trim()) {
              // Single string response
              studentBlanks = { "1": response.trim() };
            }

            if (expectedBlanks.length > 0) {
              let earned = 0;
              let totalPossible = 0;
              let allCorrect = true;

              for (const blank of expectedBlanks) {
                const bId = String(blank.id);
                const bPoints = Number(blank.points) || 1;
                totalPossible += bPoints;

                const studentAns = (studentBlanks[bId] || "").trim().toLowerCase();
                const expectedAns = (blank.answer || "").trim().toLowerCase();

                if (studentAns !== "" && studentAns === expectedAns) {
                  earned += bPoints;
                } else {
                  allCorrect = false;
                }
              }

              pointsAwarded = earned;
              isCorrect = allCorrect && earned > 0;
              totalScore += earned;
            } else {
              isCorrect = response.trim().toLowerCase() === correct.trim().toLowerCase();
              pointsAwarded = isCorrect ? q.points : 0;
              if (isCorrect) totalScore += q.points;
            }
          } catch {
            isCorrect = response.trim().toLowerCase() === correct.trim().toLowerCase();
            pointsAwarded = isCorrect ? q.points : 0;
            if (isCorrect) totalScore += q.points;
          }
        } else if (q.question_type === "Matching_Type") {
          try {
            const parsedCorrect = JSON.parse(correct);
            const parsedResponse = JSON.parse(response);

            const correctMatches = parsedCorrect.matches || [];
            const responseMatches = parsedResponse.matches || [];

            const correctMap = new Map(
              correctMatches.map((m: any) => [
                m.premise?.trim().toLowerCase(),
                m.choice?.trim().toLowerCase(),
              ])
            );
            const responseMap = new Map(
              responseMatches.map((m: any) => [
                m.premise?.trim().toLowerCase(),
                m.choice?.trim().toLowerCase(),
              ])
            );

            if (correctMap.size === responseMap.size && correctMap.size > 0) {
              isCorrect = true;
              for (const [premise, choice] of correctMap.entries()) {
                if (responseMap.get(premise) !== choice) {
                  isCorrect = false;
                  break;
                }
              }
            }
          } catch {
            isCorrect = response.trim().toLowerCase() === correct.trim().toLowerCase();
          }
        } else {
          // Case-insensitive trimmed exact matching for objective auto-grading (MCQ, T/F, Identification)
          isCorrect = response.trim().toLowerCase() === correct.trim().toLowerCase();
        }

        if (q.question_type !== "Fill_In_The_Blanks" && q.question_type !== "Essay") {
          if (isCorrect === true) {
            totalScore += q.points;
            pointsAwarded = q.points;
          } else if (isCorrect === false) {
            pointsAwarded = 0;
          }
        }

        if (ans) {
          await tx.studentAnswer.update({
            where: { answer_id: ans.answer_id },
            data: { 
              is_correct: isCorrect,
              points_awarded: pointsAwarded
            },
          });
        } else {
          // Create blank response if they did not answer
          await tx.studentAnswer.create({
            data: {
              student_exam_id: studentExamId,
              question_id: q.question_id,
              submitted_response: "",
              is_correct: q.question_type === "Essay" ? null : false,
              points_awarded: q.question_type === "Essay" ? null : 0,
              last_updated_at: new Date(),
            },
          });
        }
      }

      // Apply security violation score penalty
      penalizedScore = Math.max(0, totalScore - totalPenalty);

      // Update the student exam attempt to completed
      await tx.studentExam.update({
        where: { student_exam_id: studentExamId },
        data: {
          submitted_at: new Date(),
          total_score: penalizedScore,
          submission_trigger: trigger,
          remaining_seconds: 0, // Task 31: Clear remaining seconds upon submission
        },
      });

      // 3. Deactivate any active student override for this exam
      await tx.studentOverride.updateMany({
        where: {
          student_id: studentExam.student_id,
          exam_id: exam.exam_id,
          is_active: true
        },
        data: {
          is_active: false
        }
      });

      // 4. Log audit event
      await tx.auditLog.create({
        data: {
          user_id: studentExam.student_id,
          action_performed: `Submitted Examination (Exam ID: ${exam.exam_id}, Trigger: ${trigger}, Raw Score: ${totalScore}, Penalty: -${totalPenalty} for ${violationsCount} violations, Net Score: ${penalizedScore})`,
          ip_address: "127.0.0.1",
        },
      });
    });

    // Check if exam is now eligible to automatically transition to archives
    try {
      const { autoArchiveCompletedExams } = await import("@/app/actions/faculty");
      await autoArchiveCompletedExams(exam.faculty_id);
    } catch (archiveErr) {
      console.error("Auto-archive check error on submit:", archiveErr);
    }

    // 5. Evaluate examination result visibility settings
    const resultVisibility = parseExamResultSettings({
      tos_file_path: exam.tos_file_path,
      tableOfSpecifications: exam.tableOfSpecifications,
      examTargets: exam.examTargets,
      current_status: exam.current_status,
    });

    revalidatePath("/dashboard/student");
    return { 
      success: true, 
      totalScore: penalizedScore,
      rawScore: totalScore,
      penaltyPoints: totalPenalty,
      scorePenaltyPoints: scorePenaltyPoints,
      violationsCount: violationsCount,
      maxPoints: exam.questionBank.reduce((sum: number, q: any) => sum + (q.points || 0), 0),
      trigger: trigger,
      submittedAt: new Date().toISOString(),
      canShowResults: resultVisibility.canShowResults,
      resultReleaseMode: resultVisibility.releaseMode,
      resultStatusLabel: resultVisibility.statusLabel,
      resultExplanation: resultVisibility.explanation,
    };
  } catch (err: any) {
    console.error("Error submitting exam:", err);
    return { success: false, error: err.message || "Failed to submit examination." };
  }
}

export async function logStudentWarning(
  studentId: number,
  examId: number,
  warningNumber: number,
  reason: string,
  studentExamId?: number
) {
  try {
    // 1. Log audit warning event
    await db.auditLog.create({
      data: {
        user_id: studentId,
        action_performed: `Security Warning ${warningNumber}/2 for Exam (ID: ${examId}): ${reason}`,
        ip_address: "127.0.0.1",
      },
    });

    // 2. Fetch student exam and apply penalty configurations
    let studentExam = null;
    if (studentExamId) {
      studentExam = await db.studentExam.findUnique({
        where: { student_exam_id: studentExamId },
        include: { exam: true },
      });
    } else {
      studentExam = await db.studentExam.findFirst({
        where: {
          student_id: studentId,
          exam_id: examId,
          submitted_at: null,
        },
        include: { exam: true },
      });
    }

    let updatedRemainingSeconds = undefined;

    if (studentExam) {
      const exam = studentExam.exam;
      // Follow the configured time penalty dynamically: if 0, deduct 0s; if >0, deduct configured seconds
      const timePenalty = typeof exam.time_penalty_seconds === "number" ? exam.time_penalty_seconds : 60;
      
      // Calculate new remaining seconds
      const currentRemaining = studentExam.remaining_seconds ?? (exam.time_limit_minutes * 60);
      const newRemaining = Math.max(0, currentRemaining - timePenalty);
      updatedRemainingSeconds = newRemaining;

      // Update session state
      await db.studentExam.update({
        where: { student_exam_id: studentExam.student_exam_id },
        data: {
          violations_count: {
            increment: 1,
          },
          remaining_seconds: newRemaining,
        },
      });

      // 3. Create real-time notification record for the exam author (instructor)
      const student = await db.student.findUnique({
        where: { student_id: studentId },
        include: { user: true },
      });

      if (student) {
        const studentName = `${student.first_name} ${student.last_name}`;
        const studentInstId = student.user.institutional_id;

        await db.notification.create({
          data: {
            user_id: exam.faculty_id,
            title: "Exam Security Violation",
            message: `Student ${studentName} (ID: ${studentInstId}) triggered a warning (${warningNumber}/2) for exam "${exam.title}". Reason: ${reason}. A time penalty of -${timePenalty} seconds was applied.`,
          },
        });
      }
    }

    return { success: true, remainingSeconds: updatedRemainingSeconds };
  } catch (err: any) {
    console.error("Error logging warning:", err);
    return { error: err.message || "Failed to log security warning." };
  }
}

export async function keepAliveStudentExam(
  studentExamId: number,
  remainingSeconds: number
) {
  try {
    const studentExam = await db.studentExam.findUnique({
      where: { student_exam_id: studentExamId },
      include: { exam: true },
    });

    if (!studentExam) {
      return { error: "Student examination record not found." };
    }

    if (studentExam.submitted_at) {
      return { error: "Examination has already been submitted." };
    }

    // Verify against actual elapsed time on server to prevent tampering
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const elapsedSeconds = Math.floor((now.getTime() - studentExam.started_at.getTime()) / 1000);
    const penaltySeconds = (studentExam.violations_count || 0) * (studentExam.exam.time_penalty_seconds ?? 60);
    const maxAllowedRemaining = Math.max(0, (studentExam.exam.time_limit_minutes * 60) - penaltySeconds - elapsedSeconds);

    const safeRemaining = Math.max(0, Math.min(remainingSeconds, maxAllowedRemaining));

    if (safeRemaining <= 0) {
      await submitStudentExam(studentExamId, "Timeout");
      return { success: true, isCompleted: true, remainingSeconds: 0 };
    }

    await db.studentExam.update({
      where: { student_exam_id: studentExamId },
      data: {
        remaining_seconds: safeRemaining,
      },
    });

    return { success: true, remainingSeconds: safeRemaining };
  } catch (err: any) {
    console.error("Error in keepAliveStudentExam server action:", err);
    return { error: err.message || "Failed to save timer state." };
  }
}

export async function updateStudentPassword(
  studentId: number,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Please fill in all password fields." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }

  // Validate password strength
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  if (
    newPassword.length < 8 ||
    !hasUppercase ||
    !hasLowercase ||
    !hasDigit ||
    !hasSpecial
  ) {
    return {
      error:
        "Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.",
    };
  }

  try {
    const bcrypt = await import("bcryptjs");

    // 1. Fetch user by user_id
    const user = await db.user.findUnique({
      where: { user_id: studentId },
    });

    if (!user) {
      return { error: "Student account not found." };
    }

    if (user.role !== "Student") {
      return { error: "Only student accounts can perform this action." };
    }

    // 2. Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return { error: "Current password is incorrect." };
    }

    // 3. Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 4. Update user record
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { user_id: studentId },
        data: {
          password_hash: passwordHash,
          require_password_update: false,
        },
      });

      await tx.auditLog.create({
        data: {
          user_id: studentId,
          action_performed: "Student updated their password.",
          ip_address: "127.0.0.1",
        },
      });
    });

    revalidatePath("/dashboard/student");
    return { success: true, message: "Password updated successfully!" };
  } catch (err: any) {
    console.error("Error in updateStudentPassword:", err);
    return { error: err.message || "Failed to update password." };
  }
}

export interface StudentExamResultQuestionDetail {
  answerId: number;
  questionId: number;
  questionNumber: number;
  questionText: string;
  questionType: string;
  pointsPossible: number;
  submittedResponse: string;
  pointsAwarded: number | null;
  isCorrect: boolean | null;
  isPending: boolean;
  isInstructorGraded: boolean;
}

export interface StudentExamResultData {
  studentExamId: number;
  examId: number;
  examTitle: string;
  courseTitle: string;
  courseCode: string;
  programName: string;
  departmentName: string;
  yearLevel: number;
  timeLimitMinutes: number;
  totalQuestions: number;
  maxPoints: number;

  submittedAt: string | null;
  startedAt: string;
  durationMinutes: number;
  submissionTrigger: SubmissionType;
  submissionStatusLabel: string;
  submissionStatusDescription: string;
  isManual: boolean;
  isTimeout: boolean;
  isLockout: boolean;

  violationsCount: number;
  scorePenaltyPerViolation: number;
  totalDeductions: number;
  initialRawScore: number;
  initialNetScore: number;

  latestTotalScore: number;
  hasInstructorGraded: boolean;
  instructorGradedPoints: number;
  isScoreUpdated: boolean;

  pendingQuestionsCount: number;
  allQuestionsGraded: boolean;

  canShowResults: boolean;
  resultStatusLabel: string;
  resultExplanation: string;

  answers: StudentExamResultQuestionDetail[];
}

export async function getStudentExamResultDetails({
  studentExamId,
  examId,
  studentId,
}: {
  studentExamId?: number;
  examId?: number;
  studentId?: number;
}): Promise<{ success?: boolean; data?: StudentExamResultData; error?: string }> {
  try {
    let resolvedStudentId = studentId;

    if (!resolvedStudentId) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { error: "Authentication required to view exam results." };
      }

      const institutionalId = user.user_metadata?.institutional_id;
      const dbUser = await db.user.findUnique({
        where: { institutional_id: institutionalId },
        include: { student: true },
      });

      if (!dbUser?.student) {
        return { error: "Student profile not found." };
      }

      resolvedStudentId = dbUser.student.student_id;
    }

    const whereClause: any = {};
    if (studentExamId) {
      whereClause.student_exam_id = studentExamId;
    } else if (examId) {
      whereClause.exam_id = examId;
      whereClause.student_id = resolvedStudentId;
    } else {
      return { error: "Either studentExamId or examId must be provided." };
    }

    const studentExam = await db.studentExam.findFirst({
      where: whereClause,
      include: {
        exam: {
          include: {
            course: true,
            examTargets: true,
            tableOfSpecifications: true,
            questionBank: true,
          },
        },
        studentAnswers: {
          include: {
            question: true,
          },
        },
        student: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });

    if (!studentExam) {
      return { error: "Examination attempt record not found." };
    }

    if (resolvedStudentId && studentExam.student_id !== resolvedStudentId) {
      return { error: "You are not authorized to view results for this student attempt." };
    }

    if (!studentExam.submitted_at) {
      return { error: "This examination has not been submitted yet." };
    }

    const exam = studentExam.exam;
    const questions = exam.questionBank || [];
    const maxPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

    const visibility = parseExamResultSettings({
      tos_file_path: exam.tos_file_path,
      tableOfSpecifications: exam.tableOfSpecifications,
      examTargets: exam.examTargets,
      current_status: exam.current_status,
    });

    const trigger = studentExam.submission_trigger;
    const isManual = trigger === "Manual";
    const isTimeout = trigger === "Timeout";
    const isLockout = trigger === "Cheating_Lockout";

    let submissionStatusLabel = "Submitted Manually";
    let submissionStatusDescription = "You completed and submitted this examination manually.";
    if (isTimeout) {
      submissionStatusLabel = "Auto-Submitted (Time Ran Out)";
      submissionStatusDescription = "Your exam was submitted automatically when your allocated exam time limit reached zero.";
    } else if (isLockout) {
      submissionStatusLabel = "Auto-Submitted (Security Lockout)";
      submissionStatusDescription = "Your exam was submitted automatically because test security rules were violated (e.g. switching tabs or leaving full screen).";
    }

    const answerMap = new Map(studentExam.studentAnswers.map((a) => [a.question_id, a]));

    let initialRawScore = 0;
    let instructorGradedPoints = 0;
    let hasInstructorGraded = false;
    let pendingQuestionsCount = 0;

    const answersDetail: StudentExamResultQuestionDetail[] = questions.map((q, idx) => {
      const ans = answerMap.get(q.question_id);
      const isEssay = q.question_type === "Essay";
      const isPending = isEssay && (ans?.points_awarded === null || ans?.points_awarded === undefined);
      const isInstructorGraded = isEssay && ans?.points_awarded !== null && ans?.points_awarded !== undefined;

      if (isPending) {
        pendingQuestionsCount += 1;
      } else if (isInstructorGraded) {
        hasInstructorGraded = true;
        instructorGradedPoints += ans.points_awarded || 0;
      } else {
        if (ans?.points_awarded !== null && ans?.points_awarded !== undefined) {
          initialRawScore += ans.points_awarded;
        } else if (ans?.is_correct === true) {
          initialRawScore += q.points;
        }
      }

      return {
        answerId: ans?.answer_id || 0,
        questionId: q.question_id,
        questionNumber: idx + 1,
        questionText: q.question_text,
        questionType: q.question_type,
        pointsPossible: q.points,
        submittedResponse: ans?.submitted_response || "",
        pointsAwarded: ans?.points_awarded ?? null,
        isCorrect: ans?.is_correct ?? null,
        isPending,
        isInstructorGraded,
      };
    });

    const scorePenaltyPerViolation = typeof exam.score_penalty_points === "number" ? exam.score_penalty_points : 2;
    const violationsCount = studentExam.violations_count || 0;
    const totalDeductions = violationsCount * scorePenaltyPerViolation;
    let initialNetScore = Math.max(0, initialRawScore - totalDeductions);

    try {
      const submitAudit = await db.auditLog.findFirst({
        where: {
          action_performed: {
            contains: `Submitted Examination (Exam ID: ${exam.exam_id}`,
          },
        },
        orderBy: { timestamp: "desc" },
      });

      if (submitAudit) {
        const rawMatch = submitAudit.action_performed.match(/Raw Score:\s*(\d+)/i);
        const netMatch = submitAudit.action_performed.match(/Net Score:\s*(\d+)/i);
        if (rawMatch) initialRawScore = parseInt(rawMatch[1], 10);
        if (netMatch) initialNetScore = parseInt(netMatch[1], 10);
        else initialNetScore = Math.max(0, initialRawScore - totalDeductions);
      }
    } catch {
      // Fallback already calculated above
    }

    const latestTotalScore = studentExam.total_score;
    const isScoreUpdated = hasInstructorGraded && latestTotalScore !== initialNetScore;

    const startedAtTime = new Date(studentExam.started_at).getTime();
    const submittedAtTime = studentExam.submitted_at ? new Date(studentExam.submitted_at).getTime() : startedAtTime;
    const durationMinutes = Math.max(1, Math.round((submittedAtTime - startedAtTime) / 60000));

    return {
      success: true,
      data: {
        studentExamId: studentExam.student_exam_id,
        examId: exam.exam_id,
        examTitle: exam.title,
        courseTitle: exam.course?.course_title || "Course",
        courseCode: exam.course?.course_code || "",
        programName: studentExam.student?.program?.program_name || "",
        departmentName: studentExam.student?.program?.department?.department_name || "",
        yearLevel: studentExam.student?.year_level || 1,
        timeLimitMinutes: exam.time_limit_minutes,
        totalQuestions: questions.length,
        maxPoints,

        submittedAt: studentExam.submitted_at ? studentExam.submitted_at.toISOString() : null,
        startedAt: studentExam.started_at.toISOString(),
        durationMinutes,
        submissionTrigger: trigger,
        submissionStatusLabel,
        submissionStatusDescription,
        isManual,
        isTimeout,
        isLockout,

        violationsCount,
        scorePenaltyPerViolation,
        totalDeductions,
        initialRawScore,
        initialNetScore,

        latestTotalScore,
        hasInstructorGraded,
        instructorGradedPoints,
        isScoreUpdated,

        pendingQuestionsCount,
        allQuestionsGraded: pendingQuestionsCount === 0,

        canShowResults: visibility.canShowResults,
        resultStatusLabel: visibility.statusLabel,
        resultExplanation: visibility.explanation,

        answers: answersDetail,
      },
    };
  } catch (err: any) {
    console.error("Error in getStudentExamResultDetails:", err);
    return { error: err.message || "Failed to retrieve examination results." };
  }
}

