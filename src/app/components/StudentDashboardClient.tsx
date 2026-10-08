"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  BookOpen, Calendar, Award, ShieldAlert, Clock, CheckCircle, 
  Hourglass, ArrowRight, ShieldCheck, Download, Lock, KeyRound,
  Eye, EyeOff, Loader2, AlertCircle, X, Shield, Filter, Bell
} from "lucide-react";
import * as XLSX from "xlsx";

import { getDepartmentTheme } from "@/lib/departmentThemes";
import { DepartmentBadge } from "@/app/components/DepartmentBadge";
import { updateStudentPassword } from "@/app/actions/student";
import { getExpectedYearAndSemForCourse } from "@/lib/bsitCurriculum";

interface Course {
  course_id: number;
  course_code: string;
  course_title: string;
}

interface Target {
  target_id: number;
  scheduled_date: string;
  start_time: string;
  end_time: string;
}

interface OfficialSchedule {
  scheduled_date: string;
  start_time?: string | null;
  end_time?: string | null;
}

interface ReopenedWindow {
  start_time: string;
  end_time: string;
}

interface Exam {
  exam_id: number;
  title: string;
  time_limit_minutes: number;
  course: Course;
  target?: Target | null;
  is_schedule_pending?: boolean;
  is_reopened?: boolean;
  official_schedule?: OfficialSchedule | null;
  reopened_window?: ReopenedWindow | null;
}

interface CompletedExam {
  student_exam_id: number;
  exam_id: number;
  total_score: number;
  submitted_at: string | null;
  started_at: string;
  exam: {
    title: string;
    questionBank: Array<{ points: number }>;
  };
}

interface Student {
  student_id: number;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  year_level: number;
  section: string;
  program: {
    program_name: string;
    program_code: string;
    department: {
      department_name: string;
    } | null;
  } | null;
}

interface StudentDashboardClientProps {
  student: Student;
  activeExams: Exam[];
  upcomingExams: Exam[];
  completedExams: CompletedExam[];
  missedExams: Exam[];
  enrolledSubjectsCount: number;
  enrolledCourses?: Array<{ course_id: number; course_code: string; course_title: string }>;
  averagePerformance: number;
  institutionalId: string;
  userId: number;
  requirePasswordUpdate?: boolean;
  activeSemester?: number;
}

type TabType = "active" | "upcoming" | "completed" | "missed";

