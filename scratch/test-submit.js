process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const examId = 35;
  const status = "Pending_Chair";
  const userId = 22;

  console.log("--- TEST 1: Reset exam to Draft ---");
  await prisma.examination.update({
    where: { exam_id: examId },
    data: { current_status: "Draft" },
  });
  await prisma.approvalWorkflow.deleteMany({
    where: { exam_id: examId },
  });
  console.log("Exam reset to Draft and workflow deleted.");

  console.log("\n--- TEST 2: Submit with existing Chair ---");
  const result1 = await runUpdateStatus(examId, status, userId);
  console.log("Test 1 Result:", result1);

  const workflowAfterTest1 = await prisma.approvalWorkflow.findUnique({
    where: { exam_id: examId }
  });
  console.log("Workflow record created after test 1:", workflowAfterTest1 ? "Yes" : "No");

  console.log("\n--- TEST 3: Submit when no Chair exists ---");
  // Find eduDept ID
  const eduDept = await prisma.department.findFirst({
    where: { department_name: "Department of Teacher Education" }
  });
  
  if (eduDept) {
    // Temporarily change faculty's department to Teacher Education (no chair seeded)
    const originalFaculty = await prisma.faculty.findUnique({
      where: { faculty_id: userId }
    });
    
    await prisma.faculty.update({
      where: { faculty_id: userId },
      data: { department_id: eduDept.department_id }
    });
    console.log("Temporarily changed faculty department to Education (no chair).");

    // Reset exam status to Draft
    await prisma.examination.update({
      where: { exam_id: examId },
      data: { current_status: "Draft" },
    });
    await prisma.approvalWorkflow.deleteMany({
      where: { exam_id: examId },
    });

    // Run submission
    const result2 = await runUpdateStatus(examId, status, userId);
    console.log("Test 3 Result (Should be an error):", result2);

    // Verify database rolled back and exam is still Draft, workflow is not created
    const examAfterTest3 = await prisma.examination.findUnique({
      where: { exam_id: examId }
    });
    const workflowAfterTest3 = await prisma.approvalWorkflow.findUnique({
      where: { exam_id: examId }
    });
    console.log("Exam status after failed submission (should be Draft):", examAfterTest3.current_status);
    console.log("Workflow record after failed submission (should be null):", workflowAfterTest3);

    // Restore original department
    if (originalFaculty) {
      await prisma.faculty.update({
        where: { faculty_id: userId },
        data: { department_id: originalFaculty.department_id }
      });
      console.log("Restored original faculty department.");
    }
  } else {
    console.log("Department of Teacher Education not found.");
  }

  await prisma.$disconnect();
  await pool.end();
}

async function runUpdateStatus(examId, status, userId) {
  try {
    return await prisma.$transaction(async (tx) => {
      const exam = await tx.examination.findUnique({
        where: { exam_id: examId },
      });

      if (!exam) {
        return { error: "Examination not found." };
      }

      if (exam.faculty_id !== userId) {
        return { error: "Unauthorized operation." };
      }

      if (status === "Pending_Chair") {
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

      await tx.examination.update({
        where: { exam_id: examId },
        data: { current_status: status },
      });

      return { success: true };
    });
  } catch (err) {
    return { error: err.message };
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
