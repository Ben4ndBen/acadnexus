import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { ExamBuilderWizard } from "@/app/components/ExamBuilderWizard";
import { BookOpen } from "lucide-react";
import { LogoutButton } from "@/app/components/LogoutButton";
import { NotificationBell } from "@/app/components/NotificationBell";

import { getCoursesCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ExamBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const examId = Number(id);

  if (isNaN(examId)) {
    redirect("/dashboard/faculty");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const institutionalId = user.user_metadata?.institutional_id;

  const isChairUser = role === "Chair" || role === "ProgramChair" || role === "Program Chair" || role === "Department Chair";
  const defaultDashboard = isChairUser ? "/dashboard/chair" : "/dashboard/faculty";

  const allowedRoles = ["Faculty", "Chair", "ProgramChair", "Program Chair", "Department Chair"];
  if (!role || !allowedRoles.includes(role)) {
    redirect("/");
  }

  // Fetch faculty / chair details
  let dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      faculty: {
        include: {
          department: true,
        },
      },
      chair: {
        include: {
          department: true,
          program: true,
        },
      },
    },
  });

  if (!dbUser) {
    redirect("/");
  }

  let faculty = dbUser?.faculty;
  if (!faculty && dbUser?.chair) {
    const chairDeptId = dbUser.chair.department_id || (await db.department.findFirst())?.department_id || 1;
    faculty = await db.faculty.upsert({
      where: { faculty_id: dbUser.user_id },
      update: { department_id: chairDeptId },
      create: {
        faculty_id: dbUser.user_id,
        first_name: isChairUser ? "Chairperson" : "Faculty",
        last_name: dbUser.chair.department?.department_name || "Instructor",
        department_id: chairDeptId,
      },
      include: {
        department: true,
      },
    });
  }

  if (!faculty) {
    redirect(defaultDashboard);
  }

  // Fetch examination with course, question bank, targets, and approval workflow
  const exam = await db.examination.findUnique({
    where: { exam_id: examId },
    include: {
      course: true,
      faculty: true,
      approvalWorkflow: true,
      questionBank: {
        orderBy: { question_id: "asc" },
      },
      examTargets: {
        orderBy: { target_id: "desc" },
        take: 1,
      },
    },
  });

  // Verify examination exists and belongs to this faculty / chair
  const isOwner = exam?.faculty_id === faculty.faculty_id || exam?.faculty_id === dbUser.user_id;
  const isChairOfFaculty = isChairUser && (
    !exam?.faculty?.department_id || 
    exam?.faculty?.department_id === faculty.department_id ||
    exam?.faculty?.department_id === dbUser?.chair?.department_id
  );

  if (!exam || (!isOwner && !isChairOfFaculty)) {
    redirect(defaultDashboard);
  }

  // Note: Non-draft examination lock states are handled gracefully by ExamBuilderWizard 
  // to avoid abruptly redirecting during server action revalidation before the success modal is acknowledged.

  // Fetch all courses for fallback using cached query
  const courses = await getCoursesCached();

  // 1. Fetch official assigned courses for this faculty/chair
  const facultyAssignedCourseRecords = await db.facultyCourse.findMany({
    where: { faculty_id: faculty.faculty_id },
    include: { course: true },
    orderBy: { course: { course_code: "asc" } },
  });

  let assignedSubjects: typeof courses = facultyAssignedCourseRecords.map((fc) => fc.course);
  if (assignedSubjects.length === 0) {
    assignedSubjects = courses;
  }

  // If chair user and no specifically assigned courses, default to all courses or department courses
  if (assignedSubjects.length === 0) {
    assignedSubjects = courses;
  }

  // Preserve current exam course if already initialized so existing draft doesn't break
  if (exam.course && !assignedSubjects.some((c) => c.course_id === exam.course_id)) {
    assignedSubjects = [exam.course, ...assignedSubjects];
  }

  // Import helpers for academic period and course enrolled students
  const { getActiveAcademicPeriod } = await import("@/app/actions/director");
  const { getAssignedStudentsForCourse } = await import("@/app/actions/faculty");

  const academicPeriodSettings = await getActiveAcademicPeriod();
  const studentsRes = await getAssignedStudentsForCourse(exam.course_id, exam.faculty_id);
  const initialAssignedStudents = studentsRes.students || [];

  const defaultExamDate = exam.exam_date
    ? new Date(exam.exam_date).toISOString().split("T")[0]
    : exam.examTargets?.[0]?.scheduled_date
    ? new Date(exam.examTargets[0].scheduled_date).toISOString().split("T")[0]
    : "";

  // Convert decimal to number/string in portfolios for serialization if necessary
  const sanitizedExam = {
    ...exam,
    exam_date: defaultExamDate,
    questionBank: exam.questionBank.map((q) => ({
      ...q,
      points: Number(q.points),
    })),
  };

  const returnUrl = isChairUser ? "/dashboard/chair" : "/dashboard/faculty";
  const userDisplayName = isChairUser 
    ? (role === "ProgramChair" ? `Program Chair ${faculty.first_name} ${faculty.last_name}` : `Chairperson ${faculty.first_name} ${faculty.last_name}`)
    : `Instructor ${faculty.first_name} ${faculty.last_name}`;

  // Resolve Department Chairperson Name
  let initialDeptChairName = "";
  const deptChairRecord = await db.chair.findFirst({
    where: {
      department_id: faculty.department_id,
      is_program_chair: false,
    },
    include: {
      user: {
        include: {
          faculty: true,
        },
      },
    },
  });
  if (deptChairRecord?.user?.faculty) {
    initialDeptChairName = `${deptChairRecord.user.faculty.first_name} ${deptChairRecord.user.faculty.last_name}`.trim();
  }

  // Resolve Program Chairperson Name (if under TED or CITD)
  let initialProgChairName = "";
  const courseCodeUpper = (exam.course?.course_code || "").trim().toUpperCase();
  let progChairRecord: any = null;
  if (courseCodeUpper.startsWith("ITC") || courseCodeUpper.startsWith("ITE") || courseCodeUpper.startsWith("ITM") || courseCodeUpper.startsWith("ITD") || courseCodeUpper === "ENT 403" || courseCodeUpper.includes("INFOTECH")) {
    const prog = await db.academicProgram.findFirst({ where: { program_code: "BSInfoTech" } });
    if (prog) {
      progChairRecord = await db.chair.findFirst({ where: { program_id: prog.program_id, is_program_chair: true }, include: { user: { include: { faculty: true } } } });
    }
  } else if (courseCodeUpper.startsWith("IND") || courseCodeUpper.startsWith("IT")) {
    const prog = await db.academicProgram.findFirst({ where: { program_code: "BSIT" } });
    if (prog) {
      progChairRecord = await db.chair.findFirst({ where: { program_id: prog.program_id, is_program_chair: true }, include: { user: { include: { faculty: true } } } });
    }
  } else if (courseCodeUpper.startsWith("BEED")) {
    const prog = await db.academicProgram.findFirst({ where: { program_code: "BEED" } });
    if (prog) {
      progChairRecord = await db.chair.findFirst({ where: { program_id: prog.program_id, is_program_chair: true }, include: { user: { include: { faculty: true } } } });
    }
  } else if (courseCodeUpper.startsWith("BSED") || courseCodeUpper.startsWith("EDUC")) {
    const prog = await db.academicProgram.findFirst({ where: { program_code: "BSED" } });
    if (prog) {
      progChairRecord = await db.chair.findFirst({ where: { program_id: prog.program_id, is_program_chair: true }, include: { user: { include: { faculty: true } } } });
    }
  }
  if (progChairRecord?.user?.faculty) {
    initialProgChairName = `${progChairRecord.user.faculty.first_name} ${progChairRecord.user.faculty.last_name}`.trim();
  }

  // Resolve Director for Instruction Name
  let initialDirectorName = "";
  const directorRecord = await db.director.findFirst();
  if (directorRecord) {
    initialDirectorName = [directorRecord.title, directorRecord.first_name, directorRecord.last_name].filter(Boolean).join(" ").trim();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${isChairUser ? "bg-amber-600" : "bg-emerald-600"} text-white p-2 rounded-xl`}>
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
              <span className={`text-xs ${isChairUser ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50"} font-bold ml-2 px-2.5 py-1 rounded-full uppercase tracking-wider`}>
                Exam Builder
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">
                {userDisplayName}
              </p>
              <p className="text-xs text-slate-500">{institutionalId}</p>
            </div>
            <NotificationBell userId={dbUser?.user_id || faculty.faculty_id} />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ExamBuilderWizard 
          exam={sanitizedExam as any} 
          courses={courses} 
          assignedSubjects={assignedSubjects}
          facultyId={faculty.faculty_id} 
          academicPeriodSettings={academicPeriodSettings}
          initialAssignedStudents={initialAssignedStudents}
          returnUrl={returnUrl}
          facultyDepartment={faculty.department?.department_name}
          userRole={role}
          initialDeptChairName={initialDeptChairName}
          initialProgChairName={initialProgChairName}
          initialDirectorName={initialDirectorName}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
