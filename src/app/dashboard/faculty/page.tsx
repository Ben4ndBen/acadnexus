import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { LogoutButton } from "@/app/components/LogoutButton";
import { BookOpen } from "lucide-react";
import { FacultyDashboardClient } from "@/app/components/FacultyDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // Fetch faculty details with full relations from database
  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      faculty: {
        include: {
          department: true,
          examinations: {
            include: {
              course: true,
              approvalWorkflow: true,
            },
            orderBy: {
              exam_id: "desc",
            },
          },
          facultyPortfolios: {
            orderBy: {
              academic_year: "desc",
            },
          },
        },
      },
    },
  });

  const faculty = dbUser?.faculty;

  if (!faculty) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="bg-rose-50 text-rose-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-rose-100">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800">No Faculty Profile Found</h2>
          <p className="text-slate-500 text-xs leading-relaxed">
            Your user account is registered as Faculty, but no associated faculty record was found in the database. Please request a systems administrator to seed your profile details.
          </p>
          <div className="pt-2">
            <LogoutButton />
          </div>
        </div>
      </div>
    );
  }

  // Convert decimal to number/string to avoid Next.js client serialization issues
  const sanitizedPortfolios = faculty.facultyPortfolios.map((portfolio) => ({
    ...portfolio,
    compliance_percentage: portfolio.compliance_percentage.toString(),
  }));

  const sanitizedFaculty = {
    ...faculty,
    facultyPortfolios: sanitizedPortfolios,
  };

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
                Instructor {faculty.first_name} {faculty.last_name}
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
              Welcome back, {faculty.first_name}!
            </h1>
            <p className="text-emerald-100 max-w-xl text-sm leading-relaxed">
              Design new examination question banks, align test structures to Course Outlines (TOS), and track compliance matrices for accreditation.
            </p>
          </div>
        </div>

        {/* Render interactive Faculty Dashboard Client */}
        <FacultyDashboardClient faculty={sanitizedFaculty as any} institutionalId={institutionalId} />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
