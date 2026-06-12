"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function reviewExamByDirector(
  workflowId: number,
  examId: number,
  action: "Approve" | "Return" | "Hold",
  userId: number
) {
  try {
    // Determine target statuses
    const diReviewStatus = action === "Approve" ? "Approved" : "Hold";
    const examStatus = action === "Approve" ? "Approved" : action === "Return" ? "Returned" : "Pending_DI";

    // 1. Update the approval workflow
    await db.approvalWorkflow.update({
      where: { workflow_id: workflowId },
      data: {
        di_review_status: diReviewStatus,
        reviewed_by_di_id: userId,
        di_action_timestamp: new Date(),
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
        action_performed: `Director ${action} examination ${examId}: ${exam.title}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/director");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating director review:", err);
    return { error: err.message || "Failed to submit review." };
  }
}
