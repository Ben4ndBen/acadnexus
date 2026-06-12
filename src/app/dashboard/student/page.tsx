import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { LogoutButton } from "@/app/components/LogoutButton";
import { GraduationCap, BookOpen, Calendar, Award, ShieldAlert, Clock, CheckCircle, Hourglass, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  if (!student) {
    redirect("/");
  }

  // 1. Fetch targeted examinations via ExamTarget
  const targets = await db.examTarget.findMany({
    where: {
      program_id: student.program_id,
      year_level: student.year_level,
      section: student.section,
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
  });

  // 2. Fetch completed student exams
  const completedExams = await db.studentExam.findMany({
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
  });

  // Calculate metrics
  // Enrolled courses count: unique courses from all targeted exams
  const uniqueCourses = new Map();
  targets.forEach(t => {
    const course = t.exam.course;
    uniqueCourses.set(course.course_id, course);
  });
  const enrolledSubjectsCount = uniqueCourses.size;

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

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  targets.forEach(t => {
    if (completedExamIds.has(t.exam_id)) {
      return;
    }

    const scheduledDate = new Date(t.scheduled_date);
    const isToday = scheduledDate >= todayStart && scheduledDate <= todayEnd;
    const isFuture = scheduledDate > todayEnd;

    if (isToday) {
      const start = new Date(t.start_time);
      const end = new Date(t.end_time);

      const currentMin = now.getHours() * 60 + now.getMinutes();
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();

      if (currentMin >= startMin && currentMin <= endMin) {
        activeExams.push({
          ...t.exam,
          target: t
        });
      } else if (currentMin < startMin) {
        upcomingExams.push({
          ...t.exam,
          target: t
        });
      }
    } else if (isFuture) {
      upcomingExams.push({
        ...t.exam,
        target: t
      });
    }
  });

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

        {/* Academic Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 self-start">
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
          <div className="lg:col-span-2 space-y-8">
            {/* Active Examinations */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-rose-500 rounded-full animate-pulse" />
                Active Examinations
              </h2>

              {activeExams.length > 0 ? (
                <div className="space-y-4">
                  {activeExams.map((exam) => (
                    <div key={exam.exam_id} className="flex flex-col sm:flex-row sm:items-center justify-between border border-slate-100 p-5 rounded-2xl bg-gradient-to-r from-rose-50/20 to-transparent hover:border-rose-100 transition-all gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Live Now
                        </span>
                        <h4 className="font-bold text-slate-800 text-base mt-1">{exam.title}</h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" /> {exam.course.course_title} ({exam.course.course_code})
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Time Limit: {exam.time_limit_minutes} minutes
                        </p>
                      </div>
                      <button className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm hover:shadow-md self-start sm:self-auto">
                        Start Exam <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-slate-100 rounded-2xl">
                  <div className="bg-slate-50 p-3 rounded-full text-slate-400 mb-3">
                    <Hourglass className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No live examinations</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    There are no exams currently active for your section.
                  </p>
                </div>
              )}
            </div>

            {/* Upcoming & Completed Tab / Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upcoming Examinations */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                <h2 className="text-md font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Upcoming Exams
                </h2>

                {upcomingExams.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingExams.map((exam) => (
                      <div key={exam.exam_id} className="border border-slate-100 p-4 rounded-xl space-y-2">
                        <h4 className="font-bold text-slate-800 text-sm">{exam.title}</h4>
                        <p className="text-xs text-slate-500">
                          {exam.course.course_title}
                        </p>
                        <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1">
                          <p className="text-slate-600 font-semibold">
                            Date: {new Date(exam.target.scheduled_date).toLocaleDateString()}
                          </p>
                          <p className="text-slate-500">
                            Time: {new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No upcoming exams scheduled.
                  </div>
                )}
              </div>

              {/* Completed Examinations */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                <h2 className="text-md font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Completed Exams
                </h2>

                {completedExams.length > 0 ? (
                  <div className="space-y-4">
                    {completedExams.map((se) => {
                      const examMaxPoints = se.exam.questionBank.reduce((sum, q) => sum + q.points, 0);
                      const percentage = examMaxPoints > 0 ? Math.round((se.total_score / examMaxPoints) * 100) : 0;
                      return (
                        <div key={se.student_exam_id} className="border border-slate-100 p-4 rounded-xl flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-800 text-sm">{se.exam.title}</h4>
                            <p className="text-xs text-slate-400">
                              Submitted: {new Date(se.submitted_at || se.started_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
                              {se.total_score}/{examMaxPoints} ({percentage}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No completed exams recorded.
                  </div>
                )}
              </div>
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
