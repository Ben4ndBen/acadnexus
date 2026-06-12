"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart3, ShieldCheck, Map, List, CheckCircle, 
  XCircle, Clock, AlertCircle, RefreshCw, Search, Building2
} from "lucide-react";
import { reviewExamByDirector } from "@/app/actions/director";

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
}

export function DirectorDashboardClient({ 
  directorUserId, 
  stats, 
  pendingApprovals, 
  departmentsData,
  auditLogs
}: DirectorDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "compliance" | "logs">("overview");

  // State for Review Queue
  const [isSubmittingReview, setIsSubmittingReview] = useState<number | null>(null);

  // State for Logs Search
  const [searchQuery, setSearchQuery] = useState("");

  const handleReview = async (workflowId: number, examId: number, action: "Approve" | "Return" | "Hold") => {
    setIsSubmittingReview(workflowId);
    const res = await reviewExamByDirector(workflowId, examId, action, directorUserId);
    setIsSubmittingReview(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const filteredLogs = auditLogs.filter(log => 
    log.action_performed.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user.institutional_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

    </div>
  );
}
