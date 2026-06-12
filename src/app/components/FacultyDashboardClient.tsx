"use client";

import { useState } from "react";
import { 
  BookOpen, Award, FileText, ClipboardList, PenTool, CheckCircle, 
  User, Shield, Settings, Activity, Send, RotateCcw, AlertCircle, RefreshCw, Mail
} from "lucide-react";
import { updateFacultyProfile, updateExamStatus } from "@/app/actions/faculty";

interface FacultyDashboardClientProps {
  faculty: {
    faculty_id: number;
    first_name: string;
    last_name: string;
    department: {
      department_name: string;
    } | null;
    examinations: Array<{
      exam_id: number;
      title: string;
      time_limit_minutes: number;
      current_status: "Draft" | "Pending_Chair" | "Pending_DI" | "Approved" | "Returned";
      course: {
        course_code: string;
        course_title: string;
      };
      approvalWorkflow: {
        chair_comments: string | null;
        chair_review_status: string;
        di_review_status: string;
      } | null;
    }>;
    facultyPortfolios: Array<{
      portfolio_id: number;
      academic_year: string;
      semester: number;
      total_exams_created: number;
      compliance_percentage: any;
    }>;
  };
  institutionalId: string;
}

export function FacultyDashboardClient({ faculty, institutionalId }: FacultyDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "tracker" | "profile">("overview");
  
  // Profile form state
  const [firstName, setFirstName] = useState(faculty.first_name);
  const [lastName, setLastName] = useState(faculty.last_name);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Status transition loading state
  const [transitioningExamId, setTransitioningExamId] = useState<number | null>(null);
  
  // Tracker Filter State
  const [trackerFilter, setTrackerFilter] = useState<string>("ALL");

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);

    const res = await updateFacultyProfile(faculty.faculty_id, firstName, lastName);
    setIsSavingProfile(false);
    
    if (res.success) {
      setProfileMessage({ type: "success", text: "Profile details updated successfully!" });
    } else {
      setProfileMessage({ type: "error", text: res.error || "Failed to update profile." });
    }
  };

  const handleStatusTransition = async (examId: number, nextStatus: "Draft" | "Pending_Chair" | "Pending_DI" | "Approved" | "Returned") => {
    setTransitioningExamId(examId);
    const res = await updateExamStatus(examId, nextStatus, faculty.faculty_id);
    setTransitioningExamId(null);
    
    if (res.error) {
      alert(res.error);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Draft":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
            Draft
          </span>
        );
      case "Pending_Chair":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Chair Review
          </span>
        );
      case "Pending_DI":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Pending DI Clearance
          </span>
        );
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case "Returned":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Returned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-full">
            {status}
          </span>
        );
    }
  };

  // Filtered Exams
  const filteredExams = faculty.examinations.filter((exam) => {
    if (trackerFilter === "ALL") return true;
    return exam.current_status === trackerFilter;
  });

  return (
    <div className="space-y-8">
      {/* Dashboard Sub-navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white p-2 rounded-2xl shadow-sm gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "overview"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          Dashboard Overview
        </button>
        <button
          onClick={() => setActiveTab("tracker")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "tracker"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Examination Workflow Tracker
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "profile"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <User className="w-4 h-4" />
          Profile Settings
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel: Portfolios & Overview Stats */}
          <div className="space-y-8">
            {/* Quick Profile Summary */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Institutional Info
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Instructor</p>
                    <p className="text-sm font-bold text-slate-800">{faculty.first_name} {faculty.last_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Shield className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Department</p>
                    <p className="text-sm font-bold text-slate-800">{faculty.department?.department_name || "Not Seeded"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Mail className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Institutional Email</p>
                    <p className="text-sm font-bold text-slate-800">{institutionalId.toLowerCase()}@acadnexus.bsc.edu.ph</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Matrix */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Compliance Portfolio
              </h2>
              {faculty.facultyPortfolios && faculty.facultyPortfolios.length > 0 ? (
                <div className="space-y-4">
                  {faculty.facultyPortfolios.map((portfolio) => (
                    <div key={portfolio.portfolio_id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold text-slate-700">AY {portfolio.academic_year} (Sem {portfolio.semester})</span>
                        <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                          {portfolio.compliance_percentage.toString()}% Compliance
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Number(portfolio.compliance_percentage)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">Total Exams: {portfolio.total_exams_created}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">No compliance statistics recorded yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Recent Exams and Quick Actions */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Recent Examinations
              </h2>
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all hover:scale-105 duration-300">
                + Create Exam
              </button>
            </div>

            {faculty.examinations && faculty.examinations.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {faculty.examinations.slice(0, 5).map((exam) => (
                  <div key={exam.exam_id} className="py-4 flex justify-between items-center first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-slate-800">{exam.title}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                        <span>{exam.course.course_code} - {exam.course.course_title}</span>
                        <span>•</span>
                        <span>{exam.time_limit_minutes} min</span>
                      </div>
                    </div>
                    <div>
                      {renderStatusBadge(exam.current_status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-4">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">No examinations created</h3>
                <p className="text-slate-500 text-xs max-w-xs mt-1">
                  Start by drafting your first examination question bank to assign to your students.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRACKER TAB */}
      {activeTab === "tracker" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Examination Workflow Tracker
              </h2>
              <p className="text-slate-500 text-xs mt-1">Track the multi-tier review status of all course examinations.</p>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              {["ALL", "Draft", "Pending_Chair", "Pending_DI", "Approved", "Returned"].map((status) => (
                <button
                  key={status}
                  onClick={() => setTrackerFilter(status)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                    trackerFilter === status
                      ? "bg-white text-emerald-700 shadow-sm border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {status === "ALL" ? "All" : status.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {filteredExams.length > 0 ? (
            <div className="space-y-6">
              {filteredExams.map((exam) => {
                const isTransitioning = transitioningExamId === exam.exam_id;
                
                return (
                  <div 
                    key={exam.exam_id} 
                    className="border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-slate-50/30"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-bold text-slate-900">{exam.title}</h3>
                          {renderStatusBadge(exam.current_status)}
                        </div>
                        <p className="text-xs text-emerald-700 font-semibold mt-1">
                          {exam.course.course_code} - {exam.course.course_title}
                        </p>
                      </div>

                      {/* Interactive Actions for testing and state transitions */}
                      <div className="flex items-center gap-2">
                        {exam.current_status === "Draft" && (
                          <button
                            disabled={isTransitioning}
                            onClick={() => handleStatusTransition(exam.exam_id, "Pending_Chair")}
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all duration-300"
                          >
                            {isTransitioning ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            Submit for Review
                          </button>
                        )}
                        {exam.current_status === "Returned" && (
                          <button
                            disabled={isTransitioning}
                            onClick={() => handleStatusTransition(exam.exam_id, "Draft")}
                            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-950 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all duration-300"
                          >
                            {isTransitioning ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Revise & Reset to Draft
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timeline Tracker */}
                    <div className="py-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-0">
                        {/* Step 1: Draft */}
                        <div className="relative flex flex-col items-center text-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 z-10 transition-all ${
                            ["Draft", "Pending_Chair", "Pending_DI", "Approved", "Returned"].includes(exam.current_status)
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-white border-slate-200 text-slate-400"
                          }`}>
                            1
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 mt-2">Draft Mode</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Authoring phase</p>
                          <div className="hidden md:block absolute left-1/2 right-0 top-4 h-[2px] bg-emerald-600 -z-0" />
                        </div>

                        {/* Step 2: Chair Review */}
                        <div className="relative flex flex-col items-center text-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 z-10 transition-all ${
                            ["Pending_Chair", "Pending_DI", "Approved", "Returned"].includes(exam.current_status)
                              ? exam.current_status === "Returned" && exam.approvalWorkflow?.chair_review_status === "Returned"
                                ? "bg-rose-500 border-rose-500 text-white"
                                : "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-white border-slate-200 text-slate-400"
                          }`}>
                            2
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 mt-2">Chair Approval</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Departmental audit</p>
                          <div className={`hidden md:block absolute left-0 right-1/2 top-4 h-[2px] -z-0 ${
                            ["Pending_Chair", "Pending_DI", "Approved", "Returned"].includes(exam.current_status) ? "bg-emerald-600" : "bg-slate-200"
                          }`} />
                          <div className={`hidden md:block absolute left-1/2 right-0 top-4 h-[2px] -z-0 ${
                            ["Pending_DI", "Approved"].includes(exam.current_status) ? "bg-emerald-600" : "bg-slate-200"
                          }`} />
                        </div>

                        {/* Step 3: DI Clearance */}
                        <div className="relative flex flex-col items-center text-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 z-10 transition-all ${
                            ["Pending_DI", "Approved"].includes(exam.current_status)
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-white border-slate-200 text-slate-400"
                          }`}>
                            3
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 mt-2">DI Clearance</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Director verification</p>
                          <div className={`hidden md:block absolute left-0 right-1/2 top-4 h-[2px] -z-0 ${
                            ["Pending_DI", "Approved"].includes(exam.current_status) ? "bg-emerald-600" : "bg-slate-200"
                          }`} />
                          <div className={`hidden md:block absolute left-1/2 right-0 top-4 h-[2px] -z-0 ${
                            exam.current_status === "Approved" ? "bg-emerald-600" : "bg-slate-200"
                          }`} />
                        </div>

                        {/* Step 4: Approved */}
                        <div className="relative flex flex-col items-center text-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 z-10 transition-all ${
                            exam.current_status === "Approved"
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-white border-slate-200 text-slate-400"
                          }`}>
                            4
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 mt-2">Active / Live</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Targeted to students</p>
                          <div className={`hidden md:block absolute left-0 right-1/2 top-4 h-[2px] -z-0 ${
                            exam.current_status === "Approved" ? "bg-emerald-600" : "bg-slate-200"
                          }`} />
                        </div>
                      </div>
                    </div>

                    {/* Returned Comments Showcase */}
                    {exam.current_status === "Returned" && exam.approvalWorkflow?.chair_comments && (
                      <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex gap-3 items-start">
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-800">Returned by Department Chair:</p>
                          <p className="text-xs text-rose-700 mt-1 italic leading-relaxed">
                            "{exam.approvalWorkflow.chair_comments}"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl">
              <p className="text-slate-500 text-xs">No examinations found in this status category.</p>
            </div>
          )}
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
              Information Management
            </h2>
            <p className="text-slate-500 text-xs mt-1">Manage and update your institutional and personal details.</p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {profileMessage && (
              <div className={`p-4 rounded-xl border text-xs font-bold ${
                profileMessage.type === "success" 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                  : "bg-rose-50 text-rose-800 border-rose-100"
              }`}>
                {profileMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium px-4 py-2.5 rounded-xl transition-all duration-300"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium px-4 py-2.5 rounded-xl transition-all duration-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">Institutional ID (Read-only)</label>
                <input
                  type="text"
                  disabled
                  value={institutionalId}
                  className="w-full bg-slate-100 border border-slate-200 text-slate-500 text-sm font-bold px-4 py-2.5 rounded-xl cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">Department (Read-only)</label>
                <input
                  type="text"
                  disabled
                  value={faculty.department?.department_name || "Batanes State College"}
                  className="w-full bg-slate-100 border border-slate-200 text-slate-500 text-sm font-bold px-4 py-2.5 rounded-xl cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-sm transition-all hover:scale-105 duration-300"
              >
                {isSavingProfile ? "Saving Changes..." : "Save Profile Details"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
