import { redirect } from "next/navigation";

/**
 * /dashboard/faculty/exams — redirect to faculty dashboard
 * (individual exam builders are accessed via /dashboard/faculty/exams/[id]/builder)
 */
export default function FacultyExamsIndexPage() {
  redirect("/dashboard/faculty");
}
