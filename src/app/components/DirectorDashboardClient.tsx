"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart3, ShieldCheck, Map, List, CheckCircle, 
  XCircle, Clock, AlertCircle, RefreshCw, Search, Building2,
  UserPlus, X, Loader2, Eye, EyeOff, Award
} from "lucide-react";
import { reviewExamByDirector, toggleGlobalHold, toggleIndividualHold } from "@/app/actions/director";
import { registerInstructorByAdminAction } from "@/app/actions/auth";

interface DirectorDashboardClientProps {
  directorUserId: number;
  stats: {
    totalStudents: number;
    totalFaculty: number;
    totalDepartments: number;
    totalExams: number;
  };
  pendingApprovals: Array<{
    workflow_id: number;
    exam_id: number;
    chair_review_status: string;
    exam: {
      title: string;
      faculty: {
        first_name: string;
        last_name: string;
      };
      course: {
        course_code: string;
      }
    };
  }>;
  departmentsData: Array<{
    department_id: number;
    department_name: string;
    compliance_score: number;
    total_faculty: number;
    total_exams: number;
  }>;
  auditLogs: Array<{
    log_id: string | number;
    action_performed: string;
    ip_address: string;
    timestamp: Date;
    user: {
      institutional_id: string;
      role: string;
    };
  }>;
  allExaminations: Array<{
    exam_id: number;
    title: string;
    current_status: string;
    faculty: {
      first_name: string;
      last_name: string;
    };
    course: {
      course_code: string;
      course_title: string;
    };
    approvalWorkflow: {
      workflow_id: number;
      di_review_status: string;
      reviewed_by_di_id: number | null;
      di_comments: string | null;
    } | null;
  }>;
  globalHoldActive: boolean;
  departmentsList?: Array<{
    department_id: number;
    department_name: string;
  }>;
}

