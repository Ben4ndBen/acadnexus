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
    const exam = await db.examination.findUnique({
      where: { exam_id: examId },
    });

    if (!exam) {
      return { error: "Examination not found." };
    }

    if (exam.faculty_id !== userId) {
      return { error: "Unauthorized operation." };
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
      });

      if (faculty) {
        const chair = await db.chair.findUnique({
          where: { department_id: faculty.department_id },
        });

        if (chair) {
          await db.approvalWorkflow.upsert({
            where: { exam_id: examId },
            update: {
              reviewed_by_chair_id: chair.chair_id,
              chair_review_status: "Pending",
              chair_comments: null,
              chair_action_timestamp: null,
              di_review_status: "Hold",
              di_action_timestamp: null,
            },
            create: {
              exam_id: examId,
              reviewed_by_chair_id: chair.chair_id,
              chair_review_status: "Pending",
              di_review_status: "Hold",
            },
          });
        }
      }
    }

    // Log the audit event
    await db.auditLog.create({
      data: {
        user_id: userId,
        action_performed: `Updated exam (${exam.title}) status to ${status}`,
        ip_address: "127.0.0.1",
      },
    });

    revalidatePath("/dashboard/faculty");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating exam status:", err);
    return { error: err.message || "Failed to update exam status." };
  }
}
