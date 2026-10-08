"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Activity, Users, ClipboardCheck, CheckCircle, 
  XCircle, Send, AlertCircle, RefreshCw, FileText, Check, X,
  Columns, ExternalLink, Download, Loader2, Eye, EyeOff,
  Tag, Layers, BookOpen, Search, Plus, UserCog
} from "lucide-react";
import { reviewExamByChair, updateChairNameAction } from "@/app/actions/chair";
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
import { BSCTableOfSpecificationsView, formatFullExamDate } from "@/app/components/BSCTableOfSpecificationsView";

function toRomanNumeral(num: number): string {
  const romanMap: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let result = "";
  let val = num;
  for (const [limit, letter] of romanMap) {
    while (val >= limit) {
      result += letter;
      val -= limit;
    }
  }
  return result || String(num);
}

const QUESTION_TYPE_ORDER: Record<string, number> = {
  Multiple_Choice: 1,
  Identification: 2,
  True_False: 3,
  Fill_In_The_Blanks: 4,
  Matching_Type: 5,
  Essay: 6,
};

const QUESTION_TYPE_HEADER_LABELS: Record<string, string> = {
  Multiple_Choice: "MULTIPLE CHOICE",
  Identification: "IDENTIFICATION",
  True_False: "TRUE OR FALSE",
  Fill_In_The_Blanks: "FILL IN THE BLANKS",
  Matching_Type: "MATCHING TYPE",
  Essay: "ESSAY",
};

const QUESTION_TYPE_INSTRUCTIONS: Record<string, string> = {
  Multiple_Choice: "Read each question carefully and select the letter corresponding to the correct answer.",
  Identification: "Identify the concept, term, or statement described in each item. Write your answer clearly.",
  True_False: "Read each statement carefully. Write True if the statement is correct; otherwise write False.",
  Fill_In_The_Blanks: "Fill in the blank space(s) with the correct word or phrase to complete the statement.",
  Matching_Type: "Match the premises in Column A with the corresponding correct options in Column B.",
  Essay: "Answer each question concisely and thoroughly in the space provided.",
};

const parseQuestionData = (q: any) => {
  let text = q.question_text || "";
  let image_url = "";
  let options: string[] = [];
  let premises: string[] = [];
  let matches: Array<{ premise: string; choice: string }> = [];
  let blanks: Array<{ id: number; answer: string; points: number }> = [];
  let min_words: number | undefined = undefined;

  if (text.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      text = parsed.text || text;
      image_url = parsed.image_url || "";
      options = parsed.options || [];
      premises = parsed.premises || [];
      matches = parsed.matches || [];
      blanks = parsed.blanks || [];
      min_words = parsed.min_words;
    } catch {}
  }

  let correctAnswerStr = q.correct_answer || "";
  if (correctAnswerStr.trim().startsWith("{") || correctAnswerStr.trim().startsWith("[")) {
    try {
      const parsedAns = JSON.parse(correctAnswerStr);
      if (parsedAns.blanks && Array.isArray(parsedAns.blanks) && blanks.length === 0) {
        blanks = parsedAns.blanks;
      }
      if (parsedAns.matches && Array.isArray(parsedAns.matches) && matches.length === 0) {
        matches = parsedAns.matches;
      }
    } catch {}
  }

  return {
    text,
    image_url,
    options,
    premises,
    matches,
    blanks,
    min_words,
    correctAnswerStr,
  };
};

