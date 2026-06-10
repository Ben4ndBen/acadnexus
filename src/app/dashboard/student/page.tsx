import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { LogoutButton } from "@/app/components/LogoutButton";
import { GraduationCap, BookOpen, Calendar, Award, ShieldAlert } from "lucide-react";

export default async function StudentDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const institutionalId = user.user_metadata?.institutional_id;

  if (role !== "Student") {
    redirect("/");
  }

  // Fetch student details from the database
  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      student: {
        include: {
          program: {
            include: {
              department: true,
            },
          },
        },
      },
    },
  });

  const student = dbUser?.student;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
              <span className="text-xs text-blue-600 font-bold ml-2 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Student Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">
                {student ? `${student.first_name} ${student.last_name}` : "Student User"}
              </p>
              <p className="text-xs text-slate-500">{institutionalId}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome banner */}
        <div className="bg-gradient-to-tr from-blue-900 via-blue-800 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-blue-950/20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px]" />
          <div className="relative z-10 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {student?.first_name || "Student"}!
            </h1>
            <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
              Access your personalized examination schedule, check your performance reports, and track your ongoing compliance parameters.
            </p>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
              Academic Profile
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Full Name</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">
                  {student ? `${student.first_name} ${student.last_name}` : "Not Seeded"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Program / Department</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">
                  {student?.program ? `${student.program.program_name} (${student.program.program_code})` : "Not Seeded"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {student?.program?.department?.department_name || "Batanes State College"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Year Level</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {student ? `Year ${student.year_level}` : "Not Seeded"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Section</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {student ? student.section : "Not Seeded"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Academic Actions / Exams */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
              Examination Center
            </h2>
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">No active examinations</h3>
              <p className="text-slate-500 text-xs max-w-xs mt-1">
                There are no examinations scheduled for your section at this time. Check back later or contact your instructor.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
