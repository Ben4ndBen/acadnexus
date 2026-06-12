import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StudentDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if no session exists
  if (!user) redirect("/");

  // Verify role access
  const role = user.user_metadata?.role;
  if (role !== "Student") redirect("/dashboard/" + role.toLowerCase());

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Student Dashboard</h1>
      <p>Welcome, {user.email}. This is your portal.</p>
      {/* Add Student-specific components here */}
    </main>
  );
}