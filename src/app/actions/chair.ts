"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function reviewExamByChair(
  workflowId: number,
  examId: number,
  action: "Approve" | "Return",
  comments: string,
  userId: number
) {
  try {
    // 1. Get the current workflow state to check for individual manual holds
    const currentWorkflow = await db.approvalWorkflow.findUnique({
      where: { workflow_id: workflowId },
    });

    // Check if the Director has manually placed an individual hold on this exam.
    // A manual hold is indicated by di_review_status = "Hold" and reviewed_by_di_id is set.
    const isIndividualHoldActive =
      currentWorkflow?.di_review_status === "Hold" &&
      currentWorkflow?.reviewed_by_di_id !== null;

    // 2. Check if a global administrative hold is active in the system settings
    const globalHoldSetting = await db.systemSetting.findUnique({
      where: { key: "global_administrative_hold" },
    });
    const isGlobalHoldActive = globalHoldSetting?.value === "true";

    const isHoldActive = isGlobalHoldActive || isIndividualHoldActive;

    // Determine target statuses
    const chairReviewStatus = action === "Approve" ? "Approved" : "Returned";
    
    // Pass-through clearance: if approved and no hold is active, it goes live instantly ("Approved").
    // Otherwise, if approved but a hold is active, it goes to "Pending_DI".
    const examStatus =
      action === "Approve"
        ? isHoldActive
          ? "Pending_DI"
          : "Approved"
        : "Returned";

    const diReviewStatus =
      action === "Approve"
        ? isHoldActive
          ? "Hold"
          : "Pass_Through_Approved"
        : "Hold";

    // 3. Update the approval workflow
    await db.approvalWorkflow.update({
      where: { workflow_id: workflowId },
      data: {
        chair_review_status: chairReviewStatus,
        chair_comments: comments || null,
        chair_action_timestamp: new Date(),
        di_review_status: diReviewStatus,
      },
    });

    // 4. Update the examination status
    const exam = await db.examination.update({
      where: { exam_id: examId },
      data: { current_status: examStatus },
    });

    // 5. Log the audit event
    await db.auditLog.create({
      data: {
        user_id: userId,
        action_performed: `Chair ${action} examination ${examId}: ${exam.title}. Pass-through: ${
          action === "Approve" && !isHoldActive ? "Yes" : "No"
        } (Global Hold: ${isGlobalHoldActive}, Individual Hold: ${isIndividualHoldActive})`,
        ip_address: "127.0.0.1",
      },
    });

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
    // In a full implementation, this might toggle a 'verified' flag in the DB.
    // Here we'll simply log the verification event.
    
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
      include: { course: true },
    });

    if (!exam) return { error: "Examination not found." };

    // Log the audit event
    await db.auditLog.create({
      data: {
        user_id: userId,
        action_performed: `Chair verified Syllabus and TOS alignment for course ${exam.course.course_code} (Exam: ${exam.title})`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/chair");
    return { success: true };
  } catch (err: any) {
    console.error("Error verifying Syllabus/TOS:", err);
    return { error: err.message || "Failed to verify alignment." };
  }
}
