"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Activity, Users, ClipboardCheck, CheckCircle, 
  XCircle, Send, AlertCircle, RefreshCw, FileText, Check, X,
  Columns, ExternalLink, Download, Loader2, Eye, EyeOff,
  Tag, Layers, BookOpen, Search, Plus
} from "lucide-react";
import { reviewExamByChair } from "@/app/actions/chair";
import { assignCoursesToFacultyAction, createExamDraft } from "@/app/actions/faculty";
import { Latex } from "@/app/components/Latex";
import { getDepartmentTheme } from "@/lib/departmentThemes";
import { DepartmentBadge } from "@/app/components/DepartmentBadge";
import { 
  getProgramsForDepartment, 
  filterCoursesForDepartment 
} from "@/lib/courseDepartmentMapping";
import { getExpectedYearAndSemForCourse } from "@/lib/bsitCurriculum";
import { FacultyDashboardClient } from "@/app/components/FacultyDashboardClient";
import { BSCTableOfSpecificationsView } from "@/app/components/BSCTableOfSpecificationsView";

interface ChairDashboardClientProps {
  chairUserId: number;
  departmentId?: number;
  departmentName: string;
  isProgramChair?: boolean;
  programCode?: string;
  chairTitle?: string;
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
    facultyCourses?: Array<{
      course: {
        course_id: number;
        course_code: string;
        course_title: string;
      };
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
  courses?: Array<{ course_id: number; course_code: string; course_title: string }>;
  faculty?: any;
  institutionalId?: string;
  programs?: Array<any>;
  assignedCourses?: Array<any>;
  hasSeenCourseAssignment?: boolean;
  requirePasswordUpdate?: boolean;
  username?: string;
  studentExams?: any[];
}

export function ChairDashboardClient({ 
  chairUserId, 
  departmentId,
  departmentName, 
  isProgramChair = false,
  programCode,
  chairTitle = "Department Chairperson",
  facultyMembers, 
  pendingApprovals,
  departmentExams,
  courses = [],
  faculty,
  institutionalId = "",
  programs = [],
  assignedCourses = [],
  hasSeenCourseAssignment = false,
  requirePasswordUpdate = false,
  username,
  studentExams = []
}: ChairDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "faculty" | "queue" | "my_teaching">("overview");
  const deptTheme = getDepartmentTheme(departmentName);

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

  // State for Managing existing instructor's courses
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignFacultyTarget, setAssignFacultyTarget] = useState<any | null>(null);
  const [editProgramCode, setEditProgramCode] = useState("");
  const [editIncludeGE, setEditIncludeGE] = useState(false);
  const [editYearLevel, setEditYearLevel] = useState<number>(0);
  const [editSemester, setEditSemester] = useState<number>(0);
  const [editCourseIds, setEditCourseIds] = useState<number[]>([]);
  const [editCourseSearchQuery, setEditCourseSearchQuery] = useState("");
  const [isSavingAssignedCourses, setIsSavingAssignedCourses] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  // Filtered courses for Assign / Edit Modal based on Chair's Department, Program, Year & Sem
  const availableChairEditCourses = useMemo(() => {
    return filterCoursesForDepartment(courses || [], departmentId || departmentName, {
      programCode: editProgramCode,
      includeGeneralEducation: editIncludeGE,
      searchQuery: editCourseSearchQuery,
      yearLevel: editYearLevel || null,
      semester: editSemester || null,
    });
  }, [courses, departmentId, departmentName, editProgramCode, editIncludeGE, editCourseSearchQuery, editYearLevel, editSemester]);

  const handleOpenAssignModal = (faculty: any) => {
    setAssignFacultyTarget(faculty);
    const currentCourseIds = faculty.facultyCourses?.map((fc: any) => fc.course.course_id) || [];
    setEditCourseIds(currentCourseIds);
    setEditCourseSearchQuery("");
    
    const deptProgs = getProgramsForDepartment(departmentId, departmentName);
    if (deptProgs.length > 0) {
      setEditProgramCode(deptProgs[0].code);
    } else {
      setEditProgramCode("");
    }
    
    setEditIncludeGE(false);
    setAssignMessage(null);
    setAssignModalOpen(true);
  };

