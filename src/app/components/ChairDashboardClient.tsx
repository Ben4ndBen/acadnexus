"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Activity, Users, ClipboardCheck, CheckCircle, 
  XCircle, Send, AlertCircle, RefreshCw, FileText, Check, X,
  Columns, ExternalLink, Download, UserPlus, Loader2, Eye, EyeOff
} from "lucide-react";
import { reviewExamByChair } from "@/app/actions/chair";
import { registerInstructorByAdminAction } from "@/app/actions/auth";
import { Latex } from "@/app/components/Latex";

interface ChairDashboardClientProps {
  chairUserId: number;
  departmentId?: number;
  departmentName: string;
  facultyMembers: Array<{
    faculty_id: number;
    first_name: string;
    last_name: string;
    examinations: Array<{
      exam_id: number;
      current_status: string;
    }>;
    facultyPortfolios: Array<{
      compliance_percentage: string | number;
      total_exams_created: number;
    }>;
  }>;
  pendingApprovals: Array<{
    workflow_id: number;
    exam_id: number;
    chair_review_status: string;
    exam: {
      title: string;
      tos_file_path: string;
      course: {
        course_id: number;
        course_code: string;
        course_title: string;
      };
      faculty: {
        first_name: string;
        last_name: string;
      };
      questionBank: Array<{
        question_id: number;
        question_text: string;
        question_type: string;
        correct_answer: string;
        points: number;
      }>;
    };
  }>;
  departmentExams: Array<any>;
}

