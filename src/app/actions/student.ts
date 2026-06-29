"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { SubmissionType } from "@prisma/client";

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

    // 2. Fetch targeted approved exam targets to verify the schedule
    const target = await db.examTarget.findFirst({
      where: {
        exam_id: examId,
        program_id: student.program_id,
        year_level: student.year_level,
        section: student.section,
        exam: {
          current_status: "Approved",
        },
      },
      include: {
        exam: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!target) {
      return { error: "Examination is not active or targeted for your section." };
    }

    const exam = target.exam;

    // 3. Check if current time is within schedule
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));

    const examStart = new Date(
      target.scheduled_date.getUTCFullYear(),
      target.scheduled_date.getUTCMonth(),
      target.scheduled_date.getUTCDate(),
      target.start_time.getUTCHours(),
      target.start_time.getUTCMinutes(),
      0
    );

    const examEnd = new Date(
      target.scheduled_date.getUTCFullYear(),
      target.scheduled_date.getUTCMonth(),
      target.scheduled_date.getUTCDate(),
      target.end_time.getUTCHours(),
      target.end_time.getUTCMinutes(),
      0
    );

    if (now < examStart) {
      const startTimeString = new Date(target.start_time).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'UTC' 
      });
      return { error: `Examination has not started yet. It is scheduled to start at ${startTimeString}.` };
    }
    if (now > examEnd) {
      return { error: "Examination window has already closed." };
    }

    // 4. Fetch or create StudentExam
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

    if (studentExam) {
      // If exam already completed, return status
      if (studentExam.submitted_at) {
        return {
          isCompleted: true,
          totalScore: studentExam.total_score,
          submittedAt: studentExam.submitted_at,
          trigger: studentExam.submission_trigger,
        };
      }

      // If active, calculate remaining time from when they started
      const elapsedMs = now.getTime() - studentExam.started_at.getTime();
      const limitMs = exam.time_limit_minutes * 60 * 1000;

      if (elapsedMs >= limitMs) {
        // Time exceeded while away, auto-submit
        const submitResult = await submitStudentExam(studentExam.student_exam_id, "Timeout");
        if (submitResult.error) {
          return { error: submitResult.error };
        }
        return {
          isCompleted: true,
          totalScore: submitResult.totalScore,
          submittedAt: new Date(),
          trigger: "Timeout" as SubmissionType,
        };
      }

      remainingSeconds = Math.max(0, Math.floor((limitMs - elapsedMs) / 1000));
    } else {
      // Create new student exam attempt
      studentExam = await db.studentExam.create({
        data: {
          student_id: studentId,
          exam_id: examId,
          started_at: now,
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

    return { success: true };
  } catch (err: any) {
    console.error("Error saving answers:", err);
    return { error: err.message || "Failed to save answers." };
  }
}

export async function submitStudentExam(
  studentExamId: number,
  trigger: SubmissionType,
  finalAnswers?: { question_id: number; submitted_response: string }[]
) {
  try {
    const studentExam = await db.studentExam.findUnique({
      where: { student_exam_id: studentExamId },
      include: {
        exam: {
          include: {
            questionBank: true,
          },
        },
      },
    });

    if (!studentExam) {
      return { error: "Student examination record not found." };
    }

    if (studentExam.submitted_at) {
      return { error: "Examination has already been submitted." };
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

        if (isCorrect === true) {
          totalScore += q.points;
          pointsAwarded = q.points;
        } else if (isCorrect === false) {
          pointsAwarded = 0;
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

      // Update the student exam attempt to completed
      await tx.studentExam.update({
        where: { student_exam_id: studentExamId },
        data: {
          submitted_at: new Date(),
          total_score: totalScore,
          submission_trigger: trigger,
        },
      });

      // 3. Log audit event
      await tx.auditLog.create({
        data: {
          user_id: studentExam.student_id,
          action_performed: `Submitted Examination (Exam ID: ${exam.exam_id}, Trigger: ${trigger}, Score: ${totalScore})`,
          ip_address: "127.0.0.1",
        },
      });
    });

    revalidatePath("/dashboard/student");
    return { success: true, totalScore };
  } catch (err: any) {
    console.error("Error submitting exam:", err);
    return { error: err.message || "Failed to submit examination." };
  }
}

export async function logStudentWarning(
  studentId: number,
  examId: number,
  warningNumber: number,
  reason: string
) {
  try {
    await db.auditLog.create({
      data: {
        user_id: studentId,
        action_performed: `Security Warning ${warningNumber}/2 for Exam (ID: ${examId}): ${reason}`,
        ip_address: "127.0.0.1",
      },
    });
    return { success: true };
  } catch (err: any) {
    console.error("Error logging warning:", err);
    return { error: err.message || "Failed to log security warning." };
  }
}
