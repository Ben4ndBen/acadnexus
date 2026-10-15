"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  BookOpen, Award, FileText, ClipboardList, PenTool, CheckCircle, 
  User, Shield, Settings, Activity, Send, RotateCcw, AlertCircle, RefreshCw, Mail,
  Plus, Trash2, Calendar, Lock, Camera, Check, ShieldAlert, Loader2, ShieldCheck, Clock,
  X, AlertTriangle, Archive, Search, Edit, GraduationCap, Users, Download, Layers, ChevronRight,
  Printer, CheckCircle2, XCircle
} from "lucide-react";
import { 
  updateFacultyProfile, updateExamStatus, createExamDraft, deleteExam, 
  scheduleExamTarget, configureFacultyAccount, getStudentExamLogs,
  getQuestionBankQuestions, saveQuestionBankQuestion, deleteQuestionBankQuestion,
  archiveExamination, reuseArchivedExamination, getArchivedExaminations,
  getCurrentAcademicYear, getFacultyEnrolledStudentsAndGrades,
  getCourseRoster, enrollStudentInCourse, bulkEnrollStudentsInCourse, unenrollStudentFromCourse,
  acknowledgeAssignedCoursesAction, getStudentExamPaper, gradeEssayAnswer
} from "@/app/actions/faculty";
import { 
  exportStudentGradesRosterToExcel, 
  exportExamSubmissionsToExcel, 
  exportMissedStudentsToExcel 
} from "@/lib/exportExcel";
import { getProgramsForDepartment } from "@/lib/courseDepartmentMapping";
import { formatStudentName, getStudentMiddleInitial, getSubmissionScheduleTiming, formatStudentProgramAndYear } from "@/lib/academicUtils";
import { DatePicker } from "@/app/components/DatePicker";

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
      tos_file_path?: string | null;
      time_limit_minutes: number;
      current_status: "Draft" | "Pending_Program_Chair" | "Pending_Chair" | "Pending_DI" | "Approved" | "Returned";
      is_archived?: boolean;
      academic_year?: string | null;
      course: {
        course_code: string;
        course_title: string;
      };
      approvalWorkflow: {
        reviewed_by_prog_chair_id?: number | null;
        prog_chair_review_status?: string | null;
        prog_chair_comments?: string | null;
        chair_comments: string | null;
        chair_review_status: string;
        di_review_status: string;
        di_comments: string | null;
      } | null;
      questionBank?: Array<{
        question_id: number;
        question_text: string;
        points: number;
      }>;
      _count?: {
        questionBank: number;
      };
      examTargets?: Array<{
        target_id: number;
        program_id: number;
        year_level: number;
        section: string;
        scheduled_date: string;
        start_time: string;
        end_time: string;
      }>;
    }>;
    facultyPortfolios: Array<{
      portfolio_id: number;
      academic_year: string;
      semester: number;
      total_exams_created: number;
      compliance_percentage: any;
    }>;
    facultyCourses?: Array<any>;
  };
  institutionalId: string;
  programs?: Array<{ program_id: number; program_code: string; program_name: string; department_id: number }>;
  courses?: Array<{ course_id: number; course_code: string; course_title: string }>;
  assignedCourses?: Array<{ course_id: number; course_code: string; course_title: string; syllabus_file_path?: string | null }>;
  hasSeenCourseAssignment?: boolean;
  requirePasswordUpdate?: boolean;
  username?: string;
  studentExams?: any[];
}

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
  True_False: 2,
  Identification: 3,
  Fill_In_The_Blanks: 4,
  Matching_Type: 5,
  Essay: 6,
};

const QUESTION_TYPE_HEADER_LABELS: Record<string, string> = {
  Multiple_Choice: "MULTIPLE CHOICE",
  True_False: "TRUE OR FALSE",
  Identification: "IDENTIFICATION",
  Fill_In_The_Blanks: "FILL IN THE BLANKS",
  Matching_Type: "MATCHING TYPE",
  Essay: "ESSAY / COMPREHENSION",
};

const QUESTION_TYPE_INSTRUCTIONS: Record<string, string> = {
  Multiple_Choice: "Read each question carefully and select the letter corresponding to the correct answer.",
  True_False: "Read each statement carefully. Write True if the statement is correct; otherwise write False.",
  Identification: "Identify the concept, term, or statement described in each item. Write your answer clearly.",
  Fill_In_The_Blanks: "Fill in the blank space(s) with the correct word or phrase to complete the statement.",
  Matching_Type: "Match the premises in Column A with the corresponding correct options in Column B.",
  Essay: "Answer each question concisely and thoroughly in the space provided.",
};

function countWords(str?: string | null): number {
  if (!str) return 0;
  const trimmed = str.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function parseExamPaperQuestion(q: any) {
  let text = q.question_text || "";
  let options: string[] = [];
  let premises: string[] = [];
  let blanks: Array<{ id: number | string; answer: string; points: number }> = [];
  let matches: Array<{ premise: string; choice: string }> = [];
  let min_words: number | undefined = undefined;
  let image_url = "";
  let taxonomy_level = "";
  let instruction = "";

  if (typeof text === "string" && text.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      text = typeof parsed.text === "string" ? parsed.text : (parsed.text ?? q.question_text);
      options = parsed.options || [];
      premises = parsed.premises || [];
      blanks = parsed.blanks || [];
      matches = parsed.matches || [];
      min_words = parsed.min_words;
      image_url = parsed.image_url || "";
      taxonomy_level = parsed.taxonomy_level || "";
      instruction = parsed.instruction || parsed.instructions || parsed.rubric || "";
    } catch {
      // fallback
    }
  } else if (q.question_type === "Multiple_Choice") {
    try {
      const parsed = JSON.parse(text);
      text = parsed.text || text;
      options = parsed.options || [];
    } catch {}
  } else if (q.question_type === "Matching_Type") {
    try {
      const parsedText = JSON.parse(text);
      text = parsedText.text || text;
      premises = parsedText.premises || [];
      options = parsedText.options || [];
    } catch {}
  }

  // Fallbacks for blanks or matches from correct_answer if needed
  let parsedBlanksFromCorrect: Array<{ id: number | string; answer: string; points: number }> = [];
  let parsedMatchesFromCorrect: Array<{ premise: string; choice: string }> = [];
  if (q.question_type === "Fill_In_The_Blanks" && typeof q.correct_answer === "string") {
    try {
      const pc = JSON.parse(q.correct_answer);
      parsedBlanksFromCorrect = pc.blanks || [];
    } catch {}
  } else if (q.question_type === "Matching_Type" && typeof q.correct_answer === "string") {
    try {
      const pc = JSON.parse(q.correct_answer);
      parsedMatchesFromCorrect = pc.matches || [];
    } catch {}
  }

  return {
    ...q,
    displayText: text,
    options,
    premises,
    blanks: blanks.length > 0 ? blanks : parsedBlanksFromCorrect,
    matches: matches.length > 0 ? matches : parsedMatchesFromCorrect,
    min_words,
    image_url,
    taxonomy_level,
    instruction,
  };
}

