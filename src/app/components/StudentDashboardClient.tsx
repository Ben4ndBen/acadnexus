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
  submission_trigger?: string;
  violations_count?: number;
  can_show_results?: boolean;
  result_status_label?: string;
  result_explanation?: string;
  exam: {
    title: string;
    course?: Course | null;
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

type TabType = "upcoming" | "active" | "completed" | "missed";

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
    return "upcoming";
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
      icon: AlertCircle,
      badgeColor: missedExams.length > 0 ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-500 border-slate-200",
      activeColor: "bg-rose-50 border-rose-500 text-rose-700",
      pulse: false,
      dotColor: "bg-rose-500",
      pingColor: "bg-rose-400",
    },
  ];


  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar with Profile & Side Tab Buttons */}
      <div className="lg:col-span-1 space-y-6">
        {/* Profile Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5 whitespace-nowrap min-w-0">
              <span className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: deptTheme.colors.primary }} />
              <span>Academic Profile</span>
            </h2>
            <DepartmentBadge
              department={student?.program?.department?.department_name}
              programCode={student?.program?.program_code}
              size="xs"
              showPortalSuffix={true}
              className="shrink-0"
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
                Profile details and enrolled subjects are managed by your school and teachers.
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
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                <Bell className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-xs">Exam Reminders</p>
                <p className="text-slate-500 text-[11px] flex flex-wrap items-center gap-2 mt-0.5">
                  {activeExams.length > 0 && (
                    <span className="text-rose-600 font-semibold">
                      • {activeExams.length} active exam{activeExams.length === 1 ? "" : "s"} ready to take
                    </span>
                  )}
                  {upcomingExams.length > 0 && (
                    <span className="text-blue-600 font-semibold">
                      • {upcomingExams.length} upcoming exam{upcomingExams.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {missedExams.length > 0 && (
                    <span className="text-slate-500 font-medium">
                      • {missedExams.length} missed exam{missedExams.length === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("active")}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  Go to Active ({activeExams.length})
                </button>
              )}
              {upcomingExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("upcoming")}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  View Upcoming ({upcomingExams.length})
                </button>
              )}
              {missedExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("missed")}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  View Missed ({missedExams.length})
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
          {activeTab === "upcoming" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-full min-h-[300px]">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Upcoming Exams
              </h2>

              {upcomingExams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingExams.map((exam, idx) => (
                    <div key={exam.target ? exam.target.target_id : `pending-${exam.exam_id}-${idx}`} className="border border-slate-200/80 p-5 rounded-2xl space-y-3 transition-all bg-white shadow-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-base leading-snug">{exam.title}</h4>
                        {exam.is_schedule_pending ? (
                          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-300 whitespace-nowrap shadow-xs">
                            Schedule Coming Soon
                          </span>
                        ) : exam.is_reopened ? (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 whitespace-nowrap">
                            Special Schedule
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-blue-300 whitespace-nowrap shadow-xs">
                            Scheduled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {exam.course?.course_title || "Course"} {exam.course?.course_code ? `(${exam.course.course_code})` : ""}
                      </p>
                      
                      {exam.is_schedule_pending ? (
                        <div className="bg-amber-50/60 border border-amber-200/60 p-3.5 rounded-xl text-xs space-y-1.5">
                          {exam.official_schedule?.scheduled_date && (
                            <p className="text-slate-700 font-semibold flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-amber-700" />
                              Target Date: <span className="font-extrabold text-slate-800">{new Date(exam.official_schedule.scheduled_date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</span>
                            </p>
                          )}
                          <p className="text-slate-500 text-[11px] leading-relaxed pt-1 border-t border-amber-200/60">
                            Your teacher is setting the date and time. Check back soon.
                          </p>
                        </div>
                      ) : exam.is_reopened ? (
                        <div className="bg-amber-50/80 border border-amber-200/80 p-3 rounded-xl text-xs space-y-1.5">
                          {exam.official_schedule && (
                            <p className="text-slate-600 font-medium text-[11px] flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-bold text-slate-700">Exam Date:</span>{" "}
                              {new Date(exam.official_schedule.scheduled_date).toLocaleDateString([], { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                          <p className="text-amber-900 font-bold text-[11px] pt-1 border-t border-amber-200/60">
                            Your Special Exam Schedule: {exam.target ? new Date(exam.target.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "N/A"} ({exam.target ? new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""} - {exam.target ? new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""})
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3.5 rounded-xl text-xs space-y-2 border border-slate-100">
                          <p className="text-slate-700 font-semibold flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            Exam Date: <span className="font-extrabold text-slate-800">{exam.target ? new Date(exam.target.scheduled_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : "N/A"}</span>
                          </p>
                          <p className="text-slate-600 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            Available Time: <span className="font-bold text-slate-800">{exam.target ? new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ""} - {exam.target ? new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ""}</span>
                          </p>
                          <p className="text-slate-600 flex items-center gap-2 pt-1.5 border-t border-slate-200/60">
                            <Hourglass className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            Time Limit: <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">{exam.time_limit_minutes} minutes</span>
                          </p>
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-between text-xs font-semibold text-slate-400">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Lock className="w-3.5 h-3.5" /> Not available yet
                        </span>
                        <button
                          disabled
                          className="bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs px-3.5 py-2 rounded-xl cursor-not-allowed opacity-75"
                        >
                          {exam.is_schedule_pending ? "Coming Soon" : "Not Started Yet"}
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
                  <h3 className="font-bold text-slate-700 text-sm">No upcoming exams</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    You do not have any upcoming exams scheduled right now.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "active" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-full min-h-[300px]">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-rose-500 rounded-full animate-pulse" />
                Active Exams
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
                            Available Now
                          </span>
                          {(exam as any).is_in_progress && (
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-indigo-200">
                              In Progress
                            </span>
                          )}
                          {exam.is_reopened && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-200">
                              Special Schedule
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-800 text-base mt-1">{exam.title}</h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" /> {exam.course?.course_title || "Course"} {exam.course?.course_code ? `(${exam.course.course_code})` : ""}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Time Limit: {exam.time_limit_minutes} minutes
                        </p>
                        
                        {exam.is_reopened && (
                          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs space-y-1.5 mt-2">
                            {exam.official_schedule && (
                              <p className="text-slate-600 font-medium text-[11px] flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-bold text-slate-700">Exam Date:</span>{" "}
                                {new Date(exam.official_schedule.scheduled_date).toLocaleDateString([], { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                            <p className="text-amber-900 font-bold text-[11px] flex items-center gap-1.5 pt-0.5 border-t border-amber-200/60">
                              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                              <span>Your Special Exam Time:</span>{" "}
                              <span>{exam.target ? new Date(exam.target.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "N/A"} at {exam.target ? new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""} - {exam.target ? new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/student/exam/${exam.exam_id}`}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm hover:shadow-md self-start sm:self-auto text-center"
                      >
                        {(exam as any).is_in_progress ? "Continue Exam" : "Take Exam"} <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-slate-100 rounded-2xl h-full">
                  <div className="bg-slate-50 p-3 rounded-full text-slate-400 mb-3">
                    <Hourglass className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No active exams</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    There are no exams available to take right now.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "completed" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-full min-h-[300px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  Completed Exams
                </h2>
                {completedExams.length > 0 && (
                  <button
                    onClick={() => {
                      const rows = completedExams.map((se) => {
                        const examMaxPoints = se.exam.questionBank.reduce((sum, q) => sum + q.points, 0);
                        const isResultsHidden = se.can_show_results === false;
                        const percentage = isResultsHidden ? "Pending" : (examMaxPoints > 0 ? `${Math.round((se.total_score / examMaxPoints) * 100)}%` : "0%");
                        let statusText = "Submitted";
                        if (se.submission_trigger === "Timeout") statusText = "Auto-Submitted (Time Ran Out)";
                        else if (se.submission_trigger === "Cheating_Lockout") statusText = "Closed (Rules Broken)";
                        return {
                          "Exam Title": se.exam.title,
                          "Status": statusText,
                          "Score (pts)": isResultsHidden ? (se.result_status_label || "Results Pending") : se.total_score,
                          "Max Score (pts)": examMaxPoints,
                          "Percentage Grade": percentage,
                          "Date Submitted": new Date(se.submitted_at || se.started_at).toLocaleString(),
                        };
                      });
                      const workbook = XLSX.utils.book_new();
                      const worksheet = XLSX.utils.json_to_sheet(rows);
                      worksheet["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 22 }];
                      XLSX.utils.book_append_sheet(workbook, worksheet, "My Exam Scores");
                      XLSX.writeFile(workbook, `${student.last_name}_${student.first_name}_Exam_Scores.xlsx`);
                    }}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Download className="w-4 h-4" />
                    Download Scores (Excel)
                  </button>
                )}
              </div>

              {completedExams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-slate-100 rounded-2xl h-full">
                  <div className="bg-slate-50 p-3 rounded-full text-slate-400 mb-3">
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No completed exams</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    You haven't completed any exams yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedExams.map((se) => {
                    const examMaxPoints = se.exam.questionBank.reduce((sum, q) => sum + q.points, 0);
                    const percentage = examMaxPoints > 0 ? Math.round((se.total_score / examMaxPoints) * 100) : 0;
                    const isLockout = se.submission_trigger === "Cheating_Lockout";
                    const isTimeout = se.submission_trigger === "Timeout";

                    return (
                      <div
                        key={se.student_exam_id}
                        className={`border p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center transition-all gap-4 ${
                          isLockout
                            ? "border-rose-200 bg-rose-50/30 hover:border-rose-300"
                            : isTimeout
                            ? "border-amber-200 bg-amber-50/20 hover:border-amber-300"
                            : "border-slate-100 hover:border-emerald-100"
                        }`}
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isLockout ? (
                              <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                                Closed (Test Rules Broken)
                              </span>
                            ) : isTimeout ? (
                              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Time Ran Out (Auto-Submitted)
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Completed
                              </span>
                            )}
                            {se.violations_count && se.violations_count > 0 ? (
                              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                Penalty applied for switching screens
                              </span>
                            ) : null}
                          </div>
                          <h4 className="font-bold text-slate-800 text-base">{se.exam.title}</h4>
                          <p className="text-xs text-slate-400">
                            {se.exam.course ? `${se.exam.course.course_title} (${se.exam.course.course_code}) • ` : ""}
                            Submitted: {new Date(se.submitted_at || se.started_at).toLocaleDateString()} at {new Date(se.submitted_at || se.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {isLockout && (
                            <p className="text-[11px] text-rose-700 font-medium">
                              Your exam was submitted automatically because test rules were broken (like switching tabs or leaving full screen).
                            </p>
                          )}
                          {isTimeout && (
                            <p className="text-[11px] text-amber-700 font-medium">
                              Your exam was submitted automatically because your exam time ran out.
                            </p>
                          )}
                        </div>
                        <div className="self-start sm:self-auto shrink-0">
                          {se.can_show_results === false ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              {se.result_status_label || "Results Pending Review"}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center text-sm font-black px-3.5 py-1.5 rounded-full border ${
                              isLockout 
                                ? "bg-rose-100 text-rose-800 border-rose-200"
                                : isTimeout
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            }`}>
                              Score: {se.total_score} / {examMaxPoints} ({percentage}%)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "missed" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-full min-h-[300px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  Missed Exams
                </h2>
              </div>

              {missedExams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-slate-100 rounded-2xl h-full">
                  <div className="bg-emerald-50 p-3 rounded-full text-emerald-600 mb-3">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No missed exams</h3>
                  <p className="text-slate-400 text-xs max-w-xs mt-1">
                    Great job! You haven't missed any exams.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {missedExams.map((exam) => (
                    <div
                      key={exam.target?.target_id ?? exam.exam_id}
                      className="border border-slate-200/80 p-5 rounded-2xl space-y-2 bg-slate-50/60 opacity-90 hover:opacity-100 transition-all"
                    >
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-rose-200 shadow-xs flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              Missed Exam
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-base">{exam.title}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        {exam.course?.course_title || "Course"} {exam.course?.course_code ? `(${exam.course.course_code})` : ""}
                      </p>
                      <div className="text-xs text-slate-500 flex items-center gap-2 pt-1 border-t border-slate-200/50">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>
                          Scheduled: {exam.target ? new Date(exam.target.scheduled_date).toLocaleDateString([], { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : "N/A"}{" "}
                          {exam.target ? `@ ${new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} - ${new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}` : ""}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-600 font-medium pt-0.5">
                        The scheduled time for this exam has passed.
                      </p>
                    </div>
                  ))}
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
