import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { LogoutButton } from "@/app/components/LogoutButton";
import { BookOpen, Award, FileText, ClipboardList, PenTool, CheckCircle } from "lucide-react";

export default async function FacultyDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const institutionalId = user.user_metadata?.institutional_id;

  if (role !== "Faculty") {
    redirect("/");
  }

  // Fetch faculty details from the database
  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      faculty: {
        include: {
          department: true,
          examinations: true,
          facultyPortfolios: true,
        },
      },
    },
  });

  const faculty = dbUser?.faculty;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
              <span className="text-xs text-emerald-600 font-bold ml-2 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Faculty Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">
                {faculty ? `Instructor ${faculty.first_name} ${faculty.last_name}` : "Faculty User"}
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
        <div className="bg-gradient-to-tr from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-emerald-950/20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px]" />
          <div className="relative z-10 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {faculty?.first_name || "Faculty"}!
            </h1>
            <p className="text-emerald-100 max-w-xl text-sm leading-relaxed">
              Design new examination question banks, align test structures to Course Outlines (TOS), and track compliance matrices for accreditation.
            </p>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel: Profile and Portfolios */}
          <div className="space-y-8">
            {/* Profile */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Departmental Profile
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Instructor</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {faculty ? `${faculty.first_name} ${faculty.last_name}` : "Not Seeded"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Department</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {faculty?.department?.department_name || "Not Seeded"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Batanes State College</p>
                </div>
              </div>
            </div>

            {/* Compliance Matrix */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Compliance Portfolio
              </h2>
              {faculty?.facultyPortfolios && faculty.facultyPortfolios.length > 0 ? (
                <div className="space-y-4">
                  {faculty.facultyPortfolios.map((portfolio) => (
                    <div key={portfolio.portfolio_id} className="border border-slate-100 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">AY {portfolio.academic_year} (Sem {portfolio.semester})</span>
                        <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          {portfolio.compliance_percentage.toString()}% Comp.
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${Number(portfolio.compliance_percentage)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">Total Exams: {portfolio.total_exams_created}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs text-slate-500">No compliance statistics recorded yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Exams List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Your Examinations
              </h2>
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                + Create Exam
              </button>
            </div>

            {faculty?.examinations && faculty.examinations.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {faculty.examinations.map((exam) => (
                  <div key={exam.exam_id} className="py-4 flex justify-between items-center first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">{exam.title}</p>
                      <p className="text-xs text-slate-400">Time limit: {exam.time_limit_minutes} min</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100 px-2.5 py-1 rounded-full">
                        {exam.current_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-4">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">No examinations created</h3>
                <p className="text-slate-500 text-xs max-w-xs mt-1">
                  Start by drafting your first examination question bank to assign to your students.
                </p>
              </div>
            )}
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
