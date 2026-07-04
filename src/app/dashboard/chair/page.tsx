import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { LogoutButton } from "@/app/components/LogoutButton";
import { NotificationBell } from "@/app/components/NotificationBell";
import { ClipboardCheck } from "lucide-react";
import { ChairDashboardClient } from "@/app/components/ChairDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
                  facultyPortfolios: {
                    orderBy: {
                      academic_year: "desc",
                    },
                    take: 1
                  }
                },
              },
            },
          },
          approvals: {
            where: {
              chair_review_status: "Pending"
            },
            include: {
              exam: {
                include: {
                  course: true,
                  faculty: true,
                  questionBank: true
                }
              },
            },
          },
        },
      },
    },
  });

  if (!dbUser) {
    redirect("/");
  }

  const chair = dbUser.chair;
  const department = chair?.department;

  if (!chair || !department) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="bg-amber-50 text-amber-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-amber-100">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800">No Chair Profile Found</h2>
          <p className="text-slate-500 text-xs leading-relaxed">
            Your user account is registered as Chair, but no associated department record was found in the database.
          </p>
          <div className="pt-2">
            <LogoutButton />
          </div>
        </div>
      </div>
    );
  }

  // Format faculty members to ensure compliance_percentage is a string/number
  const formattedFaculty = department.faculty.map(f => ({
    ...f,
    facultyPortfolios: f.facultyPortfolios.map(p => ({
      ...p,
      compliance_percentage: p.compliance_percentage.toString()
    }))
  }));

  // Format pending approvals to ensure decimal/dates are serializable if needed
  // (In this case, dates and decimals are handled or not present in the essential payload)
  const formattedApprovals = chair.approvals;

  // Extract all department exams
  const departmentExams = department.faculty.flatMap(f => f.examinations);

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
                Chair ({dbUser?.institutional_id})
              </p>
              <p className="text-xs text-slate-500">{institutionalId}</p>
            </div>
            <NotificationBell userId={dbUser.user_id} />
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

        {/* Render the interactive client component */}
        <ChairDashboardClient
          chairUserId={dbUser.user_id}
          departmentName={department.department_name}
          facultyMembers={formattedFaculty as any}
          pendingApprovals={formattedApprovals as any}
          departmentExams={departmentExams as any}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
