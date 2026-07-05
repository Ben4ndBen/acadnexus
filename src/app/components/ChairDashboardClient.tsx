"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Activity, Users, ClipboardCheck, FileSearch, CheckCircle, 
  XCircle, Send, AlertCircle, RefreshCw, FileText, Check, X
} from "lucide-react";
import { reviewExamByChair, verifySyllabusAndTOS } from "@/app/actions/chair";
import { Latex } from "@/app/components/Latex";

interface ChairDashboardClientProps {
  chairUserId: number;
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
        syllabus_file_path: string | null;
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
  departmentName, 
  facultyMembers, 
  pendingApprovals,
  departmentExams 
}: ChairDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "faculty" | "queue" | "verification">("overview");

  // State for Review Queue
  const [isSubmittingReview, setIsSubmittingReview] = useState<number | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<number, string>>({});
  const [questionComments, setQuestionComments] = useState<Record<number, Record<number, string>>>({});
  const [questionStatuses, setQuestionStatuses] = useState<Record<number, Record<number, "Approved" | "Revision">>>({});

  // State for Verification Tool
  const [isVerifying, setIsVerifying] = useState<number | null>(null);
  const [verifiedExams, setVerifiedExams] = useState<Set<number>>(new Set());

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
      router.refresh();
    }
  };

  const handleVerify = async (courseId: number, examId: number) => {
    setIsVerifying(examId);
    const res = await verifySyllabusAndTOS(courseId, examId, chairUserId);
    setIsVerifying(null);

    if (res.error) {
      alert(res.error);
    } else {
      setVerifiedExams((prev) => {
        const next = new Set(prev);
        next.add(examId);
        return next;
      });
      router.refresh();
    }
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
          onClick={() => setActiveTab("verification")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "verification"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <FileSearch className="w-4 h-4" />
          Syllabus/TOS Verification
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
                Use the navigation tabs above to track faculty progress, review pending examinations, or verify syllabus and TOS alignment.
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
            {pendingApprovals.map(approval => (
              <div key={approval.workflow_id} className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-br from-white to-amber-50/10">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                  
                  <div className="flex-1 space-y-4 w-full">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{approval.exam.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                        <span>Course: <strong className="text-slate-700">{approval.exam.course.course_code} - {approval.exam.course.course_title}</strong></span>
                        <span>•</span>
                        <span>Instructor: <strong className="text-slate-700">{approval.exam.faculty.first_name} {approval.exam.faculty.last_name}</strong></span>
                      </div>
                    </div>

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

                                      {/* Feedback text area (always available, but styled specifically for revisions) */}
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
                      className="flex-1 inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSubmittingReview === approval.workflow_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      disabled={isSubmittingReview === approval.workflow_id}
                      onClick={() => handleReview(approval.workflow_id, approval.exam_id, "Return")}
                      className="flex-1 inline-flex justify-center items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-bold px-4 py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 border border-rose-200"
                    >
                      {isSubmittingReview === approval.workflow_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Return Exam
                    </button>
                  </div>
                </div>
              </div>
            ))}

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

      {/* SYLLABUS / TOS VERIFICATION TAB */}
      {activeTab === "verification" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
                Syllabus & TOS Verification Tool
              </h2>
              <p className="text-slate-500 text-xs mt-1">Verify that Examination Tables of Specifications (TOS) align with the Course Syllabi.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingApprovals.map(approval => {
              const isExamVerifying = isVerifying === approval.exam_id;
              const isVerified = verifiedExams.has(approval.exam_id);

              return (
                <div key={approval.exam_id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                  <div className="bg-slate-50 border-b border-slate-200 p-4">
                    <h3 className="font-bold text-slate-900 text-sm truncate">{approval.exam.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{approval.exam.course.course_code} - {approval.exam.faculty.first_name} {approval.exam.faculty.last_name}</p>
                  </div>
                  
                  <div className="p-4 space-y-4 flex-1">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="border border-slate-200 rounded-xl p-3 bg-white">
                        <div className="flex items-center gap-2 text-slate-700 font-bold mb-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Course Syllabus
                        </div>
                        {approval.exam.course.syllabus_file_path ? (
                          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-medium">Uploaded</span>
                        ) : (
                          <span className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded-md font-medium">Missing</span>
                        )}
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 bg-white">
                        <div className="flex items-center gap-2 text-slate-700 font-bold mb-2">
                          <FileSearch className="w-4 h-4 text-purple-600" />
                          Exam TOS
                        </div>
                        {approval.exam.tos_file_path ? (
                          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-medium">Uploaded</span>
                        ) : (
                          <span className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded-md font-medium">Missing</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-700 mb-2">Alignment Checklist</p>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-xs text-slate-600">
                          <input type="checkbox" className="rounded border-slate-300 text-amber-600 focus:ring-amber-600" />
                          Cognitive domains match syllabus objectives
                        </li>
                        <li className="flex items-center gap-2 text-xs text-slate-600">
                          <input type="checkbox" className="rounded border-slate-300 text-amber-600 focus:ring-amber-600" />
                          Time allocation matches topic weight
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-white">
                    <button
                      disabled={isExamVerifying || isVerified}
                      onClick={() => handleVerify(approval.exam.course.course_id, approval.exam_id)}
                      className={`w-full inline-flex justify-center items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm ${
                        isVerified 
                          ? "bg-emerald-100 text-emerald-700 cursor-not-allowed" 
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      {isExamVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : isVerified ? <CheckCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      {isVerified ? "Alignment Verified" : "Mark as Verified"}
                    </button>
                  </div>
                </div>
              );
            })}

            {pendingApprovals.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                <FileSearch className="w-8 h-8 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">No pending examinations available for TOS verification.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
