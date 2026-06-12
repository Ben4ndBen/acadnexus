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
    // Determine target statuses
    const chairReviewStatus = action === "Approve" ? "Approved" : "Returned";
    const examStatus = action === "Approve" ? "Pending_DI" : "Returned";

    // 1. Update the approval workflow
    await db.approvalWorkflow.update({
      where: { workflow_id: workflowId },
      data: {
        chair_review_status: chairReviewStatus,
        chair_comments: comments || null,
        chair_action_timestamp: new Date(),
        // If approved, move to DI queue by setting hold, else leave as is
        di_review_status: action === "Approve" ? "Hold" : undefined,
      },
    });

    // 2. Update the examination status
    const exam = await db.examination.update({
      where: { exam_id: examId },
      data: { current_status: examStatus },
    });

    // 3. Log the audit event
    await db.auditLog.create({
      data: {
        user_id: userId,
        action_performed: `Chair ${action} examination ${examId}: ${exam.title}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/chair");
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