export function StudentDashboardClient({
  student,
  activeExams,
  upcomingExams,
  completedExams,
  missedExams,
  enrolledSubjectsCount,
  enrolledCourses = [],
  averagePerformance,
  institutionalId,
  userId,
  requirePasswordUpdate = false,
  activeSemester = 1,
}: StudentDashboardClientProps) {
  const router = useRouter();

  // Periodically refresh student dashboard so that when the scheduled start time arrives,
  // the exam automatically transitions into Live Now and unlocks for the student.
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (activeExams && activeExams.length > 0) return "active";
    if (upcomingExams && upcomingExams.length > 0) return "upcoming";
    return "active";
  });

  // Password Update Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(!!requirePasswordUpdate);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [mustUpdatePassword, setMustUpdatePassword] = useState(!!requirePasswordUpdate);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsSavingPassword(true);

    const res = await updateStudentPassword(userId, currentPassword, newPassword, confirmPassword);
    setIsSavingPassword(false);

    if (res.error) {
      setPasswordError(res.error);
    } else {
      setPasswordSuccess("Password updated successfully!");
      setMustUpdatePassword(false);
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordSuccess(null);
      }, 1400);
    }
  };

  const deptTheme = getDepartmentTheme(
    student?.program?.department?.department_name || student?.program?.program_code
  );

  // Filter enrolled courses to show ONLY subjects for student's year level and active semester
  const filteredEnrolledCourses = useMemo(() => {
    if (!enrolledCourses || enrolledCourses.length === 0) return [];
    const studentYear = student?.year_level || 1;
    const currentSem = activeSemester || 1;

    return enrolledCourses.filter((c) => {
      const meta = getExpectedYearAndSemForCourse(c.course_code, c.course_title, student?.program?.program_code);
      if (!meta) return true;
      return meta.yearLevel === studentYear && meta.semester === currentSem;
    });
  }, [enrolledCourses, student, activeSemester]);

  const tabs = [
    {
      id: "active" as TabType,
      label: "Active Exams",
      count: activeExams.length,
      icon: Clock,
      badgeColor: activeExams.length > 0 ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-500 border-slate-200",
      activeColor: "bg-rose-50 border-rose-500 text-rose-700",
      pulse: activeExams.length > 0,
      dotColor: "bg-rose-500",
      pingColor: "bg-rose-400",
    },
    {
      id: "upcoming" as TabType,
      label: "Upcoming Exams",
      count: upcomingExams.length,
      icon: Calendar,
      badgeColor: upcomingExams.length > 0 ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-500 border-slate-200",
      activeColor: "bg-blue-50 border-blue-500 text-blue-700",
      pulse: upcomingExams.length > 0,
      dotColor: "bg-blue-500",
      pingColor: "bg-blue-400",
    },
    {
      id: "completed" as TabType,
      label: "Completed Exams",
      count: completedExams.length,
      icon: Award,
      badgeColor: completedExams.length > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200",
      activeColor: "bg-emerald-50 border-emerald-500 text-emerald-700",
      pulse: false,
      dotColor: "bg-emerald-500",
      pingColor: "bg-emerald-400",
    },
    {
      id: "missed" as TabType,
      label: "Missed Exams",
      count: missedExams.length,
      icon: ShieldAlert,
      badgeColor: missedExams.length > 0 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-500 border-slate-200",
      activeColor: "bg-amber-50 border-amber-500 text-amber-700",
      pulse: missedExams.length > 0,
      dotColor: "bg-amber-500",
      pingColor: "bg-amber-400",
    },
  ];


  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar with Profile & Side Tab Buttons */}
      <div className="lg:col-span-1 space-y-6">
        {/* Profile Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: deptTheme.colors.primary }} />
              Academic Profile
            </h2>
            <DepartmentBadge
              department={student?.program?.department?.department_name}
              programCode={student?.program?.program_code}
              size="sm"
            />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Full Name</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {student
                  ? `${student.first_name} ${student.middle_name ? `${student.middle_name.trim().charAt(0).toUpperCase()}. ` : ""}${student.last_name}`
                  : "Not Seeded"}
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
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Year Level</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {student ? `Year ${student.year_level}` : "Not Seeded"}
              </p>
            </div>

            {/* Enrolled Subjects List Section */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Enrolled Subjects</p>
                <span className="text-xs font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                  {filteredEnrolledCourses.length}
                </span>
              </div>
              {filteredEnrolledCourses.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {filteredEnrolledCourses.map((c) => (
                    <span
                      key={c.course_id}
                      title={c.course_title}
                      className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold"
                    >
                      <BookOpen className="w-3 h-3 text-blue-600" />
                      <span>{c.course_code}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No enrolled subjects for Year {student?.year_level}.</p>
              )}
            </div>

            {/* Account Security - Restricted Student Action: Change Password Only */}
            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Account Security</p>
                <span className="text-[10px] font-extrabold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  Password Edit Only
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPasswordError(null);
                  setPasswordSuccess(null);
                  setIsPasswordModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#7A151A]/20 bg-gradient-to-r from-[#7A151A]/5 to-[#7A151A]/10 hover:from-[#7A151A]/10 hover:to-[#7A151A]/20 text-[#7A151A] text-xs font-bold transition-all shadow-sm group"
              >
                <KeyRound className="w-4 h-4 text-[#7A151A] group-hover:rotate-12 transition-transform" />
                <span>Change Password</span>
              </button>
              <p className="text-[10.5px] text-slate-400 leading-tight">
                Profile details & enrolled classes are restricted and managed exclusively by course faculty.
              </p>
            </div>
          </div>
        </div>

        {/* Side Tabs Navigation (Hidden on mobile, vertical on desktop) */}
        <div className="hidden lg:block bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-3">Navigation</h3>
          <div className="flex flex-col space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm font-bold transition-all ${
                    isActive
                      ? `${tab.activeColor} border-l-4 shadow-sm`
                      : "bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${isActive ? "" : "text-slate-400"}`} />
                      {tab.pulse && (
                        <>
                          <span className={`absolute -top-1 -right-1.5 w-2.5 h-2.5 ${tab.pingColor} rounded-full animate-ping`} />
                          <span className={`absolute -top-1 -right-1.5 w-2.5 h-2.5 ${tab.dotColor} rounded-full border border-white`} />
                        </>
                      )}
                    </div>
                    <span>{tab.label}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-extrabold ${tab.badgeColor}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Tab Panel Area */}
      <div className="lg:col-span-3 space-y-6 flex flex-col">
        {/* Quick Notification Alert Banner */}
        {(activeExams.length > 0 || upcomingExams.length > 0 || missedExams.length > 0) && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-3xl border border-indigo-900/40 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-500/30 shrink-0">
                <Bell className="w-4 h-4 text-indigo-300 animate-bounce" />
              </div>
              <div className="space-y-0.5">
                <p className="font-extrabold text-white text-xs flex items-center gap-2">
                  <span>Examination Alerts</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </p>
                <p className="text-slate-300 text-[11px] flex flex-wrap items-center gap-2">
                  {activeExams.length > 0 && (
                    <span className="text-rose-300 font-bold">
                      • {activeExams.length} Live Active Exam{activeExams.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {upcomingExams.length > 0 && (
                    <span className="text-blue-300 font-bold">
                      • {upcomingExams.length} Upcoming Exam{upcomingExams.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {missedExams.length > 0 && (
                    <span className="text-amber-300 font-bold">
                      • {missedExams.length} Missed Exam{missedExams.length === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("active")}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  View Active ({activeExams.length})
                </button>
              )}
              {upcomingExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("upcoming")}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  View Upcoming ({upcomingExams.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile Tabs Bar (Visible on mobile/tablet, hidden on desktop) */}
        <div className="lg:hidden bg-white border border-slate-200 rounded-3xl p-3 shadow-sm">
          <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold whitespace-nowrap transition-all flex-1 justify-center relative ${
                    isActive
                      ? `${tab.activeColor} shadow-sm`
                      : "bg-transparent border-transparent text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                    {tab.pulse && (
                      <>
                        <span className={`absolute -top-1 -right-1 w-2 h-2 ${tab.pingColor} rounded-full animate-ping`} />
                        <span className={`absolute -top-1 -right-1 w-2 h-2 ${tab.dotColor} rounded-full border border-white`} />
                      </>
                    )}
                  </div>
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full border ${tab.badgeColor}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1">
          {activeTab === "active" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-full min-h-[300px]">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-rose-500 rounded-full animate-pulse" />
                Active Examinations
              </h2>

              {activeExams.length > 0 ? (
                <div className="space-y-4">
                  {activeExams.map((exam) => (
                    <div
                      key={exam.target?.target_id ?? exam.exam_id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between border border-slate-100 p-5 rounded-2xl bg-gradient-to-r from-rose-50/20 to-transparent hover:border-rose-100 transition-all gap-4"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Live Now
                          </span>
                          {exam.is_reopened && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-200">
                              Reopened for You
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-800 text-base mt-1">{exam.title}</h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" /> {exam.course.course_title} ({exam.course.course_code})
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Time Limit: {exam.time_limit_minutes} minutes
                        </p>
                        
                        {exam.is_reopened && (
                          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs space-y-1.5 mt-2">
                            {exam.official_schedule && (
                              <p className="text-slate-600 font-medium text-[11px] flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-bold text-slate-700">Official Exam Date:</span>{" "}
                                {new Date(exam.official_schedule.scheduled_date).toLocaleDateString([], { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                            <p className="text-amber-900 font-bold text-[11px] flex items-center gap-1.5 pt-0.5 border-t border-amber-200/60">
                              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                              <span>Your Individual Reopened Window:</span>{" "}
                              <span>{exam.target ? new Date(exam.target.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "N/A"} at {exam.target ? new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""} - {exam.target ? new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/student/exam/${exam.exam_id}`}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm hover:shadow-md self-start sm:self-auto text-center"
                      >
                        Start Exam <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-slate-100 rounded-2xl h-full">
                  <div className="bg-slate-50 p-3 rounded-full text-slate-400 mb-3">
                    <Hourglass className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No live examinations</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    There are no exams currently active for your program and year level.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "upcoming" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-full min-h-[300px]">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Upcoming Examinations
              </h2>

              {upcomingExams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingExams.map((exam, idx) => (
                    <div key={exam.target ? exam.target.target_id : `pending-${exam.exam_id}-${idx}`} className="border border-slate-200/80 p-5 rounded-2xl space-y-3 transition-all bg-white shadow-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-base leading-snug">{exam.title}</h4>
                        {exam.is_schedule_pending ? (
                          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-300 whitespace-nowrap shadow-xs">
                            Schedule Pending
                          </span>
                        ) : exam.is_reopened ? (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 whitespace-nowrap">
                            Reopened Window
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-blue-300 whitespace-nowrap shadow-xs">
                            Scheduled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {exam.course.course_title} ({exam.course.course_code})
                      </p>
                      
                      {exam.is_schedule_pending ? (
                        <div className="bg-amber-50/60 border border-amber-200/60 p-3.5 rounded-xl text-xs space-y-1.5">
                          {exam.official_schedule?.scheduled_date && (
                            <p className="text-slate-700 font-semibold flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-amber-700" />
                              Expected Date: <span className="font-extrabold text-slate-800">{new Date(exam.official_schedule.scheduled_date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</span>
                            </p>
                          )}
                          <p className="text-slate-500 text-[11px] leading-relaxed pt-1 border-t border-amber-200/60">
                            The exact schedule for this exam is currently being set. You cannot take the exam yet.
                          </p>
                        </div>
                      ) : exam.is_reopened ? (
                        <div className="bg-amber-50/80 border border-amber-200/80 p-3 rounded-xl text-xs space-y-1.5">
                          {exam.official_schedule && (
                            <p className="text-slate-600 font-medium text-[11px] flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-bold text-slate-700">Official Exam Date:</span>{" "}
                              {new Date(exam.official_schedule.scheduled_date).toLocaleDateString([], { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                          <p className="text-amber-900 font-bold text-[11px] pt-1 border-t border-amber-200/60">
                            Reopened Access Window: {exam.target ? new Date(exam.target.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "N/A"} ({exam.target ? new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""} - {exam.target ? new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""})
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3.5 rounded-xl text-xs space-y-2 border border-slate-100">
                          <p className="text-slate-700 font-semibold flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            Official Date: <span className="font-extrabold text-slate-800">{exam.target ? new Date(exam.target.scheduled_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : "N/A"}</span>
                          </p>
                          <p className="text-slate-600 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            Time Window: <span className="font-bold text-slate-800">{exam.target ? new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ""} - {exam.target ? new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ""}</span>
                          </p>
                          <p className="text-slate-600 flex items-center gap-2 pt-1.5 border-t border-slate-200/60">
                            <Hourglass className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            Exam Duration: <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">{exam.time_limit_minutes} minutes</span>
                          </p>
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-between text-xs font-semibold text-slate-400">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Lock className="w-3.5 h-3.5" /> Not Takeable Yet
                        </span>
                        <button
                          disabled
                          className="bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs px-3.5 py-2 rounded-xl cursor-not-allowed opacity-75"
                        >
                          {exam.is_schedule_pending ? "Schedule Pending" : "Not Started Yet"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-slate-100 rounded-2xl h-full">
                  <div className="bg-slate-50 p-3 rounded-full text-slate-400 mb-3">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No upcoming examinations</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    There are no upcoming examinations scheduled at the moment.
                  </p>
                </div>
              )}
            </div>
          )}



          {activeTab === "completed" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-full min-h-[300px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  Completed Examinations
                </h2>
                {completedExams.length > 0 && (
                  <button
                    onClick={() => {
                      const rows = completedExams.map((se) => {
                        const examMaxPoints = se.exam.questionBank.reduce((sum, q) => sum + q.points, 0);
                        const percentage = examMaxPoints > 0 ? Math.round((se.total_score / examMaxPoints) * 100) : 0;
                        return {
                          "Exam Title": se.exam.title,
                          "Score (pts)": se.total_score,
                          "Max Score (pts)": examMaxPoints,
                          "Percentage Grade": `${percentage}%`,
                          "Date Submitted": new Date(se.submitted_at || se.started_at).toLocaleString(),
                          "Digital Verification": "Signed by Department Chair & Academic Director"
                        };
                      });
                      const workbook = XLSX.utils.book_new();
                      const worksheet = XLSX.utils.json_to_sheet(rows);
                      worksheet["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 25 }];
                      XLSX.utils.book_append_sheet(workbook, worksheet, "My Exam Scores");
                      XLSX.writeFile(workbook, `${student.last_name}_${student.first_name}_Exam_Scores.xlsx`);
                    }}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download Scores Excel
                  </button>
                )}
              </div>

              {completedExams.length > 0 ? (
                <div className="space-y-4">
                  {completedExams.map((se) => {
                    const examMaxPoints = se.exam.questionBank.reduce((sum, q) => sum + q.points, 0);
                    const percentage = examMaxPoints > 0 ? Math.round((se.total_score / examMaxPoints) * 100) : 0;
                    return (
                      <div key={se.student_exam_id} className="border border-slate-100 hover:border-emerald-100 p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center transition-all gap-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-base">{se.exam.title}</h4>
                          <p className="text-xs text-slate-400">
                            Submitted: {new Date(se.submitted_at || se.started_at).toLocaleDateString()} at {new Date(se.submitted_at || se.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="self-start sm:self-auto">
                          <span className="inline-flex items-center text-sm font-black bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full border border-emerald-100">
                            Score: {se.total_score} / {examMaxPoints} ({percentage}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-slate-100 rounded-2xl h-full">
                  <div className="bg-slate-50 p-3 rounded-full text-slate-400 mb-3">
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No completed examinations</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    Once you submit an examination, your scores and records will appear here.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "missed" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-full min-h-[300px]">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                Missed Examinations
              </h2>

              {missedExams.length > 0 ? (
                <div className="space-y-4">
                  {missedExams.map((exam) => (
                    <div key={exam.target?.target_id ?? exam.exam_id} className="border border-slate-100 p-5 rounded-2xl space-y-3 bg-slate-50/50 opacity-90 hover:opacity-100 transition-all">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-700 text-base line-through">{exam.title}</h4>
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-rose-200 shadow-sm">
                          Missed
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {exam.course.course_title} ({exam.course.course_code})
                      </p>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>Scheduled: {exam.target ? new Date(exam.target.scheduled_date).toLocaleDateString([], { timeZone: 'UTC' }) : "N/A"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-slate-100 rounded-2xl h-full">
                  <div className="bg-emerald-50 p-3 rounded-full text-emerald-600 mb-3">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No missed examinations!</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    Great job keeping up with your schedule! You have not missed any examinations.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#7A151A]/10 text-[#7A151A] flex items-center justify-center border border-[#7A151A]/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    {mustUpdatePassword ? "Mandatory Password Setup" : "Update Account Password"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {mustUpdatePassword 
                      ? "Your instructor enrolled your account. Please set a new password."
                      : "Secure your AcadNexus student account"}
                  </p>
                </div>
              </div>
              {!mustUpdatePassword && (
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Notice if first-time / mandatory */}
            {mustUpdatePassword && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Initial Setup: </span>
                  Your initial temporary password was set to your Student ID (<code className="font-mono font-bold">{institutionalId}</code>). Enter it below as your current password to choose a secure password.
                </div>
              </div>
            )}

            {/* Error & Success Messages */}
            {passwordError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-emerald-800">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current / Initial Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={mustUpdatePassword ? `Enter ${institutionalId}` : "••••••••"}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#7A151A] rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 chars, uppercase, symbol, number"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#7A151A] rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#7A151A] rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                {!mustUpdatePassword && (
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#7A151A] hover:bg-[#580B0F] text-white py-2.5 rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-75"
                >
                  {isSavingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#FBB017]" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
