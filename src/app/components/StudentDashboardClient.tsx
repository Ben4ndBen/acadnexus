"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  BookOpen, Calendar, Award, ShieldAlert, Clock, CheckCircle, 
  Hourglass, ArrowRight, ShieldCheck, Download
} from "lucide-react";
import * as XLSX from "xlsx";

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

interface Exam {
  exam_id: number;
  title: string;
  time_limit_minutes: number;
  course: Course;
  target: Target;
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
  userId
}: StudentDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("active");

  const tabs = [
    {
      id: "active" as TabType,
      label: "Active Exams",
      count: activeExams.length,
      icon: Clock,
      badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
      activeColor: "bg-rose-50 border-rose-500 text-rose-700",
      pulse: activeExams.length > 0,
    },
    {
      id: "upcoming" as TabType,
      label: "Upcoming Exams",
      count: upcomingExams.length,
      icon: Calendar,
      badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
      activeColor: "bg-blue-50 border-blue-500 text-blue-700",
      pulse: false,
    },
    {
      id: "completed" as TabType,
      label: "Completed Exams",
      count: completedExams.length,
      icon: Award,
      badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
      activeColor: "bg-emerald-50 border-emerald-500 text-emerald-700",
      pulse: false,
    },
    {
      id: "missed" as TabType,
      label: "Missed Exams",
      count: missedExams.length,
      icon: ShieldAlert,
      badgeColor: missedExams.length > 0 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-500 border-slate-200",
      activeColor: "bg-amber-50 border-amber-500 text-amber-700",
      pulse: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar with Profile & Side Tab Buttons */}
      <div className="lg:col-span-1 space-y-6">
        {/* Profile Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
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
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Section / Major</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">
                  {student ? student.section : "Not Seeded"}
                </p>
              </div>
            </div>

            {/* Enrolled Subjects List Section */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Enrolled Subjects</p>
                <span className="text-xs font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                  {enrolledSubjectsCount}
                </span>
              </div>
              {enrolledCourses.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {enrolledCourses.map((c) => (
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
                <p className="text-xs text-slate-400 italic">No enrolled subjects registered.</p>
              )}
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
                    <div className="relative">
                      <Icon className={`w-5 h-5 ${isActive ? "" : "text-slate-400"}`} />
                      {tab.pulse && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
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
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold whitespace-nowrap transition-all flex-1 justify-center ${
                    isActive
                      ? `${tab.activeColor} shadow-sm`
                      : "bg-transparent border-transparent text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
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
                      key={exam.target.target_id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between border border-slate-100 p-5 rounded-2xl bg-gradient-to-r from-rose-50/20 to-transparent hover:border-rose-100 transition-all gap-4"
                    >
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
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit mt-1.5 shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Digitally Signed by Chairperson & Director for Instruction
                        </div>
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
                    There are no exams currently active for your section.
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
                  {upcomingExams.map((exam) => (
                    <div key={exam.target.target_id} className="border border-slate-100 hover:border-blue-100 p-5 rounded-2xl space-y-3 transition-all">
                      <h4 className="font-bold text-slate-800 text-base leading-snug">{exam.title}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        {exam.course.course_title} ({exam.course.course_code})
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Digitally Signed by Chairperson & Director for Instruction
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1.5 border border-slate-100">
                        <p className="text-slate-700 font-semibold flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Date: {new Date(exam.target.scheduled_date).toLocaleDateString([], { timeZone: 'UTC' })}
                        </p>
                        <p className="text-slate-500 flex items-center gap-2 pl-3.5">
                          Time: {new Date(exam.target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} - {new Date(exam.target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                        </p>
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
                          "Digital Verification": "Signed by Chair & DI"
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
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit mt-1.5 shadow-sm">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Digitally Signed by Chairperson & Director for Instruction
                          </div>
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
                    <div key={exam.target.target_id} className="border border-slate-100 p-5 rounded-2xl space-y-3 bg-slate-50/50 opacity-90 hover:opacity-100 transition-all">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-700 text-base line-through">{exam.title}</h4>
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-rose-200 shadow-sm">
                          Missed
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {exam.course.course_title} ({exam.course.course_code})
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Digitally Signed by Chairperson & Director for Instruction
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>Scheduled: {new Date(exam.target.scheduled_date).toLocaleDateString([], { timeZone: 'UTC' })}</span>
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
    </div>
  );
}
