import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { LogoutButton } from "@/app/components/LogoutButton";
import { NotificationBell } from "@/app/components/NotificationBell";
import { ClipboardCheck } from "lucide-react";
import { ChairDashboardClient } from "@/app/components/ChairDashboardClient";

import { getCoursesCached } from "@/lib/cache";
import { ensureChairsAndDepartmentsExist } from "@/lib/chairServer";
import { ensureBsitCoursesExist } from "@/lib/bsitCurriculumServer";
import { filterCoursesForDepartment } from "@/lib/courseDepartmentMapping";

export const dynamic = "force-dynamic";

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

  if (role !== "Chair" && role !== "ProgramChair") {
    redirect("/");
  }

  await ensureChairsAndDepartmentsExist();

  // Fetch chair details from the database
  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      chair: {
        include: {
          program: true,
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
                  },
                  facultyCourses: {
                    include: {
                      course: true,
                    },
                  },
                },
              },
            },
          },
          approvals: {
            where: {
              chair_review_status: "Pending",
              exam: {
                current_status: "Pending_Chair",
              },
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
          progApprovals: {
            where: {
              prog_chair_review_status: "Pending",
              exam: {
                current_status: "Pending_Program_Chair",
              },
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

  const isProgChair = dbUser.role === "ProgramChair" || !!chair.is_program_chair;

  // Format clean department name without redundant "Department" suffix
  let cleanDeptName = (department.department_name || "").trim();
  if (cleanDeptName.toLowerCase().endsWith(" department")) {
    cleanDeptName = cleanDeptName.substring(0, cleanDeptName.length - " department".length).trim();
  }

  // Determine Title without redundant "Department" words
  let chairTitle = isProgChair ? "Program Chairperson" : "Department Chairperson";
  if (isProgChair && chair.program) {
    if (chair.program.program_code === "BSInfoTech") chairTitle = "Program Chairperson (ICT)";
    else if (chair.program.program_code === "BSIT") chairTitle = "Program Chairperson (IT)";
    else if (chair.program.program_code === "BEED") chairTitle = "Program Chairperson (TED - Elementary)";
    else if (chair.program.program_code === "BSED") chairTitle = "Program Chairperson (TED - Secondary)";
    else chairTitle = `Program Chairperson (${chair.program.program_code})`;
  } else if (!isProgChair && cleanDeptName) {
    chairTitle = `Department Chairperson (${cleanDeptName})`;
  }

  // If CITD Department Chair, also load faculty from sub-departments (ICT, IT)
  let allFaculty = [...department.faculty];
  if (!isProgChair && department.department_name === "CITD") {
    const childFaculty = await db.faculty.findMany({
      where: {
        department: {
          department_name: { in: ["ICT Department", "IT Department"] },
        },
      },
      include: {
        examinations: true,
        facultyPortfolios: {
          orderBy: { academic_year: "desc" },
          take: 1,
        },
        facultyCourses: {
          include: { course: true },
        },
      },
    });

    const existingFacultyIds = new Set(allFaculty.map((f) => f.faculty_id));
    for (const cf of childFaculty) {
      if (!existingFacultyIds.has(cf.faculty_id)) {
        allFaculty.push(cf);
      }
    }
  }

  // Format faculty members to ensure compliance_percentage is a string/number
  const formattedFaculty = allFaculty.map(f => ({
    ...f,
    facultyPortfolios: f.facultyPortfolios.map(p => ({
      ...p,
      compliance_percentage: p.compliance_percentage.toString()
    }))
  }));

  // Selected Pending Approvals depending on whether Program Chair or Dept Chair
  let formattedApprovals: any[] = [];
  if (isProgChair) {
    formattedApprovals = chair.progApprovals;
  } else {
    const deptFacultyIds = allFaculty.map((f) => f.faculty_id);
    formattedApprovals = await db.approvalWorkflow.findMany({
      where: {
        chair_review_status: "Pending",
        exam: {
          current_status: "Pending_Chair",
        },
        OR: [
          { reviewed_by_chair_id: chair.chair_id },
          { exam: { faculty_id: { in: deptFacultyIds } } },
        ],
      },
      include: {
        exam: {
          include: {
            course: true,
            faculty: true,
            questionBank: true,
          },
        },
      },
    });
  }

  // Ensure chair user has an underlying faculty record for exam creation
  await db.faculty.upsert({
    where: { faculty_id: dbUser.user_id },
    update: { department_id: department.department_id },
    create: {
      faculty_id: dbUser.user_id,
      first_name: isProgChair ? "Program Chairperson" : "Department Chairperson",
      last_name: cleanDeptName || "Chair",
      department_id: department.department_id,
    },
  });

  // Extract all department exams
  const departmentExams = allFaculty.flatMap(f => f.examinations);

  // Fetch Chair's own faculty profile for faculty dashboard functions
  let chairFacultyRecord = await db.faculty.findUnique({
    where: { faculty_id: dbUser.user_id },
    include: {
      department: true,
      examinations: {
        include: {
          course: true,
          approvalWorkflow: true,
          questionBank: true,
          examTargets: true,
        },
        orderBy: { exam_id: "desc" },
      },
      facultyPortfolios: {
        orderBy: { academic_year: "desc" },
      },
      facultyCourses: {
        include: { course: true },
      },
    },
  });

  if (!chairFacultyRecord) {
    await db.faculty.upsert({
      where: { faculty_id: dbUser.user_id },
      update: {
        department_id: department.department_id,
      },
      create: {
        faculty_id: dbUser.user_id,
        first_name: dbUser.username || (isProgChair ? "Program" : "Department"),
        last_name: "Chairperson",
        department_id: department.department_id,
      },
    });

    chairFacultyRecord = await db.faculty.findUnique({
      where: { faculty_id: dbUser.user_id },
      include: {
        department: true,
        examinations: {
          include: {
            course: true,
            approvalWorkflow: true,
            questionBank: true,
            examTargets: true,
          },
          orderBy: { exam_id: "desc" },
        },
        facultyPortfolios: {
          orderBy: { academic_year: "desc" },
        },
        facultyCourses: {
          include: { course: true },
        },
      },
    });
  }

  const sanitizedChairFaculty = chairFacultyRecord ? {
    ...chairFacultyRecord,
    facultyPortfolios: chairFacultyRecord.facultyPortfolios.map(p => ({
      ...p,
      compliance_percentage: p.compliance_percentage.toString(),
    })),
  } : null;

  const chairExaminations = chairFacultyRecord?.examinations || [];

  // Fetch academic programs for student roster enrollment & scheduling
  const programs = await db.academicProgram.findMany({
    include: { department: true },
    orderBy: { program_code: "asc" },
  });

  // Fetch student exam attempts for grading & submissions tab
  const studentExams = await db.studentExam.findMany({
    include: {
      student: {
        include: { user: true, program: true },
      },
      exam: {
        include: { course: true },
      },
      studentAnswers: {
        include: { question: true },
      },
    },
    orderBy: { started_at: "desc" },
  });

  // Ensure all curriculum subjects exist in database
  await ensureBsitCoursesExist();

  // Fetch courses for assignment using cached query
  const courses = await getCoursesCached();

  let assignedCourses = chairFacultyRecord?.facultyCourses.map(fc => fc.course) || [];
  if (assignedCourses.length === 0) {
    assignedCourses = filterCoursesForDepartment(courses, department.department_id);
  }

  const chairFullName = [
    chairFacultyRecord?.first_name,
    chairFacultyRecord?.middle_name,
    chairFacultyRecord?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const chairDisplayName = chairFullName || chairTitle;

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
                {isProgChair ? "Program Chair Portal" : "Department Chair Portal"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">
                {chairDisplayName}
              </p>
              <p className="text-xs text-slate-500">{chairTitle} &bull; {institutionalId}</p>
            </div>
            <NotificationBell userId={dbUser.user_id} />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Welcome banner (Compact) */}
        <div className="bg-gradient-to-tr from-amber-900 via-amber-800 to-yellow-900 text-white rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden border border-amber-950/20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px]" />
          <div className="relative z-10 space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Welcome back, {chairDisplayName}!
            </h1>
            <p className="text-amber-100 max-w-2xl text-xs sm:text-sm leading-relaxed">
              Verify drafted syllabi, evaluate examination formats and Table of Specifications (TOS), draft and manage examinations, oversee academic compliance, and manage your teaching load.
            </p>
          </div>
        </div>

        {/* Render the interactive client component */}
        <ChairDashboardClient
          chairUserId={dbUser.user_id}
          departmentId={department.department_id}
          departmentName={department.department_name}
          isProgramChair={isProgChair}
          programCode={chair.program?.program_code}
          chairTitle={chairTitle}
          facultyMembers={formattedFaculty as any}
          pendingApprovals={formattedApprovals as any}
          departmentExams={departmentExams as any}
          chairExaminations={chairExaminations as any}
          programs={programs as any}
          assignedCourses={assignedCourses as any}
          courses={courses}
          faculty={sanitizedChairFaculty as any}
          institutionalId={institutionalId}
          hasSeenCourseAssignment={chairFacultyRecord?.has_seen_course_assignment || false}
          requirePasswordUpdate={dbUser.require_password_update || false}
          username={dbUser.username || undefined}
          studentExams={studentExams as any}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
