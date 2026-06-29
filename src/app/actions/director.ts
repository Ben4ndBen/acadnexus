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
    revalidatePath("/dashboard/chair");
    revalidatePath("/dashboard/student");
    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating director review:", err);
    return { error: err.message || "Failed to submit review." };
  }
}

export async function toggleGlobalHold(userId: number, enabled: boolean) {
  try {
    const user = await db.user.findUnique({
      where: { user_id: userId },
    });

    if (!user || user.role !== "Director") {
      return { error: "Unauthorized. Only the Director of Instruction can toggle the global hold." };
    }

    const value = enabled ? "true" : "false";
    await db.systemSetting.upsert({
      where: { key: "global_administrative_hold" },
      update: { value },
      create: { key: "global_administrative_hold", value },
    });

    await db.auditLog.create({
      data: {
        user_id: userId,
        action_performed: `Director toggled Global Administrative Hold to ${enabled ? "ON" : "OFF"}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/director");
    revalidatePath("/dashboard/chair");
    return { success: true };
  } catch (err: any) {
    console.error("Error toggling global hold:", err);
    return { error: err.message || "Failed to toggle global hold." };
  }
}

export async function toggleIndividualHold(userId: number, examId: number, placeHold: boolean) {
  try {
    const user = await db.user.findUnique({
      where: { user_id: userId },
    });

    if (!user || user.role !== "Director") {
      return { error: "Unauthorized. Only the Director of Instruction can manage administrative holds." };
    }

    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
      include: { approvalWorkflow: true },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }

    // Find or create the Chair of the department this exam belongs to
    // (In case the workflow doesn't exist yet, we need a reviewed_by_chair_id)
    let chairId = exam.approvalWorkflow?.reviewed_by_chair_id;
    if (!chairId) {
      const faculty = await db.faculty.findUnique({
        where: { faculty_id: exam.faculty_id },
      });
      if (faculty) {
        const chair = await db.chair.findUnique({
          where: { department_id: faculty.department_id },
        });
        if (chair) {
          chairId = chair.chair_id;
        }
      }
    }

    if (!chairId) {
      return { error: "Could not determine the Department Chair for this examination." };
    }

    if (placeHold) {
      // Place Hold
      await db.approvalWorkflow.upsert({
        where: { exam_id: examId },
        update: {
          di_review_status: "Hold",
          reviewed_by_di_id: userId,
          di_action_timestamp: new Date(),
        },
        create: {
          exam_id: examId,
          reviewed_by_chair_id: chairId,
          chair_review_status: "Pending",
          di_review_status: "Hold",
          reviewed_by_di_id: userId,
          di_action_timestamp: new Date(),
        },
      });

      // If the exam was currently Approved (live), suspend it
      if (exam.current_status === "Approved") {
        await db.examination.update({
          where: { exam_id: examId },
          data: { current_status: "Pending_DI" },
        });
      }

      await db.auditLog.create({
        data: {
          user_id: userId,
          action_performed: `Director placed administrative hold on examination ${examId}: ${exam.title}`,
          ip_address: "127.0.0.1",
        },
      });
    } else {
      // Lift Hold
      const workflow = exam.approvalWorkflow;
      const isChairApproved = workflow?.chair_review_status === "Approved";

      await db.approvalWorkflow.update({
        where: { exam_id: examId },
        data: {
          // If the Chair has already approved, lifting the hold makes it Approved
          di_review_status: isChairApproved ? "Approved" : "Hold",
          reviewed_by_di_id: isChairApproved ? userId : null,
          di_action_timestamp: isChairApproved ? new Date() : null,
        },
      });

      // If the Chair has already approved, the exam should go live now
      if (isChairApproved) {
        await db.examination.update({
          where: { exam_id: examId },
          data: { current_status: "Approved" },
        });
      }

      await db.auditLog.create({
        data: {
          user_id: userId,
          action_performed: `Director lifted administrative hold on examination ${examId}: ${exam.title}`,
          ip_address: "127.0.0.1",
        },
      });
    }

    revalidatePath("/dashboard/director");
    revalidatePath("/dashboard/chair");
    revalidatePath("/dashboard/student");
    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error toggling individual hold:", err);
    return { error: err.message || "Failed to toggle administrative hold." };
  }
}

