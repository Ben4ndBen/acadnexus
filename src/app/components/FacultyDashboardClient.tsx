"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  BookOpen, Award, FileText, ClipboardList, PenTool, CheckCircle, 
  User, Shield, Settings, Activity, Send, RotateCcw, AlertCircle, RefreshCw, Mail,
  Plus, Trash2, Calendar, Lock, Camera, Check, ShieldAlert, Loader2, ShieldCheck, Clock,
  X, AlertTriangle, Archive, Search, Edit, GraduationCap, Users, Download, Layers
} from "lucide-react";
import { 
  updateFacultyProfile, updateExamStatus, createExamDraft, deleteExam, 
  scheduleExamTarget, configureFacultyAccount, getStudentExamLogs,
  getQuestionBankQuestions, saveQuestionBankQuestion, deleteQuestionBankQuestion,
  archiveExamination, reuseArchivedExamination, getArchivedExaminations,
  getCurrentAcademicYear, getFacultyEnrolledStudentsAndGrades,
  getCourseRoster, enrollStudentInCourse, bulkEnrollStudentsInCourse, unenrollStudentFromCourse,
  acknowledgeAssignedCoursesAction
} from "@/app/actions/faculty";
import { 
  exportStudentGradesRosterToExcel, 
  exportExamSubmissionsToExcel, 
  exportMissedStudentsToExcel 
} from "@/lib/exportExcel";
import { getProgramsForDepartment } from "@/lib/courseDepartmentMapping";

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
      current_status: "Draft" | "Pending_Chair" | "Pending_DI" | "Approved" | "Returned";
      is_archived?: boolean;
      academic_year?: string | null;
      course: {
        course_code: string;
        course_title: string;
      };
      approvalWorkflow: {
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
    const res = await getCourseRoster(cId);
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

  const handleOpenScheduleModal = (examId: number, title: string) => {
    setSelectedExamForSchedule({ exam_id: examId, title });
    setScheduleModalOpen(true);

    const existingTarget = faculty.examinations.find(e => e.exam_id === examId)?.examTargets?.[0];

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
        scheduled_date: existingTarget.scheduled_date.split("T")[0],
        start_time: formatTime(existingTarget.start_time),
        end_time: formatTime(existingTarget.end_time)
      });
    } else {
      setScheduleForm({
        program_id: programs.length > 0 ? String(programs[0].program_id) : "",
        year_level: "1",
        section: "All Sections",
        scheduled_date: new Date().toISOString().split("T")[0],
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
      router.refresh();
      alert(`Examination scheduled successfully! ${res.notifiedCount ?? 0} student(s) notified.`);
    }
  };

  const handleSingleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setEnrollError(res.error);
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
      setBulkResult({ message: res.error, errors: [] });
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
            Pending Directorate Approval
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
          onClick={() => setActiveTab("submissions")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "submissions"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Live Monitor & Results
        </button>
        <button
          onClick={() => setActiveTab("question_bank")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "question_bank"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Question Bank Repository
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
          Override Controls
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

            {/* Assigned Courses / Teaching Load */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                  Assigned Teaching Load
                </h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
                  {assignedCourses.length} Assigned
                </span>
              </div>
              {assignedCourses.length > 0 ? (
                <div className="space-y-2.5">
                  {assignedCourses.map((c) => (
                    <div key={c.course_id} className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center justify-between gap-3 hover:border-emerald-200 transition-colors">
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
                <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">No official courses assigned yet by Department Chair or Academic Directorate.</p>
                </div>
              )}
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
                      {exam.current_status === "Approved" && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded w-fit shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Digitally Signed
                        </div>
                      )}
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full shadow-sm" title="TOS Matrix Enabled">
                            <Layers className="w-3 h-3 text-emerald-600" /> TOS Matrix Active
                          </span>
                        </div>
                        <p className="text-xs text-emerald-700 font-semibold mt-1">
                          {exam.course.course_code} - {exam.course.course_title}
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="text-slate-500 font-bold">
                            {exam._count?.questionBank ?? 0} Questions
                          </span>
                        </p>
                        {exam.current_status === "Approved" && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit shadow-sm">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Digitally Signed by Chairperson & Director for Instruction
                          </div>
                        )}
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
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenScheduleModal(exam.exam_id, exam.title)}
                              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all duration-300"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              Schedule Exam
                            </button>
                            <button
                              onClick={async () => {
                                setExamToArchive(exam);
                                const ay = await getCurrentAcademicYear();
                                setAcademicYearInput(ay);
                                setArchiveModalOpen(true);
                              }}
                              className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all duration-300"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              Archive Exam
                            </button>
                          </div>
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
                          <p className="text-xs font-extrabold text-slate-800 mt-2">Directorate Approval</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Academic Directorate review</p>
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

                    {/* Hold Comments Showcase */}
                    {exam.approvalWorkflow?.di_comments && (
                      <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex gap-3 items-start mt-3">
                        <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800">Administrative Hold Remarks by Director:</p>
                          <p className="text-xs text-amber-700 mt-1 italic leading-relaxed">
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
            <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl">
              <p className="text-slate-500 text-xs">No examinations found in this status category.</p>
            </div>
          )}
        </div>
      )}

      {/* SUBMISSIONS TAB */}
      {activeTab === "submissions" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
          <div className="border-b border-slate-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Student Exam Monitoring & Results
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Track live student examinations, view security violation attempts, and analyze penalties and net scores.
              </p>
            </div>
            {studentExams && studentExams.length > 0 && (
              <button
                onClick={() => exportExamSubmissionsToExcel("Exam_Monitoring", faculty.department?.department_name || "Faculty", studentExams)}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-[1.02] shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export Submissions Excel
              </button>
            )}
          </div>

          {studentExams && studentExams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/60 text-slate-400 font-extrabold uppercase tracking-wider">
                    <th className="p-4">Student</th>
                    <th className="p-4">Examination</th>
                    <th className="p-4 text-center">Trigger</th>
                    <th className="p-4 text-center">Violations</th>
                    <th className="p-4 text-center">Net Score</th>
                    <th className="p-4">Started At</th>
                    <th className="p-4">Submitted At</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentExams.map((se) => {
                    const studentName = `${se.student.first_name} ${se.student.last_name}`;
                    const penaltyText = se.violations_count > 0 
                      ? `-${se.violations_count * (se.exam.score_penalty_points ?? 2)} pts penalty` 
                      : "";

                    let triggerBadgeColor = "bg-slate-100 text-slate-800 border-slate-200";
                    if (se.submission_trigger === "Manual") triggerBadgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
                    if (se.submission_trigger === "Timeout") triggerBadgeColor = "bg-amber-50 text-amber-800 border-amber-200";
                    if (se.submission_trigger === "Cheating_Lockout") triggerBadgeColor = "bg-rose-50 text-rose-800 border-rose-200";

                    return (
                      <tr key={se.student_exam_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 min-w-[150px]">
                          <div className="font-extrabold text-slate-800">{studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{se.student.user.institutional_id}</div>
                          <div className="text-[9px] text-emerald-700 font-bold uppercase mt-0.5">
                            {se.student.program.program_code} - Yr {se.student.year_level}
                          </div>
                        </td>
                        <td className="p-4 min-w-[150px]">
                          <div className="font-bold text-slate-800">{se.exam.title}</div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{se.exam.course.course_code}</div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${triggerBadgeColor}`}>
                            {se.submission_trigger.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            se.violations_count > 0 
                              ? "bg-rose-50 text-rose-800 border border-rose-100 shadow-sm" 
                              : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                          }`}>
                            {se.violations_count}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-black text-slate-800 text-sm">
                            {se.submitted_at ? `${se.total_score} pts` : <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-extrabold animate-pulse">LIVE IN PROGRESS</span>}
                          </div>
                          {se.violations_count > 0 && se.submitted_at && (
                            <div className="text-[9px] text-rose-600 font-black tracking-wide mt-0.5 uppercase">
                              {penaltyText}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 font-medium whitespace-nowrap">
                          {new Date(se.started_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="p-4 text-slate-500 font-medium whitespace-nowrap">
                          {se.submitted_at ? (
                            new Date(se.submitted_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                          ) : (
                            <em className="text-slate-400 font-normal">Active...</em>
                          )}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleViewAttemptLogs(se.student_id, studentName, se.exam_id)}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-770 text-[10px] font-extrabold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                            View Logs
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-3xl">
              <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-4 inline-block">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">No exam attempts logged</h3>
              <p className="text-slate-500 text-xs max-w-xs mt-1 mx-auto leading-relaxed">
                When students begin taking your scheduled examinations, their active sessions, violation flags, and score penalties will be logged here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* OVERRIDE CONTROLS TAB */}
      {activeTab === "override" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Section 1: Schedules Override Engine */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                  Schedules Override Engine
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  View approved examinations and override testing schedules, windows, or dates to fix scheduling conflicts.
                </p>
              </div>
              <div className="sm:w-72">
                <select
                  value={selectedOverrideCourseId || ""}
                  onChange={e => setSelectedOverrideCourseId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 px-3.5 py-2.5 rounded-xl transition-all shadow-sm focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="">Filter by Course (All Courses)</option>
                  {availableFacultyCourses.map(c => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.course_code} - {c.course_title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Examination Title</th>
                    <th className="px-6 py-3">Course</th>
                    <th className="px-6 py-3">Target Details</th>
                    <th className="px-6 py-3">Testing Window</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {faculty.examinations
                    .filter(exam => exam.current_status === "Approved")
                    .filter(exam => {
                      if (!selectedOverrideCourseId) return true;
                      const cId = (exam as any).course_id || (exam.course as any)?.course_id;
                      return cId === selectedOverrideCourseId;
                    })
                    .map(exam => {
                      const target = exam.examTargets?.[0];
                      const programName = programs.find(p => p.program_id === target?.program_id)?.program_code || "N/A";
                      
                      return (
                        <tr key={exam.exam_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">{exam.title}</td>
                          <td className="px-6 py-4">{exam.course.course_code} - {exam.course.course_title}</td>
                          <td className="px-6 py-4">
                            {target ? (
                              <span className="font-semibold text-slate-800">
                                {programName} Year {target.year_level}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Not Scheduled</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {target ? (
                              <div className="space-y-0.5">
                                <p className="font-semibold text-slate-800">
                                  {new Date(target.scheduled_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {new Date(target.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} - {new Date(target.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Not Scheduled</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleOpenScheduleModal(exam.exam_id, exam.title)}
                              className="px-3.5 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg shadow-sm transition-all"
                            >
                              {target ? "Override Schedule" : "Schedule Exam"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {faculty.examinations
                    .filter(exam => exam.current_status === "Approved")
                    .filter(exam => {
                      if (!selectedOverrideCourseId) return true;
                      const cId = (exam as any).course_id || (exam.course as any)?.course_id;
                      return cId === selectedOverrideCourseId;
                    }).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 italic">
                        No approved examinations available to override{selectedOverrideCourseId ? " for this course" : ""}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Student Access Resets & Reschedule Overrides */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-600 rounded-full" />
                Individual Student Reschedule & Override Controls
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Choose a specific course and the examination allotted to it. Select among students who took or missed the exam, searchable by name, to reschedule or extend their testing window.
              </p>
            </div>

            {/* Step 1 & 2: Course & Examination Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  1. Choose Course Assigned to You
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
                  2. Choose Specific Examination Allotted
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

            {selectedOverrideExamId && (
              <div className="space-y-5 pt-2 animate-in fade-in duration-300">
                {/* Official Exam Schedule Preserved Banner */}
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 text-xs space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-blue-900 font-bold uppercase tracking-wider text-[10px]">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Official Examination Schedule & Date (Preserved in TOS)
                    </div>
                    {(() => {
                      const exam = faculty.examinations.find(e => e.exam_id === selectedOverrideExamId);
                      return exam ? (
                        <span className="text-[11px] font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200">
                          {exam.course.course_code} • {exam.title}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-slate-900 font-extrabold text-sm">
                    {officialExamScheduleText || "Official Examination Schedule"}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">
                    ✓ Reopening an examination creates an individual attempt window <strong>exclusively for the chosen selected student(s)</strong>. The official exam schedule and Table of Specifications (TOS) remain strictly preserved.
                  </p>
                </div>

                {/* Controls Bar: Search & Status Filters */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Students Assigned & Exam Takers
                      </h3>
                      <p className="text-xs text-slate-500">
                        Search student by name or filter by exam attempt status to grant a reschedule/retake window.
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
                        Override Schedule & Assign Retake {selectedOverrideStudentIds.length > 0 ? `(${selectedOverrideStudentIds.length} Selected)` : ""}
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
                        <option value="">-- Quick Pick Student to Reopen --</option>
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
                ) : (
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
                          <th className="px-6 py-3">Student Name</th>
                          <th className="px-6 py-3">ID / Institutional Email</th>
                          <th className="px-6 py-3">Attempt / Reopen Status</th>
                          <th className="px-6 py-3 text-right">Override Actions</th>
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
                                      Took Exam • Completed ({attempt.total_score !== null ? `${attempt.total_score} pts` : "Submitted"})
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
                                <td className="px-6 py-4 font-bold text-slate-800">
                                  {student.first_name} {student.middle_name ? `${student.middle_name.trim().charAt(0).toUpperCase()}. ` : ""}{student.last_name}
                                  {attempt && (
                                    <span className="ml-2 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                      Took Exam
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="space-y-0.5 text-slate-500">
                                    <p className="font-semibold text-slate-700">{student.institutional_id}</p>
                                    <p className="text-[10px]">{student.institutional_email}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4">{statusNode}</td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
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
                                      className="px-3 py-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-sm transition-all cursor-pointer"
                                    >
                                      {override && override.is_active ? "Modify Reopened Window" : "Reopen / Reschedule Exam"}
                                    </button>
                                    {override && override.is_active && (
                                      <button
                                        onClick={() => handleRevokeOverride(student.student_id)}
                                        className="px-2.5 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer"
                                        title="Revoke Reopened Window"
                                      >
                                        Revoke
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {missedStudents.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400 italic">
                              No students found for this examination or course.
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
                              <td colSpan={5} className="text-center py-8 text-slate-400 italic">
                                No students match the search query "{studentSearchTerm}".
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
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
                      <Clock className="w-5 h-5 text-amber-600" /> Override Schedule & Assign Retake
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Choose among students that took or missed this examination to reschedule/reopen their testing window.
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
                  {/* Official Schedule Banner (Preserved) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-1">
                    <p className="text-slate-600 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" /> Official Examination Schedule (Preserved)
                    </p>
                    <p className="text-slate-800 font-semibold text-xs">
                      {officialExamScheduleText || "Original schedule from Examination Record / TOS"}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-relaxed pt-0.5">
                      ✓ Reopening applies <strong>strictly to chosen selected student(s)</strong>. The official exam schedule date and Table of Specifications remain untouched for all other students.
                    </p>
                  </div>

                  {/* Student Search Box (Real-time by Name or ID) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 block">
                        Search & Select Student(s) Allowed to Retake
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
                      ⚠️ Reopening will reset any previous attempt for the selected student(s) to allow a clean retake during the specified reopened window.
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">Reopened Start Date</label>
                        <input
                          type="date"
                          required
                          value={overrideForm.start_date}
                          onChange={e => setOverrideForm(prev => ({ ...prev, start_date: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 px-3 py-2 rounded-xl transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">Reopened Start Time</label>
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
                        <label className="text-xs font-bold text-slate-600 block">Reopened End Date</label>
                        <input
                          type="date"
                          required
                          value={overrideForm.end_date}
                          onChange={e => setOverrideForm(prev => ({ ...prev, end_date: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 px-3 py-2 rounded-xl transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">Reopened End Time</label>
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
                          ? `Assign Retake (${selectedOverrideStudentIds.length} Selected)`
                          : "Select Student(s) to Assign"}
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
          {/* Enrolled Students & Grades Quick Access Banner Card */}
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                  <Users className="w-3.5 h-3.5" />
                  Subject Enrollment & Exam Status
                </div>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  Class Students & Grade Reports
                </h3>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  View class students in your assigned subjects, inspect their exam scores & calculated grades, and track whether they took or missed scheduled examinations.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenRosterModal}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 border border-emerald-400"
              >
                <GraduationCap className="w-4.5 h-4.5" />
                View Class Students & Grades
              </button>
            </div>
          </div>

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

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Year Level</label>
                <select 
                  required
                  value={scheduleForm.year_level}
                  onChange={e => setScheduleForm({...scheduleForm, year_level: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-900 placeholder:text-slate-500 px-4 py-2.5 rounded-xl transition-all duration-300"
                >
                  {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
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
                    promptPreview = JSON.parse(q.question_text).text || q.question_text;
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <h3 className="font-extrabold text-slate-850 text-sm leading-snug">{exam.title}</h3>
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
                    setEnrollError(null);
                    setEnrollSuccess(null);
                    setEnrollModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Student to Class</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchRoster(selectedRosterCourseId)}
                  disabled={loadingClassRoster}
                  title="Refresh Class List"
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingClassRoster ? "animate-spin text-emerald-600" : ""}`} />
                </button>
              </div>
            </div>

            {/* Course Selector & Search Filter Bar */}
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
                            {s.last_name}, {s.first_name}
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
                        setEnrollError(null);
                        setEnrollSuccess(null);
                        setEnrollModalOpen(true);
                      }}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
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
    </div>
  );
}
