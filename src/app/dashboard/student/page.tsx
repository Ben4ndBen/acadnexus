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
import { autoArchiveCompletedExams } from "@/app/actions/faculty";
import { submitStudentExam } from "@/app/actions/student";

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

  // Ensure completed exams with past schedules are archived
  await autoArchiveCompletedExams();

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
        exam: {
          current_status: "Approved",
          is_archived: false,
          selected_student_ids: {
            has: student.student_id,
          },
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

  // Filter targets to strictly only include examinations where the student is specifically assigned by the instructor.
  // Do not make an exam available to all students taking the same course unless they were actually assigned to that examination.
  const eligibleTargets = targets.filter((t) => {
    const selectedIds = t.exam.selected_student_ids;
    return Array.isArray(selectedIds) && selectedIds.includes(student.student_id);
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

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));

  // Check any in-progress exams to see if their time limit has already expired
  for (const se of completedExams) {
    if (!se.submitted_at) {
      const elapsedMs = now.getTime() - se.started_at.getTime();
      const timePenaltyMs = (se.violations_count || 0) * (se.exam.time_penalty_seconds ?? 60) * 1000;
      const totalAllowedMs = Math.max(0, se.exam.time_limit_minutes * 60 * 1000 - timePenaltyMs);
      if (elapsedMs >= totalAllowedMs) {
        try {
          const submitResult = await submitStudentExam(se.student_exam_id, "Timeout");
          se.submitted_at = new Date();
          se.submission_trigger = "Timeout";
          if (submitResult && submitResult.totalScore !== undefined) {
            se.total_score = submitResult.totalScore;
          }
        } catch (e) {
          console.error("Auto-submit timeout error:", e);
          se.submitted_at = new Date();
          se.submission_trigger = "Timeout";
        }
      }
    }
  }

  // Only count exams with submitted_at as completed (including forced submissions)
  const actualCompletedExams = completedExams.filter((se) => se.submitted_at !== null);

  // Set of all exam IDs that the student has ever started or attempted
  // (Crucial rule: Never mark a student as Missed if they already started the exam)
  const startedExamIds = new Set<number>(completedExams.map((se) => se.exam_id));

  // Average examination performance
  let totalPointsAccumulated = 0;
  let maxPossiblePointsAccumulated = 0;
  actualCompletedExams.forEach((se) => {
    const examMaxPoints = se.exam.questionBank.reduce((sum, q) => sum + q.points, 0);
    totalPointsAccumulated += se.total_score;
    maxPossiblePointsAccumulated += examMaxPoints;
  });

  const averagePerformance = maxPossiblePointsAccumulated > 0
    ? Math.round((totalPointsAccumulated / maxPossiblePointsAccumulated) * 100)
    : 0;

  // Track processed exams by ID to ensure an exam never appears in multiple categories
  const seenExamIds = new Set<number>();
  actualCompletedExams.forEach((se) => seenExamIds.add(se.exam_id));

  // Map active in-progress student exams (started, not yet submitted, and still within time limit)
  const inProgressExamsMap = new Map<number, (typeof completedExams)[0]>();
  completedExams.forEach((se) => {
    if (!se.submitted_at) {
      inProgressExamsMap.set(se.exam_id, se);
    }
  });

  const activeExams: any[] = [];
  const upcomingExams: any[] = [];
  const missedExams: any[] = [];

  // 1. Process active student overrides first (individual reopened exam attempts)
  studentOverrides.forEach((o) => {
    if (seenExamIds.has(o.exam_id)) {
      return;
    }
    seenExamIds.add(o.exam_id);

    const examStart = o.new_start_time;
    const examEnd = o.new_end_time;

    // Find original target schedule to preserve official examination date
    const origTarget = eligibleTargets.find((t) => t.exam_id === o.exam_id);
    const officialSchedule = origTarget
      ? {
          scheduled_date: origTarget.scheduled_date.toISOString(),
          start_time: origTarget.start_time.toISOString(),
          end_time: origTarget.end_time.toISOString(),
        }
      : o.exam.exam_date
      ? {
          scheduled_date: o.exam.exam_date.toISOString(),
          start_time: null,
          end_time: null,
        }
      : null;

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

    const inProgressAttempt = inProgressExamsMap.get(o.exam_id);
    if (inProgressAttempt) {
      const elapsedMs = now.getTime() - inProgressAttempt.started_at.getTime();
      const timePenaltyMs = (inProgressAttempt.violations_count || 0) * (o.exam.time_penalty_seconds ?? 60) * 1000;
      const totalAllowedMs = Math.max(0, o.exam.time_limit_minutes * 60 * 1000 - timePenaltyMs);
      if (elapsedMs < totalAllowedMs) {
        activeExams.push({
          ...o.exam,
          target: sanitizedTarget,
          official_schedule: officialSchedule,
          reopened_window: reopenedWindow,
          is_reopened: true,
          is_in_progress: true,
        });
        return;
      } else {
        // Attempt time expired: record as completed attempt, never Missed
        if (!actualCompletedExams.some((se) => se.student_exam_id === inProgressAttempt.student_exam_id)) {
          inProgressAttempt.submitted_at = inProgressAttempt.submitted_at || new Date();
          inProgressAttempt.submission_trigger = "Timeout";
          actualCompletedExams.push(inProgressAttempt);
        }
        return;
      }
    }

    if (now >= examStart && now < examEnd) {
      activeExams.push({
        ...o.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        reopened_window: reopenedWindow,
        is_reopened: true,
      });
    } else if (now < examStart) {
      upcomingExams.push({
        ...o.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        reopened_window: reopenedWindow,
        is_reopened: true,
      });
    } else {
      // Never mark a student as Missed if they already started the exam
      if (!startedExamIds.has(o.exam_id)) {
        missedExams.push({
          ...o.exam,
          target: sanitizedTarget,
          official_schedule: officialSchedule,
          reopened_window: reopenedWindow,
          is_reopened: true,
        });
      }
    }
  });

  // 2. Process general eligible targets
  eligibleTargets.forEach((t) => {
    if (seenExamIds.has(t.exam_id)) {
      return;
    }
    seenExamIds.add(t.exam_id);

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

    // Check if student has an active in-progress attempt
    const inProgressAttempt = inProgressExamsMap.get(t.exam_id);

    if (inProgressAttempt) {
      const elapsedMs = now.getTime() - inProgressAttempt.started_at.getTime();
      const timePenaltyMs = (inProgressAttempt.violations_count || 0) * (t.exam.time_penalty_seconds ?? 60) * 1000;
      const totalAllowedMs = Math.max(0, t.exam.time_limit_minutes * 60 * 1000 - timePenaltyMs);
      if (elapsedMs < totalAllowedMs) {
        // Attempt is still active and student has remaining time to finish
        activeExams.push({
          ...t.exam,
          target: sanitizedTarget,
          official_schedule: officialSchedule,
          is_reopened: false,
          is_in_progress: true,
        });
        return;
      } else {
        // Attempt time expired: record as completed attempt, never Missed
        if (!actualCompletedExams.some((se) => se.student_exam_id === inProgressAttempt.student_exam_id)) {
          inProgressAttempt.submitted_at = inProgressAttempt.submitted_at || new Date();
          inProgressAttempt.submission_trigger = "Timeout";
          actualCompletedExams.push(inProgressAttempt);
        }
        return;
      }
    }

    // Schedule availability window:
    // Student can start at start_time or anytime afterward while the exam is available.
    // If student has not started by end_time, mark as Missed Exam.
    if (now >= examStart && now < examEnd) {
      activeExams.push({
        ...t.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        is_reopened: false,
      });
    } else if (now < examStart) {
      upcomingExams.push({
        ...t.exam,
        target: sanitizedTarget,
        official_schedule: officialSchedule,
        is_reopened: false,
      });
    } else {
      // Exam window closed:
      // Do not mark a student as Missed if they already started the exam.
      // A student who started but did not finish should be recorded as an attempted or automatically submitted examination.
      if (!startedExamIds.has(t.exam_id)) {
        missedExams.push({
          ...t.exam,
          target: sanitizedTarget,
          official_schedule: officialSchedule,
          is_reopened: false,
        });
      }
    }
  });

  const serializedCompletedExams = actualCompletedExams.map((se) => ({
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
              Check your exam schedule, view your test scores, and see what exams are coming up next.
            </p>
          </div>
        </div>

        {/* Upcoming Exam Alert Banner */}
        {upcomingExams.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {upcomingExams.length} Upcoming {upcomingExams.length === 1 ? "Exam" : "Exams"} Scheduled
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Next Exam: <span className="font-semibold text-blue-900">{upcomingExams[0].title}</span> ({upcomingExams[0].course?.course_code || "Course"}) • {" "}
                  {upcomingExams[0].target?.scheduled_date ? (
                    <span>
                      on <span className="font-bold text-slate-800">{new Date(upcomingExams[0].target.scheduled_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
                      {" "}@ <span className="font-bold text-slate-800">{new Date(upcomingExams[0].target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} - {new Date(upcomingExams[0].target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</span>
                      {" "}(Time limit: <span className="font-bold text-emerald-800">{upcomingExams[0].time_limit_minutes} mins</span>)
                    </span>
                  ) : upcomingExams[0].official_schedule?.scheduled_date ? (
                    <span>Target Date: {new Date(upcomingExams[0].official_schedule.scheduled_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} (Schedule Coming Soon)</span>
                  ) : (
                    <span className="font-bold text-amber-800">Schedule Coming Soon</span>
                  )}
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
              <h3 className="text-2xl font-black text-slate-800 mt-1">{actualCompletedExams.length}</h3>
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
