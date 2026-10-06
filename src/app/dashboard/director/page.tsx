import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getSystemSettingCached, getCoursesCached } from "@/lib/cache";
import { ensureBsitCoursesExist } from "@/lib/bsitCurriculumServer";
import { LogoutButton } from "@/app/components/LogoutButton";
import { NotificationBell } from "@/app/components/NotificationBell";
import { ShieldCheck } from "lucide-react";
import { DirectorDashboardClient } from "@/app/components/DirectorDashboardClient";

export const dynamic = "force-dynamic";

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

  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
  });

  if (!dbUser) {
    redirect("/");
  }

  // Fetch all overview details concurrently in parallel
  const [
    totalStudents,
    totalFaculty,
    totalDepartments,
    totalExams,
    pendingApprovals,
    allExaminations,
    globalHoldSetting,
    rawDepartments,
    auditLogs,
  ] = await Promise.all([
    db.student.count(),
    db.faculty.count(),
    db.department.count(),
    db.examination.count(),
    db.approvalWorkflow.findMany({
      where: {
        chair_review_status: "Approved",
        di_review_status: "Hold",
      },
      include: {
        exam: {
          include: {
            faculty: true,
            course: true,
          },
        },
      },
    }),
    db.examination.findMany({
      include: {
        faculty: true,
        course: true,
        approvalWorkflow: true,
      },
      orderBy: {
        exam_id: "desc",
      },
    }),
    getSystemSettingCached("global_administrative_hold"),
    db.department.findMany({
      include: {
        faculty: {
          include: {
            examinations: true,
            facultyPortfolios: {
              orderBy: { academic_year: "desc" },
              take: 1,
            },
          },
        },
      },
    }),
    db.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            institutional_id: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const globalHoldActive = globalHoldSetting?.value === "true";

  const departmentsData = rawDepartments.map(dept => {
    let totalScore = 0;
    let portfolioCount = 0;

    dept.faculty.forEach(f => {
      if (f.facultyPortfolios && f.facultyPortfolios.length > 0) {
        totalScore += Number(f.facultyPortfolios[0].compliance_percentage);
        portfolioCount++;
      }
    });

    const averageCompliance = portfolioCount > 0 ? Math.round(totalScore / portfolioCount) : 0;
    
    return {
      department_id: dept.department_id,
      department_name: dept.department_name,
      compliance_score: averageCompliance,
      total_faculty: dept.faculty.length,
      total_exams: dept.faculty.reduce((sum, f) => sum + f.examinations.length, 0),
    };
  });

  // Convert BigInt to string to pass to client
  const serializedLogs = auditLogs.map(log => ({
    ...log,
    log_id: log.log_id.toString(),
  }));

  // Fetch active academic period configured by DI
  const { getActiveAcademicPeriod } = await import("@/app/actions/director");
  const academicPeriod = await getActiveAcademicPeriod();

  // Ensure all curriculum subjects exist in database
  await ensureBsitCoursesExist();

  // Fetch all courses for assignment by DI using cached query
  const courses = await getCoursesCached();

  // Fetch all faculty members with assigned courses and compliance
  const facultyMembers = await db.faculty.findMany({
    include: {
      user: {
        select: {
          institutional_id: true,
          username: true,
          is_active: true,
        },
      },
      department: true,
      facultyCourses: {
        include: {
          course: true,
        },
      },
      examinations: {
        select: {
          exam_id: true,
          title: true,
          current_status: true,
        },
      },
      facultyPortfolios: {
        orderBy: { academic_year: "desc" },
        take: 1,
      },
    },
    orderBy: {
      last_name: "asc",
    },
  });

  const sanitizedFacultyMembers = facultyMembers.map((f) => ({
    ...f,
    facultyPortfolios: f.facultyPortfolios.map((p) => ({
      ...p,
      compliance_percentage: p.compliance_percentage.toString(),
    })),
  }));

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
            <NotificationBell userId={dbUser.user_id} />
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
              Verify institution-wide compliance charts, approve final-round examinations, monitor system audit logs, configure academic periods, and oversee college-wide parameters.
            </p>
          </div>
        </div>

        {/* Render interactive client dashboard */}
        <DirectorDashboardClient
          directorUserId={dbUser.user_id}
          stats={{
            totalStudents,
            totalFaculty,
            totalDepartments,
            totalExams,
          }}
          pendingApprovals={pendingApprovals as any}
          departmentsData={departmentsData as any}
          departmentsList={rawDepartments.map(d => ({ department_id: d.department_id, department_name: d.department_name }))}
          auditLogs={serializedLogs as any}
          allExaminations={allExaminations as any}
          globalHoldActive={globalHoldActive}
          academicPeriodSettings={academicPeriod}
          courses={courses}
          facultyMembers={sanitizedFacultyMembers as any}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
