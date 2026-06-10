import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { LogoutButton } from "@/app/components/LogoutButton";
import { ShieldCheck, BarChart3, Landmark, BookOpen, AlertCircle } from "lucide-react";

export default async function DirectorDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const institutionalId = user.user_metadata?.institutional_id;

  if (role !== "Director") {
    redirect("/");
  }

  // Fetch director-level overview details from the database
  const totalStudents = await db.student.count();
  const totalFaculty = await db.faculty.count();
  const totalDepartments = await db.department.count();
  const totalExams = await db.examination.count();

  // Fetch pending workflows requiring Director review
  const pendingApprovals = await db.approvalWorkflow.findMany({
    where: {
      chair_review_status: "Approved",
      di_review_status: "Hold", // Represents pending final director approval in standard states
    },
    include: {
      exam: {
        include: {
          faculty: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-700 text-white p-2 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
              <span className="text-xs text-indigo-700 font-bold ml-2 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Director Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">Director Office</p>
              <p className="text-xs text-slate-500">{institutionalId}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome banner */}
        <div className="bg-gradient-to-tr from-indigo-900 via-indigo-800 to-blue-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-indigo-950/20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px]" />
          <div className="relative z-10 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, Director!
            </h1>
            <p className="text-indigo-100 max-w-xl text-sm leading-relaxed">
              Verify institution-wide compliance charts, approve final-round examinations, monitor system audit logs, and oversee college-wide parameters.
            </p>
          </div>
        </div>

        {/* Statistical Summary Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Departments</span>
            <p className="text-2xl font-extrabold text-slate-800">{totalDepartments}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Faculty</span>
            <p className="text-2xl font-extrabold text-slate-800">{totalFaculty}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Enrolled Students</span>
            <p className="text-2xl font-extrabold text-slate-800">{totalStudents}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Examinations</span>
            <p className="text-2xl font-extrabold text-slate-800">{totalExams}</p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            Final Institutional Approval Queue
          </h2>

          {pendingApprovals.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {pendingApprovals.map((approval) => (
                <div key={approval.workflow_id} className="py-4 flex justify-between items-center first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">{approval.exam.title}</p>
                    <p className="text-xs text-slate-400">
                      Author: {approval.exam.faculty.first_name} {approval.exam.faculty.last_name} &bull; Chair Status:{" "}
                      <span className="font-semibold text-emerald-600">{approval.chair_review_status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                      Final Approve
                    </button>
                    <button className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                      Return
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-4">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">No pending approvals</h3>
              <p className="text-slate-500 text-xs max-w-xs mt-1">
                All examination and syllabus workflows are currently fully resolved. Nice work!
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
