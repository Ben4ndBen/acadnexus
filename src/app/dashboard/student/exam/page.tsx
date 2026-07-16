import { redirect } from "next/navigation";

/**
 * /dashboard/student/exam — redirect to student dashboard
 * (individual exams are accessed via /dashboard/student/exam/[examId])
 */
export default function StudentExamIndexPage() {
  redirect("/dashboard/student");
}
