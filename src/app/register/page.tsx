import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  // Student self-registration has been disabled. Accounts are enrolled directly by faculty in their course rosters.
  redirect("/");
}
