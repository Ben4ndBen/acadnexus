import { redirect } from "next/navigation";

/**
 * /dashboard/chair/exams — redirect to chair dashboard
 */
export default function ChairExamsIndexPage() {
  redirect("/dashboard/chair");
}
