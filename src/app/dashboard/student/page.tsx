import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { LogoutButton } from "@/app/components/LogoutButton";
import { NotificationBell } from "@/app/components/NotificationBell";
import { GraduationCap, BookOpen, Calendar, Award, ShieldAlert, Clock, CheckCircle, Hourglass, ArrowRight } from "lucide-react";
import { StudentDashboardClient } from "@/app/components/StudentDashboardClient";

import { getCachedStudentUser, getActiveAcademicPeriodCached } from "@/lib/cache";
import { getExpectedYearAndSemForCourse } from "@/lib/bsitCurriculum";

export const dynamic = "force-dynamic";

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

  // Fetch student details from the database using cached query
  const dbUser = await getCachedStudentUser(institutionalId);

  const student = dbUser?.student;
  if (!student) {
    redirect("/");
  }

  // 1. Concurrently fetch targeted examinations, active student overrides, and completed exams
  const [targets, studentOverrides, completedExams] = await Promise.all([
    db.examTarget.findMany({
      where: {
        program_id: student.program_id,
        year_level: student.year_level,
        exam: {
          current_status: "Approved",
        },
      },
      include: {
        exam: {
          include: {
            course: true,
            questionBank: {
              select: {
                points: true,
              },
            },
          },
        },
      },
    }),
    db.studentOverride.findMany({
      where: {
        student_id: student.student_id,
        is_active: true,
      },
      include: {
        exam: {
          include: {
            course: true,
            questionBank: {
              select: {
                points: true,
              },
            },
          },
        },
      },
    }),
    db.studentExam.findMany({
      where: {
        student_id: student.student_id,
      },
      include: {
        exam: {
          include: {
            course: true,
            questionBank: {
              select: {
                points: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const overrideExamIds = new Set(studentOverrides.map(o => o.exam_id));


  // Filter targets to only include those where the student is selected (or no restriction set)
  const eligibleTargets = targets.filter((t) => {
    const selectedIds = t.exam.selected_student_ids;
    if (selectedIds && Array.isArray(selectedIds) && selectedIds.length > 0) {
      return selectedIds.includes(student.student_id);
    }
    return true;
  });
  // Calculate metrics
  // Enrolled courses count: combines student's indicated subjects from signup and any targeted exam subjects
  const uniqueCoursesMap = new Map<number, { course_id: number; course_code: string; course_title: string }>();

  // 1. Add student's explicitly indicated subjects from registration
  if (student.studentCourses && student.studentCourses.length > 0) {
    student.studentCourses.forEach((sc) => {
      if (sc.course) {
        uniqueCoursesMap.set(sc.course.course_id, sc.course);
      }
    });
  }

  // 2. Add subjects from targeted exams
  eligibleTargets.forEach((t) => {
    const course = t.exam.course;
    if (course) {
      uniqueCoursesMap.set(course.course_id, course);
    }
  });

  const academicPeriod = await getActiveAcademicPeriodCached();
  const activeSemester = academicPeriod.active_semester?.includes("2") ? 2 : 1;

  const rawCoursesList = Array.from(uniqueCoursesMap.values());
  const enrolledCoursesList = rawCoursesList.filter((c) => {
    const meta = getExpectedYearAndSemForCourse(c.course_code, c.course_title, student?.program?.program_code);
    if (!meta) return true;
    return meta.yearLevel === student.year_level && meta.semester === activeSemester;
  });
  const enrolledSubjectsCount = enrolledCoursesList.length;

  // Average examination performance
  let totalPointsAccumulated = 0;
  let maxPossiblePointsAccumulated = 0;
  completedExams.forEach(se => {
    const examMaxPoints = se.exam.questionBank.reduce((sum, q) => sum + q.points, 0);
    totalPointsAccumulated += se.total_score;
    maxPossiblePointsAccumulated += examMaxPoints;
  });

  const averagePerformance = maxPossiblePointsAccumulated > 0
    ? Math.round((totalPointsAccumulated / maxPossiblePointsAccumulated) * 100)
    : 0;

  // Categorize examinations
  const completedExamIds = new Set(completedExams.map(se => se.exam_id));
  const activeExams: any[] = [];
  const upcomingExams: any[] = [];
  const missedExams: any[] = [];

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));

  eligibleTargets.forEach(t => {
    if (completedExamIds.has(t.exam_id)) {
      return;
    }

    // Prioritize student override if active
    if (overrideExamIds.has(t.exam_id)) {
      return;
    }

    // Construct start and end dates in the Asia/Manila timezone-relative context
    const examStart = new Date(
      t.scheduled_date.getUTCFullYear(),
      t.scheduled_date.getUTCMonth(),
      t.scheduled_date.getUTCDate(),
      t.start_time.getUTCHours(),
      t.start_time.getUTCMinutes(),
      0
    );

    const examEnd = new Date(
      t.scheduled_date.getUTCFullYear(),
      t.scheduled_date.getUTCMonth(),
      t.scheduled_date.getUTCDate(),
      t.end_time.getUTCHours(),
      t.end_time.getUTCMinutes(),
      0
    );

    const sanitizedTarget = {
      target_id: t.target_id,
      scheduled_date: t.scheduled_date.toISOString(),
      start_time: t.start_time.toISOString(),
      end_time: t.end_time.toISOString(),
    };

    const officialSchedule = {
      scheduled_date: t.scheduled_date.toISOString(),
      start_time: t.start_time.toISOString(),
      end_time: t.end_time.toISOString(),
    };

    if (now >= examStart && now <= examEnd) {
      activeExams.push({
        ...t.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        is_reopened: false
      });
    } else if (now < examStart) {
      upcomingExams.push({
        ...t.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        is_reopened: false
      });
    } else {
      missedExams.push({
        ...t.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        is_reopened: false
      });
    }
  });

  // Handle active student overrides (individual reopened exam attempts)
  studentOverrides.forEach(o => {
    if (completedExamIds.has(o.exam_id)) {
      return;
    }

    const examStart = o.new_start_time;
    const examEnd = o.new_end_time;

    // Find original target schedule to preserve official examination date
    const origTarget = eligibleTargets.find(t => t.exam_id === o.exam_id);
    const officialSchedule = origTarget ? {
      scheduled_date: origTarget.scheduled_date.toISOString(),
      start_time: origTarget.start_time.toISOString(),
      end_time: origTarget.end_time.toISOString(),
    } : (o.exam.exam_date ? {
      scheduled_date: o.exam.exam_date.toISOString(),
      start_time: null,
      end_time: null,
    } : null);

    const sanitizedTarget = {
      target_id: -o.override_id, // negative ID to distinguish from real targets
      scheduled_date: (origTarget ? origTarget.scheduled_date : o.new_start_time).toISOString(),
      start_time: o.new_start_time.toISOString(),
      end_time: o.new_end_time.toISOString(),
    };

    const reopenedWindow = {
      start_time: o.new_start_time.toISOString(),
      end_time: o.new_end_time.toISOString(),
    };

    if (now >= examStart && now <= examEnd) {
      activeExams.push({
        ...o.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        reopened_window: reopenedWindow,
        is_reopened: true
      });
    } else if (now < examStart) {
      upcomingExams.push({
        ...o.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        reopened_window: reopenedWindow,
        is_reopened: true
      });
    } else {
      missedExams.push({
        ...o.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        reopened_window: reopenedWindow,
        is_reopened: true
      });
    }
  });

  const serializedCompletedExams = completedExams.map(se => ({
    ...se,
    submitted_at: se.submitted_at ? se.submitted_at.toISOString() : null,
    started_at: se.started_at.toISOString(),
  }));

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
                {student
                  ? `${student.first_name} ${student.middle_name ? `${student.middle_name.trim().charAt(0).toUpperCase()}. ` : ""}${student.last_name}`
                  : "Student User"}
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

        {/* Upcoming Exam Alert Banner */}
        {upcomingExams.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {upcomingExams.length} Upcoming {upcomingExams.length === 1 ? "Examination" : "Examinations"} Scheduled
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nearest: <span className="font-semibold text-blue-900">{upcomingExams[0].title}</span> ({upcomingExams[0].course?.course_code || "Course"}) on {new Date(upcomingExams[0].target.scheduled_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Upcoming
            </span>
          </div>
        )}

        {/* Academic Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
            <div className="bg-blue-50 p-3.5 rounded-xl text-blue-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Enrolled Subjects</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{enrolledSubjectsCount}</h3>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
            <div className="bg-indigo-50 p-3.5 rounded-xl text-indigo-600">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Exams</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{upcomingExams.length}</h3>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
            <div className="bg-emerald-50 p-3.5 rounded-xl text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exams Completed</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{completedExams.length}</h3>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
            <div className="bg-amber-50 p-3.5 rounded-xl text-amber-600">
              <Award className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Performance</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-black text-slate-800">{averagePerformance}%</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Render interactive Student Dashboard Client with tabbed navigation */}
        <StudentDashboardClient
          student={student}
          activeExams={activeExams}
          upcomingExams={upcomingExams}
          completedExams={serializedCompletedExams}
          missedExams={missedExams}
          enrolledSubjectsCount={enrolledSubjectsCount}
          enrolledCourses={enrolledCoursesList}
          averagePerformance={averagePerformance}
          institutionalId={institutionalId}
          userId={dbUser.user_id}
          requirePasswordUpdate={!!dbUser?.require_password_update}
          activeSemester={activeSemester}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Batanes State College. Powered by AcadNexus.</p>
      </footer>
    </div>
  );
}
