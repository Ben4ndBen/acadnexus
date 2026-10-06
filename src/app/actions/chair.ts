"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function reviewExamByChair(
  workflowId: number,
  examId: number,
  action: "Approve" | "Return",
  comments: string,
  userId: number,
  isProgramChairReview: boolean = false
) {
  try {
    const user = await db.user.findUnique({
      where: { user_id: userId },
      include: { chair: true },
    });

    const isProgChair =
      isProgramChairReview ||
      user?.role === "ProgramChair" ||
      !!user?.chair?.is_program_chair;

    const currentWorkflow = await db.approvalWorkflow.findUnique({
      where: { workflow_id: workflowId },
      include: { exam: { include: { course: true } } },
    });

    if (!currentWorkflow) {
      return { error: "Approval workflow not found." };
    }

    if (isProgChair) {
      // Program Chair Review step ("Reviewed by")
      const status = action === "Approve" ? "Approved" : "Returned";
      const nextExamStatus = action === "Approve" ? "Pending_Chair" : "Returned";

      await db.approvalWorkflow.update({
        where: { workflow_id: workflowId },
        data: {
          reviewed_by_prog_chair_id: user?.chair?.chair_id || userId,
          prog_chair_review_status: status as any,
          prog_chair_comments: comments || null,
          prog_chair_action_timestamp: new Date(),
        },
      });

      await db.examination.update({
        where: { exam_id: examId },
        data: { current_status: nextExamStatus as any },
      });

      await db.auditLog.create({
        data: {
          user_id: userId,
          action_performed: `Program Chairperson ${action} examination ${examId}: ${currentWorkflow.exam.title} (Reviewed by Program Chair). Forwarded to Department Chairperson.`,
          ip_address: "127.0.0.1",
        },
      });
    } else {
      // Department Chair Review step ("Recommending Approval" for programs with Prog Chair, or "Reviewed by" for programs without)
      const globalHoldSetting = await db.systemSetting.findUnique({
        where: { key: "global_administrative_hold" },
      });
      const isGlobalHoldActive = globalHoldSetting?.value === "true";
      const isIndividualHoldActive =
        currentWorkflow?.di_review_status === "Hold" &&
        currentWorkflow?.reviewed_by_di_id !== null;
      const isHoldActive = isGlobalHoldActive || isIndividualHoldActive;

      const chairReviewStatus = action === "Approve" ? "Approved" : "Returned";
      const examStatus = action === "Approve" ? (isHoldActive ? "Pending_DI" : "Approved") : "Returned";
      const diReviewStatus = action === "Approve" ? (isHoldActive ? "Hold" : "Pass_Through_Approved") : "Hold";

      await db.approvalWorkflow.update({
        where: { workflow_id: workflowId },
        data: {
          reviewed_by_chair_id: user?.chair?.chair_id || userId,
          chair_review_status: chairReviewStatus as any,
          chair_comments: comments || null,
          chair_action_timestamp: new Date(),
          di_review_status: diReviewStatus as any,
        },
      });

      await db.examination.update({
        where: { exam_id: examId },
        data: { current_status: examStatus as any },
      });

      await db.auditLog.create({
        data: {
          user_id: userId,
          action_performed: `Department Chairperson ${action} examination ${examId}: ${currentWorkflow.exam.title} (Recommending Approval / Department Review). Pass-through: ${
            action === "Approve" && !isHoldActive ? "Yes" : "No"
          }`,
          ip_address: "127.0.0.1",
        },
      });
    }

    revalidatePath("/dashboard/chair");
    revalidatePath("/dashboard/director");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating chair review:", err);
    return { error: err.message || "Failed to submit review." };
  }
}

export async function verifySyllabusAndTOS(
  courseId: number,
  examId: number,
  userId: number
) {
  try {
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
      include: { course: true },
    });

    if (!exam) return { error: "Examination not found." };

    await db.auditLog.create({
      data: {
        user_id: userId,
        action_performed: `Chairperson verified TOS alignment for course ${exam.course.course_code} (Exam: ${exam.title})`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/chair");
    return { success: true };
  } catch (err: any) {
    console.error("Error verifying TOS:", err);
    return { error: err.message || "Failed to verify alignment." };
  }
}