export function FacultyDashboardClient({ 
  faculty, 
  institutionalId, 
  programs = [], 
  courses = [],
  assignedCourses = [],
  hasSeenCourseAssignment = false,
  requirePasswordUpdate = false, 
  username,
  studentExams = []
}: FacultyDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "tracker" | "submissions" | "profile" | "override" | "question_bank" | "archive" | "students">("overview");

  // Popup modal state for newly assigned courses upon first / new login
  const [showAssignedCoursesModal, setShowAssignedCoursesModal] = useState<boolean>(() => {
    return !hasSeenCourseAssignment && assignedCourses.length > 0 && !requirePasswordUpdate;
  });
  const [isAcknowledgingCourses, setIsAcknowledgingCourses] = useState(false);

  useEffect(() => {
    if (!requirePasswordUpdate && !hasSeenCourseAssignment && assignedCourses.length > 0) {
      setShowAssignedCoursesModal(true);
    }
  }, [requirePasswordUpdate, hasSeenCourseAssignment, assignedCourses.length]);

  const handleAcknowledgeCourses = async () => {
    setIsAcknowledgingCourses(true);
    try {
      await acknowledgeAssignedCoursesAction(faculty.faculty_id);
    } catch (err) {
      console.error("Error acknowledging assigned courses:", err);
    } finally {
      setIsAcknowledgingCourses(false);
      setShowAssignedCoursesModal(false);
    }
  };

  // --- Class Roster & Student Enrollment Tab State ---
  const [selectedRosterCourseId, setSelectedRosterCourseId] = useState<number>(() => {
    return courses[0]?.course_id || 0;
  });
  const [classRosterStudents, setClassRosterStudents] = useState<any[]>([]);
  const [loadingClassRoster, setLoadingClassRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [bulkEnrollModalOpen, setBulkEnrollModalOpen] = useState(false);

  // Popup modal state when unassigned faculty attempts restricted actions
  const [unassignedWarningModalOpen, setUnassignedWarningModalOpen] = useState<boolean>(false);
  const [unassignedActionText, setUnassignedActionText] = useState<string>("creating examinations or adding students");

  // Automatically resolve default program matching the faculty's department
  const deptProgram = useMemo(() => {
    const deptProgs = getProgramsForDepartment(faculty.department?.department_name);
    if (deptProgs.length > 0) {
      const matched = programs.find((p) =>
        deptProgs.some((dp) => dp.code.toUpperCase() === p.program_code.toUpperCase())
      );
      if (matched) return matched;
    }
    return programs[0] || null;
  }, [faculty.department?.department_name, programs]);

  const defaultProgId = deptProgram?.program_id
    ? String(deptProgram.program_id)
    : programs[0]?.program_id
    ? String(programs[0].program_id)
    : "";

  // Single Enroll Form State
  const [enrollForm, setEnrollForm] = useState({
    institutionalId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    programId: defaultProgId,
    yearLevel: "1",
    section: "A",
  });
  const [isSubmittingEnroll, setIsSubmittingEnroll] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // Bulk Enroll Form State
  const [bulkInput, setBulkInput] = useState("");
  const [bulkProgramId, setBulkProgramId] = useState(defaultProgId);
  const [bulkYearLevel, setBulkYearLevel] = useState("1");
  const [bulkSection, setBulkSection] = useState("A");
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ message: string; errors?: string[] } | null>(null);

  useEffect(() => {
    if (defaultProgId && !enrollForm.programId) {
      setEnrollForm((prev) => ({ ...prev, programId: defaultProgId }));
      setBulkProgramId(defaultProgId);
    }
  }, [defaultProgId]);

  // Unenroll state
  const [unenrollingId, setUnenrollingId] = useState<number | null>(null);

  const fetchRoster = async (cId: number) => {
    if (!cId) return;
    setLoadingClassRoster(true);
    const res = await getCourseRoster(cId, faculty.faculty_id);
    setLoadingClassRoster(false);
    if (res.success) {
      setClassRosterStudents(res.students || []);
    } else {
      setClassRosterStudents([]);
    }
  };

  useEffect(() => {
    if (activeTab === "students" && selectedRosterCourseId) {
      fetchRoster(selectedRosterCourseId);
    }
  }, [activeTab, selectedRosterCourseId]);

  // --- Live Monitoring & Submissions Tab State ---
  const [selectedMonitoringCourseId, setSelectedMonitoringCourseId] = useState<number | "all">("all");
  const [monitoringSearch, setMonitoringSearch] = useState<string>("");
  const [monitoringStatusFilter, setMonitoringStatusFilter] = useState<"all" | "active" | "submitted" | "late">("all");

  // Exam Paper Modal State
  const [examPaperModalOpen, setExamPaperModalOpen] = useState(false);
  const [activeExamPaperData, setActiveExamPaperData] = useState<any | null>(null);
  const [loadingExamPaper, setLoadingExamPaper] = useState(false);
  const [savingEssayId, setSavingEssayId] = useState<number | null>(null);
  const [essayPointsDraft, setEssayPointsDraft] = useState<Record<number, number>>({});

  // Dedicated Essay Evaluation & Grading Modal State
  const [essayGradingModalOpen, setEssayGradingModalOpen] = useState(false);
  const [activeEssayGradingData, setActiveEssayGradingData] = useState<any | null>(null);
  const [loadingEssayGrading, setLoadingEssayGrading] = useState(false);
  const [essayGradeSuccessToast, setEssayGradeSuccessToast] = useState<string | null>(null);

  // Compute categorized courses, attempts, and per-course tallies for Live Monitor & Results
  const monitoringCoursesList = useMemo(() => {
    const courseMap = new Map<number, {
      course_id: number;
      course_code: string;
      course_title: string;
      attempts: any[];
      counts: {
        totalAttempts: number;
        liveActive: number;
        submittedCount: number;
        lateCount: number;
      };
    }>();

    // 1. Initialize from assignedCourses / facultyCourses
    const myAssigned = (assignedCourses && assignedCourses.length > 0)
      ? assignedCourses
      : (faculty.facultyCourses?.map((fc: any) => fc.course) || []);

    myAssigned.forEach((c: any) => {
      if (c && c.course_id && !courseMap.has(c.course_id)) {
        courseMap.set(c.course_id, {
          course_id: c.course_id,
          course_code: c.course_code,
          course_title: c.course_title,
          attempts: [],
          counts: {
            totalAttempts: 0,
            liveActive: 0,
            submittedCount: 0,
            lateCount: 0,
          },
        });
      }
    });

    // 2. Register any course present in studentExams
    (studentExams || []).forEach((se: any) => {
      const c = se.exam?.course;
      if (c && c.course_id) {
        if (!courseMap.has(c.course_id)) {
          courseMap.set(c.course_id, {
            course_id: c.course_id,
            course_code: c.course_code,
            course_title: c.course_title,
            attempts: [],
            counts: {
              totalAttempts: 0,
              liveActive: 0,
              submittedCount: 0,
              lateCount: 0,
            },
          });
        }
        const group = courseMap.get(c.course_id)!;
        group.attempts.push(se);

        group.counts.totalAttempts++;
        const isSubmitted = Boolean(se.submitted_at);
        if (isSubmitted) {
          group.counts.submittedCount++;
          const timing = getSubmissionScheduleTiming(se);
          if (timing.isLateSubmission) {
            group.counts.lateCount++;
          }
        } else {
          group.counts.liveActive++;
        }
      }
    });

    return Array.from(courseMap.values()).sort((a, b) =>
      a.course_code.localeCompare(b.course_code)
    );
  }, [studentExams, assignedCourses, faculty.facultyCourses]);

  // Aggregate tally across all courses
  const overallMonitoringCounts = useMemo(() => {
    let totalAttempts = 0;
    let liveActive = 0;
    let submittedCount = 0;
    let lateCount = 0;

    (studentExams || []).forEach((se: any) => {
      totalAttempts++;
      const isSubmitted = Boolean(se.submitted_at);
      if (isSubmitted) {
        submittedCount++;
        const timing = getSubmissionScheduleTiming(se);
        if (timing.isLateSubmission) lateCount++;
      } else {
        liveActive++;
      }
    });

    return { totalAttempts, liveActive, submittedCount, lateCount };
  }, [studentExams]);

  // Currently focused course object (null if All Courses selected)
  const selectedMonitoringCourse = useMemo(() => {
    if (selectedMonitoringCourseId === "all") return null;
    return monitoringCoursesList.find((c) => c.course_id === selectedMonitoringCourseId) || null;
  }, [selectedMonitoringCourseId, monitoringCoursesList]);

  // Dynamic counts: If a specific course is selected, reflect that course's tally; otherwise show aggregate
  const monitoringCounts = useMemo(() => {
    if (selectedMonitoringCourse) {
      return selectedMonitoringCourse.counts;
    }
    return overallMonitoringCounts;
  }, [selectedMonitoringCourse, overallMonitoringCounts]);

  const filteredMonitoringData = useMemo(() => {
    const q = monitoringSearch.trim().toLowerCase();

    return monitoringCoursesList.map((courseGroup) => {
      const filteredAttempts = courseGroup.attempts.filter((se: any) => {
        // Search filter
        if (q) {
          const mi = getStudentMiddleInitial(se.student?.middle_name);
          const fullName = `${se.student?.first_name || ""} ${mi ? `${mi} ` : ""}${se.student?.last_name || ""}`.toLowerCase();
          const institutionalId = (se.student?.user?.institutional_id || se.student?.institutional_id || "").toLowerCase();
          const examTitle = (se.exam?.title || "").toLowerCase();
          const progSec = `${se.student?.program?.program_code || ""} ${se.student?.section || ""}`.toLowerCase();

          const matches = fullName.includes(q) || institutionalId.includes(q) || examTitle.includes(q) || progSec.includes(q);
          if (!matches) return false;
        }

        // Status filter
        if (monitoringStatusFilter !== "all") {
          const timing = getSubmissionScheduleTiming(se);
          const isSubmitted = Boolean(se.submitted_at);
          if (monitoringStatusFilter === "active" && isSubmitted) return false;
          if (monitoringStatusFilter === "submitted" && !isSubmitted) return false;
          if (monitoringStatusFilter === "late" && (!isSubmitted || !timing.isLateSubmission)) return false;
        }

        return true;
      });

      return {
        ...courseGroup,
        filteredAttempts,
      };
    });
  }, [monitoringCoursesList, monitoringSearch, monitoringStatusFilter]);

  // --- Question Bank Tab State ---
  const [qbFilters, setQbFilters] = useState({
    course_id: "",
    topic: "",
    year_level: ""
  });
  const [qbQuestions, setQbQuestions] = useState<any[]>([]);
  const [loadingQb, setLoadingQb] = useState(false);

  // Question CRUD Modal State
  const [qModalOpen, setQModalOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<any | null>(null);
  const [qForm, setQForm] = useState({
    course_id: "",
    topic: "",
    year_level: "",
    question_type: "Multiple_Choice",
    question_text: "",
    correct_answer: "",
    points: 1
  });
  const [isSavingQ, setIsSavingQ] = useState(false);

  // --- Archived Exams Tab State ---
  const [archiveFilters, setArchiveFilters] = useState({
    course_id: ""
  });
  const [archivedExams, setArchivedExams] = useState<any[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [isReusingExamId, setIsReusingExamId] = useState<number | null>(null);

  // Active exam archiving states
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [examToArchive, setExamToArchive] = useState<any | null>(null);
  const [academicYearInput, setAcademicYearInput] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);

  const getExamDisplayTitle = (
    exam: {
      exam_id?: number;
      title: string;
      term?: string | null;
      semester?: string | null;
      course?: { course_code: string; course_title: string } | null;
    },
    fallbackIndex?: number
  ): string => {
    if (exam.title && exam.title !== "New Examination Draft") {
      return exam.title;
    }
    const termStr = exam.term || "Prelim";
    const courseTitleStr = exam.course?.course_title || exam.course?.course_code || "";
    const courseStr = courseTitleStr ? ` in ${courseTitleStr}` : "";
    const suffix = fallbackIndex !== undefined ? ` (Draft #${fallbackIndex + 1})` : " (Draft)";
    return `${termStr} Examination${courseStr}${suffix}`;
  };

  // --- Enrolled Students & Grades Roster Modal State ---
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [rosterStudents, setRosterStudents] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterFilters, setRosterFilters] = useState({
    course_id: "",
    status: "ALL",
    search: ""
  });

  const fetchEnrolledStudentsAndGrades = async () => {
    setLoadingRoster(true);
    try {
      const res = await getFacultyEnrolledStudentsAndGrades(faculty.faculty_id);
      if (res.success && res.enrolledStudents) {
        setRosterStudents(res.enrolledStudents);
      }
    } catch (err) {
      console.error("Failed to fetch roster:", err);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleOpenRosterModal = () => {
    setRosterModalOpen(true);
    fetchEnrolledStudentsAndGrades();
  };

  const fetchQbQuestions = async () => {
    setLoadingQb(true);
    try {
      const res = await getQuestionBankQuestions({
        course_id: qbFilters.course_id ? Number(qbFilters.course_id) : undefined,
        topic: qbFilters.topic || undefined,
        year_level: qbFilters.year_level ? Number(qbFilters.year_level) : undefined
      });
      if (res.success && res.questions) {
        setQbQuestions(res.questions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQb(false);
    }
  };

  const fetchArchivedExams = async () => {
    setLoadingArchives(true);
    try {
      const res = await getArchivedExaminations(archiveFilters.course_id ? Number(archiveFilters.course_id) : undefined);
      if (res.success && res.exams) {
        setArchivedExams(res.exams);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingArchives(false);
    }
  };

  useEffect(() => {
    if (activeTab === "question_bank") {
      fetchQbQuestions();
    }
  }, [activeTab, qbFilters]);

  useEffect(() => {
    if (activeTab === "archive") {
      fetchArchivedExams();
    }
  }, [activeTab, archiveFilters]);

  const handleSaveQuestionBankItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qForm.course_id) {
      alert("Please select a Course.");
      return;
    }
    setIsSavingQ(true);
    try {
      const res = await saveQuestionBankQuestion(faculty.faculty_id, {
        question_id: editingQ?.question_id,
        course_id: Number(qForm.course_id),
        question_text: qForm.question_text,
        question_type: qForm.question_type as any,
        correct_answer: qForm.correct_answer,
        points: Number(qForm.points) || 1,
        topic: qForm.topic || undefined,
        year_level: qForm.year_level ? Number(qForm.year_level) : undefined
      });
      if (res.success) {
        setQModalOpen(false);
        fetchQbQuestions();
        alert("Question bank item saved successfully!");
      } else {
        alert(res.error || "Failed to save question bank item.");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setIsSavingQ(false);
    }
  };

  const handleDeleteQuestionBankItem = async (questionId: number) => {
    if (!confirm("Are you sure you want to delete this question from the Question Bank repository?")) return;
    try {
      const res = await deleteQuestionBankQuestion(questionId, faculty.faculty_id);
      if (res.success) {
        fetchQbQuestions();
        alert("Question deleted successfully!");
      } else {
        alert(res.error || "Failed to delete question bank item.");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    }
  };

  const handleReuseExam = async (examId: number) => {
    if (courses.length === 0 || assignedCourses.length === 0) {
      setUnassignedActionText("reusing archived examinations");
      setUnassignedWarningModalOpen(true);
      return;
    }
    setIsReusingExamId(examId);
    try {
      const res = await reuseArchivedExamination(examId, faculty.faculty_id);
      if (res.success && res.exam_id) {
        alert("Exam duplicated successfully as a Draft. Redirecting to Exam Builder...");
        router.push(`/dashboard/faculty/exams/${res.exam_id}/builder`);
      } else {
        alert(res.error || "Failed to reuse exam.");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setIsReusingExamId(null);
    }
  };

  const handleArchiveExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examToArchive || !academicYearInput) return;
    setIsArchiving(true);
    try {
      const res = await archiveExamination(examToArchive.exam_id, academicYearInput, faculty.faculty_id);
      if (res.success) {
        alert("Examination archived successfully!");
        setArchiveModalOpen(false);
        setExamToArchive(null);
        setAcademicYearInput("");
        router.refresh();
      } else {
        alert(res.error || "Failed to archive exam.");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setIsArchiving(false);
    }
  };

  // Violation Audit Logs State variables
  const [selectedAttemptLogs, setSelectedAttemptLogs] = useState<any[] | null>(null);
  const [selectedAttemptStudentName, setSelectedAttemptStudentName] = useState<string>("");
  const [logsModalOpen, setLogsModalOpen] = useState<boolean>(false);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const handleViewAttemptLogs = async (studentId: number, studentName: string, examId: number) => {
    setLoadingLogs(true);
    setSelectedAttemptStudentName(studentName);
    setSelectedAttemptLogs(null);
    setLogsModalOpen(true);
    try {
      const res = await getStudentExamLogs(studentId, examId);
      if (res.success && res.logs) {
        setSelectedAttemptLogs(res.logs);
      } else {
        alert(res.error || "Failed to retrieve logs.");
        setLogsModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching attempt logs.");
      setLogsModalOpen(false);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleViewExamPaper = async (se: any) => {
    setLoadingExamPaper(true);
    setExamPaperModalOpen(true);
    setActiveExamPaperData(null);
    try {
      const res = await getStudentExamPaper(se.student_exam_id);
      if (res.success && res.paper) {
        setActiveExamPaperData(res.paper);
        const drafts: Record<number, number> = {};
        res.paper.exam.questions.forEach((q: any) => {
          if (q.question_type === "Essay" && q.answer_id) {
            drafts[q.answer_id] = q.points_awarded !== null ? q.points_awarded : 0;
          }
        });
        setEssayPointsDraft(drafts);
      } else {
        const questions = se.exam?.questionBank || [];
        const answers = se.studentAnswers || [];
        const penaltyPerViolation = se.exam?.score_penalty_points ?? 2;
        const penaltyPoints = (se.violations_count || 0) * penaltyPerViolation;
        const rawItemsScore = se.rawScore ?? ((se.total_score || 0) + (se.submitted_at ? penaltyPoints : 0));
        const finalTotalScore = se.finalScore ?? (se.total_score || 0);

        const mappedQuestions = questions.map((q: any) => {
          const ans = answers.find((a: any) => a.question_id === q.question_id);
          return {
            ...q,
            submitted_response: ans?.submitted_response || "",
            is_correct: ans?.is_correct ?? null,
            points_awarded: ans?.points_awarded ?? null,
            answer_id: ans?.answer_id || null,
          };
        });

        setActiveExamPaperData({
          student_exam_id: se.student_exam_id,
          started_at: se.started_at,
          submitted_at: se.submitted_at,
          violations_count: se.violations_count || 0,
          submission_trigger: se.submission_trigger,
          rawItemsScore,
          penaltyPoints,
          penaltyPerViolation,
          finalTotalScore,
          hasEssay: questions.some((q: any) => q.question_type === "Essay"),
          pendingEssayCount: 0,
          student: {
            first_name: se.student?.first_name,
            middle_name: se.student?.middle_name,
            last_name: se.student?.last_name,
            year_level: se.student?.year_level,
            section: se.student?.section,
            program_code: se.student?.program?.program_code || "",
          },
          exam: {
            title: se.exam?.title,
            term: se.exam?.term,
            semester: se.exam?.semester,
            course: se.exam?.course,
            questions: mappedQuestions,
          },
        });
      }
    } catch (err) {
      console.error("Error loading exam paper:", err);
    } finally {
      setLoadingExamPaper(false);
    }
  };

  const handleOpenEssayGrading = async (se: any) => {
    setLoadingEssayGrading(true);
    setEssayGradingModalOpen(true);
    setActiveEssayGradingData(null);
    try {
      const res = await getStudentExamPaper(se.student_exam_id);
      if (res.success && res.paper) {
        setActiveEssayGradingData(res.paper);
        const drafts: Record<number, number> = {};
        res.paper.exam.questions.forEach((q: any) => {
          if (q.question_type === "Essay" && q.answer_id) {
            drafts[q.answer_id] = q.points_awarded !== null ? q.points_awarded : (q.points || 10);
          }
        });
        setEssayPointsDraft(drafts);
      } else {
        alert(res.error || "Failed to load student essay responses.");
        setEssayGradingModalOpen(false);
      }
    } catch (err) {
      console.error("Error opening essay grading:", err);
      alert("An unexpected error occurred while loading essay questions.");
      setEssayGradingModalOpen(false);
    } finally {
      setLoadingEssayGrading(false);
    }
  };

  const handleSaveEssayScore = async (answerId: number, maxPoints: number) => {
    const targetExamId = activeExamPaperData?.student_exam_id || activeEssayGradingData?.student_exam_id;
    if (!targetExamId) return;
    const points = essayPointsDraft[answerId] !== undefined ? essayPointsDraft[answerId] : 0;
    const clampedPoints = Math.max(0, Math.min(maxPoints, points));

    setSavingEssayId(answerId);
    try {
      const res = await gradeEssayAnswer(
        faculty.faculty_id,
        answerId,
        clampedPoints,
        clampedPoints > 0
      );
      if (res.success) {
        const fresh = await getStudentExamPaper(targetExamId);
        if (fresh.success && fresh.paper) {
          if (activeExamPaperData) setActiveExamPaperData(fresh.paper);
          if (activeEssayGradingData) setActiveEssayGradingData(fresh.paper);
          const drafts: Record<number, number> = {};
          fresh.paper.exam.questions.forEach((q: any) => {
            if (q.question_type === "Essay" && q.answer_id) {
              drafts[q.answer_id] = q.points_awarded !== null ? q.points_awarded : 0;
            }
          });
          setEssayPointsDraft(drafts);
        }
        setEssayGradeSuccessToast(`Successfully awarded ${clampedPoints} / ${maxPoints} pts! Exam grade recalculated.`);
        setTimeout(() => setEssayGradeSuccessToast(null), 3500);
        router.refresh();
        if (selectedOverrideExamId) {
          fetchMissedStudents(selectedOverrideExamId);
        }
      } else {
        alert(res.error || "Failed to grade essay answer.");
      }
    } catch (err: any) {
      console.error("Error grading essay:", err);
      alert("An unexpected error occurred while saving essay grade.");
    } finally {
      setSavingEssayId(null);
    }
  };
  
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
  const [middleName, setMiddleName] = useState(faculty.middle_name || "");
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

  // States for Student Access Resets & Reschedule Overrides
  const [selectedOverrideCourseId, setSelectedOverrideCourseId] = useState<number | null>(null);
  const [selectedOverrideExamId, setSelectedOverrideExamId] = useState<number | null>(null);
  const [missedStudents, setMissedStudents] = useState<any[]>([]);
  const [isLoadingMissedStudents, setIsLoadingMissedStudents] = useState(false);
  const [overrideExamInfo, setOverrideExamInfo] = useState<{
    has_essay?: boolean;
    total_exam_points?: number;
    max_essay_points?: number;
    score_penalty_points?: number;
  } | null>(null);
  const [inlineEssayScores, setInlineEssayScores] = useState<Record<number, number>>({});
  const [savingInlineEssayId, setSavingInlineEssayId] = useState<number | null>(null);

  const handleSaveInlineEssayScore = async (answerId: number, maxPoints: number) => {
    const currentVal = inlineEssayScores[answerId];
    if (currentVal === undefined || currentVal === null || isNaN(Number(currentVal))) return;
    const clampedPoints = Math.max(0, Math.min(maxPoints, Number(currentVal)));
    setSavingInlineEssayId(answerId);
    try {
      const res = await gradeEssayAnswer(faculty.faculty_id, answerId, clampedPoints, clampedPoints > 0);
      if (res.success) {
        if (selectedOverrideExamId) {
          await fetchMissedStudents(selectedOverrideExamId);
        }
        setEssayGradeSuccessToast(`Awarded ${clampedPoints}/${maxPoints} pts! Total score updated.`);
        setTimeout(() => setEssayGradeSuccessToast(null), 3000);
        router.refresh();
      } else {
        alert(res.error || "Failed to save score.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving score.");
    } finally {
      setSavingInlineEssayId(null);
    }
  };

  const [studentStatusFilter, setStudentStatusFilter] = useState<"ALL" | "TAKERS" | "MISSED" | "OVERRIDE">("ALL");
  const [popupStudentFilter, setPopupStudentFilter] = useState<"ALL" | "TAKERS" | "MISSED">("ALL");
  
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedOverrideStudentIds, setSelectedOverrideStudentIds] = useState<number[]>([]);
  const [popupStudentSearchInput, setPopupStudentSearchInput] = useState("");
  const [popupStudentSearchTerm, setPopupStudentSearchTerm] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [officialExamScheduleText, setOfficialExamScheduleText] = useState("");
  const [overrideForm, setOverrideForm] = useState({
    start_date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_date: new Date(Date.now() + 86400000).toISOString().split("T")[0], // tomorrow
    end_time: "09:00"
  });
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  // Memoized courses available to faculty
  const availableFacultyCourses = useMemo(() => {
    const map = new Map<number, { course_id: number; course_code: string; course_title: string }>();
    if (assignedCourses && assignedCourses.length > 0) {
      assignedCourses.forEach(c => map.set(c.course_id, { course_id: c.course_id, course_code: c.course_code, course_title: c.course_title }));
    }
    faculty.examinations.forEach(e => {
      const cId = (e as any).course_id || (e.course as any)?.course_id;
      if (cId && e.course) {
        if (!map.has(cId)) {
          map.set(cId, { course_id: cId, course_code: e.course.course_code, course_title: e.course.course_title });
        }
      }
    });
    if (map.size === 0 && courses && courses.length > 0) {
      courses.forEach(c => map.set(c.course_id, { course_id: c.course_id, course_code: c.course_code, course_title: c.course_title }));
    }
    return Array.from(map.values()).sort((a, b) => a.course_code.localeCompare(b.course_code));
  }, [assignedCourses, faculty.examinations, courses]);

  // Approved exams filtered by selected course (or all if none selected)
  const overrideFilteredExams = useMemo(() => {
    const approved = faculty.examinations.filter(exam => exam.current_status === "Approved");
    if (!selectedOverrideCourseId) return approved;
    return approved.filter(exam => {
      const cId = (exam as any).course_id || (exam.course as any)?.course_id;
      return cId === selectedOverrideCourseId;
    });
  }, [faculty.examinations, selectedOverrideCourseId]);

  const fetchMissedStudents = async (examId: number) => {
    setIsLoadingMissedStudents(true);
    const { getMissedStudentsForExam } = await import("@/app/actions/faculty");
    const res = await getMissedStudentsForExam(faculty.faculty_id, examId);
    setIsLoadingMissedStudents(false);
    if (res.error) {
      alert(res.error);
    } else {
      setMissedStudents(res.students || []);
      setOverrideExamInfo({
        has_essay: res.has_essay,
        total_exam_points: res.total_exam_points,
        max_essay_points: res.max_essay_points,
        score_penalty_points: res.score_penalty_points,
      });
      if (res.course?.course_id && !selectedOverrideCourseId) {
        setSelectedOverrideCourseId(res.course.course_id);
      }
      if (res.officialDateIso) {
        setOfficialExamScheduleText(
          new Date(res.officialDateIso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
        );
      } else {
        setOfficialExamScheduleText("Standard Examination Schedule");
      }
    }
  };

  useEffect(() => {
    if (selectedOverrideExamId) {
      fetchMissedStudents(selectedOverrideExamId);
      setStudentStatusFilter("ALL");
      setStudentSearchTerm("");
    } else {
      setMissedStudents([]);
      setOverrideExamInfo(null);
      setOfficialExamScheduleText("");
      setStudentSearchTerm("");
    }
  }, [selectedOverrideExamId]);

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOverrideStudentIds.length === 0 || !selectedOverrideExamId) {
      alert("Please select at least one assigned student allowed to retake the examination.");
      return;
    }

    const startTimeStr = `${overrideForm.start_date}T${overrideForm.start_time}:00`;
    const endTimeStr = `${overrideForm.end_date}T${overrideForm.end_time}:00`;

    setIsSavingOverride(true);
    const { grantStudentOverride } = await import("@/app/actions/faculty");
    
    let successCount = 0;
    let lastError = "";

    for (const studentId of selectedOverrideStudentIds) {
      const res = await grantStudentOverride(
        faculty.faculty_id,
        studentId,
        selectedOverrideExamId,
        startTimeStr,
        endTimeStr
      );
      if (res.error) {
        lastError = res.error;
      } else {
        successCount++;
      }
    }

    setIsSavingOverride(false);

    if (successCount > 0) {
      alert(`Examination successfully reopened for ${successCount} student(s)! Official examination date and TOS remain preserved.`);
      setOverrideModalOpen(false);
      fetchMissedStudents(selectedOverrideExamId);
      router.refresh();
    } else {
      alert(lastError || "Failed to grant override for selected student(s).");
    }
  };

  const handleRevokeOverride = async (studentId: number) => {
    if (!selectedOverrideExamId) return;
    if (!confirm("Are you sure you want to revoke this student's reopened examination window?")) return;

    const { revokeStudentOverride } = await import("@/app/actions/faculty");
    const res = await revokeStudentOverride(faculty.faculty_id, studentId, selectedOverrideExamId);

    if (res.error) {
      alert(res.error);
    } else {
      alert("Reopened examination access window revoked successfully.");
      fetchMissedStudents(selectedOverrideExamId);
      router.refresh();
    }
  };
  const [scheduleForm, setScheduleForm] = useState({
    program_id: "",
    year_level: "1",
    section: "All Sections",
    scheduled_date: "",
    start_time: "",
    end_time: ""
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleSuccessModalOpen, setScheduleSuccessModalOpen] = useState(false);
  const [scheduleSuccessInfo, setScheduleSuccessInfo] = useState<{
    examTitle: string;
    date: string;
    startTime: string;
    endTime: string;
    notifiedCount: number;
  } | null>(null);

  const handleOpenScheduleModal = (examId: number, title: string) => {
    setSelectedExamForSchedule({ exam_id: examId, title });
    setScheduleModalOpen(true);

    const targetExam = faculty.examinations.find(e => e.exam_id === examId);
    const existingTarget = targetExam?.examTargets?.[0];

    let initialDate = "";
    if (existingTarget?.scheduled_date) {
      initialDate = typeof existingTarget.scheduled_date === "string"
        ? existingTarget.scheduled_date.split("T")[0]
        : new Date(existingTarget.scheduled_date).toISOString().split("T")[0];
    } else if ((targetExam as any)?.exam_date) {
      const examDateVal = (targetExam as any).exam_date;
      initialDate = typeof examDateVal === "string"
        ? examDateVal.split("T")[0]
        : new Date(examDateVal).toISOString().split("T")[0];
    }

    if (existingTarget) {
      const formatTime = (timeStr: string) => {
        try {
          if (timeStr.includes("T")) {
            return timeStr.split("T")[1].slice(0, 5);
          }
          return timeStr.slice(0, 5);
        } catch {
          return "09:00";
        }
      };

      setScheduleForm({
        program_id: String(existingTarget.program_id),
        year_level: String(existingTarget.year_level),
        section: existingTarget.section || "All Sections",
        scheduled_date: initialDate,
        start_time: formatTime(existingTarget.start_time),
        end_time: formatTime(existingTarget.end_time)
      });
    } else {
      const progId = (targetExam as any)?.course?.program_id || (programs.length > 0 ? programs[0].program_id : "");
      setScheduleForm({
        program_id: String(progId),
        year_level: "1",
        section: "All Sections",
        scheduled_date: initialDate,
        start_time: "09:00",
        end_time: "10:00"
      });
    }
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
      setScheduleSuccessInfo({
        examTitle: selectedExamForSchedule.title,
        date: scheduleForm.scheduled_date,
        startTime: scheduleForm.start_time,
        endTime: scheduleForm.end_time,
        notifiedCount: res.notifiedCount ?? 0,
      });
      setScheduleSuccessModalOpen(true);
      router.refresh();
    }
  };

  const handleSingleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (courses.length === 0 || assignedCourses.length === 0) {
      setEnrollModalOpen(false);
      setUnassignedActionText("adding students to the class roster");
      setUnassignedWarningModalOpen(true);
      return;
    }
    setEnrollError(null);
    setEnrollSuccess(null);
    setIsSubmittingEnroll(true);

    const res = await enrollStudentInCourse(faculty.faculty_id, selectedRosterCourseId, {
      institutionalId: enrollForm.institutionalId,
      firstName: enrollForm.firstName,
      middleName: enrollForm.middleName,
      lastName: enrollForm.lastName,
      programId: Number(enrollForm.programId),
      yearLevel: Number(enrollForm.yearLevel),
      section: enrollForm.section,
    });
    setIsSubmittingEnroll(false);

    if (res.error) {
      if (res.error.includes("UNASSIGNED_TEACHING_LOAD")) {
        setEnrollModalOpen(false);
        setUnassignedActionText("adding students to the class roster");
        setUnassignedWarningModalOpen(true);
      } else {
        setEnrollError(res.error);
      }
    } else {
      setEnrollSuccess(res.message || "Student enrolled successfully!");
      fetchRoster(selectedRosterCourseId);
      setTimeout(() => {
        setEnrollModalOpen(false);
        setEnrollForm({
          institutionalId: "",
          firstName: "",
          middleName: "",
          lastName: "",
          programId: programs[0]?.program_id ? String(programs[0].program_id) : "",
          yearLevel: "1",
          section: "A",
        });
        setEnrollSuccess(null);
      }, 1200);
    }
  };

  const handleBulkEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (courses.length === 0 || assignedCourses.length === 0) {
      setBulkEnrollModalOpen(false);
      setUnassignedActionText("bulk enrolling students to the class roster");
      setUnassignedWarningModalOpen(true);
      return;
    }
    setBulkResult(null);
    setIsSubmittingBulk(true);

    const res = await bulkEnrollStudentsInCourse(
      faculty.faculty_id,
      selectedRosterCourseId,
      bulkInput,
      Number(bulkProgramId),
      Number(bulkYearLevel),
      bulkSection
    );
    setIsSubmittingBulk(false);

    if (res.error) {
      if (res.error.includes("UNASSIGNED_TEACHING_LOAD")) {
        setBulkEnrollModalOpen(false);
        setUnassignedActionText("bulk enrolling students to the class roster");
        setUnassignedWarningModalOpen(true);
      } else {
        setBulkResult({ message: res.error, errors: [] });
      }
    } else {
      setBulkResult({
        message: res.message || `Successfully enrolled ${res.enrolledCount} students!`,
        errors: res.errors,
      });
      fetchRoster(selectedRosterCourseId);
      if (res.enrolledCount && res.enrolledCount > 0) {
        setTimeout(() => {
          setBulkEnrollModalOpen(false);
          setBulkInput("");
          setBulkResult(null);
        }, 2000);
      }
    }
  };

  const handleUnenroll = async (studentId: number, studentName: string) => {
    if (!confirm(`Are you sure you want to unenroll ${studentName} from this class?`)) {
      return;
    }
    setUnenrollingId(studentId);
    const res = await unenrollStudentFromCourse(faculty.faculty_id, selectedRosterCourseId, studentId);
    setUnenrollingId(null);
    if (res.error) {
      alert(res.error);
    } else {
      fetchRoster(selectedRosterCourseId);
    }
  };

  const handleCreateExam = async () => {
    if (courses.length === 0 && assignedCourses.length === 0) {
      setUnassignedActionText("creating new examination drafts");
      setUnassignedWarningModalOpen(true);
      return;
    }
    setIsCreatingExam(true);
    const defaultCourseId = assignedCourses[0]?.course_id || courses[0]?.course_id;
    const res = await createExamDraft(faculty.faculty_id, defaultCourseId);
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

    const res = await updateFacultyProfile(faculty.faculty_id, firstName, lastName, middleName);
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

  const getExamScheduleStatus = (exam: any) => {
    if (exam.current_status !== "Approved") {
      return exam.current_status;
    }
    const target = exam.examTargets?.[0];
    if (!target || !target.start_time || !target.end_time) {
      return "Approved_Schedule_Pending";
    }

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const scheduledDate = new Date(target.scheduled_date);
    const startTime = new Date(target.start_time);
    const endTime = new Date(target.end_time);

    const examStart = new Date(
      scheduledDate.getUTCFullYear(),
      scheduledDate.getUTCMonth(),
      scheduledDate.getUTCDate(),
      startTime.getUTCHours(),
      startTime.getUTCMinutes(),
      0
    );

    const examEnd = new Date(
      scheduledDate.getUTCFullYear(),
      scheduledDate.getUTCMonth(),
      scheduledDate.getUTCDate(),
      endTime.getUTCHours(),
      endTime.getUTCMinutes(),
      0
    );

    if (now < examStart) {
      return "Scheduled";
    }
    if (now >= examStart && now <= examEnd) {
      return "Live";
    }

    // Check if any student started taking the exam and is currently finishing within their allowed time limit
    const attempts = (studentExams || []).filter(
      (se: any) => se.exam_id === exam.exam_id || se.exam?.exam_id === exam.exam_id
    );

    const activeAttemptsCount = attempts.filter((se: any) => {
      if (se.submitted_at) return false;
      const startedAt = new Date(se.started_at);
      const elapsedMs = now.getTime() - startedAt.getTime();
      const limitMs = (exam.time_limit_minutes || 60) * 60 * 1000;
      return elapsedMs < limitMs;
    }).length;

    if (activeAttemptsCount > 0) {
      return "In_Progress";
    }

    return "Completed";
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string, exam?: any) => {
    let effectiveStatus = status;
    if (exam && status === "Approved") {
      effectiveStatus = getExamScheduleStatus(exam);
    }

    switch (effectiveStatus) {
      case "Draft":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
            Draft
          </span>
        );
      case "Pending_Program_Chair":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Pending Program Chairperson Review
          </span>
        );
      case "Pending_Chair":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Department Chairperson Review
          </span>
        );
      case "Pending_DI":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Pending Director for Instruction Approval
          </span>
        );
      case "Approved_Schedule_Pending":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            Approved — Schedule Pending
          </span>
        );
      case "Scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            Scheduled
          </span>
        );
      case "Live":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            Live / Active
          </span>
        );
      case "In_Progress":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            Students In Progress
          </span>
        );
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full shadow-sm">
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
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Exam Concluded
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
    if (exam.is_archived) return false;
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
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "students"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Class Students
        </button>
        <button
          onClick={() => setActiveTab("archive")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "archive"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Award className="w-4 h-4" />
          Exam Archives
        </button>
        <button
          onClick={() => setActiveTab("override")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "override"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Settings className="w-4 h-4" />
          Override Controls and Student Scores
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Panel: Portfolios & Overview Stats */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-5">
            {/* Compact Faculty Identity Card */}
            <div className="bg-gradient-to-b from-[#7A151A] to-[#580B0F] rounded-2xl overflow-hidden shadow-md border-2 border-[#E2A123]/60 relative text-white transition-all duration-300 hover:shadow-xl group/idcard select-none">
              {/* Card Holographic/Vector overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px] opacity-40 pointer-events-none" />
              <div className="absolute top-0 right-0 w-24 h-full bg-[#E2A123]/5 transform skew-x-12 origin-top-right pointer-events-none" />
              
              {/* ID Card Header */}
              <div className="bg-[#580B0F] px-4 py-2.5 border-b border-[#E2A123]/30 flex items-center gap-2.5">
                <div className="bg-white p-1 rounded-full border border-[#E2A123]/50 shrink-0 shadow-sm">
                  <img src="/bsc-logo.png" alt="BSC Logo" className="w-6 h-6 object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-[#E2A123] font-black uppercase tracking-wider leading-none">Batanes State College</p>
                  <p className="text-[10px] text-amber-100 font-bold uppercase tracking-widest mt-0.5 opacity-90 leading-none">Faculty Identity Card</p>
                </div>
              </div>

              {/* ID Card Body */}
              <div className="p-4 flex flex-col items-center text-center space-y-3">
                {/* Profile Image Frame */}
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#E2A123] bg-[#7A151A]/40 shadow-inner flex items-center justify-center shrink-0">
                  {faculty.profile_image ? (
                    <img src={faculty.profile_image} alt={`${faculty.first_name} ${faculty.last_name}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-[#7A151A] to-amber-700 flex items-center justify-center text-white text-2xl font-black">
                      {faculty.first_name.charAt(0)}{faculty.last_name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Faculty Name & Role */}
                <div className="space-y-0.5">
                  <h3 className="text-base font-black tracking-wide truncate max-w-[220px]">
                    {faculty.first_name} {faculty.middle_name ? `${faculty.middle_name.charAt(0).toUpperCase()}. ` : ""}{faculty.last_name}
                  </h3>
                  <p className="text-[9px] bg-[#E2A123]/20 text-[#E2A123] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full inline-block border border-[#E2A123]/30">
                    Faculty Instructor
                  </p>
                </div>

                {/* Faculty Specific Details */}
                <div className="w-full text-left bg-black/15 rounded-xl p-3 border border-white/5 space-y-1.5 text-[11px] font-semibold text-neutral-100">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-amber-200/70 text-[9px] font-bold uppercase tracking-wider">Dept</span>
                    <span className="truncate max-w-[150px] font-bold">{faculty.department?.department_name || "BSC Faculty"}</span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-amber-200/70 text-[9px] font-bold uppercase tracking-wider">ID Number</span>
                    <span className="font-mono font-bold">{institutionalId}</span>
                  </div>
                  {username && (
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-amber-200/70 text-[9px] font-bold uppercase tracking-wider">Username</span>
                      <span className="font-mono font-bold text-amber-300">{username}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-3 border-t border-white/10 pt-1.5 mt-1.5">
                    <span className="text-amber-200/70 text-[9px] font-bold uppercase tracking-wider">Email</span>
                    <span className="truncate max-w-[150px] font-mono text-neutral-200 text-[10px]">
                      {faculty.institutional_email || `${institutionalId.toLowerCase()}@acadnexus.bsc.edu.ph`}
                    </span>
                  </div>
                </div>

                {/* Aesthetic Digital Card Details */}
                <div className="w-full flex items-center justify-between border-t border-white/10 pt-2">
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[7px] text-white/40 font-bold uppercase tracking-widest">Digital ID Security</span>
                    <span className="text-[8px] text-[#E2A123] font-bold font-mono tracking-wider">SECURE-ACADNEXUS-2026</span>
                  </div>
                  {/* Stylized CSS Barcode */}
                  <div className="flex gap-[2px] items-center h-4 opacity-60">
                    <div className="w-[2px] h-4 bg-white" />
                    <div className="w-[1px] h-4 bg-white" />
                    <div className="w-[3px] h-4 bg-white" />
                    <div className="w-[1px] h-4 bg-white" />
                    <div className="w-[2px] h-4 bg-white" />
                    <div className="w-[1px] h-4 bg-white" />
                    <div className="w-[4px] h-4 bg-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned Courses / Teaching Load */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-emerald-600 rounded-full" />
                  Assigned Teaching Load
                </h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
                  {assignedCourses.length} Assigned
                </span>
              </div>
              {assignedCourses.length > 0 ? (
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                  {assignedCourses.map((c) => (
                    <div key={c.course_id} className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 hover:border-emerald-200 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 shrink-0">
                            {c.course_code}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 truncate mt-1">
                          {c.course_title}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 shrink-0">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">No official courses assigned yet by Department Chair or Academic Directorate.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Examinations & Drafts with Review Workflow */}
          <div className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                  Examinations & Drafts
                  {faculty.examinations && faculty.examinations.length > 0 && (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                      {faculty.examinations.length}
                    </span>
                  )}
                </h2>
              </div>
              <button
                disabled={isCreatingExam}
                onClick={handleCreateExam}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all hover:scale-105 duration-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                {isCreatingExam ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Create Exam
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              {[
                { id: "ALL", label: "All" },
                { id: "Draft", label: "Draft" },
                { id: "Pending_Program_Chair", label: "Pending Program Chairperson" },
                { id: "Pending_Chair", label: "Pending Department Chairperson" },
                { id: "Pending_DI", label: "Pending DI" },
                { id: "Approved", label: "Approved" },
                { id: "Returned", label: "Returned" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTrackerFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    trackerFilter === tab.id
                      ? "bg-white text-emerald-700 shadow-sm border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredExams.length > 0 ? (
              <div className="max-h-[650px] overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {filteredExams.map((exam) => {
                  const isTransitioning = transitioningExamId === exam.exam_id;
                  
                  return (
                    <div 
                      key={exam.exam_id} 
                      className="border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-slate-50/30"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                        <div className="flex-1 w-full">
                          <div className="space-y-1.5">
                            <h3 className="text-base font-extrabold text-slate-900">{getExamDisplayTitle(exam)}</h3>
                            <div>
                              {renderStatusBadge(exam.current_status, exam)}
                            </div>
                          </div>
                          
                          <p className="text-xs text-slate-400 font-semibold mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-slate-400 font-medium">{exam.course.course_code} - {exam.course.course_title}</span>
                            <span className="text-slate-400">•</span>
                            <span>{exam.time_limit_minutes || 60} min</span>
                            <span className="text-slate-400">•</span>
                            <span>{exam._count?.questionBank ?? 0} Questions</span>
                          </p>

                          {exam.current_status === "Approved" && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg w-fit shadow-sm">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Digitally Signed
                            </div>
                          )}
                        </div>

                        {/* Interactive Primary Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {exam.current_status === "Draft" && (
                            <>
                              <button
                                disabled={isTransitioning}
                                onClick={() => handleStatusTransition(exam.exam_id, "Pending_Chair")}
                                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-all duration-300 cursor-pointer"
                                title="Submit exam for Chair review"
                              >
                                {isTransitioning ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                Submit for Review
                              </button>

                              <div className="flex items-center gap-1.5 ml-1">
                                <button
                                  onClick={() => router.push(`/dashboard/faculty/exams/${exam.exam_id}/builder`)}
                                  className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 rounded-xl shadow-sm transition-all cursor-pointer"
                                  title="Edit Exam in Builder"
                                >
                                  <PenTool className="w-4 h-4" />
                                </button>
                                <button
                                  disabled={deletingExamId === exam.exam_id}
                                  onClick={() => handleDeleteExam(exam.exam_id)}
                                  className="p-1.5 border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                  title="Delete Exam"
                                >
                                  {deletingExamId === exam.exam_id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </>
                          )}

                          {exam.current_status === "Returned" && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/dashboard/faculty/exams/${exam.exam_id}/builder`)}
                                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
                              >
                                <PenTool className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                disabled={deletingExamId === exam.exam_id}
                                onClick={() => handleDeleteExam(exam.exam_id)}
                                className="p-1.5 border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                title="Delete Exam"
                              >
                                {deletingExamId === exam.exam_id ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          )}

                          {exam.current_status === "Approved" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleOpenScheduleModal(exam.exam_id, exam.title)}
                                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-all duration-300 cursor-pointer"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                {exam.examTargets && exam.examTargets.length > 0 ? "Update Schedule" : "Set Schedule & Publish"}
                              </button>
                              <button
                                onClick={async () => {
                                  setExamToArchive(exam);
                                  const ay = await getCurrentAcademicYear();
                                  setAcademicYearInput(ay);
                                  setArchiveModalOpen(true);
                                }}
                                className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-all duration-300 cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                Archive Exam
                              </button>
                            </div>
                          )}
                        </div>
                      </div>



                      {/* Returned Comments Showcase */}
                      {exam.current_status === "Returned" && (
                        <div className="space-y-3">
                          {(() => {
                            const renderCommentCard = (commentsText: string, titleLabel: string) => {
                              let parsedComments: { general?: string; questions?: Record<string, string> } | null = null;
                              try {
                                const trimmed = commentsText.trim();
                                if (trimmed.startsWith("{")) {
                                  parsedComments = JSON.parse(trimmed);
                                }
                              } catch (e) {
                                // fallback to plain text
                              }

                              if (parsedComments) {
                                const hasGeneral = !!(parsedComments.general && parsedComments.general.trim().length > 0);
                                if (!hasGeneral) return null;
                                return (
                                  <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 space-y-3">
                                    <div className="flex gap-3 items-start">
                                      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-xs font-bold text-rose-800">{titleLabel}:</p>
                                        <p className="text-xs text-rose-700 mt-1 italic leading-relaxed">
                                          "{parsedComments.general!.trim()}"
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              // Graceful fallback to raw text (suppress raw JSON payloads)
                              if (commentsText.trim().startsWith("{")) {
                                return null;
                              }

                              return (
                                <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex gap-3 items-start">
                                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-bold text-rose-800">{titleLabel}:</p>
                                    <p className="text-xs text-rose-700 mt-1 italic leading-relaxed">
                                      "{commentsText}"
                                    </p>
                                  </div>
                                </div>
                              );
                            };

                            const showProgChairComments = !!exam.approvalWorkflow?.prog_chair_comments && (
                              exam.approvalWorkflow?.prog_chair_review_status === "Returned" || (!exam.approvalWorkflow?.chair_comments && !exam.approvalWorkflow?.di_comments)
                            );
                            const showChairComments = !!exam.approvalWorkflow?.chair_comments && (
                              exam.approvalWorkflow?.chair_review_status === "Returned" || (!exam.approvalWorkflow?.prog_chair_comments && !exam.approvalWorkflow?.di_comments) || (exam.approvalWorkflow?.prog_chair_review_status !== "Returned" && !exam.approvalWorkflow?.di_comments)
                            );
                            const showDiReturnedComments = !!exam.approvalWorkflow?.di_comments && exam.current_status === "Returned";

                            const card1 = showProgChairComments ? renderCommentCard(exam.approvalWorkflow!.prog_chair_comments!, "Returned by Program Chairperson") : null;
                            const card2 = showChairComments ? renderCommentCard(exam.approvalWorkflow!.chair_comments!, "Returned by Department Chairperson") : null;
                            const card3 = showDiReturnedComments ? renderCommentCard(exam.approvalWorkflow!.di_comments!, "Returned by Director of Instruction") : null;
                            const hasAnyCard = !!(card1 || card2 || card3);
                            if (!hasAnyCard) return null;

                            return (
                              <>
                                {card1}
                                {card2}
                                {card3}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Administrative Hold Remarks (when not in Returned status) */}
                      {exam.current_status !== "Returned" && exam.approvalWorkflow?.di_comments && (
                        <div className="bg-[#7A151A]/5 border border-[#7A151A]/20 rounded-xl p-4 flex gap-3 items-start mt-3">
                          <Clock className="w-5 h-5 text-[#7A151A] shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-[#7A151A]">Administrative Hold Remarks by Director:</p>
                            <p className="text-xs text-[#7A151A] mt-1 italic leading-relaxed">
                              "{exam.approvalWorkflow.di_comments}"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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



      {/* SUBMISSIONS TAB */}
      {activeTab === "submissions" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6 animate-in fade-in duration-300">
          {/* Header & Excel Export */}
          <div className="border-b border-slate-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Student Exam Monitoring & Results
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Live exam session tracking, security violation flags, and official submission scores categorized by course.
              </p>
            </div>
            {studentExams && studentExams.length > 0 && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonitoringCourseId === "all") {
                      exportExamSubmissionsToExcel(
                        "All_Courses",
                        faculty.department?.department_name || "Faculty",
                        studentExams
                      );
                    } else {
                      const selGroup = monitoringCoursesList.find(
                        (c) => c.course_id === selectedMonitoringCourseId
                      );
                      exportExamSubmissionsToExcel(
                        selGroup?.course_title || "Course_Monitoring",
                        selGroup?.course_code || "Course",
                        selGroup?.attempts || []
                      );
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-[1.02] shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {selectedMonitoringCourseId === "all"
                      ? "Export All Submissions Excel"
                      : `Export ${
                          monitoringCoursesList.find(
                            (c) => c.course_id === selectedMonitoringCourseId
                          )?.course_code || "Course"
                        } Excel`}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Course Tally Selector Tabs Bar */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Course Tally & Live Monitor:
                </span>
                <span className="text-[10px] text-slate-500 font-medium hidden md:inline">
                  (Select a course to view its specific tally numbers and exam results)
                </span>
              </div>
              {selectedMonitoringCourse && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg">
                    Showing: <strong className="text-emerald-800 font-extrabold">{selectedMonitoringCourse.course_code}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMonitoringCourseId("all")}
                    className="text-[11px] font-extrabold text-emerald-700 hover:text-emerald-900 bg-emerald-100/70 hover:bg-emerald-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                  >
                    View All Courses
                  </button>
                </div>
              )}
            </div>

            {/* Course Selector Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              <button
                type="button"
                onClick={() => setSelectedMonitoringCourseId("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                  selectedMonitoringCourseId === "all"
                    ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/10"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>All Courses</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    selectedMonitoringCourseId === "all"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {overallMonitoringCounts.totalAttempts}
                </span>
              </button>

              {monitoringCoursesList.map((cg) => {
                const isSelected = selectedMonitoringCourseId === cg.course_id;
                return (
                  <button
                    key={cg.course_id}
                    type="button"
                    onClick={() => setSelectedMonitoringCourseId(cg.course_id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span className="font-mono">{cg.course_code}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        isSelected
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {cg.counts.totalAttempts}
                    </span>
                    {cg.counts.liveActive > 0 && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                        title={`${cg.counts.liveActive} Live Active`}
                      />
                    )}
                    {cg.counts.lateCount > 0 && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                        title={`${cg.counts.lateCount} Submitted Past Schedule`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Attempts Card */}
            <div
              onClick={() => setMonitoringStatusFilter("all")}
              className={`bg-slate-50 border rounded-2xl p-4 space-y-1 transition-all cursor-pointer hover:shadow-xs ${
                monitoringStatusFilter === "all"
                  ? "border-slate-400 ring-2 ring-slate-400/20 bg-slate-100/70"
                  : "border-slate-200/80"
              }`}
              title="Click to filter all attempts"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Total Attempts
                </span>
                <span className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 uppercase tracking-tight truncate max-w-[120px]">
                  {selectedMonitoringCourse ? selectedMonitoringCourse.course_code : "All Subjects"}
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {monitoringCounts.totalAttempts}
              </p>
              <span className="text-[10px] text-slate-500 font-medium block truncate">
                {selectedMonitoringCourse
                  ? `For ${selectedMonitoringCourse.course_code} - ${selectedMonitoringCourse.course_title}`
                  : `Across ${monitoringCoursesList.length} teaching subject${monitoringCoursesList.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {/* Live In Progress Card */}
            <div
              onClick={() => setMonitoringStatusFilter(monitoringStatusFilter === "active" ? "all" : "active")}
              className={`bg-emerald-50/60 border rounded-2xl p-4 space-y-1 transition-all cursor-pointer hover:shadow-xs ${
                monitoringStatusFilter === "active"
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-100/70"
                  : "border-emerald-100"
              }`}
              title="Click to filter active live attempts"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live In Progress
                </span>
                <span className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-800 uppercase tracking-tight truncate max-w-[120px]">
                  {selectedMonitoringCourse ? selectedMonitoringCourse.course_code : "All Subjects"}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-800">
                {monitoringCounts.liveActive}
              </p>
              <span className="text-[10px] text-emerald-600 font-medium block truncate">
                {selectedMonitoringCourse
                  ? `Students taking ${selectedMonitoringCourse.course_code} exams`
                  : "Students currently taking exams"}
              </span>
            </div>

            {/* Submitted / Completed Card */}
            <div
              onClick={() => setMonitoringStatusFilter(monitoringStatusFilter === "submitted" ? "all" : "submitted")}
              className={`bg-blue-50/60 border rounded-2xl p-4 space-y-1 transition-all cursor-pointer hover:shadow-xs ${
                monitoringStatusFilter === "submitted"
                  ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-100/70"
                  : "border-blue-100"
              }`}
              title="Click to filter finalized attempts"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block">
                  Submitted / Completed
                </span>
                <span className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded bg-blue-200/80 text-blue-800 uppercase tracking-tight truncate max-w-[120px]">
                  {selectedMonitoringCourse ? selectedMonitoringCourse.course_code : "All Subjects"}
                </span>
              </div>
              <p className="text-2xl font-black text-blue-800">
                {monitoringCounts.submittedCount}
              </p>
              <span className="text-[10px] text-blue-600 font-medium block truncate">
                {selectedMonitoringCourse
                  ? `Finalized in ${selectedMonitoringCourse.course_code}`
                  : "Finalized exam attempts"}
              </span>
            </div>

            {/* Submitted Past Schedule Card */}
            <div
              onClick={() => setMonitoringStatusFilter(monitoringStatusFilter === "late" ? "all" : "late")}
              className={`bg-amber-50/60 border rounded-2xl p-4 space-y-1 transition-all cursor-pointer hover:shadow-xs ${
                monitoringStatusFilter === "late"
                  ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-100/70"
                  : "border-amber-200/80"
              }`}
              title="Click to filter late submissions"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Submitted Past Schedule
                </span>
                <span className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 uppercase tracking-tight truncate max-w-[120px]">
                  {selectedMonitoringCourse ? selectedMonitoringCourse.course_code : "All Subjects"}
                </span>
              </div>
              <p className="text-2xl font-black text-amber-900">
                {monitoringCounts.lateCount}
              </p>
              <span className="text-[10px] text-amber-700 font-medium block truncate">
                {selectedMonitoringCourse
                  ? `Finished after schedule in ${selectedMonitoringCourse.course_code}`
                  : "Finished after schedule end"}
              </span>
            </div>
          </div>

          {/* When "All Courses" is selected: Per-Course Tally Breakdown Matrix */}
          {selectedMonitoringCourseId === "all" && monitoringCoursesList.length > 0 && (
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    Per-Course Tally & Live Status Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Click any course card below to focus its specific KPI tally and review submissions.
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-lg self-start sm:self-auto">
                  {monitoringCoursesList.length} Courses Total
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {monitoringCoursesList.map((cg) => {
                  return (
                    <div
                      key={cg.course_id}
                      onClick={() => setSelectedMonitoringCourseId(cg.course_id)}
                      className="group bg-white hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-black text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                            {cg.course_code}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700 transition-colors flex items-center gap-0.5">
                            Focus Tally <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-xs mt-1.5 line-clamp-1 group-hover:text-emerald-950">
                          {cg.course_title}
                        </h4>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 rounded-lg p-1.5">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Total</span>
                          <span className="text-xs font-black text-slate-800">{cg.counts.totalAttempts}</span>
                        </div>
                        <div className="bg-emerald-50/70 rounded-lg p-1.5">
                          <span className="text-[9px] font-extrabold text-emerald-700 uppercase block">Live</span>
                          <span className="text-xs font-black text-emerald-800">{cg.counts.liveActive}</span>
                        </div>
                        <div className="bg-blue-50/70 rounded-lg p-1.5">
                          <span className="text-[9px] font-extrabold text-blue-700 uppercase block">Done</span>
                          <span className="text-xs font-black text-blue-800">{cg.counts.submittedCount}</span>
                        </div>
                        <div className="bg-amber-50/70 rounded-lg p-1.5">
                          <span className="text-[9px] font-extrabold text-amber-800 uppercase block">Late</span>
                          <span className="text-xs font-black text-amber-900">{cg.counts.lateCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Filter & Search Controls */}
          <div className="space-y-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Filter Attempts {selectedMonitoringCourse ? `(${selectedMonitoringCourse.course_code})` : "(All Courses)"}:
                </span>
              </div>

              {/* Status filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                  Status:
                </span>
                <button
                  type="button"
                  onClick={() => setMonitoringStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                    monitoringStatusFilter === "all"
                      ? "bg-slate-800 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200"
                  }`}
                >
                  All ({monitoringCounts.totalAttempts})
                </button>
                <button
                  type="button"
                  onClick={() => setMonitoringStatusFilter("active")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                    monitoringStatusFilter === "active"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200"
                  }`}
                >
                  Active ({monitoringCounts.liveActive})
                </button>
                <button
                  type="button"
                  onClick={() => setMonitoringStatusFilter("submitted")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                    monitoringStatusFilter === "submitted"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-blue-700 hover:bg-blue-50 border border-slate-200"
                  }`}
                >
                  Submitted ({monitoringCounts.submittedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setMonitoringStatusFilter("late")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                    monitoringStatusFilter === "late"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white text-amber-800 hover:bg-amber-50 border border-slate-200"
                  }`}
                >
                  Past Schedule ({monitoringCounts.lateCount})
                </button>
              </div>
            </div>

            {/* Student & Exam Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search student by name (with middle initial), student ID, exam title, or section..."
                value={monitoringSearch}
                onChange={(e) => setMonitoringSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              {monitoringSearch && (
                <button
                  type="button"
                  onClick={() => setMonitoringSearch("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Course-Categorized Sections */}
          {monitoringCoursesList.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
              <div className="bg-slate-100 p-4 rounded-full text-slate-400 mb-4 inline-block">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">No Teaching Courses Assigned</h3>
              <p className="text-slate-500 text-xs max-w-sm mt-1 mx-auto leading-relaxed">
                Once subjects are allocated to your teaching load, examinations scheduled for those courses will be monitored here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredMonitoringData
                .filter(
                  (cg) =>
                    selectedMonitoringCourseId === "all" ||
                    cg.course_id === selectedMonitoringCourseId
                )
                .map((courseGroup) => {
                  const courseAttempts = courseGroup.filteredAttempts;
                  const totalInCourse = courseGroup.attempts.length;
                  const liveInCourse = courseGroup.attempts.filter(
                    (se: any) => !se.submitted_at
                  ).length;
                  const lateInCourse = courseGroup.attempts.filter((se: any) => {
                    if (!se.submitted_at) return false;
                    const timing = getSubmissionScheduleTiming(se);
                    return timing.isLateSubmission;
                  }).length;

                  return (
                    <div
                      key={courseGroup.course_id}
                      className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs bg-white space-y-0"
                    >
                      {/* Course Header Banner */}
                      <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3.5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black font-mono text-xs shrink-0 shadow-xs">
                            {courseGroup.course_code.split(" ")[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-slate-900 text-sm tracking-tight">
                                {courseGroup.course_code} - {courseGroup.course_title}
                              </h3>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {courseAttempts.length} of {courseGroup.counts.totalAttempts} Attempt{courseGroup.counts.totalAttempts === 1 ? "" : "s"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                Total: {courseGroup.counts.totalAttempts}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {courseGroup.counts.liveActive} Live
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                                {courseGroup.counts.submittedCount} Completed
                              </span>
                              {courseGroup.counts.lateCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  {courseGroup.counts.lateCount} Past Schedule
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Course Actions */}
                        {courseGroup.attempts.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              exportExamSubmissionsToExcel(
                                courseGroup.course_title,
                                courseGroup.course_code,
                                courseGroup.attempts
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs transition-all self-start sm:self-auto cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Export Subject (.xlsx)</span>
                          </button>
                        )}
                      </div>

                      {/* Course Attempts Table */}
                      {courseAttempts.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-semibold text-slate-600 border-collapse">
                            <thead>
                              <tr className="bg-slate-50/70 border-b border-slate-200/60 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                                <th className="p-3.5 sm:p-4 text-center w-12">#</th>
                                <th className="p-3.5 sm:p-4">Student</th>
                                <th className="p-3.5 sm:p-4">Examination</th>
                                <th className="p-3.5 sm:p-4 text-center">Trigger</th>
                                <th className="p-3.5 sm:p-4 text-center">Violations</th>
                                <th className="p-3.5 sm:p-4 text-center">Score</th>
                                <th className="p-3.5 sm:p-4 text-center">Total Score</th>
                                <th className="p-3.5 sm:p-4">Started At</th>
                                <th className="p-3.5 sm:p-4">Submitted At</th>
                                <th className="p-3.5 sm:p-4 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {courseAttempts.map((se: any, idx: number) => {
                                const mi = getStudentMiddleInitial(se.student?.middle_name);
                                const studentFullName = mi
                                  ? `${se.student?.first_name} ${mi} ${se.student?.last_name}`
                                  : `${se.student?.first_name} ${se.student?.last_name}`;

                                const penaltyPerViolation = se.exam?.score_penalty_points ?? 2;
                                const penaltyPoints = (se.violations_count || 0) * penaltyPerViolation;
                                const rawScore = se.rawScore !== undefined
                                  ? se.rawScore
                                  : ((se.total_score || 0) + (se.submitted_at ? penaltyPoints : 0));
                                const finalScore = se.finalScore !== undefined
                                  ? se.finalScore
                                  : Math.max(0, rawScore - penaltyPoints);

                                const questions = se.exam?.questionBank || [];
                                const answers = se.studentAnswers || [];
                                const hasEssay = se.hasEssay !== undefined
                                  ? se.hasEssay
                                  : questions.some((q: any) => q.question_type === "Essay");
                                const essayAnswers = answers.filter((a: any) => a.question?.question_type === "Essay");
                                const hasUngradedEssay = se.hasUngradedEssay !== undefined
                                  ? se.hasUngradedEssay
                                  : (hasEssay && (essayAnswers.length === 0 || essayAnswers.some((a: any) => a.points_awarded === null)));

                                let triggerBadgeColor = "bg-slate-100 text-slate-800 border-slate-200";
                                if (se.submission_trigger === "Manual") triggerBadgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
                                if (se.submission_trigger === "Timeout") triggerBadgeColor = "bg-amber-50 text-amber-800 border-amber-200";
                                if (se.submission_trigger === "Cheating_Lockout") triggerBadgeColor = "bg-rose-50 text-rose-800 border-rose-200";

                                const timing = getSubmissionScheduleTiming(se);

                                return (
                                  <tr key={se.student_exam_id} className="hover:bg-slate-50/60 transition-colors">
                                    {/* Numbering Column */}
                                    <td className="p-3.5 sm:p-4 text-center font-mono font-bold text-slate-400 text-xs">
                                      {idx + 1}
                                    </td>
                                    {/* Student Column with Middle Initial */}
                                    <td className="p-3.5 sm:p-4 min-w-[170px]">
                                      <div className="font-extrabold text-slate-900 text-xs">
                                        {studentFullName}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                        {se.student?.user?.institutional_id || se.student?.institutional_id}
                                      </div>
                                      <div className="text-[9px] text-emerald-700 font-bold uppercase mt-0.5">
                                        {formatStudentProgramAndYear(se.student?.program?.program_code, se.student?.year_level, se.student?.section)}
                                      </div>
                                    </td>

                                    {/* Examination Column */}
                                    <td className="p-3.5 sm:p-4 min-w-[150px]">
                                      <div className="font-bold text-slate-800">{se.exam?.title}</div>
                                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                        {se.exam?.term || "Term Exam"} • {se.exam?.time_limit_minutes}m time limit
                                      </div>
                                    </td>

                                    {/* Submission Trigger */}
                                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${triggerBadgeColor}`}>
                                        {(se.submission_trigger || "").replace("_", " ")}
                                      </span>
                                    </td>

                                    {/* Security Violations */}
                                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                          se.violations_count > 0
                                            ? "bg-rose-50 text-rose-800 border border-rose-100 shadow-2xs"
                                            : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                                        }`}
                                      >
                                        {se.violations_count}
                                      </span>
                                    </td>

                                    {/* Score (Item Score & Essay Status) */}
                                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                                      {se.submitted_at ? (
                                        <div>
                                          <div className="font-black text-slate-800 text-sm">
                                            {rawScore} pts
                                          </div>
                                          {hasEssay && (
                                            hasUngradedEssay ? (
                                              <button
                                                type="button"
                                                onClick={() => handleOpenEssayGrading(se)}
                                                className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
                                                title="Click to evaluate and grade student's essay answer"
                                              >
                                                <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                                <span>Essay Ungraded</span>
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => handleOpenEssayGrading(se)}
                                                className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
                                                title="Click to review or modify essay score"
                                              >
                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                                <span>Essay Graded</span>
                                              </button>
                                            )
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full font-extrabold animate-pulse border border-indigo-200">
                                          LIVE IN PROGRESS
                                        </span>
                                      )}
                                    </td>

                                    {/* Total Score (Post-Penalty Total) */}
                                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                                      {se.submitted_at ? (
                                        <div>
                                          <div className="font-black text-slate-900 text-sm">
                                            {finalScore} pts
                                          </div>
                                          {se.violations_count > 0 ? (
                                            <div
                                              className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                                              title={`${rawScore} pts (Score) - ${penaltyPoints} pts (${se.violations_count} violation(s) x ${penaltyPerViolation} pts penalty)`}
                                            >
                                              <span>{rawScore} - {penaltyPoints} = {finalScore}</span>
                                            </div>
                                          ) : (
                                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                              No penalty
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 font-bold text-xs">-</span>
                                      )}
                                    </td>

                                    {/* Started At */}
                                    <td className="p-3.5 sm:p-4 text-slate-500 font-medium whitespace-nowrap text-xs">
                                      {new Date(se.started_at).toLocaleString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </td>

                                    {/* Submitted At (Reflecting Late Submissions) */}
                                    <td className="p-3.5 sm:p-4 text-slate-600 font-medium whitespace-nowrap text-xs">
                                      {se.submitted_at ? (
                                        <div className="space-y-1">
                                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>
                                              {new Date(se.submitted_at).toLocaleString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                month: "short",
                                                day: "numeric",
                                              })}
                                            </span>
                                          </div>
                                          {timing.isLateSubmission ? (
                                            <div
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs"
                                              title={
                                                timing.scheduledEnd
                                                  ? `Scheduled end time was ${timing.scheduledEnd.toLocaleTimeString([], {
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                    })}`
                                                  : "Submitted past scheduled exam window"
                                              }
                                            >
                                              <Clock className="w-3 h-3 text-amber-600 shrink-0 animate-pulse" />
                                              <span>Submitted Past Schedule (+{timing.minsLate}m)</span>
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                              <CheckCircle className="w-2.5 h-2.5" /> On Schedule
                                            </span>
                                          )}
                                        </div>
                                      ) : timing.isActivePastSchedule ? (
                                        <div className="space-y-1">
                                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
                                            <span>Active (Past Schedule)</span>
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-indigo-600 font-semibold italic text-[11px] flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
                                          Active in progress...
                                        </span>
                                      )}
                                    </td>

                                    {/* Action: View Exam Paper Button */}
                                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleViewExamPaper(se)}
                                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
                                          title="View official auto-filled student examination paper"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>View Exam Paper</span>
                                        </button>
                                        {hasEssay && se.submitted_at && (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEssayGrading(se)}
                                            className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl border shadow-2xs transition-all cursor-pointer active:scale-95 ${
                                              hasUngradedEssay
                                                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-200"
                                                : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                                            }`}
                                            title={hasUngradedEssay ? "Evaluate and grade student's submitted essay responses" : "Review and edit awarded essay points"}
                                          >
                                            <PenTool className="w-3.5 h-3.5" />
                                            <span>{hasUngradedEssay ? "Grade Essay" : "Review Essay"}</span>
                                          </button>
                                        )}
                                        {se.violations_count > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleViewAttemptLogs(
                                                se.student_id,
                                                studentFullName,
                                                se.exam_id
                                              )
                                            }
                                            title="View security violation audit logs"
                                            className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 active:scale-95 border border-rose-200 text-rose-700 text-[10px] font-black px-2 py-1.5 rounded-xl shadow-2xs transition-all cursor-pointer"
                                          >
                                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                                            <span className="hidden sm:inline">Logs</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-slate-50/50">
                          <p className="text-xs text-slate-400 font-medium">
                            {courseGroup.attempts.length === 0
                              ? `No exam attempts recorded yet for ${courseGroup.course_code}.`
                              : `No attempts match your current search/status filter for ${courseGroup.course_code}.`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

              {filteredMonitoringData.filter(
                (cg) =>
                  selectedMonitoringCourseId === "all" ||
                  cg.course_id === selectedMonitoringCourseId
              ).length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-500">
                    No course attempts match the selected filter or search query.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonitoringCourseId("all");
                      setMonitoringSearch("");
                      setMonitoringStatusFilter("all");
                    }}
                    className="mt-3 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* OVERRIDE CONTROLS TAB */}
      {activeTab === "override" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Student Reschedule & Reopen Controls */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
                Student Reschedule & Reopen Controls
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Choose a course and exam, then find students who missed it or need a retake to set a new exam schedule for them.
              </p>
            </div>

            {/* Step 1 & 2: Course & Examination Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  1. Select Course
                </label>
                <select
                  value={selectedOverrideCourseId || ""}
                  onChange={e => {
                    const cId = e.target.value ? Number(e.target.value) : null;
                    setSelectedOverrideCourseId(cId);
                    if (cId && selectedOverrideExamId) {
                      const cur = faculty.examinations.find(ex => ex.exam_id === selectedOverrideExamId);
                      const curCId = (cur as any)?.course_id || (cur?.course as any)?.course_id;
                      if (curCId !== cId) {
                        setSelectedOverrideExamId(null);
                      }
                    }
                  }}
                  className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 px-3.5 py-2.5 rounded-xl transition-all shadow-sm focus:outline-none focus:border-emerald-600"
                >
                  <option value="">-- All Assigned Courses --</option>
                  {availableFacultyCourses.map(c => {
                    const examCount = faculty.examinations.filter(ex => {
                      const cId = (ex as any).course_id || (ex.course as any)?.course_id;
                      return ex.current_status === "Approved" && cId === c.course_id;
                    }).length;
                    return (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_code} - {c.course_title} ({examCount} approved exam{examCount === 1 ? "" : "s"})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  2. Select Examination
                </label>
                <select
                  value={selectedOverrideExamId || ""}
                  onChange={e => {
                    const exId = e.target.value ? Number(e.target.value) : null;
                    setSelectedOverrideExamId(exId);
                    if (exId) {
                      const foundExam = faculty.examinations.find(ex => ex.exam_id === exId);
                      if (foundExam) {
                        const cId = (foundExam as any).course_id || (foundExam.course as any)?.course_id;
                        if (cId && cId !== selectedOverrideCourseId) {
                          setSelectedOverrideCourseId(cId);
                        }
                      }
                    }
                  }}
                  className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 px-3.5 py-2.5 rounded-xl transition-all shadow-sm focus:outline-none focus:border-amber-600"
                >
                  <option value="">-- Choose Approved Examination --</option>
                  {overrideFilteredExams.map(exam => (
                    <option key={exam.exam_id} value={exam.exam_id}>
                      {exam.title} ({exam.course.course_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Approved Examinations Cards Showcase when no specific exam is selected yet */}
            {!selectedOverrideExamId && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Approved Examinations ({overrideFilteredExams.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select an approved exam below to view taker rosters, inspect student attempts, and set reschedule/override windows for students who missed it.
                    </p>
                  </div>
                </div>

                {overrideFilteredExams.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {overrideFilteredExams.map((exam) => {
                      const target = exam.examTargets?.[0];
                      const dateStr = target?.scheduled_date
                        ? new Date(target.scheduled_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                        : "No date set";
                      const timeStr = target?.start_time && target?.end_time
                        ? `${new Date(target.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${new Date(target.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "";
                      const attemptsCount = studentExams.filter(
                        (se: any) => se.exam_id === exam.exam_id || se.exam?.exam_id === exam.exam_id
                      ).length;

                      return (
                        <div
                          key={exam.exam_id}
                          onClick={() => {
                            setSelectedOverrideExamId(exam.exam_id);
                            const cId = (exam as any).course_id || (exam.course as any)?.course_id;
                            if (cId) setSelectedOverrideCourseId(cId);
                          }}
                          className="bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] font-black text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                {exam.course.course_code}
                              </span>
                              {exam.is_archived ? (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                  Archived Exam
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Approved
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-2">
                              {getExamDisplayTitle(exam)}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium line-clamp-1">
                              {exam.course.course_title}
                            </p>

                            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-semibold">{dateStr} {timeStr ? `• ${timeStr}` : ""}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{attemptsCount} student attempt(s) recorded</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-50 group-hover:bg-amber-600 text-amber-800 group-hover:text-white border border-amber-200 group-hover:border-amber-600 text-xs font-bold py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Student Scores</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No approved examinations found for this selection</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Examinations must be approved by the Department Chair & Director to manage student overrides.</p>
                  </div>
                )}
              </div>
            )}

            {selectedOverrideExamId && (
              <div className="space-y-5 pt-2 animate-in fade-in duration-300">
                {/* Original Exam Schedule Preserved Banner */}
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 text-xs space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-blue-900 font-bold uppercase tracking-wider text-[10px]">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Original Exam Schedule
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const exam = faculty.examinations.find(e => e.exam_id === selectedOverrideExamId);
                        return exam ? (
                          <span className="text-[11px] font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200">
                            {exam.course.course_code} • {exam.title}
                          </span>
                        ) : null;
                      })()}
                      <button
                        type="button"
                        onClick={() => setSelectedOverrideExamId(null)}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline ml-2 cursor-pointer"
                      >
                        ← Choose Another Exam
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-900 font-extrabold text-sm">
                    {officialExamScheduleText || "Original Exam Schedule"}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">
                    ✓ Rescheduling only applies to the selected students. The original exam schedule and Table of Specifications (TOS) stay the same for everyone else.
                  </p>
                </div>

                {/* Controls Bar: Search & Status Filters */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Students & Exam Status
                      </h3>
                      <p className="text-xs text-slate-500">
                        Search by student name or filter by status to reschedule their exam.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => {
                          setPopupStudentSearchInput("");
                          setPopupStudentSearchTerm("");
                          setPopupStudentFilter("ALL");
                          setOverrideModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] px-3.5 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Reschedule Selected Student(s) {selectedOverrideStudentIds.length > 0 ? `(${selectedOverrideStudentIds.length} Selected)` : ""}
                      </button>
                      {missedStudents && missedStudents.length > 0 && (
                        <button
                          onClick={() => {
                            const targetExam = faculty.examinations.find(e => e.exam_id === selectedOverrideExamId);
                            exportMissedStudentsToExcel(targetExam ? targetExam.title : "Exam", missedStudents);
                          }}
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export Excel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Filter Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setStudentStatusFilter("ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        studentStatusFilter === "ALL"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All Students ({missedStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentStatusFilter("TAKERS")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        studentStatusFilter === "TAKERS"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Took Exam ({missedStudents.filter(s => !!s.attempt).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentStatusFilter("MISSED")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        studentStatusFilter === "MISSED"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Missed / Not Taken ({missedStudents.filter(s => !s.attempt).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentStatusFilter("OVERRIDE")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        studentStatusFilter === "OVERRIDE"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Active Overrides ({missedStudents.filter(s => s.override && s.override.is_active).length})
                    </button>
                  </div>

                  {/* Searchable Student Bar (Search by Name or ID) */}
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="Search student by name or ID in real-time..."
                        value={studentSearchTerm}
                        onChange={e => setStudentSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs font-semibold text-slate-800 pl-9 pr-8 py-2.5 rounded-xl transition-all shadow-sm focus:outline-none focus:border-amber-500"
                      />
                      {studentSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setStudentSearchTerm("")}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="sm:w-80">
                      <select
                        onChange={e => {
                          const sId = Number(e.target.value);
                          if (sId) {
                            setSelectedOverrideStudentIds([sId]);
                            setPopupStudentSearchInput("");
                            setPopupStudentSearchTerm("");
                            const found = missedStudents.find(s => s.student_id === sId);
                            if (found && found.override && found.override.is_active) {
                              setOverrideForm({
                                start_date: found.override.new_start_time.split("T")[0],
                                start_time: found.override.new_start_time.split("T")[1]?.slice(0, 5) || "09:00",
                                end_date: found.override.new_end_time.split("T")[0],
                                end_time: found.override.new_end_time.split("T")[1]?.slice(0, 5) || "09:00",
                              });
                            } else {
                              setOverrideForm({
                                start_date: new Date().toISOString().split("T")[0],
                                start_time: "09:00",
                                end_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                                end_time: "09:00",
                              });
                            }
                            setOverrideModalOpen(true);
                          }
                        }}
                        value=""
                        className="w-full bg-white border border-slate-200 text-xs font-bold text-amber-900 bg-amber-50/50 px-3 py-2.5 rounded-xl cursor-pointer"
                      >
                        <option value="">-- Select Student to Reschedule --</option>
                        {missedStudents.map(s => (
                          <option key={s.student_id} value={s.student_id}>
                            {s.attempt ? "[Took Exam]" : "[Missed]"} {s.first_name} {s.middle_name ? `${s.middle_name.trim().charAt(0).toUpperCase()}. ` : ""}{s.last_name} ({s.institutional_id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {isLoadingMissedStudents ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                    <span>Loading student records for this examination...</span>
                  </div>
                ) : (() => {
                  const selectedExamHasEssay = Boolean(
                    overrideExamInfo?.has_essay ||
                    missedStudents.some(s => s.attempt?.has_essay)
                  );
                  const colSpanCount = selectedExamHasEssay ? 8 : 7;
                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-600 font-semibold">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={
                                  missedStudents.length > 0 &&
                                  missedStudents.every(s => selectedOverrideStudentIds.includes(s.student_id))
                                }
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedOverrideStudentIds(missedStudents.map(s => s.student_id));
                                  } else {
                                    setSelectedOverrideStudentIds([]);
                                  }
                                }}
                                className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                title="Select All Students"
                              />
                            </th>
                            <th className="px-5 py-3">Student Name</th>
                            <th className="px-4 py-3">ID / Email</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-center">Cheating Attempts</th>
                            {selectedExamHasEssay && (
                              <th className="px-4 py-3">Essay Score & Check Answer</th>
                            )}
                            <th className="px-4 py-3 text-right">Actions</th>
                            <th className="px-6 py-3 text-right">Total Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {missedStudents
                            .filter(student => {
                              if (studentStatusFilter === "TAKERS" && !student.attempt) return false;
                              if (studentStatusFilter === "MISSED" && student.attempt) return false;
                              if (studentStatusFilter === "OVERRIDE" && (!student.override || !student.override.is_active)) return false;

                              if (!studentSearchTerm.trim()) return true;
                              const q = studentSearchTerm.toLowerCase().trim();
                              const fullName = `${student.first_name} ${student.middle_name || ""} ${student.last_name}`.toLowerCase();
                              const revName = `${student.last_name}, ${student.first_name}`.toLowerCase();
                              const id = (student.institutional_id || "").toLowerCase();
                              const email = (student.institutional_email || "").toLowerCase();
                              return fullName.includes(q) || revName.includes(q) || id.includes(q) || email.includes(q);
                            })
                            .map(student => {
                              const attempt = student.attempt;
                              const override = student.override;
                              const isChecked = selectedOverrideStudentIds.includes(student.student_id);
                              
                              let statusNode = (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-100">
                                  Missed Exam / Not Taken
                                </span>
                              );

                              if (override && override.is_active) {
                                statusNode = (
                                  <div className="space-y-0.5">
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                                      Reopened Window Active
                                    </span>
                                    <p className="text-[10px] text-amber-900 font-semibold">
                                      {new Date(override.new_start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} ({new Date(override.new_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(override.new_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                    </p>
                                  </div>
                                );
                              } else if (attempt) {
                                if (attempt.submitted_at) {
                                  statusNode = (
                                    <div className="space-y-0.5">
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        Took Exam • Completed
                                      </span>
                                      <p className="text-[10px] text-slate-500">
                                        Submitted: {new Date(attempt.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  );
                                } else {
                                  statusNode = (
                                    <div className="space-y-0.5">
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-100">
                                        Took Exam • In Progress
                                      </span>
                                      <p className="text-[10px] text-slate-500">
                                        Started: {new Date(attempt.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  );
                                }
                              }

                              const violationCount = attempt ? (attempt.violations_count || 0) : 0;

                              return (
                                <tr key={student.student_id} className={`hover:bg-slate-50/50 transition-colors ${isChecked ? "bg-amber-50/30" : ""}`}>
                                  <td className="px-4 py-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedOverrideStudentIds(prev => prev.filter(id => id !== student.student_id));
                                        } else {
                                          setSelectedOverrideStudentIds(prev => [...prev, student.student_id]);
                                        }
                                      }}
                                      className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-5 py-4 font-bold text-slate-800">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span>
                                        {student.first_name} {student.middle_name ? `${student.middle_name.trim().charAt(0).toUpperCase()}. ` : ""}{student.last_name}
                                      </span>
                                      {attempt && (
                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                          Took Exam
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="space-y-0.5 text-slate-500">
                                      <p className="font-semibold text-slate-700">{student.institutional_id}</p>
                                      <p className="text-[10px] truncate max-w-[140px]" title={student.institutional_email}>{student.institutional_email}</p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">{statusNode}</td>
                                  
                                  {/* Cheating Attempts Column */}
                                  <td className="px-4 py-4 text-center">
                                    {attempt ? (
                                      <div className="flex flex-col items-center gap-1">
                                        {violationCount === 0 ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                            0 Attempts
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
                                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                            {violationCount} {violationCount === 1 ? "Attempt" : "Attempts"}
                                          </span>
                                        )}
                                        {selectedOverrideExamId && (
                                          <button
                                            type="button"
                                            onClick={() => handleViewAttemptLogs(student.student_id, `${student.first_name} ${student.last_name}`, selectedOverrideExamId)}
                                            className="text-[9px] font-bold text-slate-400 hover:text-slate-700 underline cursor-pointer"
                                            title="View student proctoring and violation logs"
                                          >
                                            View Logs
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </td>

                                  {/* Essay Score & Grading Column (if exam has essay) */}
                                  {selectedExamHasEssay && (
                                    <td className="px-4 py-4">
                                      {attempt ? (
                                        attempt.essayAnswers && attempt.essayAnswers.length > 0 ? (
                                          <div className="space-y-2 py-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {attempt.has_ungraded_essay ? (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                                  Pending Review
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                  Graded
                                                </span>
                                              )}
                                              <span className="text-xs font-bold text-slate-800">
                                                {attempt.essay_points ?? 0} / {attempt.max_essay_points ?? (attempt.essayAnswers.length * 10)} pts
                                              </span>
                                            </div>

                                            {/* Teacher can add their scores there directly */}
                                            {attempt.essayAnswers.map((ea: any, idx: number) => {
                                              const maxPts = ea.points || 10;
                                              const currentVal = inlineEssayScores[ea.answer_id] !== undefined
                                                ? inlineEssayScores[ea.answer_id]
                                                : (ea.points_awarded !== null ? ea.points_awarded : "");
                                              return (
                                                <div key={ea.answer_id} className="flex items-center gap-1.5">
                                                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
                                                    {attempt.essayAnswers.length > 1 && (
                                                      <span className="text-[10px] text-slate-500 font-bold">Q{idx + 1}:</span>
                                                    )}
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      max={maxPts}
                                                      placeholder="0"
                                                      value={currentVal}
                                                      onChange={e => {
                                                        const val = e.target.value === "" ? "" : Number(e.target.value);
                                                        setInlineEssayScores(prev => ({
                                                          ...prev,
                                                          [ea.answer_id]: val as any
                                                        }));
                                                      }}
                                                      className="w-12 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-500"
                                                    />
                                                    <span className="text-[10px] text-slate-400 font-bold">/ {maxPts}</span>
                                                    <button
                                                      type="button"
                                                      disabled={savingInlineEssayId === ea.answer_id || currentVal === ""}
                                                      onClick={() => handleSaveInlineEssayScore(ea.answer_id, maxPts)}
                                                      className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors disabled:opacity-50 cursor-pointer"
                                                      title="Save score"
                                                    >
                                                      {savingInlineEssayId === ea.answer_id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                      ) : (
                                                        "Save"
                                                      )}
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}

                                            {/* Button for teacher to check their answer in the essay */}
                                            <div>
                                              <button
                                                type="button"
                                                onClick={() => handleOpenEssayGrading(attempt)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all cursor-pointer shadow-xs"
                                                title="Check student's essay answer and rubric"
                                              >
                                                <PenTool className="w-3 h-3 text-indigo-600" />
                                                Check Answer
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <span className="text-[11px] text-slate-400 italic">No essay response</span>
                                        )
                                      ) : (
                                        <span className="text-slate-300 text-xs">-</span>
                                      )}
                                    </td>
                                  )}

                                  {/* Actions Column */}
                                  <td className="px-4 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {attempt && (
                                        <button
                                          type="button"
                                          onClick={() => handleViewExamPaper(attempt)}
                                          className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                          title="View Student's Full Exam Paper & Responses"
                                        >
                                          <FileText className="w-3 h-3 text-slate-500" />
                                          Exam Paper
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedOverrideStudentIds([student.student_id]);
                                          setPopupStudentSearchInput("");
                                          setPopupStudentSearchTerm("");
                                          if (override && override.is_active) {
                                            setOverrideForm({
                                              start_date: override.new_start_time.split("T")[0],
                                              start_time: override.new_start_time.split("T")[1]?.slice(0, 5) || "09:00",
                                              end_date: override.new_end_time.split("T")[0],
                                              end_time: override.new_end_time.split("T")[1]?.slice(0, 5) || "09:00",
                                            });
                                          } else {
                                            setOverrideForm({
                                              start_date: new Date().toISOString().split("T")[0],
                                              start_time: "09:00",
                                              end_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                                              end_time: "09:00",
                                            });
                                          }
                                          setOverrideModalOpen(true);
                                        }}
                                        className="px-2.5 py-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-xs transition-all cursor-pointer"
                                      >
                                        {override && override.is_active ? "Change Schedule" : "Reschedule"}
                                      </button>
                                      {override && override.is_active && (
                                        <button
                                          type="button"
                                          onClick={() => handleRevokeOverride(student.student_id)}
                                          className="px-2 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer"
                                          title="Revoke Reopened Window"
                                        >
                                          Revoke
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  {/* Last Column: Total Score */}
                                  <td className="px-6 py-4 text-right">
                                    {attempt ? (
                                      attempt.submitted_at ? (
                                        <div className="space-y-0.5">
                                          <div className="text-sm font-black text-slate-900">
                                            {attempt.total_score !== null ? `${attempt.total_score} pts` : "Submitted"}
                                          </div>
                                          {attempt.penalty_points > 0 && (
                                            <div className="text-[10px] font-bold text-rose-600">
                                              -{attempt.penalty_points} pts penalty
                                            </div>
                                          )}
                                          {attempt.raw_score !== undefined && attempt.penalty_points > 0 && (
                                            <div className="text-[9px] text-slate-400">
                                              Raw: {attempt.raw_score} pts
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-100">
                                          In Progress
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-slate-400 text-xs italic">
                                        0 pts (Missed)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          {missedStudents.length === 0 && (
                            <tr>
                              <td colSpan={colSpanCount} className="text-center py-8 text-slate-400 italic">
                                No assigned students found for this examination.
                              </td>
                            </tr>
                          )}
                          {missedStudents.length > 0 &&
                            missedStudents.filter(student => {
                              if (studentStatusFilter === "TAKERS" && !student.attempt) return false;
                              if (studentStatusFilter === "MISSED" && student.attempt) return false;
                              if (studentStatusFilter === "OVERRIDE" && (!student.override || !student.override.is_active)) return false;

                              if (!studentSearchTerm.trim()) return true;
                              const q = studentSearchTerm.toLowerCase().trim();
                              const fullName = `${student.first_name} ${student.middle_name || ""} ${student.last_name}`.toLowerCase();
                              const revName = `${student.last_name}, ${student.first_name}`.toLowerCase();
                              const id = (student.institutional_id || "").toLowerCase();
                              const email = (student.institutional_email || "").toLowerCase();
                              return fullName.includes(q) || revName.includes(q) || id.includes(q) || email.includes(q);
                            }).length === 0 && (
                              <tr>
                                <td colSpan={colSpanCount} className="text-center py-8 text-slate-400 italic">
                                  No students match the search query "{studentSearchTerm}".
                                </td>
                              </tr>
                            )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* REOPEN EXAMINATION / OVERRIDE SCHEDULE POPUP MODAL */}
          {overrideModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-start shrink-0">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-600" /> Reschedule Exam for Student(s)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Select students who missed the exam or need a retake, then choose their new schedule.
                    </p>
                  </div>
                  <button
                    onClick={() => setOverrideModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <span className="text-2xl leading-none">&times;</span>
                  </button>
                </div>

                {/* Main Body Content */}
                <div className="overflow-y-auto space-y-4 pr-1">
                  {/* Original Schedule Banner */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-1">
                    <p className="text-slate-600 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" /> Original Exam Schedule
                    </p>
                    <p className="text-slate-800 font-semibold text-xs">
                      {officialExamScheduleText || "Original exam schedule"}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-relaxed pt-0.5">
                      ✓ Rescheduling only applies to the selected students. The original exam schedule and Table of Specifications (TOS) stay the same for everyone else.
                    </p>
                  </div>

                  {/* Student Search Box (Real-time by Name or ID) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 block">
                        Search & Select Student(s) to Reschedule
                      </label>
                      <div className="flex gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setPopupStudentFilter("ALL")}
                          className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                            popupStudentFilter === "ALL" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          All ({missedStudents.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPopupStudentFilter("TAKERS")}
                          className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                            popupStudentFilter === "TAKERS" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          }`}
                        >
                          Took ({missedStudents.filter(s => !!s.attempt).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPopupStudentFilter("MISSED")}
                          className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                            popupStudentFilter === "MISSED" ? "bg-rose-700 text-white" : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                          }`}
                        >
                          Missed ({missedStudents.filter(s => !s.attempt).length})
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search student by name or ID in real-time..."
                        value={popupStudentSearchInput}
                        onChange={e => {
                          setPopupStudentSearchInput(e.target.value);
                          setPopupStudentSearchTerm(e.target.value);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 pl-9 pr-8 py-2.5 rounded-xl transition-all focus:outline-none focus:border-amber-500 focus:bg-white"
                      />
                      {popupStudentSearchInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setPopupStudentSearchInput("");
                            setPopupStudentSearchTerm("");
                          }}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Student Checkbox List */}
                  <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2 max-h-48 overflow-y-auto">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                      <span className="text-[11px] font-extrabold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                        {selectedOverrideStudentIds.length} Student(s) Selected
                      </span>
                      <div className="flex gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const term = (popupStudentSearchInput || popupStudentSearchTerm).toLowerCase().trim();
                            const filteredIds = missedStudents
                              .filter(s => {
                                if (popupStudentFilter === "TAKERS" && !s.attempt) return false;
                                if (popupStudentFilter === "MISSED" && s.attempt) return false;
                                if (!term) return true;
                                const fn = `${s.first_name} ${s.middle_name || ""} ${s.last_name}`.toLowerCase();
                                const rn = `${s.last_name}, ${s.first_name}`.toLowerCase();
                                const id = (s.institutional_id || "").toLowerCase();
                                return fn.includes(term) || rn.includes(term) || id.includes(term);
                              })
                              .map(s => s.student_id);
                            setSelectedOverrideStudentIds(Array.from(new Set([...selectedOverrideStudentIds, ...filteredIds])));
                          }}
                          className="text-amber-700 font-bold hover:underline cursor-pointer"
                        >
                          Select All Filtered
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedOverrideStudentIds([])}
                          className="text-slate-500 font-bold hover:underline cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>

                    {missedStudents
                      .filter(student => {
                        if (popupStudentFilter === "TAKERS" && !student.attempt) return false;
                        if (popupStudentFilter === "MISSED" && student.attempt) return false;

                        const term = (popupStudentSearchInput || popupStudentSearchTerm).toLowerCase().trim();
                        if (!term) return true;
                        const fullName = `${student.first_name} ${student.middle_name || ""} ${student.last_name}`.toLowerCase();
                        const revName = `${student.last_name}, ${student.first_name}`.toLowerCase();
                        const id = (student.institutional_id || "").toLowerCase();
                        return fullName.includes(term) || revName.includes(term) || id.includes(term);
                      })
                      .map(student => {
                        const isChecked = selectedOverrideStudentIds.includes(student.student_id);
                        const override = student.override;
                        return (
                          <label
                            key={student.student_id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isChecked
                                ? "bg-amber-50/90 border-amber-300 text-amber-950 font-medium shadow-sm"
                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedOverrideStudentIds(prev => prev.filter(id => id !== student.student_id));
                                  } else {
                                    setSelectedOverrideStudentIds(prev => [...prev, student.student_id]);
                                  }
                                }}
                                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                              />
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  {student.first_name} {student.middle_name ? `${student.middle_name.trim().charAt(0).toUpperCase()}. ` : ""}{student.last_name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  ID: {student.institutional_id}
                                </p>
                              </div>
                            </div>
                            {override && override.is_active ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Already Reopened
                              </span>
                            ) : student.attempt?.submitted_at ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Took Exam • Completed ({student.attempt.total_score !== null ? `${student.attempt.total_score} pts` : "Submitted"})
                              </span>
                            ) : student.attempt ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Took Exam • In Progress
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Missed / Not Taken
                              </span>
                            )}
                          </label>
                        );
                      })}

                    {missedStudents.filter(student => {
                      if (popupStudentFilter === "TAKERS" && !student.attempt) return false;
                      if (popupStudentFilter === "MISSED" && student.attempt) return false;

                      const term = (popupStudentSearchInput || popupStudentSearchTerm).toLowerCase().trim();
                      if (!term) return true;
                      const fullName = `${student.first_name} ${student.middle_name || ""} ${student.last_name}`.toLowerCase();
                      const revName = `${student.last_name}, ${student.first_name}`.toLowerCase();
                      const id = (student.institutional_id || "").toLowerCase();
                      return fullName.includes(term) || revName.includes(term) || id.includes(term);
                    }).length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-4 italic">
                        No matching students found for the current search filter.
                      </p>
                    )}
                  </div>

                  {/* Override Form Inputs */}
                  <form onSubmit={handleOverrideSubmit} className="space-y-4 pt-1">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-900 font-medium">
                      ⚠️ Rescheduling will reset any previous attempt for the selected student(s) so they can take the exam during their new window.
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">New Start Date</label>
                        <input
                          type="date"
                          required
                          value={overrideForm.start_date}
                          onChange={e => setOverrideForm(prev => ({ ...prev, start_date: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 px-3 py-2 rounded-xl transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">New Start Time</label>
                        <input
                          type="time"
                          required
                          value={overrideForm.start_time}
                          onChange={e => setOverrideForm(prev => ({ ...prev, start_time: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 px-3 py-2 rounded-xl transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">New End Date</label>
                        <input
                          type="date"
                          required
                          value={overrideForm.end_date}
                          onChange={e => setOverrideForm(prev => ({ ...prev, end_date: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 px-3 py-2 rounded-xl transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">New End Time</label>
                        <input
                          type="time"
                          required
                          value={overrideForm.end_time}
                          onChange={e => setOverrideForm(prev => ({ ...prev, end_time: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 px-3 py-2 rounded-xl transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setOverrideModalOpen(false)}
                        className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingOverride || selectedOverrideStudentIds.length === 0}
                        className="px-5 py-2.5 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isSavingOverride && <Loader2 className="w-4 h-4 animate-spin" />}
                        {selectedOverrideStudentIds.length > 0
                          ? `Save New Schedule (${selectedOverrideStudentIds.length} Selected)`
                          : "Select Student(s) to Reschedule"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Maria"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-800 placeholder:text-slate-400 px-4 py-2.5 rounded-xl transition-all duration-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Middle Name / Initial</label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="e.g. Santos or S."
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
                    placeholder="e.g. Reyes"
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
                {(() => {
                  const pObj = programs.find(p => String(p.program_id) === String(scheduleForm.program_id));
                  return (
                    <input 
                      type="text"
                      disabled
                      readOnly
                      value={pObj ? `${pObj.program_code} - ${pObj.program_name}` : (scheduleForm.program_id ? `Program ID: ${scheduleForm.program_id}` : "Program set from exam creation")}
                      className="w-full bg-slate-100 border border-slate-200 text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl cursor-not-allowed select-none"
                    />
                  );
                })()}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Scheduled Date</label>
                <DatePicker
                  value={scheduleForm.scheduled_date}
                  onChange={d => setScheduleForm({...scheduleForm, scheduled_date: d})}
                  placeholder="Select scheduled date"
                  required
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

      {/* Schedule Success Popup Modal */}
      {scheduleSuccessModalOpen && scheduleSuccessInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center border border-slate-100 relative transform transition-all animate-in zoom-in-95 duration-200">
            {/* Animated Checkmark Icon */}
            <div className="mx-auto w-16 h-16 bg-emerald-100/80 rounded-full flex items-center justify-center mb-4 text-emerald-600 shadow-inner">
              <svg className="w-10 h-10 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-1">
              Schedule Set Successfully!
            </h3>
            <p className="text-xs text-slate-500 mb-5 font-medium">
              The examination schedule has been saved and published to student dashboards.
            </p>

            {/* Schedule Summary Card */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-left space-y-2 mb-6">
              <div className="text-xs">
                <span className="font-semibold text-slate-500 block">Examination</span>
                <span className="font-bold text-slate-900 text-sm line-clamp-1">{scheduleSuccessInfo.examTitle}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-emerald-100">
                <div>
                  <span className="font-semibold text-slate-500 block text-[11px]">Scheduled Date</span>
                  <span className="font-bold text-emerald-950 text-xs">{scheduleSuccessInfo.date}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block text-[11px]">Time Window</span>
                  <span className="font-bold text-emerald-950 text-xs">
                    {scheduleSuccessInfo.startTime} - {scheduleSuccessInfo.endTime}
                  </span>
                </div>
              </div>
              {scheduleSuccessInfo.notifiedCount > 0 && (
                <div className="pt-2 border-t border-emerald-100 text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span>{scheduleSuccessInfo.notifiedCount} student(s) notified</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setScheduleSuccessModalOpen(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20 active:scale-[0.98] text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* QUESTION BANK REPOSITORY TAB */}
      {activeTab === "question_bank" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Question Bank Repository
              </h2>
              <p className="text-slate-500 text-xs mt-1">Manage and categorize objective & subjective test items.</p>
            </div>
            
            <button
              onClick={() => {
                setEditingQ(null);
                setQForm({
                  course_id: courses[0]?.course_id ? String(courses[0].course_id) : "",
                  topic: "",
                  year_level: "",
                  question_type: "Multiple_Choice",
                  question_text: "",
                  correct_answer: "",
                  points: 1
                });
                setQModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>

          {/* Filters */}
          <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Course</label>
              <select
                value={qbFilters.course_id}
                onChange={(e) => setQbFilters({ ...qbFilters, course_id: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 px-3 py-2.5 focus:outline-emerald-500 shadow-sm"
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_code} - {c.course_title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Search Topic</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Arrays, Normalization"
                  value={qbFilters.topic}
                  onChange={(e) => setQbFilters({ ...qbFilters, topic: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 pl-9 pr-4 py-2.5 focus:outline-emerald-500 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Year Level</label>
              <select
                value={qbFilters.year_level}
                onChange={(e) => setQbFilters({ ...qbFilters, year_level: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 px-3 py-2.5 focus:outline-emerald-500 shadow-sm"
              >
                <option value="">All Year Levels</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
          </div>

          {/* List Content */}
          {loadingQb ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="text-xs font-semibold text-slate-500">Querying question bank...</span>
            </div>
          ) : qbQuestions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {qbQuestions.map((q) => {
                let typeColor = "bg-slate-100 text-slate-700 border-slate-200";
                if (q.question_type === "Multiple_Choice") typeColor = "bg-blue-50 text-blue-700 border-blue-100";
                if (q.question_type === "True_False") typeColor = "bg-purple-50 text-purple-700 border-purple-100";
                if (q.question_type === "Identification") typeColor = "bg-amber-50 text-amber-700 border-amber-100";
                if (q.question_type === "Matching_Type") typeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                if (q.question_type === "Essay") typeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                if (q.question_type === "Fill_In_The_Blanks") typeColor = "bg-teal-50 text-teal-700 border-teal-100";

                let promptPreview = q.question_text;
                if (q.question_text.trim().startsWith("{")) {
                  try {
                    const parsed = JSON.parse(q.question_text);
                    promptPreview = typeof parsed.text === "string" ? parsed.text : (parsed.text ?? q.question_text);
                  } catch {}
                }

                return (
                  <div key={q.question_id} className="border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all duration-300 bg-white flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColor}`}>
                          {q.question_type.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-extrabold">{q.points} pt{q.points !== 1 && "s"}</span>
                        
                        {q.course && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full font-bold">
                            {q.course.course_code}
                          </span>
                        )}

                        {q.topic && (
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full font-bold">
                            Topic: {q.topic}
                          </span>
                        )}

                        {q.year_level && (
                          <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-0.5 rounded-full font-bold">
                            {q.year_level} Year
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 leading-relaxed max-w-3xl whitespace-pre-wrap">
                        {promptPreview}
                      </p>
                      {q.correct_answer && (
                        <p className="text-[11px] text-slate-400 leading-normal">
                          <span className="font-extrabold text-slate-500">Correct Answer:</span> {q.correct_answer.startsWith("{") ? "Matches definition" : q.correct_answer}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingQ(q);
                          setQForm({
                            course_id: String(q.course_id || ""),
                            topic: q.topic || "",
                            year_level: q.year_level ? String(q.year_level) : "",
                            question_type: q.question_type,
                            question_text: promptPreview,
                            correct_answer: q.correct_answer,
                            points: q.points
                          });
                          setQModalOpen(true);
                        }}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-sm bg-white"
                        title="Edit Question"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestionBankItem(q.question_id)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-sm bg-white"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 border-2 border-dashed border-slate-150 rounded-3xl">
              <AlertCircle className="w-8 h-8 text-slate-350 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">No questions found</p>
              <p className="text-[10px] text-slate-400 mt-1">Add items or adjust filters to explore matches.</p>
            </div>
          )}
        </div>
      )}

      {/* EXAM ARCHIVES TAB */}
      {activeTab === "archive" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-5">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
              Exam Archives
            </h2>
            <p className="text-slate-500 text-xs mt-1">Reuse previous examinations and test assets for the new academic year.</p>
          </div>

          {/* Filters */}
          <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-1.5 flex-1 max-w-md">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filter by Course</label>
              <select
                value={archiveFilters.course_id}
                onChange={(e) => setArchiveFilters({ course_id: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 px-3 py-2.5 focus:outline-emerald-500 shadow-sm"
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_code} - {c.course_title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Archives Content */}
          {loadingArchives ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="text-xs font-semibold text-slate-500">Querying historical archives...</span>
            </div>
          ) : archivedExams.length > 0 ? (
            <div className="max-h-[600px] overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              {archivedExams.map((exam) => (
                <div key={exam.exam_id} className="border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all duration-300 bg-white flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-[10px] bg-slate-900 text-white font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        AY {exam.academic_year || "Unknown"}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        {exam._count?.questionBank ?? 0} Items
                      </span>
                    </div>
                    <h3 className="font-extrabold text-slate-850 text-sm leading-snug">{getExamDisplayTitle(exam)}</h3>
                    <p className="text-xs text-emerald-700 font-semibold leading-normal">
                      {exam.course.course_code} - {exam.course.course_title}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Author: Instructor {exam.faculty.first_name} {exam.faculty.last_name}
                    </p>
                  </div>
                  <button
                    disabled={isReusingExamId !== null}
                    onClick={() => handleReuseExam(exam.exam_id)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold py-2.5 rounded-xl shadow-sm transition-all duration-300 disabled:opacity-50"
                  >
                    {isReusingExamId === exam.exam_id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Duplicating Exam...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Reuse & Create Draft</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border-2 border-dashed border-slate-150 rounded-3xl">
              <Archive className="w-8 h-8 text-slate-350 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">No archived examinations found</p>
              <p className="text-[10px] text-slate-400 mt-1">Exams are marked as archived by faculty members upon completion.</p>
            </div>
          )}
        </div>
      )}

      {/* CLASS ROSTER & STUDENT ENROLLMENT TAB */}
      {activeTab === "students" && (() => {
        const selectedCourse = courses.find((c) => c.course_id === selectedRosterCourseId) || courses[0];
        const filteredRosterStudents = classRosterStudents.filter((s) => {
          if (!rosterSearch.trim()) return true;
          const q = rosterSearch.toLowerCase();
          return (
            s.institutional_id.toLowerCase().includes(q) ||
            s.first_name.toLowerCase().includes(q) ||
            s.last_name.toLowerCase().includes(q) ||
            (s.program_code && s.program_code.toLowerCase().includes(q)) ||
            (s.section && s.section.toLowerCase().includes(q))
          );
        });

        return (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                  Subject Class List
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  Official student class list assigned to this subject. Only students enrolled in this specific course section are listed here.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (courses.length === 0 || assignedCourses.length === 0) {
                      setUnassignedActionText("adding students to the class roster");
                      setUnassignedWarningModalOpen(true);
                      return;
                    }
                    setEnrollError(null);
                    setEnrollSuccess(null);
                    setEnrollModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Student to Class</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchRoster(selectedRosterCourseId)}
                  disabled={loadingClassRoster || courses.length === 0}
                  title="Refresh Class List"
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingClassRoster ? "animate-spin text-emerald-600" : ""}`} />
                </button>
              </div>
            </div>

            {/* Course Selector & Search Filter Bar */}
            {courses.length === 0 ? (
              <div className="bg-amber-50/80 border border-amber-200 p-6 rounded-2xl text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                <h3 className="text-sm font-extrabold text-amber-900">No Teaching Subjects Assigned Yet</h3>
                <p className="text-xs text-amber-800 max-w-md mx-auto leading-relaxed">
                  The Campus Director has not assigned any teaching subjects or courses to your faculty account yet. The class student list remains empty until subjects are assigned to your load.
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Course Dropdown */}
                <div className="w-full md:w-auto flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider shrink-0">
                    Select Course:
                  </label>
                  <select
                    value={selectedRosterCourseId}
                    onChange={(e) => setSelectedRosterCourseId(Number(e.target.value))}
                    className="w-full sm:max-w-md bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 px-3.5 py-2.5 focus:outline-emerald-500 shadow-sm"
                  >
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_code} - {c.course_title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div className="w-full md:w-72 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Filter student ID or name..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-emerald-500 shadow-sm"
                  />
                </div>
              </div>
            )}

            {/* Current Course Summary Banner */}
            {selectedCourse && (
              <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 rounded-2xl px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    {selectedCourse.course_code.split(" ")[0] || "IT"}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      {selectedCourse.course_code} - {selectedCourse.course_title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Active Subject Class List
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-3 py-1 rounded-full">
                    {classRosterStudents.length} Class Students
                  </span>
                </div>
              </div>
            )}

            {/* Roster Table */}
            {loadingClassRoster ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs font-bold text-slate-500">Loading subject class list...</p>
              </div>
            ) : filteredRosterStudents.length > 0 ? (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-4">Student ID Number</th>
                        <th className="py-3 px-4">Student Full Name</th>
                        <th className="py-3 px-4">Program</th>
                        <th className="py-3 px-4">Year Level</th>
                        <th className="py-3 px-4">Date Enrolled</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredRosterStudents.map((s) => (
                        <tr key={s.student_id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-black text-xs px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg">
                              {s.institutional_id}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {formatStudentName(s)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                              {s.program_code || "BSIT"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600">
                            Year {s.year_level}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {new Date(s.enrolled_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              disabled={unenrollingId === s.student_id}
                              onClick={() => handleUnenroll(s.student_id, `${s.first_name} ${s.last_name}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-bold transition-all disabled:opacity-50"
                            >
                              {unenrollingId === s.student_id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Remove from Class</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {rosterSearch.trim() ? "No class students match your search" : "No class students registered for this subject"}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {rosterSearch.trim()
                    ? "Try adjusting your search criteria or clear the filter."
                    : "Add student ID numbers to register them in this subject class list. Once listed, students can access scheduled examinations for this course."}
                </p>
                {!rosterSearch.trim() && (
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (courses.length === 0 || assignedCourses.length === 0) {
                          setUnassignedActionText("adding students to the class roster");
                          setUnassignedWarningModalOpen(true);
                          return;
                        }
                        setEnrollError(null);
                        setEnrollSuccess(null);
                        setEnrollModalOpen(true);
                      }}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Student to Class</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* SINGLE STUDENT ENROLLMENT MODAL */}
      {enrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form
            onSubmit={handleSingleEnroll}
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 relative"
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-600" />
                  Add Student to Class List
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Insert student ID number to assign student to this course section
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollModalOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info notice */}
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-900 leading-relaxed">
              <span className="font-bold">Class Section Assignment: </span>
              Assigning student account to this subject class list.
            </div>

            {/* Error & Success */}
            {enrollError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{enrollError}</span>
              </div>
            )}
            {enrollSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{enrollSuccess}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Student ID Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2023-0001-AB"
                  value={enrollForm.institutionalId}
                  onChange={(e) => setEnrollForm({ ...enrollForm, institutionalId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan"
                    value={enrollForm.firstName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, firstName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-xs font-medium text-slate-900 px-3.5 py-2.5 rounded-xl transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">
                    Middle Initial / Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. S. or Santos"
                    value={enrollForm.middleName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, middleName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-xs font-medium text-slate-900 px-3.5 py-2.5 rounded-xl transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dela Cruz"
                    value={enrollForm.lastName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, lastName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-xs font-medium text-slate-900 px-3.5 py-2.5 rounded-xl transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Academic Program
                </label>
                {(() => {
                  const selProg = programs.find((p) => String(p.program_id) === String(enrollForm.programId)) || deptProgram || programs[0];
                  return (
                    <div className="w-full bg-slate-100/90 border border-slate-200/90 text-xs font-bold text-slate-800 px-3.5 py-2.5 rounded-xl flex items-center justify-between shadow-inner">
                      <span>
                        {selProg ? `${selProg.program_code} - ${selProg.program_name}` : "BSInfoTech - Bachelor of Science in Information Technology"}
                      </span>
                      <span className="font-mono text-[10px] font-black text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                        {selProg?.program_code || "BSInfoTech"}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Year Level
                </label>
                <select
                  value={enrollForm.yearLevel}
                  onChange={(e) => setEnrollForm({ ...enrollForm, yearLevel: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl transition-all"
                >
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEnrollModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEnroll}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-75"
              >
                {isSubmittingEnroll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding Student...</span>
                  </>
                ) : (
                  <span>Add Student to Class</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QUESTION CRUD MODAL */}
      {qModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form onSubmit={handleSaveQuestionBankItem} className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingQ ? "Edit Question Repository Item" : "Create Question Repository Item"}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Define structured metadata for categorized cataloging</p>
              </div>
              <button
                type="button"
                onClick={() => setQModalOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">Target Course</label>
                <select
                  required
                  value={qForm.course_id}
                  onChange={(e) => setQForm({ ...qForm, course_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 px-4 py-2.5 rounded-xl transition-all"
                >
                  <option value="" disabled>Select Course...</option>
                  {courses.map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.course_code} - {c.course_title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block">Topic</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arrays, Lists"
                    value={qForm.topic}
                    onChange={(e) => setQForm({ ...qForm, topic: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 px-4 py-2.5 rounded-xl transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block">Year Level</label>
                  <select
                    value={qForm.year_level}
                    onChange={(e) => setQForm({ ...qForm, year_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 px-4 py-2.5 rounded-xl transition-all"
                  >
                    <option value="">N/A</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block">Question Type</label>
                  <select
                    value={qForm.question_type}
                    onChange={(e) => setQForm({ ...qForm, question_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 px-4 py-2.5 rounded-xl transition-all"
                  >
                    <option value="Multiple_Choice">Multiple Choice</option>
                    <option value="True_False">True / False</option>
                    <option value="Identification">Identification</option>
                    <option value="Matching_Type">Matching Type</option>
                    <option value="Essay">Essay</option>
                    <option value="Fill_In_The_Blanks">Fill in the Blanks</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block">Points</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qForm.points}
                    onChange={(e) => setQForm({ ...qForm, points: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 px-4 py-2.5 rounded-xl transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">Question Prompt Text</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the question details..."
                  value={qForm.question_text}
                  onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 px-4 py-2.5 rounded-xl transition-all"
                />
              </div>

              {qForm.question_type !== "Essay" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block">Correct Answer</label>
                  <input
                    type="text"
                    required
                    placeholder={
                      qForm.question_type === "True_False" 
                        ? "True or False" 
                        : "Type expected target response..."
                    }
                    value={qForm.correct_answer}
                    onChange={(e) => setQForm({ ...qForm, correct_answer: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 px-4 py-2.5 rounded-xl transition-all"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setQModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingQ}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingQ && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Question
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EXAM ARCHIVE CONFIRMATION MODAL */}
      {archiveModalOpen && examToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form onSubmit={handleArchiveExamSubmit} className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 relative">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Archive Examination</h3>
                <p className="text-xs text-slate-400 mt-0.5">Move exam to historical records</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setArchiveModalOpen(false);
                  setExamToArchive(null);
                }}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-1">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Exam Title</p>
                <p className="text-sm font-extrabold text-slate-800">{examToArchive.title}</p>
                <p className="text-xs text-emerald-700 font-bold mt-1">
                  {examToArchive.course.course_code} - {examToArchive.course.course_title}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-750 block">Academic Year Target</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2025-2026"
                  value={academicYearInput}
                  onChange={(e) => setAcademicYearInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 px-4 py-2.5 rounded-xl transition-all"
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  Specify the academic year this test was administered. Archiving hides the exam from active feed tracker boards, keeping it safe for duplication.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setArchiveModalOpen(false);
                  setExamToArchive(null);
                }}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isArchiving}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                {isArchiving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Archive Exam
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DETAILED LOGS MODAL */}
      {logsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Security Violation Audit Logs
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">
                    Attempt history for: <span className="text-emerald-700 font-extrabold">{selectedAttemptStudentName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setLogsModalOpen(false)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 space-y-4 overflow-y-auto max-h-[50vh] pr-1">
                {loadingLogs ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-500">Querying project audit logs...</span>
                  </div>
                ) : selectedAttemptLogs && selectedAttemptLogs.length > 0 ? (
                  <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-5">
                    {selectedAttemptLogs.map((log) => {
                      const isWarning = log.action_performed.includes("Warning");
                      const isSubmission = log.action_performed.includes("Submitted");
                      
                      let logDotColor = "bg-slate-400";
                      let logBgColor = "bg-slate-50 border-slate-100 text-slate-705";
                      if (isWarning) {
                        logDotColor = "bg-rose-500 animate-pulse";
                        logBgColor = "bg-rose-50/50 border-rose-100 text-rose-900";
                      } else if (isSubmission) {
                        logDotColor = "bg-emerald-500";
                        logBgColor = "bg-emerald-50/50 border-emerald-100 text-emerald-900";
                      }

                      return (
                        <div key={log.log_id} className="relative">
                          {/* Timeline Dot */}
                          <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${logDotColor}`} />
                          <div className={`border p-3 rounded-xl ${logBgColor} space-y-1`}>
                            <p className="text-xs font-bold leading-normal">{log.action_performed}</p>
                            <p className="text-[10px] text-slate-400 font-semibold font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-450 italic text-xs">
                    No matching security violation logs found in database. Student has taken the exam within full compliance.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => setLogsModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Close Logs Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL STUDENT EXAM PAPER MODAL */}
      {examPaperModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300 print:p-0 print:bg-white print:static print:z-auto print:backdrop-blur-none">
          <div className="bg-slate-100 border border-slate-200 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[94vh] overflow-hidden print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none print:bg-white">
            
            {/* Modal Header Bar (Non-printable) */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-2xl border border-emerald-200">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    Official Student Examination Paper
                    {activeExamPaperData?.hasEssay && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        Includes Essay Questions
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    {activeExamPaperData?.student ? (
                      <>
                        Student: <span className="text-slate-800 font-bold">{[activeExamPaperData.student.first_name, getStudentMiddleInitial(activeExamPaperData.student.middle_name), activeExamPaperData.student.last_name].filter(Boolean).join(" ")}</span> &bull; {activeExamPaperData.exam?.title || "Examination Paper"}
                      </>
                    ) : (
                      "Loading examination attempt record..."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Print or save as PDF"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span className="hidden sm:inline">Print Paper</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExamPaperModalOpen(false)}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Printable A4 Area */}
            <div className="overflow-y-auto flex-1 p-2 sm:p-6 print:p-0 print:overflow-visible">
              {loadingExamPaper && !activeExamPaperData ? (
                <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center gap-4 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">Generating Official Examination Paper</h4>
                    <p className="text-xs text-slate-400 font-semibold mt-1">Retrieving question bank items, student answers, and grading data...</p>
                  </div>
                </div>
              ) : activeExamPaperData ? (
                (() => {
                  const paper = activeExamPaperData;
                  const student = paper.student || {};
                  const exam = paper.exam || {};
                  const mi = getStudentMiddleInitial(student.middle_name);
                  const studentFullName = mi
                    ? `${student.first_name} ${mi} ${student.last_name}`
                    : `${student.first_name} ${student.last_name}`;

                  const yrLevelSection = formatStudentProgramAndYear(student.program_code, student.year_level || 1, student.section);
                  
                  const examDate = paper.submitted_at ? new Date(paper.submitted_at) : (paper.started_at ? new Date(paper.started_at) : new Date());
                  const formattedExamDate = examDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                  });

                  const rawItemsScore = paper.rawItemsScore ?? 0;
                  const penaltyPoints = paper.penaltyPoints ?? 0;
                  const finalTotalScore = paper.finalTotalScore ?? Math.max(0, rawItemsScore - penaltyPoints);
                  const totalPossiblePoints = paper.totalPossiblePoints ?? 0;
                  const hasPenalty = penaltyPoints > 0;

                  // Group questions by canonical types
                  const rawQuestions = exam.questions || [];
                  const parsedQuestions = rawQuestions.map((q: any) => parseExamPaperQuestion(q));

                  // Group by question_type
                  const groupedTypesMap = new Map<string, any[]>();
                  parsedQuestions.forEach((q: any) => {
                    const qType = q.question_type || "Multiple_Choice";
                    if (!groupedTypesMap.has(qType)) {
                      groupedTypesMap.set(qType, []);
                    }
                    groupedTypesMap.get(qType)!.push(q);
                  });

                  // Sort groups by canonical order
                  const sortedTypeKeys = Array.from(groupedTypesMap.keys()).sort((a, b) => {
                    const orderA = QUESTION_TYPE_ORDER[a] ?? 99;
                    const orderB = QUESTION_TYPE_ORDER[b] ?? 99;
                    return orderA - orderB;
                  });

                  let runningItemNumber = 0;

                  return (
                    <div
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                      className="exam-paper-printable w-full max-w-[794px] mx-auto bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-10 text-slate-900 space-y-5 print:max-w-none print:shadow-none print:border-none print:m-0 print:p-0 print:rounded-none select-text"
                    >
                      {/* BSC OFFICIAL HEADER IMAGE */}
                      <div className="w-full relative overflow-hidden leading-none block shrink-0 border-b border-slate-200 pb-2">
                        <img
                          src="/bsc-header.png"
                          alt="Batanes State College Header"
                          className="w-full h-auto object-cover block mx-auto print:w-full"
                        />
                      </div>

                      {/* FULL EXAMINATION TITLE HEADER */}
                      <div className="text-center space-y-0.5 pt-1 pb-2 border-b border-slate-200">
                        <h2 className="text-base sm:text-lg font-black font-sans text-slate-900 tracking-wider uppercase">
                          {exam.course?.course_code ? `${exam.course.course_code}` : "COURSE EXAMINATION"}
                          {exam.course?.course_title ? ` — ${exam.course.course_title}` : ""}
                        </h2>
                        <p className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                          {exam.term ? `${exam.term.toUpperCase()} EXAMINATION` : "TERM EXAMINATION"}
                        </p>
                        <p className="text-xs font-bold text-slate-600">
                          {exam.semester || "First Semester"} {exam.academic_year ? `• A.Y. ${exam.academic_year}` : ""}
                        </p>
                      </div>

                      {/* AUTO-FILLED 4-BOX STUDENT METADATA (NAME, DATE, YR/LEVEL, SCORE) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5 text-xs font-bold border-b-2 border-black pb-4 pt-1">
                        {/* NAME */}
                        <div className="flex items-baseline gap-2">
                          <span className="font-black text-black uppercase tracking-wider shrink-0 min-w-[75px]">NAME:</span>
                          <span className="border-b border-black flex-1 min-h-[20px] px-1 font-black text-slate-900 text-xs">
                            {studentFullName}
                          </span>
                        </div>
                        {/* DATE */}
                        <div className="flex items-baseline gap-2">
                          <span className="font-black text-black uppercase tracking-wider shrink-0 min-w-[50px]">DATE:</span>
                          <span className="border-b border-black flex-1 min-h-[20px] px-1 font-black text-slate-900 text-xs">
                            {formattedExamDate}
                          </span>
                        </div>
                        {/* YR / LEVEL */}
                        <div className="flex items-baseline gap-2">
                          <span className="font-black text-black uppercase tracking-wider shrink-0 min-w-[75px]">YR / LEVEL:</span>
                          <span className="border-b border-black flex-1 min-h-[20px] px-1 font-black text-slate-900 text-xs">
                            {yrLevelSection}
                          </span>
                        </div>
                        {/* SCORE: Total score with penalty breakdown */}
                        <div className="flex items-baseline gap-2">
                          <span className="font-black text-black uppercase tracking-wider shrink-0 min-w-[50px]">SCORE:</span>
                          <span className="border-b border-black flex-1 min-h-[20px] px-1 font-black text-emerald-800 text-xs flex items-center justify-between">
                            <span>
                              {hasPenalty ? (
                                <span className="font-black">
                                  {rawItemsScore} - {penaltyPoints} = {finalTotalScore} pts
                                </span>
                              ) : (
                                <span className="font-black">
                                  {finalTotalScore} pts
                                </span>
                              )}
                            </span>
                            {totalPossiblePoints > 0 && (
                              <span className="text-[10px] text-slate-500 font-bold ml-2">
                                (out of {totalPossiblePoints} pts)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* PENALTY & VIOLATIONS ALERT BANNER (If penalty exists) */}
                      {hasPenalty && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 text-rose-800">
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                            <span className="font-extrabold">
                              Security Violations Penalty Applied: {paper.violations_count} violation(s) recorded ({paper.penaltyPerViolation ?? 2} pts penalty each).
                            </span>
                          </div>
                          <div className="text-[11px] font-black font-mono text-rose-900 shrink-0">
                            Calculation: {rawItemsScore} - {penaltyPoints} = {finalTotalScore} pts
                          </div>
                        </div>
                      )}

                      {/* QUESTION SECTIONS */}
                      <div className="space-y-6 pt-2">
                        {sortedTypeKeys.map((qType, typeIdx) => {
                          const typeQuestions = groupedTypesMap.get(qType) || [];
                          const sectionTotalPoints = typeQuestions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
                          const headerLabel = QUESTION_TYPE_HEADER_LABELS[qType] || qType.toUpperCase();
                          const instructionsText = QUESTION_TYPE_INSTRUCTIONS[qType] || "Read each question carefully and answer accordingly.";

                          return (
                            <div key={qType} className="space-y-4">
                              {/* Test Section Header */}
                              <div className="pt-3 pb-1.5 border-b-2 border-slate-900">
                                <div className="flex items-baseline justify-between">
                                  <h4 className="font-black text-sm text-slate-900 tracking-wide uppercase font-sans">
                                    TEST {toRomanNumeral(typeIdx + 1)}. {headerLabel}
                                  </h4>
                                  <span className="text-xs font-extrabold text-slate-900 font-sans tracking-tight shrink-0">
                                    ({sectionTotalPoints} {sectionTotalPoints === 1 ? "Point" : "Points"})
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 italic font-sans mt-0.5 leading-tight">
                                  <span className="font-bold not-italic">Directions: </span>
                                  <span>{instructionsText}</span>
                                </p>
                              </div>

                              {/* Questions in this Section */}
                              <div className="space-y-4">
                                {typeQuestions.map((q: any) => {
                                  runningItemNumber++;
                                  const currentItemNum = runningItemNumber;
                                  const pointsMax = q.points || 1;
                                  const isEssay = q.question_type === "Essay";
                                  const isCorrect = q.is_correct;
                                  const pointsAwarded = q.points_awarded;

                                  return (
                                    <div
                                      key={q.question_id}
                                      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs shadow-2xs"
                                    >
                                      {/* Item Header & Points */}
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5">
                                          <span className="font-extrabold text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[11px] shrink-0">
                                            {currentItemNum}.
                                          </span>
                                          <p className="font-bold text-slate-900 leading-relaxed text-xs">
                                            {q.displayText || "(Question prompt)"}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {isEssay ? (
                                            <span className="text-[10px] font-extrabold bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded">
                                              Max {pointsMax} pts
                                            </span>
                                          ) : (
                                            <span
                                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                                isCorrect === true
                                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                  : isCorrect === false
                                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                                  : "bg-slate-100 text-slate-700 border-slate-200"
                                              }`}
                                            >
                                              {isCorrect === true ? (
                                                <>
                                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                  <span>+{pointsAwarded ?? pointsMax} pt</span>
                                                </>
                                              ) : isCorrect === false ? (
                                                <>
                                                  <XCircle className="w-3 h-3 text-rose-600" />
                                                  <span>0 / {pointsMax} pt</span>
                                                </>
                                              ) : (
                                                <span>{pointsMax} pt</span>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Prompt Image if any */}
                                      {q.image_url && (
                                        <div className="pl-6 pt-1">
                                          <img
                                            src={q.image_url}
                                            alt={`Question ${currentItemNum}`}
                                            className="max-h-44 rounded-lg border border-slate-300 object-contain"
                                          />
                                        </div>
                                      )}

                                      {/* Instructions / Rubric Guidelines if any */}
                                      {q.instruction && (
                                        <div className="pl-6 pt-1">
                                          <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950">
                                            <span className="font-black text-amber-900 uppercase tracking-wider text-[10px] block mb-0.5">
                                              Instructions / Guidelines:
                                            </span>
                                            <p className="whitespace-pre-wrap leading-relaxed">{q.instruction}</p>
                                          </div>
                                        </div>
                                      )}

                                      {/* 1. Multiple Choice Options Rendering */}
                                      {q.question_type === "Multiple_Choice" && (
                                        <div className="pl-6 pt-1 space-y-1.5">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {(q.options || []).map((opt: string, optIdx: number) => {
                                              const label = String.fromCharCode(65 + optIdx);
                                              const optText = opt || `Option ${label}`;
                                              const isStudentChoice = (q.submitted_response || "").trim() === optText.trim() ||
                                                (q.submitted_response || "").trim().toUpperCase() === label;
                                              const isCorrectChoice = (q.correct_answer || "").trim() === optText.trim() ||
                                                (q.correct_answer || "").trim().toUpperCase() === label;

                                              let borderBg = "bg-slate-50 border-slate-200 text-slate-700";
                                              if (isStudentChoice && isCorrectChoice) {
                                                borderBg = "bg-emerald-50 border-emerald-300 text-emerald-900 ring-1 ring-emerald-400";
                                              } else if (isStudentChoice && !isCorrectChoice) {
                                                borderBg = "bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-400";
                                              } else if (!isStudentChoice && isCorrectChoice) {
                                                borderBg = "bg-emerald-50/50 border-emerald-200 border-dashed text-emerald-900";
                                              }

                                              return (
                                                <div
                                                  key={optIdx}
                                                  className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs font-semibold ${borderBg}`}
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-black px-1.5 py-0.5 rounded text-[10px] bg-slate-200/80 text-slate-800">
                                                      {label}.
                                                    </span>
                                                    <span>{optText}</span>
                                                  </div>
                                                  <div className="shrink-0 text-[10px] font-black">
                                                    {isStudentChoice && isCorrectChoice && (
                                                      <span className="text-emerald-700 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Student Answer (Correct)</span>
                                                      </span>
                                                    )}
                                                    {isStudentChoice && !isCorrectChoice && (
                                                      <span className="text-rose-700 flex items-center gap-1">
                                                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                                        <span>Student Answer (Incorrect)</span>
                                                      </span>
                                                    )}
                                                    {!isStudentChoice && isCorrectChoice && (
                                                      <span className="text-emerald-600 italic">
                                                        (Correct Answer)
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* 2. True or False Rendering */}
                                      {q.question_type === "True_False" && (
                                        <div className="pl-6 pt-1 space-y-2">
                                          <div className="flex items-center gap-3">
                                            {["True", "False"].map((choice) => {
                                              const isStudentChoice = (q.submitted_response || "").trim().toLowerCase() === choice.toLowerCase();
                                              const isCorrectChoice = (q.correct_answer || "").trim().toLowerCase() === choice.toLowerCase();

                                              let badgeStyle = "bg-slate-50 border-slate-200 text-slate-600";
                                              if (isStudentChoice && isCorrectChoice) {
                                                badgeStyle = "bg-emerald-50 border-emerald-300 text-emerald-900 ring-1 ring-emerald-400";
                                              } else if (isStudentChoice && !isCorrectChoice) {
                                                badgeStyle = "bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-400";
                                              } else if (!isStudentChoice && isCorrectChoice) {
                                                badgeStyle = "bg-emerald-50/50 border-emerald-200 border-dashed text-emerald-800";
                                              }

                                              return (
                                                <div
                                                  key={choice}
                                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${badgeStyle}`}
                                                >
                                                  <span>{choice}</span>
                                                  {isStudentChoice && isCorrectChoice && (
                                                    <span className="text-[10px] text-emerald-700 font-black flex items-center gap-0.5">
                                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Student Ans
                                                    </span>
                                                  )}
                                                  {isStudentChoice && !isCorrectChoice && (
                                                    <span className="text-[10px] text-rose-700 font-black flex items-center gap-0.5">
                                                      <XCircle className="w-3 h-3 text-rose-600" /> Student Ans
                                                    </span>
                                                  )}
                                                  {!isStudentChoice && isCorrectChoice && (
                                                    <span className="text-[10px] text-emerald-600 italic">
                                                      (Key)
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* 3. Identification Rendering */}
                                      {q.question_type === "Identification" && (
                                        <div className="pl-6 pt-1 space-y-1.5">
                                          <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="font-extrabold text-slate-500">Student Response:</span>
                                            <span
                                              className={`font-mono font-bold px-2 py-0.5 rounded border ${
                                                isCorrect === true
                                                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                                  : isCorrect === false
                                                  ? "bg-rose-50 border-rose-300 text-rose-900"
                                                  : "bg-slate-100 border-slate-300 text-slate-800"
                                              }`}
                                            >
                                              {q.submitted_response || "(Blank / No Answer)"}
                                            </span>
                                            {isCorrect === false && (
                                              <span className="text-slate-500 text-[11px] ml-2 font-medium">
                                                Expected Key: <span className="font-mono font-bold text-slate-800">{q.correct_answer}</span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* 4. Fill In The Blanks Rendering */}
                                      {q.question_type === "Fill_In_The_Blanks" && (
                                        <div className="pl-6 pt-1 space-y-2">
                                          <div className="space-y-1 text-xs">
                                            <div className="font-extrabold text-slate-500">Student Submitted Blanks:</div>
                                            <div className="flex flex-wrap gap-2">
                                              {(() => {
                                                let studentBlanks: Record<string, string> = {};
                                                try {
                                                  if ((q.submitted_response || "").trim().startsWith("{")) {
                                                    const parsed = JSON.parse(q.submitted_response);
                                                    studentBlanks = parsed.blanks || {};
                                                  } else if (q.submitted_response) {
                                                    studentBlanks = { "1": q.submitted_response };
                                                  }
                                                } catch {}

                                                return (q.blanks || []).map((b: any, bIdx: number) => {
                                                  const studentVal = studentBlanks[String(b.id || bIdx + 1)] || "";
                                                  const isBlankCorrect = studentVal.trim().toLowerCase() === (b.answer || "").trim().toLowerCase();

                                                  return (
                                                    <div
                                                      key={bIdx}
                                                      className={`p-2 rounded-lg border text-xs font-mono ${
                                                        isBlankCorrect
                                                          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                                          : "bg-rose-50 border-rose-300 text-rose-900"
                                                      }`}
                                                    >
                                                      <span className="font-bold">Blank #{bIdx + 1}: </span>
                                                      <span>{studentVal || "(Empty)"}</span>
                                                      {!isBlankCorrect && (
                                                        <div className="text-[10px] text-slate-600 mt-0.5">
                                                          Key: {b.answer} ({b.points || 1} pt)
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                });
                                              })()}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* 5. Matching Type Rendering */}
                                      {q.question_type === "Matching_Type" && (
                                        <div className="pl-6 pt-1 space-y-2">
                                          <div className="space-y-1 text-xs">
                                            <div className="font-extrabold text-slate-500">Premise & Student Matching:</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              {(q.matches || []).map((m: any, mIdx: number) => (
                                                <div key={mIdx} className="p-2 rounded-lg border bg-slate-50 border-slate-200 text-xs">
                                                  <div className="font-bold text-slate-800">{mIdx + 1}. {m.premise}</div>
                                                  <div className="text-slate-600 text-[11px] mt-0.5">
                                                    Matched with: <span className="font-bold text-slate-900">{m.choice}</span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* 6. Essay Question with Interactive Grading */}
                                      {isEssay && (
                                        <div className="pl-6 pt-1 space-y-3">
                                          {/* Instructor Reference Key / Scoring Guide */}
                                          {q.correct_answer && (
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-900">
                                                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>Instructor Evaluation Reference / Criteria Guide:</span>
                                              </div>
                                              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 leading-relaxed whitespace-pre-wrap select-text">
                                                {q.correct_answer}
                                              </div>
                                            </div>
                                          )}

                                          {/* Student Written Response */}
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                                              <span className="flex items-center gap-1 text-slate-800 font-extrabold">
                                                <PenTool className="w-3.5 h-3.5 text-slate-600" />
                                                <span>Student Submitted Essay Response:</span>
                                              </span>
                                              <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                Word count: <strong className={countWords(q.submitted_response || "") >= (q.min_words || 50) ? "text-emerald-700" : "text-amber-700"}>{countWords(q.submitted_response || "")}</strong> / min {q.min_words || 50} words
                                              </span>
                                            </div>
                                            <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap select-text">
                                              {q.submitted_response ? (
                                                q.submitted_response
                                              ) : (
                                                <span className="text-slate-400 italic">
                                                  (Student did not submit an answer for this essay item.)
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Interactive Grading Panel */}
                                          <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3 print:hidden">
                                            <div className="flex items-center gap-3 flex-wrap">
                                              <span className="text-xs font-black text-amber-950">
                                                Award Essay Points:
                                              </span>
                                              <div className="flex items-center gap-1.5">
                                                <input
                                                  type="number"
                                                  min={0}
                                                  max={pointsMax}
                                                  value={
                                                    essayPointsDraft[q.answer_id] !== undefined
                                                      ? essayPointsDraft[q.answer_id]
                                                      : (pointsAwarded !== null ? pointsAwarded : 0)
                                                  }
                                                  onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setEssayPointsDraft((prev) => ({
                                                      ...prev,
                                                      [q.answer_id]: isNaN(val) ? 0 : val,
                                                    }));
                                                  }}
                                                  className="w-16 px-2 py-1 text-center text-xs font-black bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                                                />
                                                <span className="text-xs font-extrabold text-amber-900">
                                                  / {pointsMax} pts
                                                </span>
                                              </div>

                                              {/* Quick Score Presets */}
                                              <div className="flex items-center gap-1 text-[10px] font-bold">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEssayPointsDraft((prev) => ({
                                                      ...prev,
                                                      [q.answer_id]: pointsMax,
                                                    }));
                                                  }}
                                                  className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded border border-emerald-300 cursor-pointer"
                                                  title={`Set full score (${pointsMax} pts)`}
                                                >
                                                  Full ({pointsMax})
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEssayPointsDraft((prev) => ({
                                                      ...prev,
                                                      [q.answer_id]: Math.round(pointsMax / 2),
                                                    }));
                                                  }}
                                                  className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300 cursor-pointer"
                                                  title={`Set half score (${Math.round(pointsMax / 2)} pts)`}
                                                >
                                                  Half ({Math.round(pointsMax / 2)})
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEssayPointsDraft((prev) => ({
                                                      ...prev,
                                                      [q.answer_id]: 0,
                                                    }));
                                                  }}
                                                  className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded border border-slate-300 cursor-pointer"
                                                  title="Set zero score (0 pts)"
                                                >
                                                  Zero (0)
                                                </button>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              {pointsAwarded !== null ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 rounded-lg">
                                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                  <span>Graded ({pointsAwarded} / {pointsMax} pts)</span>
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                  <span>Ungraded</span>
                                                </span>
                                              )}

                                              <button
                                                type="button"
                                                disabled={savingEssayId === q.answer_id || !q.answer_id}
                                                onClick={() => handleSaveEssayScore(q.answer_id, pointsMax)}
                                                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer"
                                                title="Save score and update student's exam grade"
                                              >
                                                {savingEssayId === q.answer_id ? (
                                                  <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Saving...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>Save Score</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* BSC OFFICIAL FOOTER IMAGE */}
                      <div className="w-full mt-8 relative overflow-hidden leading-none block shrink-0 border-t border-slate-200 pt-3">
                        <img
                          src="/bsc-footer.png"
                          alt="Batanes State College Footer"
                          className="w-full h-auto object-cover block mx-auto print:w-full"
                        />
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 text-xs">
                  Unable to load examination paper details.
                </div>
              )}
            </div>

            {/* Modal Bottom Bar */}
            <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 print:hidden">
              <span className="text-xs text-slate-400 font-semibold">
                Batanes State College &bull; Official Examination Paper
              </span>
              <button
                type="button"
                onClick={() => setExamPaperModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED STUDENT ESSAY EVALUATION & GRADING MODAL */}
      {essayGradingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-900 p-2.5 rounded-2xl border border-amber-200">
                  <PenTool className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    Student Essay Evaluation & Scoring
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      Instructor Grading Portal
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {activeEssayGradingData?.student ? (
                      <>
                        Student: <strong className="text-slate-800">{[activeEssayGradingData.student.first_name, getStudentMiddleInitial(activeEssayGradingData.student.middle_name), activeEssayGradingData.student.last_name].filter(Boolean).join(" ")}</strong> ({activeEssayGradingData.student.institutional_id}) &bull; {activeEssayGradingData.exam?.title} ({activeEssayGradingData.exam?.course?.course_code})
                      </>
                    ) : (
                      "Loading student essay submissions..."
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEssayGradingModalOpen(false)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score Breakdown Bar */}
            {activeEssayGradingData && (
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block">Raw Score</span>
                    <span className="text-sm font-black text-slate-800">{activeEssayGradingData.rawItemsScore ?? 0} pts</span>
                  </div>
                  {activeEssayGradingData.violations_count > 0 && (
                    <div className="border-l border-slate-200 pl-4">
                      <span className="text-rose-600 font-bold uppercase text-[10px] tracking-wider block">Penalty</span>
                      <span className="text-sm font-black text-rose-700">
                        -{activeEssayGradingData.penaltyPoints ?? 0} pts ({activeEssayGradingData.violations_count} violation(s))
                      </span>
                    </div>
                  )}
                  <div className="border-l border-slate-200 pl-4">
                    <span className="text-emerald-700 font-bold uppercase text-[10px] tracking-wider block">Total Exam Grade</span>
                    <span className="text-sm font-black text-emerald-800">
                      {activeEssayGradingData.finalTotalScore ?? 0} pts
                      {activeEssayGradingData.totalPossiblePoints > 0 && (
                        <span className="text-xs font-semibold text-slate-400 ml-1">
                          / {activeEssayGradingData.totalPossiblePoints} pts
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-semibold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                  Evaluation updates and recalculations save directly to the official grade roster.
                </div>
              </div>
            )}

            {/* Success Toast Banner */}
            {essayGradeSuccessToast && (
              <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-2 text-emerald-900 text-xs font-bold animate-in fade-in shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{essayGradeSuccessToast}</span>
              </div>
            )}

            {/* Modal Body: List of Essay Questions */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-6">
              {loadingEssayGrading && !activeEssayGradingData ? (
                <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center gap-4 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">Loading Essay Responses</h4>
                    <p className="text-xs text-slate-400 font-semibold mt-1">Retrieving student answers, attached images, instructions, and reference keys...</p>
                  </div>
                </div>
              ) : activeEssayGradingData ? (
                (() => {
                  const rawQuestions = activeEssayGradingData.exam?.questions || [];
                  const essayQuestions = rawQuestions
                    .map((q: any) => parseExamPaperQuestion(q))
                    .filter((q: any) => q.question_type === "Essay");

                  if (essayQuestions.length === 0) {
                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs font-medium">
                        No essay items found in this examination.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {essayQuestions.map((q: any, eIdx: number) => {
                        const pointsMax = q.points || 10;
                        const pointsAwarded = q.points_awarded;
                        const wordCount = countWords(q.submitted_response || "");
                        const minWords = q.min_words || 50;
                        const meetsMinWords = wordCount >= minWords;

                        return (
                          <div
                            key={q.question_id || eIdx}
                            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                          >
                            {/* Question Header & Max Points */}
                            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black px-2.5 py-1 rounded-lg">
                                  Essay Item #{eIdx + 1}
                                </span>
                                {q.taxonomy_level && (
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase">
                                    {q.taxonomy_level}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                Max Points: {pointsMax} pts
                              </span>
                            </div>

                            {/* Question Prompt */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Question Prompt:
                              </label>
                              <p className="text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-wrap select-text">
                                {q.displayText || q.question_text || "(No prompt text)"}
                              </p>
                            </div>

                            {/* Attached Image if Uploaded by Instructor */}
                            {q.image_url && (
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  Attached Reference Image:
                                </label>
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl inline-block max-w-full">
                                  <img
                                    src={q.image_url}
                                    alt={`Essay Reference ${eIdx + 1}`}
                                    className="max-h-60 rounded-lg object-contain border border-slate-300"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Attached Instructions / Guidelines if Provided */}
                            {q.instruction && (
                              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950 space-y-1">
                                <span className="font-black text-amber-900 uppercase tracking-wider text-[10px] block">
                                  Instructions / Rubric Guidelines:
                                </span>
                                <p className="whitespace-pre-wrap leading-relaxed">{q.instruction}</p>
                              </div>
                            )}

                            {/* Instructor's Reference Key / Rubric Evaluation Guide */}
                            {q.correct_answer && (
                              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200/90 rounded-xl text-xs space-y-1.5 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-indigo-950 font-black text-xs">
                                  <BookOpen className="w-4 h-4 text-indigo-600" />
                                  <span>Instructor Reference Key / Evaluation Guide (Scoring Basis):</span>
                                </div>
                                <div className="p-3 bg-white/90 border border-indigo-100 rounded-lg text-indigo-950 text-xs leading-relaxed whitespace-pre-wrap select-text font-normal">
                                  {q.correct_answer}
                                </div>
                              </div>
                            )}

                            {/* Student Submitted Response */}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                  <PenTool className="w-3.5 h-3.5 text-slate-500" />
                                  Student's Submitted Essay Answer:
                                </label>
                                <span className="text-[11px] font-mono font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg">
                                  Word count: <strong className={meetsMinWords ? "text-emerald-700 font-black" : "text-amber-700 font-black"}>{wordCount}</strong> / min {minWords} words
                                </span>
                              </div>
                              <div className="p-4 bg-slate-50/80 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap select-text">
                                {q.submitted_response ? (
                                  q.submitted_response
                                ) : (
                                  <span className="text-slate-400 italic">
                                    (The student did not provide an answer for this essay item.)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Interactive Grading Panel */}
                            <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs font-black text-amber-950">
                                  Award Points:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={pointsMax}
                                    value={
                                      essayPointsDraft[q.answer_id] !== undefined
                                        ? essayPointsDraft[q.answer_id]
                                        : (pointsAwarded !== null ? pointsAwarded : 0)
                                    }
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setEssayPointsDraft((prev) => ({
                                        ...prev,
                                        [q.answer_id]: isNaN(val) ? 0 : val,
                                      }));
                                    }}
                                    className="w-16 px-2 py-1 text-center text-xs font-black bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 shadow-2xs"
                                  />
                                  <span className="text-xs font-extrabold text-amber-900">
                                    / {pointsMax} pts
                                  </span>
                                </div>

                                {/* Quick Score Preset Buttons */}
                                <div className="flex items-center gap-1 text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEssayPointsDraft((prev) => ({
                                        ...prev,
                                        [q.answer_id]: pointsMax,
                                      }));
                                    }}
                                    className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md border border-emerald-300 cursor-pointer transition-colors"
                                    title={`Award full points (${pointsMax} pts)`}
                                  >
                                    Full ({pointsMax})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEssayPointsDraft((prev) => ({
                                        ...prev,
                                        [q.answer_id]: Math.round(pointsMax / 2),
                                      }));
                                    }}
                                    className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md border border-amber-300 cursor-pointer transition-colors"
                                    title={`Award half points (${Math.round(pointsMax / 2)} pts)`}
                                  >
                                    Half ({Math.round(pointsMax / 2)})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEssayPointsDraft((prev) => ({
                                        ...prev,
                                        [q.answer_id]: 0,
                                      }));
                                    }}
                                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md border border-slate-300 cursor-pointer transition-colors"
                                    title="Award zero points (0 pts)"
                                  >
                                    Zero (0)
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {pointsAwarded !== null ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-lg">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Graded ({pointsAwarded} / {pointsMax} pts)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Ungraded</span>
                                  </span>
                                )}

                                <button
                                  type="button"
                                  disabled={savingEssayId === q.answer_id || !q.answer_id}
                                  onClick={() => handleSaveEssayScore(q.answer_id, pointsMax)}
                                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer"
                                  title="Save score and update student's exam grade"
                                >
                                  {savingEssayId === q.answer_id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Saving...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Save Score</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 text-xs">
                  Unable to load student essay data.
                </div>
              )}
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400 font-semibold">
                Batanes State College &bull; Student Essay Evaluation
              </span>
              <button
                type="button"
                onClick={() => setEssayGradingModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Done Grading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENROLLED STUDENTS & GRADES ROSTER MODAL */}
      {rosterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 text-emerald-800 p-3 rounded-2xl border border-emerald-200/60">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    Class Students & Exam Performance Roster
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Class students taking your subjects, their exam completion status, and calculated grade percentages.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const filtered = rosterStudents.filter((item) => {
                      if (rosterFilters.course_id && String(item.course_id) !== rosterFilters.course_id) return false;
                      if (rosterFilters.status === "TOOK" && item.total_took === 0) return false;
                      if (rosterFilters.status === "MISSED" && item.total_missed === 0) return false;
                      if (rosterFilters.search) {
                        const q = rosterFilters.search.toLowerCase();
                        const name = `${item.first_name} ${item.last_name}`.toLowerCase();
                        const id = item.institutional_id.toLowerCase();
                        const course = `${item.course_code} ${item.course_title}`.toLowerCase();
                        const prog = item.program_code.toLowerCase();
                        if (!name.includes(q) && !id.includes(q) && !course.includes(q) && !prog.includes(q)) return false;
                      }
                      return true;
                    });
                    exportStudentGradesRosterToExcel(filtered, "Faculty_Enrolled_Students_Grades");
                  }}
                  disabled={loadingRoster || rosterStudents.length === 0}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer"
                  title="Download student roster and grades as Excel document (.xlsx)"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel</span>
                </button>
                <button
                  onClick={() => setRosterModalOpen(false)}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Controls & Summary Stats */}
            <div className="space-y-4 shrink-0">
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search student, ID, program..."
                    value={rosterFilters.search}
                    onChange={(e) => setRosterFilters({ ...rosterFilters, search: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 pl-9 pr-4 py-2.5 focus:outline-emerald-500 shadow-sm"
                  />
                </div>

                {/* Course Filter */}
                <div>
                  <select
                    value={rosterFilters.course_id}
                    onChange={(e) => setRosterFilters({ ...rosterFilters, course_id: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 px-3 py-2.5 focus:outline-emerald-500 shadow-sm"
                  >
                    <option value="">All Taught Subjects</option>
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_code} - {c.course_title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <select
                    value={rosterFilters.status}
                    onChange={(e) => setRosterFilters({ ...rosterFilters, status: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 px-3 py-2.5 focus:outline-emerald-500 shadow-sm"
                  >
                    <option value="ALL">All Attendance Statuses</option>
                    <option value="TOOK">Took Scheduled Exams</option>
                    <option value="MISSED">Missed Scheduled Exams</option>
                  </select>
                </div>
              </div>

              {/* Roster Summary KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-2xl text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Total Enrolled</p>
                  <p className="text-xl font-black text-emerald-950 mt-0.5">{rosterStudents.length}</p>
                </div>
                <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl text-center">
                  <p className="text-[10px] font-black uppercase text-blue-800 tracking-wider">Exams Taken</p>
                  <p className="text-xl font-black text-blue-950 mt-0.5">
                    {rosterStudents.reduce((sum, s) => sum + s.total_took, 0)}
                  </p>
                </div>
                <div className="bg-rose-50/70 border border-rose-100 p-3 rounded-2xl text-center">
                  <p className="text-[10px] font-black uppercase text-rose-800 tracking-wider">Exams Missed</p>
                  <p className="text-xl font-black text-rose-950 mt-0.5">
                    {rosterStudents.reduce((sum, s) => sum + s.total_missed, 0)}
                  </p>
                </div>
                <div className="bg-amber-50/70 border border-amber-100 p-3 rounded-2xl text-center">
                  <p className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Class Avg Grade</p>
                  <p className="text-xl font-black text-amber-950 mt-0.5">
                    {(() => {
                      const valid = rosterStudents.map(s => s.average_grade_percentage).filter(g => g !== null && g !== undefined);
                      return valid.length > 0 ? `${Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)}%` : "N/A";
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Roster Table Content */}
            <div className="flex-1 overflow-y-auto min-h-[300px] border border-slate-200 rounded-2xl">
              {loadingRoster ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-500">Loading student roster and exam scores...</span>
                </div>
              ) : (() => {
                const filtered = rosterStudents.filter((item) => {
                  if (rosterFilters.course_id && String(item.course_id) !== rosterFilters.course_id) return false;
                  if (rosterFilters.status === "TOOK" && item.total_took === 0) return false;
                  if (rosterFilters.status === "MISSED" && item.total_missed === 0) return false;
                  if (rosterFilters.search) {
                    const q = rosterFilters.search.toLowerCase();
                    const name = `${item.first_name} ${item.last_name}`.toLowerCase();
                    const id = item.institutional_id.toLowerCase();
                    const course = `${item.course_code} ${item.course_title}`.toLowerCase();
                    const prog = item.program_code.toLowerCase();
                    if (!name.includes(q) && !id.includes(q) && !course.includes(q) && !prog.includes(q)) return false;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-20 text-slate-400 text-xs">
                      No class students found matching the selected filters.
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100">
                    {filtered.map((student, idx) => (
                      <div key={`${student.course_id}-${student.student_id}-${idx}`} className="p-4 hover:bg-slate-50/80 transition-colors space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                              {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-slate-900">
                                  {student.first_name} {student.middle_name ? `${student.middle_name.trim().charAt(0).toUpperCase()}. ` : ""}{student.last_name}
                                </h4>
                                <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md border border-slate-200">
                                  {student.institutional_id}
                                </span>
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-100">
                                  {student.program_code} Year {student.year_level}
                                </span>
                              </div>
                              <p className="text-xs text-emerald-700 font-bold mt-0.5">
                                Subject: {student.course_code} - {student.course_title}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {student.average_grade_percentage !== null ? (
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Average Grade</span>
                                <span className={`text-base font-black ${
                                  student.average_grade_percentage >= 75 ? "text-emerald-600" : "text-rose-600"
                                }`}>
                                  {student.average_grade_percentage}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">No Exams Recorded</span>
                            )}
                          </div>
                        </div>

                        {/* Exam Participation Breakdown */}
                        {student.exams && student.exams.length > 0 && (
                          <div className="bg-slate-50/90 border border-slate-200/60 rounded-xl p-3 space-y-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Exam History & Performance</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {student.exams.map((ex: any) => {
                                let badgeColor = "bg-amber-50 text-amber-800 border-amber-200";
                                if (ex.status === "Took Exam") badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
                                if (ex.status === "Missed Exam") badgeColor = "bg-rose-50 text-rose-800 border-rose-200";

                                return (
                                  <div key={ex.exam_id} className="bg-white border border-slate-200/80 p-2.5 rounded-lg flex items-center justify-between text-xs gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-slate-800 truncate">{ex.exam_title}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">
                                        {ex.submitted_at ? `Submitted: ${new Date(ex.submitted_at).toLocaleDateString()}` : (ex.scheduled_date ? `Scheduled: ${new Date(ex.scheduled_date).toLocaleDateString()}` : "No schedule set")}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                        {ex.status}
                                      </span>
                                      {ex.status === "Took Exam" && (
                                        <p className="text-[11px] font-black text-emerald-700 mt-0.5">
                                          {ex.student_score} / {ex.max_score} ({ex.percentage}%)
                                        </p>
                                      )}
                                      {ex.status === "Missed Exam" && (
                                        <p className="text-[11px] font-black text-rose-600 mt-0.5">
                                          0 / {ex.max_score} (0%)
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-4 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-400 font-semibold">
                Showing roster records for Faculty member
              </span>
              <button
                onClick={() => setRosterModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNED COURSES INITIAL LOGIN POPUP MODAL */}
      {showAssignedCoursesModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Official Teaching Load Assignment
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Assigned Teaching Courses
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Designated by the Academic Directorate & Campus Administration
                </p>
              </div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed space-y-2">
              <p>
                Welcome, <strong className="font-bold text-slate-900">Instructor {faculty.first_name} {faculty.last_name}</strong>! 
                You have been officially assigned to facilitate the following course(s) for the current academic term:
              </p>
            </div>

            {/* List of Assigned Courses */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {assignedCourses.map((c, idx) => (
                <div 
                  key={c.course_id || idx}
                  className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black px-2.5 py-1.5 rounded-xl bg-slate-900 text-emerald-400 shrink-0">
                      {c.course_code}
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
                        {c.course_title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Active Curriculum Course
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/60 shrink-0">
                    Assigned
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-500 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Your <strong>Question Bank</strong>, <strong>Examination Creator</strong>, and <strong>Student Rosters</strong> have been pre-scoped to these assigned courses.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isAcknowledgingCourses}
                onClick={handleAcknowledgeCourses}
                className="w-full sm:w-auto px-6 py-3 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isAcknowledgingCourses ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Acknowledge & Access Workspace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTRICTED UNASSIGNED FACULTY POPUP MODAL */}
      {unassignedWarningModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-6 my-8 transform animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Action Restricted
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  No Teaching Load Assigned
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Campus Directorate Policy Requirement
                </p>
              </div>
              <button
                onClick={() => setUnassignedWarningModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed space-y-2">
              <p className="font-bold">
                Attention Instructor {faculty.first_name} {faculty.last_name}:
              </p>
              <p className="text-amber-800">
                You cannot perform <strong>{unassignedActionText}</strong> because the Campus Director has not assigned any teaching subjects/courses to your faculty profile yet.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-semibold text-slate-500">Department:</span>
                <span className="font-bold text-slate-800">{faculty.department?.department_name || "Unassigned"}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-semibold text-slate-500">Status:</span>
                <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                  Awaiting Director Load Assignment
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setUnassignedWarningModalOpen(false)}
                className="w-full py-3 text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Understand & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
