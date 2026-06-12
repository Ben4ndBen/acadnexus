"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Activity, Users, ClipboardCheck, FileSearch, CheckCircle, 
  XCircle, Send, AlertCircle, RefreshCw, FileText
} from "lucide-react";
import { reviewExamByChair, verifySyllabusAndTOS } from "@/app/actions/chair";

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
      }
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

  // State for Verification Tool
  const [isVerifying, setIsVerifying] = useState<number | null>(null);
  const [verifiedExams, setVerifiedExams] = useState<Set<number>>(new Set());

  const handleReview = async (workflowId: number, examId: number, action: "Approve" | "Return") => {
    const comments = reviewComments[workflowId] || "";
    if (action === "Return" && !comments.trim()) {
      alert("Please provide feedback when returning an examination.");
      return;
    }

    setIsSubmittingReview(workflowId);
    const res = await reviewExamByChair(workflowId, examId, action, comments, chairUserId);
    setIsSubmittingReview(null);

    if (res.error) {
      alert(res.error);
    } else {
      // Clear comment on success
      setReviewComments((prev) => {
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
                      <label className="text-xs font-bold text-slate-700 mb-2 block">Review Comments (Required for Return)</label>
                      <textarea
                        value={reviewComments[approval.workflow_id] || ""}
                        onChange={(e) => setReviewComments({...reviewComments, [approval.workflow_id]: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                        rows={3}
                        placeholder="Add your feedback or required changes here..."
                      />
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