export function ChairDashboardClient({ 
  chairUserId, 
  departmentId,
  departmentName, 
  facultyMembers, 
  pendingApprovals,
  departmentExams 
}: ChairDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "faculty" | "queue">("overview");

  // State for Review Queue
  const [isSubmittingReview, setIsSubmittingReview] = useState<number | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<number, string>>({});
  const [questionComments, setQuestionComments] = useState<Record<number, Record<number, string>>>({});
  const [questionStatuses, setQuestionStatuses] = useState<Record<number, Record<number, "Approved" | "Revision">>>({});

  // State for TOS Alignment Checklist
  const [tosChecklist, setTosChecklist] = useState<Record<number, {
    topicWeighting: boolean;
    cognitiveLevels: boolean;
    itemPoints: boolean;
  }>>({});

  // State for Split Screen Review Modal
  const [activeSplitApproval, setActiveSplitApproval] = useState<any | null>(null);
  const [splitViewMode, setSplitViewMode] = useState<"split" | "tos_only" | "questions_only">("split");

  // State for Register Instructor Modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [instId, setInstId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<{ username: string; institutionalId: string; name: string } | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  const handleRegisterInstructorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId) {
      setRegError("Department ID missing.");
      return;
    }
    setRegError(null);
    setRegSuccess(null);
    setIsSubmittingReg(true);

    const formData = new FormData();
    formData.append("institutionalId", instId);
    formData.append("firstName", firstName);
    formData.append("middleName", middleName);
    formData.append("lastName", lastName);
    formData.append("departmentId", String(departmentId));
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);

    const res = await registerInstructorByAdminAction(null, formData);
    setIsSubmittingReg(false);

    if (res.error) {
      setRegError(res.error);
    } else if (res.success) {
      setRegSuccess({
        username: res.username!,
        institutionalId: res.institutionalId!,
        name: res.name!,
      });
      router.refresh();
    }
  };

  const handleReview = async (workflowId: number, examId: number, action: "Approve" | "Return") => {
    const generalComment = reviewComments[workflowId] || "";
    const qComments = questionComments[workflowId] || {};
    const qStatuses = questionStatuses[workflowId] || {};
    
    // For each question in the pending approval, compile its status and comment
    const approval = pendingApprovals.find(a => a.workflow_id === workflowId);
    const questionsFeedback: Record<string, { status: "Approved" | "Revision"; comment: string }> = {};
    
    if (approval && approval.exam.questionBank) {
      approval.exam.questionBank.forEach(q => {
        const status = qStatuses[q.question_id] || "Approved"; // default to Approved if not toggled
        const comment = qComments[q.question_id] || "";
        questionsFeedback[q.question_id] = { status, comment };
      });
    }

    const hasRevisionRequested = Object.values(questionsFeedback).some(q => q.status === "Revision");
    const hasQuestionComments = Object.values(questionsFeedback).some(q => q.comment.trim().length > 0);

    // Enforce feedback rules when returning
    if (action === "Return" && !generalComment.trim() && !hasRevisionRequested && !hasQuestionComments) {
      alert("Please provide general feedback or request revisions on specific questions before returning the exam.");
      return;
    }

    // Enforce TOS Alignment Checklist before approving
    if (action === "Approve") {
      const checklist = tosChecklist[workflowId] || { topicWeighting: false, cognitiveLevels: false, itemPoints: false };
      if (!checklist.topicWeighting || !checklist.cognitiveLevels || !checklist.itemPoints) {
        alert("Before approving this examination, you must complete all items in the TOS Alignment Checklist.");
        return;
      }
    }

    // Enforce warning when approving but revisions are requested
    if (action === "Approve" && hasRevisionRequested) {
      const confirmApprove = window.confirm(
        "You have marked some questions as requiring revision. Are you sure you want to approve this exam?"
      );
      if (!confirmApprove) return;
    }

    // Compile into serialized JSON
    const compiledComments = JSON.stringify({
      general: generalComment,
      questions: questionsFeedback
    });

    setIsSubmittingReview(workflowId);
    const res = await reviewExamByChair(workflowId, examId, action, compiledComments, chairUserId);
    setIsSubmittingReview(null);

    if (res.error) {
      alert(res.error);
    } else {
      // Clear comments on success
      setReviewComments((prev) => {
        const next = { ...prev };
        delete next[workflowId];
        return next;
      });
      setQuestionComments((prev) => {
        const next = { ...prev };
        delete next[workflowId];
        return next;
      });
      setQuestionStatuses((prev) => {
        const next = { ...prev };
        delete next[workflowId];
        return next;
      });
      setTosChecklist((prev) => {
        const next = { ...prev };
        delete next[workflowId];
        return next;
      });
      if (activeSplitApproval?.workflow_id === workflowId) {
        setActiveSplitApproval(null);
      }
      router.refresh();
    }
  };

  const renderTosChecklist = (workflowId: number) => {
    const current = tosChecklist[workflowId] || { topicWeighting: false, cognitiveLevels: false, itemPoints: false };
    const isComplete = current.topicWeighting && current.cognitiveLevels && current.itemPoints;

    return (
      <div className={`border rounded-xl p-4 space-y-3 transition-all ${
        isComplete 
          ? "bg-emerald-50/50 border-emerald-200" 
          : "bg-amber-50/50 border-amber-200"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className={`w-4 h-4 ${isComplete ? "text-emerald-700" : "text-amber-700"}`} />
            <h4 className={`text-xs font-black uppercase tracking-wider ${isComplete ? "text-emerald-900" : "text-amber-900"}`}>
              TOS Alignment Checklist <span className="text-rose-600">*</span>
            </h4>
          </div>
          {isComplete ? (
            <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Check className="w-3 h-3" /> All Verified
            </span>
          ) : (
            <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
              Required for approval
            </span>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <label className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={current.topicWeighting}
              onChange={(e) => {
                setTosChecklist({
                  ...tosChecklist,
                  [workflowId]: { ...current, topicWeighting: e.target.checked }
                });
              }}
              className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-600 shrink-0 w-4 h-4 cursor-pointer"
            />
            <span>Topic weighting matches test question distribution</span>
          </label>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={current.cognitiveLevels}
              onChange={(e) => {
                setTosChecklist({
                  ...tosChecklist,
                  [workflowId]: { ...current, cognitiveLevels: e.target.checked }
                });
              }}
              className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-600 shrink-0 w-4 h-4 cursor-pointer"
            />
            <span>Cognitive levels (Remembering, Applying, etc.) match item breakdown</span>
          </label>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={current.itemPoints}
              onChange={(e) => {
                setTosChecklist({
                  ...tosChecklist,
                  [workflowId]: { ...current, itemPoints: e.target.checked }
                });
              }}
              className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-600 shrink-0 w-4 h-4 cursor-pointer"
            />
            <span>Total test items & point allocation match TOS specification</span>
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Sub-navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl shadow-sm gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "overview"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          Dashboard Overview
        </button>
        <button
          onClick={() => setActiveTab("faculty")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "faculty"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          Faculty Progress Tracker
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "queue"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Pending Review Queue
        </button>

        <button
          onClick={() => {
            setRegError(null);
            setRegSuccess(null);
            setInstId("");
            setFirstName("");
            setMiddleName("");
            setLastName("");
            setPassword("");
            setConfirmPassword("");
            setRegisterModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all duration-300 ml-auto"
        >
          <UserPlus className="w-4 h-4" />
          Add Instructor
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
              Department Overview
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Department Name</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{departmentName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Faculty Members</p>
                  <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{facultyMembers.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pending Reviews</p>
                  <p className="text-2xl font-extrabold text-amber-600 mt-0.5">{pendingApprovals.length}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
             <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
              Recent Department Activity
            </h2>
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
              <Activity className="w-8 h-8 text-slate-400 mb-4" />
              <h3 className="font-extrabold text-slate-800 text-base">Select a tab to view details</h3>
              <p className="text-slate-500 text-xs max-w-sm mt-2">
                Use the navigation tabs above to track faculty progress or review pending examinations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FACULTY PROGRESS TRACKER TAB */}
      {activeTab === "faculty" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
                Faculty Progress Tracker
              </h2>
              <p className="text-slate-500 text-xs mt-1">Monitor compliance and examination progress of your department's instructors.</p>
            </div>
          </div>

          <div className="space-y-6">
            {facultyMembers.map(faculty => {
              const latestPortfolio = faculty.facultyPortfolios?.[0];
              const compliance = latestPortfolio ? Number(latestPortfolio.compliance_percentage) : 0;
              
              const totalExams = faculty.examinations.length;
              const approvedExams = faculty.examinations.filter(e => e.current_status === "Approved").length;
              const pendingExams = faculty.examinations.filter(e => e.current_status.startsWith("Pending")).length;

              return (
                <div key={faculty.faculty_id} className="border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-slate-50/30">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
                        {faculty.first_name[0]}{faculty.last_name[0]}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{faculty.first_name} {faculty.last_name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Instructor</p>
                      </div>
                    </div>

                    <div className="flex-1 w-full md:w-auto px-4 md:px-8 border-y md:border-y-0 md:border-x border-slate-100 py-4 md:py-0">
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-slate-600">Compliance Rate</span>
                        <span className={compliance >= 80 ? "text-emerald-600" : compliance >= 50 ? "text-amber-600" : "text-rose-600"}>
                          {compliance}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${compliance >= 80 ? "bg-emerald-500" : compliance >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${compliance}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase">Total</p>
                        <p className="text-lg font-extrabold text-slate-800">{totalExams}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase">Pending</p>
                        <p className="text-lg font-extrabold text-amber-600">{pendingExams}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase">Approved</p>
                        <p className="text-lg font-extrabold text-emerald-600">{approvedExams}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            
            {facultyMembers.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-500 text-xs">No faculty members found in this department.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PENDING REVIEW QUEUE TAB */}
      {activeTab === "queue" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
                Pending Review Queue
              </h2>
              <p className="text-slate-500 text-xs mt-1">Review, approve, or return examinations drafted by faculty members.</p>
            </div>
          </div>

          <div className="space-y-6">
            {pendingApprovals.map(approval => {
              const hasTosFile = Boolean(approval.exam.tos_file_path && approval.exam.tos_file_path.trim() !== "");

              return (
                <div key={approval.workflow_id} className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-br from-white to-amber-50/10">
                  <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                    
                    <div className="flex-1 space-y-4 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">{approval.exam.title}</h3>
                            {hasTosFile ? (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold px-2.5 py-0.5 rounded-md">
                                <FileText className="w-3 h-3" /> TOS File Attached
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-700 border border-rose-200 font-extrabold px-2.5 py-0.5 rounded-md">
                                <AlertCircle className="w-3 h-3 text-rose-500" /> No TOS File Uploaded
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                            <span>Course: <strong className="text-slate-700">{approval.exam.course.course_code} - {approval.exam.course.course_title}</strong></span>
                            <span>•</span>
                            <span>Instructor: <strong className="text-slate-700">{approval.exam.faculty.first_name} {approval.exam.faculty.last_name}</strong></span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveSplitApproval(approval);
                            setSplitViewMode("split");
                          }}
                          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all self-start sm:self-auto cursor-pointer"
                        >
                          <Columns className="w-4 h-4" />
                          <span>Review TOS & Exam (Split Screen)</span>
                        </button>
                      </div>

                      {/* TOS Alignment Checklist */}
                      {renderTosChecklist(approval.workflow_id)}

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <label className="text-xs font-bold text-slate-700 mb-2 block">General Review Comments</label>
                        <textarea
                          value={reviewComments[approval.workflow_id] || ""}
                          onChange={(e) => setReviewComments({...reviewComments, [approval.workflow_id]: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                          rows={3}
                          placeholder="Add your general feedback or required changes here..."
                        />
                      </div>
                      
                      {/* Itemized Question Feedback Panel */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                        {(() => {
                          const qStatuses = questionStatuses[approval.workflow_id] || {};
                          const totalQuestions = approval.exam.questionBank?.length || 0;
                          const approvedCount = approval.exam.questionBank?.filter(q => (qStatuses[q.question_id] || "Approved") === "Approved").length || 0;
                          const revisionCount = totalQuestions - approvedCount;
                          const percentApproved = totalQuestions > 0 ? Math.round((approvedCount / totalQuestions) * 100) : 100;
                          
                          return (
                            <>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                <div>
                                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                    Granular Question Review
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                                    Set individual item status and write specific corrections.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <span className="text-[10px] font-extrabold text-slate-600 block">
                                      {approvedCount} / {totalQuestions} Approved
                                    </span>
                                    {revisionCount > 0 && (
                                      <span className="text-[9px] font-bold text-rose-600">
                                        {revisionCount} require revision
                                      </span>
                                    )}
                                  </div>
                                  <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden shrink-0">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        percentApproved === 100 ? "bg-emerald-500" : percentApproved > 50 ? "bg-amber-500" : "bg-rose-500"
                                      }`}
                                      style={{ width: `${percentApproved}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                {approval.exam.questionBank && approval.exam.questionBank.length > 0 ? (
                                  approval.exam.questionBank.map((q, idx) => {
                                    const currentStatus = qStatuses[q.question_id] || "Approved";
                                    return (
                                      <div key={q.question_id} className={`bg-white border rounded-xl p-4.5 space-y-3 transition-all duration-200 shadow-sm ${
                                        currentStatus === "Approved" 
                                          ? "border-slate-100 hover:border-slate-200" 
                                          : "border-rose-200 ring-2 ring-rose-500/5 bg-rose-50/5"
                                      }`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                          <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                                              Item #{idx + 1}
                                            </span>
                                            <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-100 font-semibold text-[9px] uppercase tracking-wider">
                                              {q.question_type.replace("_", " ")}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                              {q.points} {q.points === 1 ? "pt" : "pts"}
                                            </span>
                                          </div>

                                          {/* Status Toggle Buttons */}
                                          <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50 shrink-0 text-[10px] font-bold">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const currentWfStatuses = questionStatuses[approval.workflow_id] || {};
                                                setQuestionStatuses({
                                                  ...questionStatuses,
                                                  [approval.workflow_id]: {
                                                    ...currentWfStatuses,
                                                    [q.question_id]: "Approved"
                                                  }
                                                });
                                              }}
                                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                                                currentStatus === "Approved"
                                                  ? "bg-emerald-600 text-white shadow-sm font-black"
                                                  : "text-slate-500 hover:text-slate-700"
                                              }`}
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                              <span>Approve</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const currentWfStatuses = questionStatuses[approval.workflow_id] || {};
                                                setQuestionStatuses({
                                                  ...questionStatuses,
                                                  [approval.workflow_id]: {
                                                    ...currentWfStatuses,
                                                    [q.question_id]: "Revision"
                                                  }
                                                });
                                              }}
                                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                                                currentStatus === "Revision"
                                                  ? "bg-rose-600 text-white shadow-sm font-black"
                                                  : "text-slate-500 hover:text-slate-700"
                                              }`}
                                            >
                                              <X className="w-3.5 h-3.5" />
                                              <span>Requires Revision</span>
                                            </button>
                                          </div>
                                        </div>

                                        {(() => {
                                          let parsed: { text: string; image_url?: string; options?: string[]; premises?: string[] } | null = null;
                                          if (q.question_text.trim().startsWith("{")) {
                                            try {
                                              parsed = JSON.parse(q.question_text);
                                            } catch (e) {
                                              // fallback
                                            }
                                          }

                                          const textToRender = parsed ? parsed.text : q.question_text;

                                          return (
                                            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 space-y-3">
                                              <div className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-wrap">
                                                <Latex text={textToRender} />
                                              </div>

                                              {parsed?.image_url && (
                                                <div className="max-w-md border border-slate-200/60 rounded-xl overflow-hidden p-1 bg-white">
                                                  <img 
                                                    src={parsed.image_url} 
                                                    alt="Question attachment" 
                                                    className="w-full h-auto max-h-[180px] object-contain rounded-lg"
                                                  />
                                                </div>
                                              )}

                                              {/* Render choices/options for math & completeness */}
                                              {parsed?.options && parsed.options.length > 0 && (
                                                <div className="text-[11px] text-slate-500 font-semibold space-y-1 pl-2">
                                                  <p className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">Choices:</p>
                                                  {parsed.options.map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex gap-1.5 items-center">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                      <span><Latex text={opt} /></span>
                                                      {opt === q.correct_answer && <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1 py-0.2 rounded font-extrabold uppercase ml-2">Correct</span>}
                                                    </div>
                                                  ))}
                                                </div>
                                              )}

                                              {parsed?.premises && parsed.premises.length > 0 && (
                                                <div className="text-[11px] text-slate-500 font-semibold space-y-1 pl-2">
                                                  <p className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">Premises:</p>
                                                  {parsed.premises.map((prem, pIdx) => (
                                                    <div key={pIdx} className="flex gap-1.5 items-center">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                      <span><Latex text={prem} /></span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}

                                              {!parsed?.options && q.correct_answer && (
                                                <div className="text-[11px] text-slate-500 font-semibold pl-2">
                                                  <span className="font-bold text-slate-400">Correct Answer:</span> <strong className="text-slate-700">{q.correct_answer}</strong>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {/* Feedback text area */}
                                        <div className="space-y-1">
                                          <div className="flex justify-between items-center text-[10px]">
                                            <span className="font-bold text-slate-500">Feedback Comments:</span>
                                            {currentStatus === "Revision" && (
                                              <span className="text-rose-600 font-extrabold uppercase tracking-wider text-[8px]">
                                                * Required for revisions
                                              </span>
                                            )}
                                          </div>
                                          <textarea
                                            value={questionComments[approval.workflow_id]?.[q.question_id] || ""}
                                            onChange={(e) => {
                                              const currentWorkflowComments = questionComments[approval.workflow_id] || {};
                                              setQuestionComments({
                                                ...questionComments,
                                                [approval.workflow_id]: {
                                                  ...currentWorkflowComments,
                                                  [q.question_id]: e.target.value
                                                }
                                              });
                                            }}
                                            placeholder={
                                              currentStatus === "Revision"
                                                ? "Describe the correction needed for this item (e.g. rewrite options, change correct key, etc.)..."
                                                : "Add suggestions or comments (optional)..."
                                            }
                                            rows={2}
                                            className={`w-full bg-slate-50/50 border rounded-lg p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white transition-all duration-200 ${
                                              currentStatus === "Revision"
                                                ? "border-rose-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
                                                : "border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
                                            }`}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No questions found in this examination draft.</p>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex flex-row lg:flex-col gap-3 w-full lg:w-48 pt-2">
                      <button
                        disabled={isSubmittingReview === approval.workflow_id}
                        onClick={() => handleReview(approval.workflow_id, approval.exam_id, "Approve")}
                        className="flex-1 inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingReview === approval.workflow_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Approve Exam
                      </button>
                      <button
                        disabled={isSubmittingReview === approval.workflow_id}
                        onClick={() => handleReview(approval.workflow_id, approval.exam_id, "Return")}
                        className="flex-1 inline-flex justify-center items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold px-4 py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 border border-rose-200 cursor-pointer"
                      >
                        {isSubmittingReview === approval.workflow_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Return Exam
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {pendingApprovals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                <CheckCircle className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="font-extrabold text-slate-800 text-lg">Inbox Zero!</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-2">
                  There are no pending examinations requiring your approval. Enjoy your day!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SPLIT SCREEN REVIEW MODAL */}
      {activeSplitApproval && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col p-3 sm:p-6 overflow-hidden">
          {/* Modal Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
                <Columns className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {activeSplitApproval.exam.title}
                  </h2>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                    Split Review Mode
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Course: <strong className="text-slate-200">{activeSplitApproval.exam.course.course_code} - {activeSplitApproval.exam.course.course_title}</strong> • Faculty: <strong className="text-slate-200">{activeSplitApproval.exam.faculty.first_name} {activeSplitApproval.exam.faculty.last_name}</strong>
                </p>
              </div>
            </div>

            {/* View Mode Switcher & Close Button */}
            <div className="flex items-center justify-between md:justify-end gap-3">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold text-slate-400">
                <button
                  type="button"
                  onClick={() => setSplitViewMode("split")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    splitViewMode === "split"
                      ? "bg-amber-600 text-white shadow-md font-extrabold"
                      : "hover:text-slate-200"
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Split 50/50</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitViewMode("tos_only")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    splitViewMode === "tos_only"
                      ? "bg-amber-600 text-white shadow-md font-extrabold"
                      : "hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">TOS Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitViewMode("questions_only")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    splitViewMode === "questions_only"
                      ? "bg-amber-600 text-white shadow-md font-extrabold"
                      : "hover:text-slate-200"
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Test Questions</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveSplitApproval(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all border border-slate-700 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Main Split Content */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden mt-4">
            
            {/* LEFT PANEL: TOS FILE VIEWER */}
            {(splitViewMode === "split" || splitViewMode === "tos_only") && (
              <div className={`bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl ${
                splitViewMode === "tos_only" ? "lg:col-span-2" : ""
              }`}>
                {/* TOS Panel Header */}
                <div className="bg-slate-950/70 border-b border-slate-800 p-3.5 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Table of Specifications (TOS)</h3>
                  </div>

                  {activeSplitApproval.exam.tos_file_path && activeSplitApproval.exam.tos_file_path.trim() !== "" ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={activeSplitApproval.exam.tos_file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open New Tab
                      </a>
                      <a
                        href={activeSplitApproval.exam.tos_file_path}
                        download
                        className="inline-flex items-center gap-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-all shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg">
                      No TOS File Uploaded
                    </span>
                  )}
                </div>

                {/* TOS Panel Body */}
                <div className="flex-1 bg-slate-950 p-3 overflow-hidden flex flex-col relative">
                  {activeSplitApproval.exam.tos_file_path && activeSplitApproval.exam.tos_file_path.trim() !== "" ? (
                    <div className="w-full h-full flex flex-col">
                      <iframe
                        src={activeSplitApproval.exam.tos_file_path}
                        className="w-full h-full rounded-xl border border-slate-800 bg-white"
                        title="TOS Document Preview"
                      />
                      <p className="text-[10px] text-slate-400 mt-2 text-center shrink-0">
                        Viewing document preview. If file format is not supported in browser frame (e.g. DOCX/XLSX), click "Open New Tab" or "Download".
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-center p-6 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                      <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                      <h4 className="font-extrabold text-white text-base">No TOS File Uploaded</h4>
                      <p className="text-slate-400 text-xs max-w-md mt-1.5 leading-relaxed">
                        The faculty member did not upload a Table of Specifications (TOS) file for this examination draft.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RIGHT PANEL: TEST QUESTIONS & REVIEW CONTROLS */}
            {(splitViewMode === "split" || splitViewMode === "questions_only") && (
              <div className={`bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xl ${
                splitViewMode === "questions_only" ? "lg:col-span-2" : ""
              }`}>
                {/* Questions Panel Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-slate-900">Examination Test Questions</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-lg">
                    {activeSplitApproval.exam.questionBank?.length || 0} Items
                  </span>
                </div>

                {/* Questions Panel Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* TOS Alignment Checklist */}
                  {renderTosChecklist(activeSplitApproval.workflow_id)}

                  {/* General Review Comments */}
                  <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3.5 space-y-2">
                    <label className="text-xs font-extrabold text-amber-900 block uppercase tracking-wider">
                      General Review Feedback
                    </label>
                    <textarea
                      value={reviewComments[activeSplitApproval.workflow_id] || ""}
                      onChange={(e) => setReviewComments({...reviewComments, [activeSplitApproval.workflow_id]: e.target.value})}
                      className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                      rows={2}
                      placeholder="Add overall comments or instructions for the instructor..."
                    />
                  </div>

                  {/* Granular Questions List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Question Item Review
                    </h4>
                    {activeSplitApproval.exam.questionBank && activeSplitApproval.exam.questionBank.length > 0 ? (
                      activeSplitApproval.exam.questionBank.map((q: any, idx: number) => {
                        const qStatuses = questionStatuses[activeSplitApproval.workflow_id] || {};
                        const currentStatus = qStatuses[q.question_id] || "Approved";

                        let parsed: { text: string; image_url?: string; options?: string[]; premises?: string[] } | null = null;
                        if (q.question_text?.trim().startsWith("{")) {
                          try {
                            parsed = JSON.parse(q.question_text);
                          } catch (e) {}
                        }
                        const textToRender = parsed ? parsed.text : q.question_text;

                        return (
                          <div
                            key={q.question_id}
                            className={`border rounded-xl p-3.5 space-y-3 transition-all ${
                              currentStatus === "Approved"
                                ? "border-slate-200 bg-slate-50/50"
                                : "border-rose-200 bg-rose-50/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-[10px]">
                                  Item #{idx + 1}
                                </span>
                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold text-[9px] uppercase tracking-wider border border-amber-200">
                                  {q.question_type?.replace("_", " ")}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">
                                  {q.points} {q.points === 1 ? "pt" : "pts"}
                                </span>
                              </div>

                              {/* Toggle item status */}
                              <div className="flex border border-slate-200 rounded-lg p-0.5 bg-white text-[10px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentWfStatuses = questionStatuses[activeSplitApproval.workflow_id] || {};
                                    setQuestionStatuses({
                                      ...questionStatuses,
                                      [activeSplitApproval.workflow_id]: {
                                        ...currentWfStatuses,
                                        [q.question_id]: "Approved"
                                      }
                                    });
                                  }}
                                  className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                                    currentStatus === "Approved"
                                      ? "bg-emerald-600 text-white font-black shadow-sm"
                                      : "text-slate-500 hover:text-slate-800"
                                  }`}
                                >
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentWfStatuses = questionStatuses[activeSplitApproval.workflow_id] || {};
                                    setQuestionStatuses({
                                      ...questionStatuses,
                                      [activeSplitApproval.workflow_id]: {
                                        ...currentWfStatuses,
                                        [q.question_id]: "Revision"
                                      }
                                    });
                                  }}
                                  className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                                    currentStatus === "Revision"
                                      ? "bg-rose-600 text-white shadow-sm font-black"
                                      : "text-slate-500 hover:text-slate-800"
                                  }`}
                                >
                                  <X className="w-3 h-3" /> Revision
                                </button>
                              </div>
                            </div>

                            {/* Question text content */}
                            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-xs text-slate-800">
                              <div className="font-medium whitespace-pre-wrap leading-relaxed">
                                <Latex text={textToRender} />
                              </div>

                              {parsed?.image_url && (
                                <div className="max-w-xs border border-slate-200 rounded-lg overflow-hidden p-1 bg-white">
                                  <img
                                    src={parsed.image_url}
                                    alt="Question attachment"
                                    className="w-full h-auto max-h-[140px] object-contain rounded"
                                  />
                                </div>
                              )}

                              {parsed?.options && parsed.options.length > 0 && (
                                <div className="text-[11px] space-y-1 pl-1 text-slate-600 font-medium pt-1 border-t border-slate-100">
                                  <p className="font-extrabold text-[9px] text-slate-400 uppercase">Options:</p>
                                  {parsed.options.map((opt: string, oIdx: number) => (
                                    <div key={oIdx} className="flex gap-1.5 items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                      <span><Latex text={opt} /></span>
                                      {opt === q.correct_answer && (
                                        <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded font-extrabold uppercase ml-2">
                                          Correct
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {!parsed?.options && q.correct_answer && (
                                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                  <span className="font-bold text-slate-400">Answer:</span> <strong className="text-slate-700">{q.correct_answer}</strong>
                                </div>
                              )}
                            </div>

                            {/* Question comment area */}
                            <textarea
                              value={questionComments[activeSplitApproval.workflow_id]?.[q.question_id] || ""}
                              onChange={(e) => {
                                const currentWorkflowComments = questionComments[activeSplitApproval.workflow_id] || {};
                                setQuestionComments({
                                  ...questionComments,
                                  [activeSplitApproval.workflow_id]: {
                                    ...currentWorkflowComments,
                                    [q.question_id]: e.target.value
                                  }
                                });
                              }}
                              placeholder={
                                currentStatus === "Revision"
                                  ? "Specify correction needed for this item (e.g. rewrite options, change correct key, etc.)..."
                                  : "Item feedback (optional)..."
                              }
                              rows={1}
                              className={`w-full bg-white border rounded-lg p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all ${
                                currentStatus === "Revision"
                                  ? "border-rose-300 focus:border-rose-500"
                                  : "border-slate-200 focus:border-amber-500"
                              }`}
                            />
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic">No questions found for this exam.</p>
                    )}
                  </div>
                </div>

                {/* Questions Panel Footer / Action Bar */}
                <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                  <button
                    disabled={isSubmittingReview === activeSplitApproval.workflow_id}
                    onClick={() => {
                      handleReview(activeSplitApproval.workflow_id, activeSplitApproval.exam_id, "Return");
                    }}
                    className="inline-flex justify-center items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-rose-200 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingReview === activeSplitApproval.workflow_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Return Exam
                  </button>
                  <button
                    disabled={isSubmittingReview === activeSplitApproval.workflow_id}
                    onClick={() => {
                      handleReview(activeSplitApproval.workflow_id, activeSplitApproval.exam_id, "Approve");
                    }}
                    className="inline-flex justify-center items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingReview === activeSplitApproval.workflow_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Approve Exam
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGISTER INSTRUCTOR MODAL */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-2xl">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">Add Instructor to {departmentName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Department Chair faculty registration portal</p>
                </div>
              </div>
              <button 
                onClick={() => setRegisterModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {regSuccess ? (
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-7 h-7" />
                  </div>
                  <h4 className="text-lg font-bold text-emerald-900">Instructor Registered!</h4>
                  <p className="text-xs text-emerald-700">
                    The instructor profile for <strong className="font-semibold">{regSuccess.name}</strong> has been added to {departmentName}.
                  </p>
                  
                  <div className="bg-white border border-emerald-200/80 rounded-xl p-4 text-left space-y-2 text-xs font-mono text-slate-800">
                    <div><span className="text-slate-400">Institutional ID:</span> <strong className="text-slate-900">{regSuccess.institutionalId}</strong></div>
                    <div><span className="text-slate-400">Generated Username:</span> <strong className="text-emerald-700 text-sm">{regSuccess.username}</strong></div>
                    <div className="text-[11px] text-slate-500 font-sans pt-1 border-t border-slate-100">
                      Password update will be required on initial sign-in.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRegSuccess(null);
                      setInstId("");
                      setFirstName("");
                      setMiddleName("");
                      setLastName("");
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Add Another Instructor
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterInstructorSubmit} className="space-y-4">
                {regError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Institutional ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={instId}
                    onChange={(e) => setInstId(e.target.value)}
                    placeholder="e.g. FACULTY-003"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Format: FACULTY- followed by digits</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Juan"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="e.g. Dela"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Last Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Cruz"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Department</label>
                  <input
                    type="text"
                    disabled
                    value={departmentName}
                    className="w-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 p-3 rounded-xl cursor-not-allowed outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Initial Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 chars (Aa1!)"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 pr-9 rounded-xl outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReg}
                    className="px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-md transition-all"
                  >
                    {isSubmittingReg ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Add Instructor</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