  const handleSaveAssignedCourses = async () => {
    if (!assignFacultyTarget) return;
    setIsSavingAssignedCourses(true);
    setAssignMessage(null);
    const res = await assignCoursesToFacultyAction(assignFacultyTarget.faculty_id, editCourseIds);
    setIsSavingAssignedCourses(false);
    if (res.error) {
      setAssignMessage(res.error);
    } else {
      setAssignModalOpen(false);
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
    const res = await reviewExamByChair(workflowId, examId, action, compiledComments, chairUserId, isProgramChair);
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



  const [isCreatingExam, setIsCreatingExam] = useState(false);

  const effectiveFaculty = useMemo(() => {
    if (faculty) return faculty;
    return {
      faculty_id: chairUserId,
      first_name: chairTitle,
      last_name: "Chairperson",
      department_id: departmentId || 1,
      examinations: [],
      facultyPortfolios: [],
      facultyCourses: [],
      has_seen_course_assignment: true,
    };
  }, [faculty, chairUserId, chairTitle, departmentId]);

  const handleCreateExamDirect = async () => {
    setIsCreatingExam(true);
    const defaultCourseId = (assignedCourses && assignedCourses.length > 0) ? assignedCourses[0].course_id : (courses && courses.length > 0 ? courses[0].course_id : undefined);
    const res = await createExamDraft(chairUserId, defaultCourseId);
    setIsCreatingExam(false);

    if (res.error) {
      alert(res.error);
    } else if (res.exam_id) {
      router.push(`/dashboard/faculty/exams/${res.exam_id}/builder`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center border-b border-slate-200 bg-white p-2 rounded-2xl shadow-sm gap-2">
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
          {pendingApprovals.length > 0 && (
            <span className="bg-amber-100 text-amber-900 text-xs px-2 py-0.5 rounded-full font-extrabold ml-1">
              {pendingApprovals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("my_teaching")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "my_teaching"
              ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          My Teaching Portal & Exams
        </button>

        {/* Direct Create Exam Button */}
        <button
          disabled={isCreatingExam}
          onClick={handleCreateExamDirect}
          className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 duration-300 flex items-center gap-2 disabled:opacity-50"
        >
          {isCreatingExam ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create Exam
        </button>
      </div>

      {/* MY TEACHING & EXAMS TAB */}
      {activeTab === "my_teaching" && (
        <FacultyDashboardClient
          faculty={effectiveFaculty}
          institutionalId={institutionalId || ""}
          programs={programs}
          courses={courses}
          assignedCourses={assignedCourses}
          hasSeenCourseAssignment={hasSeenCourseAssignment}
          requirePasswordUpdate={requirePasswordUpdate}
          username={username}
          studentExams={studentExams}
        />
      )}

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: deptTheme.colors.primary }} />
                {isProgramChair ? "Program Overview" : "Department Overview"}
              </h2>
              <DepartmentBadge department={isProgramChair && programCode ? programCode : departmentName} size="sm" />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  {isProgramChair ? "Program & Academic Specialty" : "Department & Academic Programs"}
                </p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{departmentName}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {getProgramsForDepartment(departmentName, departmentName, isProgramChair ? programCode : null).map(p => (
                    <span key={p.code} className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      {p.name} ({p.code})
                    </span>
                  ))}
                </div>
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

                  {/* Assigned Courses Row */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                        Assigned Courses:
                      </span>
                      {faculty.facultyCourses && faculty.facultyCourses.length > 0 ? (
                        faculty.facultyCourses.map((fc: any) => (
                          <span
                            key={fc.course.course_id}
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg"
                            title={fc.course.course_title}
                          >
                            <span className="font-mono">{fc.course.course_code}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">None assigned</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAssignModal(faculty)}
                      className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors flex items-center gap-1.5 shrink-0 self-end sm:self-auto cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Assign / Edit Subjects</span>
                    </button>
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
                            <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-950 border border-amber-300 font-extrabold px-2.5 py-0.5 rounded-md">
                              {isProgramChair ? "Reviewed by (Program Chairperson)" : "Recommended by (Department Chairperson)"}
                            </span>
                            {hasTosFile ? (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold px-2.5 py-0.5 rounded-md">
                                <FileText className="w-3 h-3" /> TOS File Attached
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold px-2.5 py-0.5 rounded-md">
                                <Layers className="w-3 h-3 text-emerald-600" /> TOS Matrix Active
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
                    <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                      Auto-Generated TOS Matrix
                    </span>
                  )}
                </div>

                {/* TOS Panel Body */}
                <div className="flex-1 bg-slate-950 p-3 overflow-y-auto flex flex-col relative">
                  {(() => {
                    const tosStr = activeSplitApproval.exam.tos_file_path || "";
                    let parsedTos: any = null;

                    if (tosStr.trim().startsWith("{")) {
                      try {
                        parsedTos = JSON.parse(tosStr);
                      } catch {}
                    }

                    if (parsedTos && parsedTos.topics) {
                      return (
                        <div className="w-full h-full overflow-y-auto bg-white p-4 rounded-xl border border-slate-800">
                          <BSCTableOfSpecificationsView
                            examTitle={activeSplitApproval.exam.title}
                            courseCode={activeSplitApproval.exam.course?.course_code || ""}
                            courseTitle={activeSplitApproval.exam.course?.course_title || activeSplitApproval.exam.title}
                            departmentName={departmentName}
                            term={activeSplitApproval.exam.term || "Midterm"}
                            semester={activeSplitApproval.exam.semester || "1st Semester"}
                            academicYear={activeSplitApproval.exam.academic_year || "2026-2027"}
                            examDate={activeSplitApproval.exam.exam_date ? String(activeSplitApproval.exam.exam_date).split("T")[0] : ""}
                            documentReference={activeSplitApproval.exam.document_reference || "BSC-ODI-F-121"}
                            facultyName={`${activeSplitApproval.exam.faculty?.first_name || ""} ${activeSplitApproval.exam.faculty?.last_name || ""}`}
                            totalItems={parsedTos.targetTotalItems || activeSplitApproval.exam.questionBank?.length || 50}
                            topics={parsedTos.topics || []}
                          />
                        </div>
                      );
                    }

                    if (tosStr.trim() !== "" && (tosStr.startsWith("/") || tosStr.startsWith("http"))) {
                      return (
                        <div className="w-full h-full flex flex-col">
                          <iframe
                            src={tosStr}
                            className="w-full h-full rounded-xl border border-slate-800 bg-white"
                            title="TOS Document Preview"
                          />
                          <p className="text-[10px] text-slate-400 mt-2 text-center shrink-0">
                            Viewing document preview. If file format is not supported in browser frame (e.g. DOCX/XLSX), click "Open New Tab" or "Download".
                          </p>
                        </div>
                      );
                    }

                    // Fallback to auto-generated TOS from question bank
                    const qBank = activeSplitApproval.exam.questionBank || [];
                    const map: Record<string, number> = {};
                    qBank.forEach((q: any) => {
                      const t = (q as any).topic?.trim() || "General Course Concepts";
                      map[t] = (map[t] || 0) + 1;
                    });
                    const fallbackTopics = Object.entries(map).map(([tName, qCount], idx) => ({
                      id: `top-${idx}`,
                      topic_name: tName,
                      learning_outcomes: "Demonstrate mastery and application of syllabus competencies.",
                      hours: Math.max(2, qCount * 2),
                      weightPercentage: Math.round((qCount / (qBank.length || 1)) * 100),
                      assignedItems: qCount,
                      question_types: ["Multiple_Choice"],
                      itemPlacement: `Items 1–${qBank.length}`,
                    }));

                    return (
                      <div className="w-full h-full overflow-y-auto bg-white p-4 rounded-xl border border-slate-800">
                        <BSCTableOfSpecificationsView
                          examTitle={activeSplitApproval.exam.title}
                          courseCode={activeSplitApproval.exam.course?.course_code || ""}
                          courseTitle={activeSplitApproval.exam.course?.course_title || activeSplitApproval.exam.title}
                          departmentName={departmentName}
                          term={activeSplitApproval.exam.term || "Midterm"}
                          semester={activeSplitApproval.exam.semester || "1st Semester"}
                          academicYear={activeSplitApproval.exam.academic_year || "2026-2027"}
                          examDate={activeSplitApproval.exam.exam_date ? String(activeSplitApproval.exam.exam_date).split("T")[0] : ""}
                          documentReference={activeSplitApproval.exam.document_reference || "BSC-ODI-F-121"}
                          facultyName={`${activeSplitApproval.exam.faculty?.first_name || ""} ${activeSplitApproval.exam.faculty?.last_name || ""}`}
                          totalItems={qBank.length || 50}
                          topics={fallbackTopics.length > 0 ? fallbackTopics : [
                            {
                              id: "top-1",
                              topic_name: "Core Course Module",
                              learning_outcomes: "Demonstrate comprehensive knowledge of course concepts.",
                              hours: 10,
                              weightPercentage: 100,
                              assignedItems: qBank.length || 50,
                              question_types: ["Multiple_Choice"],
                              itemPlacement: `Items 1–${qBank.length || 50}`,
                            }
                          ]}
                        />
                      </div>
                    );
                  })()}
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

                  {/* Chapter & Topic Breakdown Card for Chair Review */}
                  {(() => {
                    const qb = activeSplitApproval.exam.questionBank || [];
                    if (qb.length === 0) return null;

                    const map: Record<string, { itemNumbers: number[]; totalPoints: number }> = {};
                    const totalExamPoints = qb.reduce((sum: number, q: any) => sum + (q.points || 1), 0);

                    qb.forEach((q: any, idx: number) => {
                      const topicName = (q.topic && q.topic.trim() !== "") ? q.topic.trim() : "Unassigned Topic";
                      if (!map[topicName]) {
                        map[topicName] = { itemNumbers: [], totalPoints: 0 };
                      }
                      map[topicName].itemNumbers.push(idx + 1);
                      map[topicName].totalPoints += (q.points || 1);
                    });

                    const chapters = Object.entries(map).map(([topic, data]) => {
                      const count = data.itemNumbers.length;
                      const start = data.itemNumbers[0];
                      const end = data.itemNumbers[data.itemNumbers.length - 1];
                      const rangeStr = count === 1 ? `Item ${start}` : `Items ${start}–${end}`;
                      const weightPercentage = totalExamPoints > 0 ? Math.round((data.totalPoints / totalExamPoints) * 100) : 0;
                      return { topic, count, rangeStr, totalPoints: data.totalPoints, weightPercentage };
                    });

                    return (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                              Chapter & Topic Coverage (TOS Matrix)
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                            {chapters.length} Chapter{chapters.length !== 1 && "s"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {chapters.map((c, cIdx) => (
                            <div key={cIdx} className="bg-white border border-slate-200/70 p-2.5 rounded-xl space-y-1">
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="font-extrabold text-indigo-900 line-clamp-1">{c.topic}</span>
                                <span className="font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{c.weightPercentage}%</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <span className="font-bold text-slate-700">{c.rangeStr}</span>
                                <span>{c.count} items ({c.totalPoints} pts)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

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
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-[10px]">
                                  Item #{idx + 1}
                                </span>
                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold text-[9px] uppercase tracking-wider border border-amber-200">
                                  {q.question_type?.replace("_", " ")}
                                </span>
                                <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Tag className="w-2.5 h-2.5 text-indigo-500" />
                                  {q.topic?.trim() || "Unassigned Topic"}
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



      {/* ASSIGN / EDIT COURSES MODAL */}
      {assignModalOpen && assignFacultyTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-white rounded-3xl max-w-3xl sm:max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto">
            {/* Modal Header (Fixed Top) */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-800 p-2.5 rounded-2xl">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Assign Teaching Load
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instructor: <strong className="text-slate-800">{assignFacultyTarget.first_name} {assignFacultyTarget.last_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 font-sans">
              {assignMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{assignMessage}</span>
                </div>
              )}

              {(() => {
                const deptProgs = getProgramsForDepartment(departmentId, departmentName);

                return (
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div>
                        <span className="text-slate-500">Department:</span>{" "}
                        <strong className="text-amber-950 font-bold">{departmentName}</strong>
                      </div>

                      {deptProgs.length === 1 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Academic Program:</span>
                          <span className="text-[11px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1 select-none">
                            {deptProgs[0].name} ({deptProgs[0].code})
                          </span>
                        </div>
                      ) : deptProgs.length > 1 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Academic Program:</span>
                          <select
                            value={editProgramCode}
                            onChange={(e) => setEditProgramCode(e.target.value)}
                            className="bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-amber-500/20"
                          >
                            {deptProgs.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name} ({p.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none bg-white border border-slate-200/80 px-2 py-1 rounded-lg hover:border-slate-300">
                        <input
                          type="checkbox"
                          checked={editIncludeGE}
                          onChange={(e) => setEditIncludeGE(e.target.checked)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Include GE Subjects</span>
                      </label>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                        <span>Year:</span>
                        <select
                          value={editYearLevel}
                          onChange={(e) => setEditYearLevel(Number(e.target.value))}
                          className="bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 rounded-lg px-1.5 py-1 outline-none cursor-pointer"
                        >
                          <option value={0}>All Years</option>
                          <option value={1}>1st Year</option>
                          <option value={2}>2nd Year</option>
                          <option value={3}>3rd Year</option>
                          <option value={4}>4th Year</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                        <span>Sem:</span>
                        <select
                          value={editSemester}
                          onChange={(e) => setEditSemester(Number(e.target.value))}
                          className="bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 rounded-lg px-1.5 py-1 outline-none cursor-pointer"
                        >
                          <option value={0}>All Semesters</option>
                          <option value={1}>1st Sem</option>
                          <option value={2}>2nd Sem</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Select Department Courses to Assign
                  </span>
                  <span className="text-[10px] font-black bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                    {editCourseIds.length} Selected
                  </span>
                </div>

                {/* Search box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter department subjects by code or title..."
                    value={editCourseSearchQuery}
                    onChange={(e) => setEditCourseSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                {/* Selected chips */}
                {editCourseIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto py-1">
                    {editCourseIds.map((cId) => {
                      const c = courses.find((item) => item.course_id === cId);
                      if (!c) return null;
                      return (
                        <span
                          key={cId}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg"
                        >
                          <span className="font-mono">{c.course_code}</span>
                          <button
                            type="button"
                            onClick={() => setEditCourseIds((prev) => prev.filter((id) => id !== cId))}
                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* List of courses */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2.5 bg-slate-50/50">
                  {availableChairEditCourses.map((c) => {
                    const isChecked = editCourseIds.includes(c.course_id);
                    return (
                      <label
                        key={c.course_id}
                        className={`flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isChecked ? "bg-amber-50 font-bold text-amber-900 border border-amber-200" : "bg-white hover:bg-slate-100/80 text-slate-700 font-medium border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditCourseIds((prev) => [...prev, c.course_id]);
                            } else {
                              setEditCourseIds((prev) => prev.filter((id) => id !== c.course_id));
                            }
                          }}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                        />
                        <span className="font-mono text-[11px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {c.course_code}
                        </span>
                        <span className="truncate">{c.course_title}</span>
                      </label>
                    );
                  })}
                  {availableChairEditCourses.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No subjects found matching this department / program.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer (Fixed Bottom) */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/90 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingAssignedCourses}
                onClick={handleSaveAssignedCourses}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSavingAssignedCourses ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Save Course Allocations</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
