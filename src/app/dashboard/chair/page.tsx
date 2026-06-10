import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { LogoutButton } from "@/app/components/LogoutButton";
import { ClipboardCheck, Users, ShieldAlert, Award, FileText, CheckSquare } from "lucide-react";

export default async function ChairDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const institutionalId = user.user_metadata?.institutional_id;

  if (role !== "Chair") {
    redirect("/");
  }

  // Fetch chair details from the database
  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      chair: {
        include: {
          department: {
            include: {
              faculty: {
                include: {
                  examinations: true,
                },
              },
            },
          },
          approvals: {
            include: {
              exam: true,
            },
          },
        },
      },
    },
  });

  const chair = dbUser?.chair;
  const department = chair?.department;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-600 text-white p-2 rounded-xl">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
              <span className="text-xs text-amber-600 font-bold ml-2 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Chair Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">
                {chair ? `Chair (${dbUser?.institutional_id})` : "Department Chair"}
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
        <div className="bg-gradient-to-tr from-amber-900 via-amber-800 to-yellow-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-amber-950/20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px]" />
          <div className="relative z-10 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, Chair!
            </h1>
            <p className="text-amber-100 max-w-xl text-sm leading-relaxed">
              Verify drafted syllabi, evaluate examination formats and Table of Specifications (TOS), and oversee the accreditation status of the department.
            </p>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: Department status */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
              Department Overview
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Department Name</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">
                  {department?.department_name || "Not Seeded"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Batanes State College</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Faculty Members</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-0.5">
                    {department?.faculty ? department.faculty.length : 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Review Pipeline</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-0.5">
                    {chair?.approvals ? chair.approvals.filter(a => a.chair_review_status === "Pending").length : 0} Pending
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: approvals workflow */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
              Pending Approval Workflows
            </h2>

            {chair?.approvals && chair.approvals.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {chair.approvals.map((approval) => (
                  <div key={approval.workflow_id} className="py-4 flex justify-between items-center first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">{approval.exam.title}</p>
                      <p className="text-xs text-slate-400">
                        Status: <span className="font-semibold text-yellow-600">{approval.chair_review_status}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                        Approve
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
                  <CheckSquare className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">All clear!</h3>
                <p className="text-slate-500 text-xs max-w-xs mt-1">
                  There are no examination approvals waiting for your review. Excellent work!
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