const formatCorrectAnswer = (answerStr: string) => {
  if (!answerStr) return "";
  const trimmed = answerStr.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === "object" ? item.answer || item.text || JSON.stringify(item) : String(item))).join(", ");
      }
      if (parsed.blanks) {
        if (Array.isArray(parsed.blanks)) {
          return parsed.blanks.map((b: any, idx: number) => `[Blank ${idx + 1}]: ${b.answer || b.text || "N/A"}`).join(" • ");
        }
        if (typeof parsed.blanks === "object") {
          return Object.entries(parsed.blanks).map(([key, val]) => `[Blank ${key}]: ${val}`).join(" • ");
        }
      }
      if (parsed.pairs && Array.isArray(parsed.pairs)) {
        return parsed.pairs.map((p: any) => `${p.premise || ""} → ${p.answer || ""}`).join(" • ");
      }
      if (parsed.answer !== undefined) {
        return String(parsed.answer);
      }
      if (parsed.text !== undefined) {
        return String(parsed.text);
      }
    } catch {}
  }
  return answerStr;
};

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
  chairExaminations?: Array<any>;
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

  // State for Editing Chairperson's Personal Profile Name
  const [chairProfileModalOpen, setChairProfileModalOpen] = useState(false);
  const [chairFirstName, setChairFirstName] = useState(faculty?.first_name || "");
  const [chairMiddleName, setChairMiddleName] = useState(faculty?.middle_name || "");
  const [chairLastName, setChairLastName] = useState(faculty?.last_name || "");
  const [isSavingChairName, setIsSavingChairName] = useState(false);
  const [chairNameMsg, setChairNameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveChairProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chairFirstName.trim() || !chairLastName.trim()) {
      setChairNameMsg({ type: "error", text: "First Name and Last Name are required." });
      return;
    }
    setIsSavingChairName(true);
    setChairNameMsg(null);
    const res = await updateChairNameAction(chairUserId, {
      firstName: chairFirstName,
      middleName: chairMiddleName,
      lastName: chairLastName,
    });
    setIsSavingChairName(false);
    if (res.error) {
      setChairNameMsg({ type: "error", text: res.error });
    } else {
      setChairNameMsg({ type: "success", text: "Chairperson name updated successfully!" });
      setTimeout(() => {
        setChairProfileModalOpen(false);
        router.refresh();
      }, 700);
    }
  };

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

  const renderOfficialExamPaperReviewer = (approval: any) => {
    const qBank = approval.exam?.questionBank || [];
    if (qBank.length === 0) {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
          No questions found in this examination draft.
        </div>
      );
    }

    const groupsMap: Record<string, any[]> = {};
    qBank.forEach((q: any) => {
      const type = q.question_type || "Multiple_Choice";
      if (!groupsMap[type]) groupsMap[type] = [];
      groupsMap[type].push(q);
    });

    const sortedTypes = Object.keys(groupsMap).sort((a, b) => {
      const orderA = QUESTION_TYPE_ORDER[a] || 99;
      const orderB = QUESTION_TYPE_ORDER[b] || 99;
      return orderA - orderB;
    });

    const totalPoints = qBank.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
    const term = approval.exam?.term || "Prelim";
    const semester = approval.exam?.semester || "1st Semester";
    const courseCode = approval.exam?.course?.course_code || "";
    const courseTitle = approval.exam?.course?.course_title || "";
    const deptName = approval.exam?.course?.department?.department_name || departmentName || "Department of Information Technology";
    const examDate = approval.exam?.exam_date ? String(approval.exam.exam_date).split("T")[0] : "TBA";
    const timeLimit = approval.exam?.time_limit || 60;

    let itemCounter = 0;

    return (
      <div className="bg-white border border-slate-300 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6 text-slate-900 font-sans">
        {/* BSC OFFICIAL HEADER IMAGE */}
        <div className="w-full border-b border-slate-200 pb-3">
          <img
            src="/bsc-header.png"
            alt="Batanes State College Header"
            className="w-full h-auto object-contain mx-auto max-h-[140px]"
          />
        </div>

        {/* EXAMINATION METADATA HEADER */}
        <div className="text-center space-y-0.5 py-1 border-b border-slate-200">
          <h2 className="text-base sm:text-lg font-black font-sans text-slate-900 tracking-wider uppercase">
            {courseCode}{courseTitle ? ` — ${courseTitle}` : ""}
          </h2>
          <p className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
            {term.toUpperCase()} EXAMINATION
          </p>
          <p className="text-xs font-bold text-slate-700">
            {semester}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs font-bold border-b border-black pb-3 pt-1">
          <div className="flex items-baseline gap-2">
            <span className="font-black text-black uppercase tracking-wider shrink-0 min-w-[75px]">NAME:</span>
            <span
              contentEditable
              suppressContentEditableWarning
              className="border-b border-black flex-1 min-h-[18px] outline-none focus:bg-amber-100/90 rounded px-1 transition-all cursor-text print:bg-transparent"
            ></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-black text-black uppercase tracking-wider shrink-0 min-w-[50px]">DATE:</span>
            <span
              contentEditable
              suppressContentEditableWarning
              className="border-b border-black flex-1 min-h-[18px] outline-none focus:bg-amber-100/90 rounded px-1 transition-all cursor-text print:bg-transparent"
            ></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-black text-black uppercase tracking-wider shrink-0 min-w-[75px]">YR / LEVEL:</span>
            <span
              contentEditable
              suppressContentEditableWarning
              className="border-b border-black flex-1 min-h-[18px] outline-none focus:bg-amber-100/90 rounded px-1 transition-all cursor-text print:bg-transparent"
            ></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-black text-black uppercase tracking-wider shrink-0 min-w-[50px]">SCORE:</span>
            <span
              contentEditable
              suppressContentEditableWarning
              className="border-b border-black flex-1 min-h-[18px] outline-none focus:bg-amber-100/90 rounded px-1 transition-all cursor-text print:bg-transparent"
            ></span>
          </div>
        </div>

        {/* TEST PARTS */}
        <div className="space-y-6 pt-2">
          {sortedTypes.map((qType, typeIdx) => {
            const items = groupsMap[qType];
            const groupPoints = items.reduce((sum, q) => sum + (q.points || 1), 0);
            const headerLabel = QUESTION_TYPE_HEADER_LABELS[qType] || qType.toUpperCase();
            const instruction = QUESTION_TYPE_INSTRUCTIONS[qType] || "Answer the items as instructed.";

            return (
              <div key={qType} className="space-y-4">
                {/* TEST PART HEADER */}
                <div className="pt-3 pb-2 border-b-2 border-slate-900">
                  <div className="flex items-baseline justify-between">
                    <h4
                      contentEditable
                      suppressContentEditableWarning
                      className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-wide uppercase font-sans outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                      title="Click to edit test section header title"
                    >
                      TEST {toRomanNumeral(typeIdx + 1)}. {headerLabel}
                    </h4>
                    <span className="text-xs font-extrabold text-slate-900 font-sans tracking-tight shrink-0">
                      ({groupPoints} {groupPoints === 1 ? "Point" : "Points"})
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 italic font-sans mt-0.5 leading-tight">
                    <span className="font-bold not-italic">Directions: </span>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      className="outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                      title="Click to edit directions for this test type"
                    >
                      {instruction}
                    </span>
                  </p>
                </div>

                {/* QUESTION ITEMS */}
                <div className="space-y-4">
                  {items.map((q: any) => {
                    itemCounter += 1;
                    const itemNum = itemCounter;
                    const parsed = parseQuestionData(q);
                    const currentStatus = questionStatuses[approval.workflow_id]?.[q.question_id] || "Approved";

                    return (
                      <div
                        key={q.question_id}
                        className={`border rounded-xl p-4 space-y-3 transition-all ${
                          currentStatus === "Revision"
                            ? "bg-rose-50/50 border-rose-300 ring-1 ring-rose-300"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* ITEM HEADER & QUESTION PROMPT */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className="font-black text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-xs shrink-0">
                              Item {itemNum}.
                            </span>
                            <div className="font-bold text-slate-900 leading-relaxed text-xs pt-0.5">
                              <Latex text={parsed.text || "(Question prompt empty)"} />
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold bg-slate-100 border border-slate-300 text-slate-700 px-2 py-0.5 rounded shrink-0 uppercase tracking-tight">
                            {q.taxonomy_level || "KNOWLEDGE"} • {q.points || 1} pt(s)
                          </span>
                        </div>

                        {/* PROMPT IMAGE */}
                        {parsed.image_url && (
                          <div className="pl-7">
                            <img
                              src={parsed.image_url}
                              alt={`Item ${itemNum}`}
                              className="max-h-40 rounded-lg border border-slate-300 object-contain"
                            />
                          </div>
                        )}

                        {/* OPTIONS / PREMISES / MATCHES */}
                        {parsed.options && parsed.options.length > 0 && (
                          <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-800">
                            {parsed.options.map((opt: string, optIdx: number) => {
                              const letter = String.fromCharCode(65 + optIdx);
                              return (
                                <div key={optIdx} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                                  <span className="font-black text-slate-700">{letter}.</span>
                                  <span><Latex text={opt} /></span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {parsed.premises && parsed.premises.length > 0 && (
                          <div className="pl-7 space-y-1.5 text-xs text-slate-700">
                            <p className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider">Premises:</p>
                            {parsed.premises.map((prem: string, pIdx: number) => (
                              <div key={pIdx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                <span><Latex text={prem} /></span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ANSWER KEY FOR CHAIR REVIEW */}
                        <div className="pl-7">
                          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-lg p-2.5 text-xs flex items-center gap-2 text-emerald-950 font-medium">
                            <span className="font-black text-emerald-800 shrink-0 uppercase text-[10px] tracking-wider bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              Answer Key
                            </span>
                            <span className="font-extrabold font-mono text-emerald-900">
                              {formatCorrectAnswer(q.correct_answer)}
                            </span>
                          </div>
                        </div>

                        {/* CHAIR ITEM REVIEW CONTROL & COMMENT TEXTAREA */}
                        <div className="pt-2 border-t border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                              Item Review Status:
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const currentWorkflowStatuses = questionStatuses[approval.workflow_id] || {};
                                  setQuestionStatuses({
                                    ...questionStatuses,
                                    [approval.workflow_id]: {
                                      ...currentWorkflowStatuses,
                                      [q.question_id]: "Approved",
                                    },
                                  });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  currentStatus === "Approved"
                                    ? "bg-emerald-600 text-white shadow-sm font-extrabold"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const currentWorkflowStatuses = questionStatuses[approval.workflow_id] || {};
                                  setQuestionStatuses({
                                    ...questionStatuses,
                                    [approval.workflow_id]: {
                                      ...currentWorkflowStatuses,
                                      [q.question_id]: "Revision",
                                    },
                                  });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  currentStatus === "Revision"
                                    ? "bg-rose-600 text-white shadow-sm font-extrabold"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                                Request Revision
                              </button>
                            </div>
                          </div>

                          {/* PER-QUESTION COMMENT TEXTAREA */}
                          <div>
                            <textarea
                              value={questionComments[approval.workflow_id]?.[q.question_id] || ""}
                              onChange={(e) => {
                                const currentWorkflowComments = questionComments[approval.workflow_id] || {};
                                setQuestionComments({
                                  ...questionComments,
                                  [approval.workflow_id]: {
                                    ...currentWorkflowComments,
                                    [q.question_id]: e.target.value,
                                  },
                                });
                              }}
                              placeholder={
                                currentStatus === "Revision"
                                  ? "Specify correction needed for Item " + itemNum + " (e.g. rewrite options, change correct key, etc.)..."
                                  : "Item feedback comment (optional)..."
                              }
                              rows={2}
                              className={`w-full bg-slate-50 border rounded-lg p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-all ${
                                currentStatus === "Revision"
                                  ? "border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
                                  : "border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* BSC FOOTER */}
        <div className="pt-6 border-t border-slate-300">
          <img
            src="/bsc-footer.png"
            alt="Batanes State College Footer"
            className="w-full h-auto object-contain mx-auto max-h-[100px]"
          />
        </div>
      </div>
    );
  };

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

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => {
              setChairNameMsg(null);
              setChairFirstName(faculty?.first_name || "");
              setChairMiddleName(faculty?.middle_name || "");
              setChairLastName(faculty?.last_name || "");
              setChairProfileModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm transition-all duration-300 cursor-pointer"
          >
            <UserCog className="w-4 h-4 text-amber-600" />
            Edit Profile / Name
          </button>
          <button
            disabled={isCreatingExam}
            onClick={handleCreateExamDirect}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 duration-300 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isCreatingExam ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Exam
          </button>
        </div>
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
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full" style={{ backgroundColor: deptTheme.colors.primary }} />
                {isProgramChair ? "Program Overview" : "Department Overview"}
              </h2>
              <DepartmentBadge department={isProgramChair && programCode ? programCode : departmentName} size="sm" />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
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
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Faculty Members</p>
                  <p className="text-xl font-extrabold text-slate-800 mt-0.5">{facultyMembers.length}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Pending Reviews</p>
                  <p className="text-xl font-extrabold text-amber-600 mt-0.5">{pendingApprovals.length}</p>
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

          <div className="max-h-[650px] overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
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
                            term={activeSplitApproval.exam.term || "Prelim"}
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
                          term={activeSplitApproval.exam.term || "Prelim"}
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

                  {/* Official Examination Test Paper with Question Comments */}
                  {renderOfficialExamPaperReviewer(activeSplitApproval)}
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

                {/* List of courses (Scrollable) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  <div className="max-h-72 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300">
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

      {/* EDIT CHAIRPERSON PROFILE / NAME MODAL */}
      {chairProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 text-amber-700 p-2.5 rounded-2xl border border-amber-100">
                  <UserCog className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Chairperson Profile Name</h3>
                  <p className="text-xs text-slate-500 font-medium">Update your official name displayed across portals and signatures</p>
                </div>
              </div>
              <button
                onClick={() => setChairProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {chairNameMsg && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-bold border flex items-center gap-2 ${
                  chairNameMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {chairNameMsg.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{chairNameMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveChairProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria"
                    value={chairFirstName}
                    onChange={(e) => setChairFirstName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. D."
                    value={chairMiddleName}
                    onChange={(e) => setChairMiddleName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Santos"
                  value={chairLastName}
                  onChange={(e) => setChairLastName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none transition-all"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setChairProfileModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingChairName}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingChairName ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Update Name</span>
                    </>
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
