"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  BookOpen, Award, FileText, ClipboardList, PenTool, CheckCircle, 
  User, Shield, Settings, Activity, Send, RotateCcw, AlertCircle, RefreshCw, Mail,
  Plus, Trash2, Calendar, Lock, Camera, Check, ShieldAlert, Loader2
} from "lucide-react";
import { updateFacultyProfile, updateExamStatus, createExamDraft, deleteExam, scheduleExamTarget, configureFacultyAccount } from "@/app/actions/faculty";

interface FacultyDashboardClientProps {
  faculty: {
    faculty_id: number;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    institutional_email?: string | null;
    profile_image?: string | null;
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
      questionBank?: Array<{
        question_id: number;
        question_text: string;
        points: number;
      }>;
      _count?: {
        questionBank: number;
      };
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
  programs?: Array<{ program_id: number; program_code: string; program_name: string; department_id: number }>;
  requirePasswordUpdate?: boolean;
  username?: string;
}

export function FacultyDashboardClient({ 
  faculty, 
  institutionalId, 
  programs = [], 
  requirePasswordUpdate = false, 
  username 
}: FacultyDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "tracker" | "profile">("overview");
  
  // Account Configuration form state
  const [configPassword, setConfigPassword] = useState("");
  const [configConfirmPassword, setConfigConfirmPassword] = useState("");
  const [configEmail, setConfigEmail] = useState(faculty.institutional_email || "");
  const [configImage, setConfigImage] = useState<File | null>(null);
  const [configImagePreview, setConfigImagePreview] = useState<string | null>(faculty.profile_image || null);
  const [configMessage, setConfigMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isConfiguring, startConfigureTransition] = useTransition();

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (configPassword !== configConfirmPassword) {
      setConfigMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (configPassword.length < 8) {
      setConfigMessage({ type: "error", text: "Password must be at least 8 characters long." });
      return;
    }

    const formData = new FormData();
    formData.append("newPassword", configPassword);
    formData.append("institutionalEmail", configEmail);
    if (configImage) {
      formData.append("profileImage", configImage);
    }

    setConfigMessage(null);
    startConfigureTransition(async () => {
      const res = await configureFacultyAccount(faculty.faculty_id, formData);
      if (res.success) {
        setConfigMessage({ type: "success", text: "Account configured successfully! Unlocking dashboard..." });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setConfigMessage({ type: "error", text: res.error || "Failed to configure account." });
      }
    });
  };
  
  // Profile form state
  const [firstName, setFirstName] = useState(faculty.first_name);
  const [lastName, setLastName] = useState(faculty.last_name);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Status transition loading state
  const [transitioningExamId, setTransitioningExamId] = useState<number | null>(null);

  // Draft Creation & Deletion loading states
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<number | null>(null);
  
  // Tracker Filter State
  const [trackerFilter, setTrackerFilter] = useState<string>("ALL");

  // Schedule Exam Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedExamForSchedule, setSelectedExamForSchedule] = useState<{exam_id: number, title: string} | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    program_id: "",
    year_level: "1",
    section: "A",
    scheduled_date: "",
    start_time: "",
    end_time: ""
  });
  const [isScheduling, setIsScheduling] = useState(false);

  const handleOpenScheduleModal = (examId: number, title: string) => {
    setSelectedExamForSchedule({ exam_id: examId, title });
    setScheduleModalOpen(true);
    setScheduleForm({
      program_id: programs.length > 0 ? String(programs[0].program_id) : "",
      year_level: "1",
      section: "A",
      scheduled_date: new Date().toISOString().split("T")[0],
      start_time: "09:00",
      end_time: "10:00"
    });
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForSchedule) return;

    setIsScheduling(true);
    const res = await scheduleExamTarget(
      faculty.faculty_id,
      selectedExamForSchedule.exam_id,
      Number(scheduleForm.program_id),
      Number(scheduleForm.year_level),
      scheduleForm.section,
      scheduleForm.scheduled_date,
      scheduleForm.start_time,
      scheduleForm.end_time
    );
    setIsScheduling(false);

    if (res.error) {
      alert(res.error);
    } else {
      setScheduleModalOpen(false);
      router.refresh();
      alert("Examination scheduled successfully!");
    }
  };

  const handleCreateExam = async () => {
    setIsCreatingExam(true);
    const res = await createExamDraft(faculty.faculty_id);
    setIsCreatingExam(false);
    
    if (res.error) {
      alert(res.error);
    } else if (res.exam_id) {
      router.push(`/dashboard/faculty/exams/${res.exam_id}/builder`);
    }
  };

  const handleDeleteExam = async (examId: number) => {
    if (!confirm("Are you sure you want to permanently delete this examination draft? All associated questions will be removed.")) {
      return;
    }
    setDeletingExamId(examId);
    const res = await deleteExam(examId, faculty.faculty_id);
    setDeletingExamId(null);
    
    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);

    const res = await updateFacultyProfile(faculty.faculty_id, firstName, lastName);
    setIsSavingProfile(false);
    
    if (res.success) {
      setProfileMessage({ type: "success", text: "Profile details updated successfully!" });
      router.refresh();
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
    } else {
      router.refresh();
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

  if (requirePasswordUpdate) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2 border-b border-slate-100 pb-5">
          <div className="bg-[#7A151A]/10 text-[#7A151A] p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-[#7A151A]/20">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Secure Account Configuration</h2>
          <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
            Welcome to AcadNexus! Because you recently signed up, Batanes State College security policy requires you to configure your institutional email, upload a profile image, and update your temporary password immediately before accessing the dashboard pipeline.
          </p>
        </div>

        <form onSubmit={handleConfigSubmit} className="space-y-6">
          {configMessage && (
            <div className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-3 ${
              configMessage.type === "success" 
                ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                : "bg-rose-50 text-rose-800 border-rose-100"
            }`}>
              {configMessage.type === "success" ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <p>{configMessage.text}</p>
            </div>
          )}

          {/* Profile Image Upload */}
          <div className="space-y-3">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Profile Image</label>
            <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-slate-350 bg-white flex items-center justify-center group/avatar shrink-0">
                {configImagePreview ? (
                  <img src={configImagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-slate-400" />
                )}
                <label className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white cursor-pointer transition-all duration-300">
                  <Camera className="w-5 h-5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setConfigImage(file);
                        setConfigImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              </div>
              <div className="text-center sm:text-left space-y-1">
                <p className="text-xs font-bold text-slate-700">Upload your profile photo</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Supported formats: JPG, PNG, WEBP. Max size 2MB. This image will be printed onto your digital faculty identity card.
                </p>
              </div>
            </div>
          </div>

          {/* Institutional Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Institutional Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
              <input
                type="email"
                required
                value={configEmail}
                onChange={(e) => setConfigEmail(e.target.value)}
                placeholder="e.g. mark.abad@acadnexus.bsc.edu.ph"
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#7A151A]/20 focus:border-[#7A151A] text-sm font-medium text-slate-900 pl-11 pr-4 py-2.5 rounded-xl transition-all duration-300"
              />
            </div>
          </div>

          {/* New Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">New Secure Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={configPassword}
                  onChange={(e) => setConfigPassword(e.target.value)}
                  placeholder="•••••••• (Min 8 chars)"
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#7A151A]/20 focus:border-[#7A151A] text-sm font-medium text-slate-900 pl-11 pr-4 py-2.5 rounded-xl transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={configConfirmPassword}
                  onChange={(e) => setConfigConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#7A151A]/20 focus:border-[#7A151A] text-sm font-medium text-slate-900 pl-11 pr-4 py-2.5 rounded-xl transition-all duration-300"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isConfiguring}
            className="w-full relative flex items-center justify-center bg-[#7A151A] hover:bg-[#580B0F] text-white font-bold rounded-xl py-3.5 text-sm shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#7A151A] focus:ring-offset-2 transition-all duration-300 disabled:opacity-85 disabled:cursor-not-allowed overflow-hidden group"
          >
            {isConfiguring ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#FBB017]" />
                <span>Applying Secure Configurations...</span>
              </div>
            ) : (
              <span>Save & Activate Account</span>
            )}
          </button>
        </form>
      </div>
    );
  }

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
            {/* Premium Faculty Identity Card */}
            <div className="bg-gradient-to-b from-[#7A151A] to-[#580B0F] rounded-3xl overflow-hidden shadow-lg border-2 border-[#E2A123]/60 relative text-white transition-all duration-500 hover:shadow-2xl hover:scale-[1.01] group/idcard select-none">
              {/* Card Holographic/Vector overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px] opacity-40 pointer-events-none" />
              <div className="absolute top-0 right-0 w-24 h-full bg-[#E2A123]/5 transform skew-x-12 origin-top-right pointer-events-none" />
              
              {/* ID Card Header */}
              <div className="bg-[#580B0F] px-5 py-4 border-b border-[#E2A123]/30 flex items-center gap-3">
                <div className="bg-white p-1 rounded-full border border-[#E2A123]/50 shrink-0 shadow-sm">
                  <img src="/bsc-logo.png" alt="BSC Logo" className="w-8 h-8 object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[#E2A123] font-black uppercase tracking-wider leading-none">Batanes State College</p>
                  <p className="text-[11px] text-amber-100 font-bold uppercase tracking-widest mt-1 opacity-90 leading-none">Faculty Identity Card</p>
                </div>
              </div>

              {/* ID Card Body */}
              <div className="p-6 flex flex-col items-center text-center space-y-4">
                {/* Profile Image Frame */}
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-[#E2A123] bg-[#7A151A]/40 shadow-inner flex items-center justify-center shrink-0">
                  {faculty.profile_image ? (
                    <img src={faculty.profile_image} alt={`${faculty.first_name} ${faculty.last_name}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-[#7A151A] to-amber-700 flex items-center justify-center text-white text-3xl font-black">
                      {faculty.first_name.charAt(0)}{faculty.last_name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Faculty Name & Role */}
                <div className="space-y-1">
                  <h3 className="text-lg font-black tracking-wide truncate max-w-[220px]">
                    {faculty.first_name} {faculty.middle_name ? `${faculty.middle_name.charAt(0).toUpperCase()}. ` : ""}{faculty.last_name}
                  </h3>
                  <p className="text-[10px] bg-[#E2A123]/20 text-[#E2A123] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full inline-block border border-[#E2A123]/30">
                    Faculty Instructor
                  </p>
                </div>

                {/* Faculty Specific Details */}
                <div className="w-full text-left bg-black/15 rounded-2xl p-4 border border-white/5 space-y-2 text-xs font-semibold text-neutral-100">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-amber-200/70 text-[10px] font-bold uppercase tracking-wider">Dept</span>
                    <span className="truncate max-w-[150px] font-bold">{faculty.department?.department_name || "BSC Faculty"}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-amber-200/70 text-[10px] font-bold uppercase tracking-wider">ID Number</span>
                    <span className="font-mono font-bold">{institutionalId}</span>
                  </div>
                  {username && (
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-amber-200/70 text-[10px] font-bold uppercase tracking-wider">Username</span>
                      <span className="font-mono font-bold text-amber-300">{username}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-4 border-t border-white/10 pt-2 mt-2">
                    <span className="text-amber-200/70 text-[10px] font-bold uppercase tracking-wider">Email</span>
                    <span className="truncate max-w-[150px] font-mono text-neutral-200">
                      {faculty.institutional_email || `${institutionalId.toLowerCase()}@acadnexus.bsc.edu.ph`}
                    </span>
                  </div>
                </div>

                {/* Aesthetic Digital Card Details */}
                <div className="w-full flex items-center justify-between border-t border-white/10 pt-3">
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Digital ID Security</span>
                    <span className="text-[9px] text-[#E2A123] font-bold font-mono tracking-wider">SECURE-ACADNEXUS-2026</span>
                  </div>
                  {/* Stylized CSS Barcode */}
                  <div className="flex gap-[2px] items-center h-6 opacity-60">
                    <div className="w-[2px] h-6 bg-white" />
                    <div className="w-[1px] h-6 bg-white" />
                    <div className="w-[3px] h-6 bg-white" />
                    <div className="w-[1px] h-6 bg-white" />
                    <div className="w-[2px] h-6 bg-white" />
                    <div className="w-[1px] h-6 bg-white" />
                    <div className="w-[4px] h-6 bg-white" />
                    <div className="w-[1px] h-6 bg-white" />
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
              <button
                disabled={isCreatingExam}
                onClick={handleCreateExam}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all hover:scale-105 duration-300 flex items-center gap-1"
              >
                {isCreatingExam ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Create Exam
              </button>
            </div>

            {faculty.examinations && faculty.examinations.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {faculty.examinations.slice(0, 5).map((exam) => (
                  <div key={exam.exam_id} className="py-4 flex justify-between items-center first:pt-0 last:pb-0 gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-slate-800 truncate">{exam.title}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 font-medium">
                        <span>{exam.course.course_code} - {exam.course.course_title}</span>
                        <span>•</span>
                        <span>{exam.time_limit_minutes} min</span>
                        <span>•</span>
                        <span className="font-bold text-slate-500">
                          {exam._count?.questionBank ?? 0} Questions
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {renderStatusBadge(exam.current_status)}
                      {(exam.current_status === "Draft" || exam.current_status === "Returned") && (
                        <>
                          <button
                            onClick={() => router.push(`/dashboard/faculty/exams/${exam.exam_id}/builder`)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                            title="Edit in Builder"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={deletingExamId === exam.exam_id}
                            onClick={() => handleDeleteExam(exam.exam_id)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                            title="Delete Exam"
                          >
                            {deletingExamId === exam.exam_id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      )}
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
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="text-slate-500 font-bold">
                            {exam._count?.questionBank ?? 0} Questions
                          </span>
                        </p>
                      </div>

                      {/* Interactive Actions for testing and state transitions */}
                      <div className="flex items-center gap-2">
                        {(exam.current_status === "Draft" || exam.current_status === "Returned") && (
                          <>
                            <button
                              onClick={() => router.push(`/dashboard/faculty/exams/${exam.exam_id}/builder`)}
                              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300/65 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all duration-300"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              Edit Builder
                            </button>
                            <button
                              disabled={deletingExamId === exam.exam_id}
                              onClick={() => handleDeleteExam(exam.exam_id)}
                              className="inline-flex items-center justify-center p-2 bg-slate-100 hover:bg-rose-50 border border-slate-300/65 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-xl shadow-sm transition-all duration-300 disabled:opacity-50"
                              title="Delete Exam"
                            >
                              {deletingExamId === exam.exam_id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        )}
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
                        {exam.current_status === "Approved" && (
                          <button
                            onClick={() => handleOpenScheduleModal(exam.exam_id, exam.title)}
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all duration-300"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Schedule Exam
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
                    {exam.current_status === "Returned" && exam.approvalWorkflow?.chair_comments && (() => {
                      let parsedComments: { general?: string; questions?: Record<string, string> } | null = null;
                      try {
                        if (exam.approvalWorkflow.chair_comments.startsWith("{")) {
                          parsedComments = JSON.parse(exam.approvalWorkflow.chair_comments);
                        }
                      } catch (e) {
                        // fallback to plain text
                      }

                      if (parsedComments) {
                        const hasQuestionComments = parsedComments.questions && Object.keys(parsedComments.questions).length > 0;
                        return (
                          <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 space-y-3">
                            <div className="flex gap-3 items-start">
                              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold text-rose-800">Returned by Department Chair:</p>
                                {parsedComments.general && (
                                  <p className="text-xs text-rose-700 mt-1 italic leading-relaxed">
                                    "{parsedComments.general}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {hasQuestionComments && (
                              <div className="border-t border-rose-100/60 pt-3 space-y-2">
                                <h5 className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Granular Question Feedback:</h5>
                                <div className="space-y-2">
                                  {Object.entries(parsedComments.questions || {}).map(([qId, val]) => {
                                    let commentText = "";
                                    let itemStatus: "Approved" | "Revision" | undefined = undefined;

                                    if (val && typeof val === "object") {
                                      commentText = (val as any).comment || "";
                                      itemStatus = (val as any).status;
                                    } else if (typeof val === "string") {
                                      commentText = val;
                                      // default legacy status is Revision if there is text
                                      if (commentText.trim()) itemStatus = "Revision";
                                    }

                                    if (!itemStatus && !commentText.trim()) return null;

                                    const qIndex = exam.questionBank?.findIndex(q => String(q.question_id) === String(qId)) ?? -1;
                                    const qNumber = qIndex !== -1 ? qIndex + 1 : "Unknown";
                                    const qText = qIndex !== -1 ? exam.questionBank?.[qIndex].question_text : "";
                                    
                                    return (
                                      <div key={qId} className={`bg-white border rounded-lg p-2.5 space-y-1.5 ${
                                        itemStatus === "Approved" ? "border-emerald-100" : "border-rose-100"
                                      }`}>
                                        <div className="flex justify-between items-center text-[10px] font-bold">
                                          <span className={itemStatus === "Approved" ? "text-emerald-800" : "text-rose-800"}>
                                            Question #{qNumber}
                                          </span>
                                          {itemStatus && (
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                              itemStatus === "Approved" 
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                                : "bg-rose-50 text-rose-700 border border-rose-100"
                                            }`}>
                                              {itemStatus === "Approved" ? "Approved" : "Revision Required"}
                                            </span>
                                          )}
                                        </div>
                                        {qText && (
                                          <p className="text-[11px] text-slate-500 truncate">{qText}</p>
                                        )}
                                        {commentText.trim() && (
                                          <p className={`text-xs italic font-medium ${
                                            itemStatus === "Approved" ? "text-emerald-700" : "text-rose-700"
                                          }`}>
                                            "{commentText}"
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Graceful fallback to raw text
                      return (
                        <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex gap-3 items-start">
                          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-rose-800">Returned by Department Chair:</p>
                            <p className="text-xs text-rose-700 mt-1 italic leading-relaxed">
                              "{exam.approvalWorkflow.chair_comments}"
                            </p>
                          </div>
                        </div>
                      );
                    })()}
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
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-800 placeholder:text-slate-400 px-4 py-2.5 rounded-xl transition-all duration-300"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-800 placeholder:text-slate-400 px-4 py-2.5 rounded-xl transition-all duration-300"
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

      {/* SCHEDULE MODAL */}
      {scheduleModalOpen && selectedExamForSchedule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Schedule Examination</h3>
                <p className="text-xs text-emerald-700 font-bold mt-1">{selectedExamForSchedule.title}</p>
              </div>
              <button onClick={() => setScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Target Program</label>
                <select 
                  required
                  value={scheduleForm.program_id}
                  onChange={e => setScheduleForm({...scheduleForm, program_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-900 placeholder:text-slate-500 px-4 py-2.5 rounded-xl transition-all duration-300"
                >
                  <option value="" disabled>Select Program</option>
                  {programs.map(p => (
                    <option key={p.program_id} value={p.program_id}>{p.program_code} - {p.program_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Year Level</label>
                  <select 
                    required
                    value={scheduleForm.year_level}
                    onChange={e => setScheduleForm({...scheduleForm, year_level: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-900 placeholder:text-slate-500 px-4 py-2.5 rounded-xl transition-all duration-300"
                  >
                    {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Section</label>
                  <input 
                    type="text" required
                    value={scheduleForm.section}
                    onChange={e => setScheduleForm({...scheduleForm, section: e.target.value})}
                    placeholder="e.g. A"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-900 placeholder:text-slate-500 px-4 py-2.5 rounded-xl transition-all duration-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Scheduled Date</label>
                <input 
                  type="date" required
                  value={scheduleForm.scheduled_date}
                  onChange={e => setScheduleForm({...scheduleForm, scheduled_date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-900 placeholder:text-slate-500 px-4 py-2.5 rounded-xl transition-all duration-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Start Time</label>
                  <input 
                    type="time" required
                    value={scheduleForm.start_time}
                    onChange={e => setScheduleForm({...scheduleForm, start_time: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-900 placeholder:text-slate-500 px-4 py-2.5 rounded-xl transition-all duration-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">End Time</label>
                  <input 
                    type="time" required
                    value={scheduleForm.end_time}
                    onChange={e => setScheduleForm({...scheduleForm, end_time: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-900 placeholder:text-slate-500 px-4 py-2.5 rounded-xl transition-all duration-300"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" onClick={() => setScheduleModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" disabled={isScheduling}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  {isScheduling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