export function DirectorDashboardClient({ 
  directorUserId, 
  stats, 
  pendingApprovals, 
  departmentsData,
  auditLogs,
  allExaminations,
  globalHoldActive,
  departmentsList = []
}: DirectorDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "compliance" | "logs" | "exams">("overview");

  // State for Review Queue
  const [isSubmittingReview, setIsSubmittingReview] = useState<number | null>(null);

  // State for Global Hold Toggle
  const [isTogglingGlobalHold, setIsTogglingGlobalHold] = useState(false);

  // State for Individual Hold Toggles
  const [isTogglingIndividualHold, setIsTogglingIndividualHold] = useState<Record<number, boolean>>({});

  // State for Hold Remarks Modal
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [holdTriggerType, setHoldTriggerType] = useState<"review" | "toggle" | null>(null);
  const [holdRemarks, setHoldRemarks] = useState("");

  // State for Manage Exams Search & Filter
  const [examSearchQuery, setExamSearchQuery] = useState("");
  const [examStatusFilter, setExamStatusFilter] = useState("ALL");

  // State for Logs Search
  const [searchQuery, setSearchQuery] = useState("");

  // State for Register Instructor Modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [instId, setInstId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<{ username: string; institutionalId: string; name: string } | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  const handleRegisterInstructorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    setIsSubmittingReg(true);

    const formData = new FormData();
    formData.append("institutionalId", instId);
    formData.append("firstName", firstName);
    formData.append("middleName", middleName);
    formData.append("lastName", lastName);
    formData.append("departmentId", deptId);
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

  const handleReview = async (workflowId: number, examId: number, action: "Approve" | "Return" | "Hold") => {
    if (action === "Hold") {
      setSelectedWorkflowId(workflowId);
      setSelectedExamId(examId);
      setHoldTriggerType("review");
      setHoldRemarks("");
      setHoldModalOpen(true);
      return;
    }

    setIsSubmittingReview(workflowId);
    const res = await reviewExamByDirector(workflowId, examId, action, directorUserId);
    setIsSubmittingReview(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleToggleGlobalHold = async () => {
    setIsTogglingGlobalHold(true);
    const res = await toggleGlobalHold(directorUserId, !globalHoldActive);
    setIsTogglingGlobalHold(false);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleToggleIndividualHold = async (examId: number, placeHold: boolean) => {
    if (placeHold) {
      setSelectedWorkflowId(null);
      setSelectedExamId(examId);
      setHoldTriggerType("toggle");
      setHoldRemarks("");
      setHoldModalOpen(true);
      return;
    }

    setIsTogglingIndividualHold(prev => ({ ...prev, [examId]: true }));
    const res = await toggleIndividualHold(directorUserId, examId, placeHold);
    setIsTogglingIndividualHold(prev => ({ ...prev, [examId]: false }));

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleConfirmHoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdRemarks.trim()) {
      alert("Hold remarks are required.");
      return;
    }

    setHoldModalOpen(false);

    if (holdTriggerType === "review" && selectedWorkflowId && selectedExamId) {
      setIsSubmittingReview(selectedWorkflowId);
      const res = await reviewExamByDirector(selectedWorkflowId, selectedExamId, "Hold", directorUserId, holdRemarks);
      setIsSubmittingReview(null);
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    } else if (holdTriggerType === "toggle" && selectedExamId) {
      setIsTogglingIndividualHold(prev => ({ ...prev, [selectedExamId]: true }));
      const res = await toggleIndividualHold(directorUserId, selectedExamId, true, holdRemarks);
      setIsTogglingIndividualHold(prev => ({ ...prev, [selectedExamId]: false }));
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    }
  };

  const filteredLogs = auditLogs.filter(log => 
    log.action_performed.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user.institutional_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExams = allExaminations.filter(exam => {
    const matchesSearch = 
      exam.title.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
      exam.course.course_code.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
      exam.course.course_title.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
      `${exam.faculty.first_name} ${exam.faculty.last_name}`.toLowerCase().includes(examSearchQuery.toLowerCase());

    const matchesStatus = examStatusFilter === "ALL" || exam.current_status === examStatusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Dashboard Sub-navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl shadow-sm gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "overview"
              ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overview & Approvals
        </button>
        <button
          onClick={() => setActiveTab("exams")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "exams"
              ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Manage All Examinations
        </button>
        <button
          onClick={() => setActiveTab("compliance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "compliance"
              ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Map className="w-4 h-4" />
          School-Wide Compliance Map
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "logs"
              ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <List className="w-4 h-4" />
          Global System Action Logs
        </button>

        <button
          onClick={() => {
            setRegError(null);
            setRegSuccess(null);
            setInstId("");
            setFirstName("");
            setMiddleName("");
            setLastName("");
            setDeptId(departmentsList.length > 0 ? String(departmentsList[0].department_id) : "");
            setPassword("");
            setConfirmPassword("");
            setRegisterModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all duration-300 ml-auto"
        >
          <UserPlus className="w-4 h-4" />
          Register New Instructor
        </button>
      </div>

      {/* OVERVIEW & APPROVALS TAB */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Statistical Summary Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-2 relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                <Building2 className="w-24 h-24" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Departments</span>
              <p className="text-3xl font-extrabold text-slate-800">{stats.totalDepartments}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-2 relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                <ShieldCheck className="w-24 h-24" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Faculty</span>
              <p className="text-3xl font-extrabold text-slate-800">{stats.totalFaculty}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-2 relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                <BarChart3 className="w-24 h-24" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Enrolled Students</span>
              <p className="text-3xl font-extrabold text-slate-800">{stats.totalStudents}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-2 relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                <CheckCircle className="w-24 h-24" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Examinations</span>
              <p className="text-3xl font-extrabold text-slate-800">{stats.totalExams}</p>
            </div>
          </div>

          {/* Global Hold / Pass-Through clearance card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-700" />
                Pass-Through Clearance Optimization
              </h3>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                When enabled, examinations approved by Department Chairs bypass manual Director review and go live instantly.
                Disable this to enforce manual Director approval on all examinations.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${
                !globalHoldActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {!globalHoldActive ? "Pass-Through Active (Auto-Live)" : "Global Hold Active (Manual Review)"}
              </span>
              <button
                disabled={isTogglingGlobalHold}
                onClick={handleToggleGlobalHold}
                className={`text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 ${
                  !globalHoldActive
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {isTogglingGlobalHold ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : !globalHoldActive ? (
                  "Enforce Manual Review"
                ) : (
                  "Enable Auto-Live"
                )}
              </button>
            </div>
          </div>

          {/* Action Panel */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              Final Institutional Approval Queue
            </h2>

            {pendingApprovals.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {pendingApprovals.map((approval) => (
                  <div key={approval.workflow_id} className="py-4 flex flex-col md:flex-row justify-between md:items-center gap-4 first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-800">{approval.exam.title}</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Course: <strong className="text-slate-700">{approval.exam.course.course_code}</strong> &bull; 
                        Author: <strong className="text-slate-700">{approval.exam.faculty.first_name} {approval.exam.faculty.last_name}</strong>
                      </p>
                      <p className="text-[11px] text-emerald-600 font-bold bg-emerald-50 inline-block px-2 py-0.5 rounded-full mt-1 border border-emerald-100">
                        Chair Review: {approval.chair_review_status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        disabled={isSubmittingReview === approval.workflow_id}
                        onClick={() => handleReview(approval.workflow_id, approval.exam_id, "Approve")}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSubmittingReview === approval.workflow_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button 
                        disabled={isSubmittingReview === approval.workflow_id}
                        onClick={() => handleReview(approval.workflow_id, approval.exam_id, "Return")}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSubmittingReview === approval.workflow_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Return
                      </button>
                      <button 
                        disabled={isSubmittingReview === approval.workflow_id}
                        onClick={() => handleReview(approval.workflow_id, approval.exam_id, "Hold")}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSubmittingReview === approval.workflow_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                        Hold
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                <ShieldCheck className="w-10 h-10 text-indigo-400 mb-4" />
                <h3 className="font-bold text-slate-800 text-base">No pending approvals</h3>
                <p className="text-slate-500 text-xs max-w-sm mt-2">
                  All examination workflows have been resolved. The institution is fully compliant.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANAGE EXAMINATIONS TAB */}
      {activeTab === "exams" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-750 rounded-full" />
                Manage All Examinations
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Oversee all system examinations and place or lift administrative holds on specific assessments.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="Search by title or course..."
                  value={examSearchQuery}
                  onChange={(e) => setExamSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 px-10 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
              <select
                value={examStatusFilter}
                onChange={(e) => setExamStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Pending_Chair">Pending Chair</option>
                <option value="Pending_DI">Pending DI</option>
                <option value="Approved">Approved (Live)</option>
                <option value="Returned">Returned</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-4">Course & Title</th>
                  <th scope="col" className="px-6 py-4">Faculty Author</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <th scope="col" className="px-6 py-4">Administrative Hold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredExams.map(exam => {
                  const isManualHold = exam.approvalWorkflow?.di_review_status === "Hold" && exam.approvalWorkflow?.reviewed_by_di_id !== null;
                  const isLoading = isTogglingIndividualHold[exam.exam_id] || false;
                  
                  return (
                    <tr key={exam.exam_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm">{exam.title}</span>
                          <span className="text-xs text-slate-400 mt-0.5">{exam.course.course_code} - {exam.course.course_title}</span>
                          {exam.current_status === "Approved" && (
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded w-fit shadow-sm">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Digitally Signed by Chairperson & Director for Instruction
                            </div>
                          )}
                          {isManualHold && exam.approvalWorkflow?.di_comments && (
                            <div className="text-[10px] italic font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded w-fit mt-1.5 shadow-sm">
                              Hold Reason: "{exam.approvalWorkflow.di_comments}"
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                        {exam.faculty.first_name} {exam.faculty.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                          exam.current_status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          exam.current_status === "Returned" ? "bg-rose-50 text-rose-700 border-rose-200" :
                          exam.current_status === "Pending_DI" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          exam.current_status === "Pending_Chair" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {exam.current_status === "Approved" ? "Approved (Live)" : exam.current_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          disabled={isLoading}
                          onClick={() => handleToggleIndividualHold(exam.exam_id, !isManualHold)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                            isManualHold
                              ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {isLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isManualHold ? (
                            <>
                              <Clock className="w-3.5 h-3.5 text-rose-500" />
                              On Hold
                            </>
                          ) : (
                              "No Hold"
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredExams.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                      <p>No examinations found matching the filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPLIANCE MAP TAB */}
      {activeTab === "compliance" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                School-Wide Compliance Map
              </h2>
              <p className="text-slate-500 text-xs mt-1">Holistic overview of departmental adherence to syllabus and examination policies.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {departmentsData.map(dept => (
              <div key={dept.department_id} className="border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50/50">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-slate-800 text-base">{dept.department_name}</h3>
                  <div className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${
                    dept.compliance_score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    dept.compliance_score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-rose-50 text-rose-700 border-rose-200"
                  }`}>
                    {dept.compliance_score}%
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        dept.compliance_score >= 80 ? "bg-emerald-500" :
                        dept.compliance_score >= 50 ? "bg-amber-500" :
                        "bg-rose-500"
                      }`}
                      style={{ width: `${dept.compliance_score}%` }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-white border border-slate-100 p-3 rounded-xl text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Faculty</p>
                      <p className="text-xl font-extrabold text-slate-700">{dept.total_faculty}</p>
                    </div>
                    <div className="bg-white border border-slate-100 p-3 rounded-xl text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Exams</p>
                      <p className="text-xl font-extrabold text-slate-700">{dept.total_exams}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {departmentsData.length === 0 && (
              <div className="col-span-full text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-500 text-sm">No departments available.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SYSTEM ACTION LOGS TAB */}
      {activeTab === "logs" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                Global System Action Logs
              </h2>
              <p className="text-slate-500 text-xs mt-1">Audit trail of critical system actions, authentication events, and workflow transitions.</p>
            </div>
            
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 px-10 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-4">Timestamp</th>
                  <th scope="col" className="px-6 py-4">User</th>
                  <th scope="col" className="px-6 py-4">Action Performed</th>
                  <th scope="col" className="px-6 py-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLogs.map(log => (
                  <tr key={log.log_id.toString()} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{log.user.institutional_id}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{log.user.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {log.action_performed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}
                
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                      <p>No audit logs found matching your search.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HOLD REMARKS MODAL */}
      {holdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Enforce Administrative Hold</h3>
                <p className="text-xs text-slate-500 mt-1">Remarks explaining the hold status are strictly required.</p>
              </div>
              <button onClick={() => setHoldModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>

            <form onSubmit={handleConfirmHoldSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Written Remarks / Explanation</label>
                <textarea
                  required
                  value={holdRemarks}
                  onChange={e => setHoldRemarks(e.target.value)}
                  placeholder="Explain why this examination is being placed on hold..."
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-medium text-slate-800 placeholder:text-slate-400 p-3 rounded-xl transition-all outline-none"
                  rows={4}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setHoldModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!holdRemarks.trim()}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  Confirm Hold
                </button>
              </div>
            </form>
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
                  <h3 className="text-xl font-extrabold text-slate-900">Register New Instructor</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Admin registration for faculty profile setup</p>
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
                    The account for <strong className="font-semibold">{regSuccess.name}</strong> has been successfully created.
                  </p>
                  
                  <div className="bg-white border border-emerald-200/80 rounded-xl p-4 text-left space-y-2 text-xs font-mono text-slate-800">
                    <div><span className="text-slate-400">Institutional ID:</span> <strong className="text-slate-900">{regSuccess.institutionalId}</strong></div>
                    <div><span className="text-slate-400">Generated Username:</span> <strong className="text-emerald-700 text-sm">{regSuccess.username}</strong></div>
                    <div className="text-[11px] text-slate-500 font-sans pt-1 border-t border-slate-100">
                      Password update will be required on their initial login.
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
                    Register Another Instructor
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl shadow-md transition-colors"
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
                    placeholder="e.g. FACULTY-002"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Must follow format FACULTY- followed by numbers</p>
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
                      placeholder="e.g. Maria"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="e.g. Santos"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
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
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Department Assignment <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
                  >
                    <option value="" disabled>Select Department</option>
                    {departmentsList.map((d) => (
                      <option key={d.department_id} value={d.department_id}>
                        {d.department_name}
                      </option>
                    ))}
                  </select>
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
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 pr-9 rounded-xl outline-none"
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
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none"
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
                        <span>Create Instructor Account</span>
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
