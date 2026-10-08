"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart3, ShieldCheck, Map, List, CheckCircle, 
  XCircle, Clock, AlertCircle, RefreshCw, Search, Building2,
  UserPlus, X, Loader2, Eye, EyeOff, Award, Calendar, Sparkles,
  Users, BookOpen, UserCog
} from "lucide-react";
import { reviewExamByDirector, toggleGlobalHold, toggleIndividualHold, saveActiveAcademicPeriod, updateDirectorNameAction } from "@/app/actions/director";
import type { AcademicPeriodSettings } from "@/lib/academicUtils";
import { registerInstructorByAdminAction } from "@/app/actions/auth";
import { assignCoursesToFacultyAction } from "@/app/actions/faculty";
import { getDepartmentTheme } from "@/lib/departmentThemes";
import { DepartmentBadge } from "@/app/components/DepartmentBadge";
import { 
  getProgramsForDepartment, 
  filterCoursesForDepartment, 
  isCourseInDepartmentOrProgram,
  getDepartmentKeyForProgram,
  resolveDepartmentKey
} from "@/lib/courseDepartmentMapping";
import { getExpectedYearAndSemForCourse } from "@/lib/bsitCurriculum";

interface DirectorDashboardClientProps {
  directorUserId: number;
  initialDirectorProfile?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    title?: string;
  };
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
  academicPeriodSettings?: AcademicPeriodSettings;
  courses?: Array<{ course_id: number; course_code: string; course_title: string }>;
  facultyMembers?: Array<{
    faculty_id: number;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    department?: { department_id?: number; department_name: string } | null;
    user?: { institutional_id: string; username?: string | null; is_active: boolean; role?: string };
    facultyCourses?: Array<{ course: { course_id: number; course_code: string; course_title: string } }>;
  }>;
}

export function DirectorDashboardClient({ 
  directorUserId, 
  initialDirectorProfile,
  stats, 
  pendingApprovals, 
  departmentsData,
  auditLogs,
  allExaminations,
  globalHoldActive,
  departmentsList = [],
  academicPeriodSettings,
  courses = [],
  facultyMembers = []
}: DirectorDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "compliance" | "logs" | "exams" | "period" | "faculty">("overview");

  // State for Editing Director's Personal Profile Name
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [dirTitle, setDirTitle] = useState(initialDirectorProfile?.title || "");
  const [dirFirstName, setDirFirstName] = useState(initialDirectorProfile?.firstName || "");
  const [dirMiddleName, setDirMiddleName] = useState(initialDirectorProfile?.middleName || "");
  const [dirLastName, setDirLastName] = useState(initialDirectorProfile?.lastName || "");
  const [isSavingDirectorName, setIsSavingDirectorName] = useState(false);
  const [directorNameMsg, setDirectorNameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveDirectorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirFirstName.trim() || !dirLastName.trim()) {
      setDirectorNameMsg({ type: "error", text: "First Name and Last Name are required." });
      return;
    }
    setIsSavingDirectorName(true);
    setDirectorNameMsg(null);
    const res = await updateDirectorNameAction(directorUserId, {
      title: dirTitle,
      firstName: dirFirstName,
      middleName: dirMiddleName,
      lastName: dirLastName,
    });
    setIsSavingDirectorName(false);
    if (res.error) {
      setDirectorNameMsg({ type: "error", text: res.error });
    } else {
      setDirectorNameMsg({ type: "success", text: "Director profile name updated successfully!" });
      setTimeout(() => {
        setProfileModalOpen(false);
        router.refresh();
      }, 700);
    }
  };

  // State for Academic Period Configuration (Configured by DI)
  const [periodAY, setPeriodAY] = useState(academicPeriodSettings?.active_academic_year || "2026-2027");
  const [periodSem, setPeriodSem] = useState(academicPeriodSettings?.active_semester || "1st Semester");
  const [periodTerm, setPeriodTerm] = useState(academicPeriodSettings?.active_term || "Midterm");
  const [sem1Start, setSem1Start] = useState(academicPeriodSettings?.sem1_start || "2026-08-01");
  const [sem1End, setSem1End] = useState(academicPeriodSettings?.sem1_end || "2026-12-31");
  const [sem2Start, setSem2Start] = useState(academicPeriodSettings?.sem2_start || "2027-01-01");
  const [sem2End, setSem2End] = useState(academicPeriodSettings?.sem2_end || "2027-05-31");
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);
  const [periodSaveMsg, setPeriodSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Automatically update semester date range if date/year of academic year is edited
  const handleAcademicYearChange = (newAY: string) => {
    setPeriodAY(newAY);
    const numbers = newAY.match(/\d{4}/g);
    if (numbers && numbers.length >= 1) {
      const startYear = parseInt(numbers[0], 10);
      const endYear = numbers.length >= 2 ? parseInt(numbers[1], 10) : startYear + 1;
      setSem1Start(`${startYear}-08-01`);
      setSem1End(`${startYear}-12-31`);
      setSem2Start(`${endYear}-01-01`);
      setSem2End(`${endYear}-05-31`);
    }
  };

  // Validate semester date ranges before saving
  const semesterRangeValidation = useMemo(() => {
    if (!periodAY.trim() || !/\d{4}/.test(periodAY)) {
      return { isValid: false, message: "Academic Year must be specified in a valid format (e.g. 2026-2027)." };
    }
    if (!sem1Start || !sem1End || !sem2Start || !sem2End) {
      return { isValid: false, message: "All semester range start and end dates must be selected." };
    }
    const d1Start = new Date(sem1Start).getTime();
    const d1End = new Date(sem1End).getTime();
    const d2Start = new Date(sem2Start).getTime();
    const d2End = new Date(sem2End).getTime();

    if (isNaN(d1Start) || isNaN(d1End) || isNaN(d2Start) || isNaN(d2End)) {
      return { isValid: false, message: "Invalid dates entered in semester range." };
    }
    if (d1Start >= d1End) {
      return { isValid: false, message: "1st Semester start date must be before its end date." };
    }
    if (d2Start >= d2End) {
      return { isValid: false, message: "2nd Semester start date must be before its end date." };
    }
    if (d1End >= d2Start) {
      return { isValid: false, message: "1st Semester end date must be before 2nd Semester start date." };
    }
    return { isValid: true, message: "" };
  }, [periodAY, sem1Start, sem1End, sem2Start, sem2End]);

  const handleSaveAcademicPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semesterRangeValidation.isValid) return;
    setIsSavingPeriod(true);
    setPeriodSaveMsg(null);
    try {
      const res = await saveActiveAcademicPeriod(directorUserId, {
        active_academic_year: periodAY,
        active_semester: periodSem,
        sem1_start: sem1Start,
        sem1_end: sem1End,
        sem2_start: sem2Start,
        sem2_end: sem2End,
      });
      if (res.error) {
        setPeriodSaveMsg({ type: "error", text: res.error });
      } else {
        setPeriodSaveMsg({ type: "success", text: "Active academic period configured successfully!" });
        router.refresh();
      }
    } catch (err: any) {
      setPeriodSaveMsg({ type: "error", text: err.message || "Failed to save configuration." });
    } finally {
      setIsSavingPeriod(false);
    }
  };

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
  const [regProgramCode, setRegProgramCode] = useState("");
  const [regIncludeGE, setRegIncludeGE] = useState(false);
  const [regYearLevel, setRegYearLevel] = useState<number>(0);
  const [regSemester, setRegSemester] = useState<number>(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<{ username: string; institutionalId: string; name: string; assignedCoursesCount?: number } | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

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
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [selectedFacultyDeptFilter, setSelectedFacultyDeptFilter] = useState<string>("ALL");

  // Handler for changing program in registration modal (Program chosen first -> Dept auto-assigned)
  const handleProgramChange = (newProgramCode: string) => {
    setRegProgramCode(newProgramCode);
    if (!newProgramCode) {
      setDeptId("");
      return;
    }
    const targetDeptKey = getDepartmentKeyForProgram(newProgramCode);
    const matchedDept = departmentsList?.find((d) => {
      if (d.department_name === "CITD") return false;
      const key = resolveDepartmentKey(d.department_id, d.department_name);
      return key === targetDeptKey;
    });
    if (matchedDept) {
      setDeptId(String(matchedDept.department_id));
    }
    // Clean up selected courses that don't belong to the newly selected program
    setSelectedCourseIds((prev) =>
      prev.filter((id) => {
        const c = courses.find((item) => item.course_id === id);
        if (!c) return false;
        return isCourseInDepartmentOrProgram(c.course_code, null, newProgramCode, regIncludeGE);
      })
    );
  };

  // Handler for changing department in registration modal
  const handleDeptChange = (newDeptId: string) => {
    setDeptId(newDeptId);
    const progs = getProgramsForDepartment(newDeptId);
    if (progs.length === 1) {
      setRegProgramCode(progs[0].code);
    } else {
      setRegProgramCode("");
    }
    // Clean up selected courses that don't belong to the newly selected department
    setSelectedCourseIds((prev) =>
      prev.filter((id) => {
        const c = courses.find((item) => item.course_id === id);
        if (!c) return false;
        return isCourseInDepartmentOrProgram(c.course_code, newDeptId, null, regIncludeGE);
      })
    );
  };

  // Filtered courses for Register Instructor Modal based on selected Department, Program, Year & Sem
  const availableRegisterCourses = useMemo(() => {
    if (!deptId) return [];
    return filterCoursesForDepartment(courses, deptId, {
      programCode: regProgramCode,
      includeGeneralEducation: regIncludeGE,
      searchQuery: courseSearchQuery,
      yearLevel: regYearLevel || null,
      semester: regSemester || null,
    });
  }, [courses, deptId, regProgramCode, regIncludeGE, courseSearchQuery, regYearLevel, regSemester]);

  // Filtered courses for Assign / Edit Modal based on target Instructor's Department, Program, Year & Sem
  const availableEditCourses = useMemo(() => {
    if (!assignFacultyTarget) return [];
    const targetDeptId = assignFacultyTarget.department_id || assignFacultyTarget.department?.department_id;
    return filterCoursesForDepartment(courses, targetDeptId, {
      programCode: editProgramCode,
      includeGeneralEducation: editIncludeGE,
      searchQuery: editCourseSearchQuery,
      yearLevel: editYearLevel || null,
      semester: editSemester || null,
    });
  }, [courses, assignFacultyTarget, editProgramCode, editIncludeGE, editCourseSearchQuery, editYearLevel, editSemester]);


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
    formData.append("courseIds", JSON.stringify(selectedCourseIds));

    const res = await registerInstructorByAdminAction(null, formData);
    setIsSubmittingReg(false);

    if (res.error) {
      setRegError(res.error);
    } else if (res.success) {
      setRegSuccess({
        username: res.username!,
        institutionalId: res.institutionalId!,
        name: res.name!,
        assignedCoursesCount: res.assignedCoursesCount,
      });
      router.refresh();
    }
  };

  const handleOpenAssignModal = (faculty: any) => {
    setAssignFacultyTarget(faculty);
    const currentCourseIds = faculty.facultyCourses?.map((fc: any) => fc.course.course_id) || [];
    setEditCourseIds(currentCourseIds);
    setEditCourseSearchQuery("");
    
    const targetDeptId = faculty.department_id || faculty.department?.department_id;
    const targetDeptName = faculty.department?.department_name || departmentsList?.find((d) => d.department_id === targetDeptId)?.department_name;
    const deptProgs = getProgramsForDepartment(targetDeptId, targetDeptName);
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
          onClick={() => setActiveTab("period")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "period"
              ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Academic Period Configuration
        </button>
        <button
          onClick={() => setActiveTab("faculty")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === "faculty"
              ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          Faculty & Assigned Courses
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => {
              setDirectorNameMsg(null);
              setDirTitle(initialDirectorProfile?.title || "");
              setDirFirstName(initialDirectorProfile?.firstName || "");
              setDirMiddleName(initialDirectorProfile?.middleName || "");
              setDirLastName(initialDirectorProfile?.lastName || "");
              setProfileModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm transition-all duration-300 cursor-pointer"
          >
            <UserCog className="w-4 h-4 text-indigo-700" />
            Edit Profile / Name
          </button>
          <button
            onClick={() => {
              setRegError(null);
              setRegSuccess(null);
              setInstId("");
              setFirstName("");
              setMiddleName("");
              setLastName("");
              setSelectedCourseIds([]);
              setCourseSearchQuery("");
              setDeptId("");
              setRegProgramCode("");
              setRegIncludeGE(false);
              setPassword("");
              setConfirmPassword("");
              setRegisterModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all duration-300 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Register New Instructor
          </button>
        </div>
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
                <option value="Pending_Program_Chair">Pending Program Chairperson</option>
                <option value="Pending_Chair">Pending Department Chairperson</option>
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
                          exam.current_status === "Pending_Program_Chair" ? "bg-purple-50 text-purple-700 border-purple-200" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {exam.current_status === "Approved" ? "Approved (Live)" : exam.current_status === "Pending_Program_Chair" ? "Pending Program Chairperson" : exam.current_status === "Pending_Chair" ? "Pending Dept Chairperson" : exam.current_status}
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
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{dept.department_name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <DepartmentBadge department={dept.department_name} size="sm" />
                      {getProgramsForDepartment(dept.department_id, dept.department_name).map(p => (
                        <span key={p.code} className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {p.code}
                        </span>
                      ))}
                    </div>
                  </div>
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

      {/* ACADEMIC PERIOD CONFIGURATION TAB */}
      {activeTab === "period" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-700 rounded-full" />
                Active Academic Period & Semester Scheduling
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Configure the institutional academic calendar. Examination dates set by faculty will automatically compute and bind to the correct semester and academic year based on these active boundaries.
              </p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200/80 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-700" />
              <span className="text-xs font-black text-indigo-900">
                Current: {periodSem}, AY {periodAY}
              </span>
            </div>
          </div>

          {periodSaveMsg && (
            <div className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              periodSaveMsg.type === "success" 
                ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                : "bg-rose-50 text-rose-800 border-rose-100"
            }`}>
              {periodSaveMsg.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{periodSaveMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveAcademicPeriod} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Active Academic Year */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Active Academic Year <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={periodAY}
                  onChange={(e) => handleAcademicYearChange(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm font-bold text-slate-800 px-4 py-2.5 rounded-xl transition-all"
                />
                <p className="text-[11px] text-slate-400">Editing auto-generates 1st & 2nd semester date ranges</p>
              </div>

              {/* Active Semester */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Active Semester Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={periodSem}
                  onChange={(e) => setPeriodSem(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm font-bold text-slate-800 px-4 py-2.5 rounded-xl transition-all"
                >
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Midyear / Summer">Midyear / Summer</option>
                </select>
                <p className="text-[11px] text-slate-400">Current officially active collegiate term</p>
              </div>
            </div>

            {/* Examination Term Status (Disabled for DI - Selected by Faculty during Exam Creation) */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-200 text-slate-600 rounded-xl">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800">Examination Term Field</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold px-2 py-0.5 rounded-full">
                      Faculty Responsiblity
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    The examination term (Midterm, Final, Prelim) is selected directly by Faculty when creating an examination.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-400 italic shrink-0">DI Configuration Disabled</span>
            </div>

            {/* Semester Date Ranges */}
            <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-700" />
                Semester Date Windows (For Automatic Determination)
              </h3>
              <p className="text-xs text-slate-500">
                When faculty pick an exam date, the system evaluates these date windows to automatically determine whether the examination belongs to the 1st or 2nd Semester.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* 1st Semester Range */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-black uppercase text-indigo-900 tracking-wider">1st Semester Range</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={sem1Start}
                        onChange={(e) => setSem1Start(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 p-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">End Date</label>
                      <input
                        type="date"
                        value={sem1End}
                        onChange={(e) => setSem1End(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 p-2 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* 2nd Semester Range */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-black uppercase text-indigo-900 tracking-wider">2nd Semester Range</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={sem2Start}
                        onChange={(e) => setSem2Start(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 p-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">End Date</label>
                      <input
                        type="date"
                        value={sem2End}
                        onChange={(e) => setSem2End(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 p-2 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation warning banner */}
            {!semesterRangeValidation.isValid && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Cannot save configuration: {semesterRangeValidation.message}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={!semesterRangeValidation.isValid || isSavingPeriod}
                className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-black px-6 py-3 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingPeriod ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Academic Period...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Save Academic Period Policy</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FACULTY DIRECTORY & ASSIGNED COURSES TAB */}
      {activeTab === "faculty" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                Faculty Directory & Teaching Load Allocation
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                View department instructors, inspect teaching load breakdowns by course category, and allocate official offerings.
              </p>
            </div>

            <div className="w-full sm:w-72 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search faculty name, ID, or @username..."
                value={facultySearchQuery}
                onChange={(e) => setFacultySearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-indigo-500 focus:bg-white transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Department / Category Filter Bar */}
          <div className="bg-slate-50/90 border border-slate-200/80 p-2 rounded-2xl flex flex-wrap items-center gap-1.5 shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider px-2">
              Category / Dept:
            </span>
            <button
              type="button"
              onClick={() => setSelectedFacultyDeptFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedFacultyDeptFilter === "ALL"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              All Categories ({facultyMembers.length})
            </button>
            {departmentsList
              .filter((d) => d.department_name !== "ICT Department" && d.department_name !== "IT Department" && d.department_name !== "ICT" && d.department_name !== "ITD")
              .map((d) => {
              const count = facultyMembers.filter(
                (f) => resolveDepartmentKey(null, f.department?.department_name) === resolveDepartmentKey(d.department_id, d.department_name)
              ).length;
              return (
                <button
                  key={d.department_id}
                  type="button"
                  onClick={() => setSelectedFacultyDeptFilter(d.department_name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFacultyDeptFilter === d.department_name
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60"
                  }`}
                >
                  {d.department_name} ({count})
                </button>
              );
            })}
          </div>

          {/* Category / Department Grouped Sections */}
          <div className="space-y-8 pt-2">
            {departmentsList
              .filter((d) => d.department_name !== "ICT Department" && d.department_name !== "IT Department" && d.department_name !== "ICT" && d.department_name !== "ITD")
              .map((dept) => {
                const members = facultyMembers.filter((f) => {
                  const fKey = resolveDepartmentKey(null, f.department?.department_name);
                  const dKey = resolveDepartmentKey(dept.department_id, dept.department_name);
                  if (fKey !== dKey) return false;
                  if (facultySearchQuery.trim()) {
                    const q = facultySearchQuery.toLowerCase();
                    const fullName = `${f.first_name} ${f.last_name}`.toLowerCase();
                    const instId = (f.user?.institutional_id || "").toLowerCase();
                    const uName = (f.user?.username || "").toLowerCase();
                    return fullName.includes(q) || instId.includes(q) || uName.includes(q);
                  }
                  return true;
                });

                return {
                  department_id: dept.department_id,
                  department_name: dept.department_name,
                  members,
                };
              })
              .filter((group) => {
                if (selectedFacultyDeptFilter !== "ALL") {
                  return group.department_name === selectedFacultyDeptFilter;
                }
                return group.members.length > 0;
              })
              .map((group) => (
                <div key={group.department_id} className="space-y-4">
                  {/* Category Section Header Banner */}
                  <div className="bg-slate-100/80 border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {group.department_name}
                      </h3>
                    </div>
                    <span className="text-[11px] font-extrabold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                      {group.members.length} {group.members.length === 1 ? "Member" : "Members"}
                    </span>
                  </div>

                  {/* Minimalist Faculty List */}
                  <div className="space-y-3">
                    {group.members.map((faculty) => {
                      const assigned = faculty.facultyCourses?.map((fc: any) => fc.course) || [];
                      const role = faculty.user?.role;

                      return (
                        <div
                          key={faculty.faculty_id}
                          className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-indigo-300 hover:shadow-sm transition-all space-y-3"
                        >
                          {/* Row 1: Profile & Action Button */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {faculty.first_name[0]}{faculty.last_name[0]}
                              </div>
                              <div>
                                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                  {faculty.first_name} {faculty.middle_name ? `${faculty.middle_name.charAt(0)}. ` : ""}{faculty.last_name}
                                  {role === "ProgramChair" ? (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                                      Program Chair
                                    </span>
                                  ) : role === "Chair" ? (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                      Department Chair
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                      Faculty
                                    </span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                                  <span className="font-mono text-slate-500 font-semibold">
                                    {faculty.user?.institutional_id || `ID: ${faculty.faculty_id}`}
                                  </span>
                                  {faculty.user?.username && (
                                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 font-bold px-1.5 py-0.2 rounded-md">
                                      @{faculty.user.username}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-xl">
                                {assigned.length} {assigned.length === 1 ? "Subject" : "Subjects"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenAssignModal(faculty)}
                                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Assign / Edit</span>
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Minimalist Subject List */}
                          {assigned.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {assigned.map((c: any) => {
                                const code = (c.course_code || "").toUpperCase();
                                const isGE = code.startsWith("GE") || code.startsWith("PATHFIT") || code.startsWith("NSTP") || code.includes("CDRM") || code.includes("ITCH");
                                const isElective = code.startsWith("ITD") || code.startsWith("ELECTIVE");

                                const styleClass = isGE
                                  ? "bg-emerald-50/90 text-emerald-950 border-emerald-200"
                                  : isElective
                                  ? "bg-amber-50/90 text-amber-950 border-amber-200"
                                  : "bg-indigo-50/90 text-indigo-950 border-indigo-200";

                                return (
                                  <span
                                    key={c.course_id}
                                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1 rounded-xl shadow-2xs ${styleClass}`}
                                    title={c.course_title}
                                  >
                                    <span className="font-mono font-black">{c.course_code}</span>
                                    <span className="max-w-[220px] truncate text-[10px] font-medium opacity-90">
                                      {c.course_title}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 font-medium italic">
                              No subjects assigned yet for this instructor.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            {facultyMembers.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-3xl">
                <p className="text-slate-500 text-xs font-semibold">No faculty instructors registered in the institution yet.</p>
              </div>
            )}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-white rounded-3xl max-w-3xl sm:max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto">
            {/* Modal Header (Fixed Top) */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 shrink-0 bg-white">
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
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {regSuccess ? (
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 font-sans">
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
                    className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Register Another Instructor
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterInstructorSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 font-sans">
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
                    <label className="text-xs font-bold text-slate-700 block mb-1">Middle Name / Initial</label>
                    <input
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="e.g. Santos or S."
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

                {/* 1. Academic Program Selection (Selected First) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Academic Program <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={regProgramCode}
                    onChange={(e) => handleProgramChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-800 p-3 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="" disabled>-- Select Academic Program --</option>
                    <option value="BSA">Bachelor of Science in Agriculture (BSA)</option>
                    <option value="BEED">Bachelor of Elementary Education (BEED)</option>
                    <option value="BSED">Bachelor of Secondary Education (BSED)</option>
                    <option value="BSInfoTech">Bachelor of Science in Information Technology (BSInfoTech)</option>
                    <option value="BSIT">Bachelor of Science in Industrial Technology (BSIT)</option>
                    <option value="BSHM">Bachelor of Science in Hospitality Management (BSHM)</option>
                    <option value="BSTM">Bachelor of Science in Tourism Management (BSTM)</option>
                  </select>

                  {/* Display majors if BSED or BSIT selected */}
                  {regProgramCode === "BSED" && (
                    <div className="mt-1 text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-700">Majors:</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">English</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">Science</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">Mathematics</span>
                    </div>
                  )}
                  {regProgramCode === "BSIT" && (
                    <div className="mt-1 text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-700">Majors:</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">ARCHITECTURE</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">AUTOMOTIVE</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">ELECTRONICS</span>
                    </div>
                  )}
                </div>

                {/* 2. Department Assignment (Automated & Non-editable - Minimalist) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Department <span className="text-slate-400 font-normal">(Auto-assigned)</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={
                      deptId
                        ? departmentsList?.find((d) => String(d.department_id) === String(deptId))?.department_name || "Assigned Department"
                        : "Select a program above"
                    }
                    className="w-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 p-3 rounded-xl cursor-not-allowed outline-none"
                  />
                </div>

                {/* Course / Subject Assignment Section */}
                <div className="space-y-2.5 border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block">
                        Assign Courses / Subjects
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Designate official teaching load. Faculty will only see these subjects.
                      </p>
                    </div>
                    {selectedCourseIds.length > 0 && (
                      <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                        {selectedCourseIds.length} Selected
                      </span>
                    )}
                  </div>

                  {!deptId ? (
                    <div className="bg-amber-50/80 border border-dashed border-amber-300 rounded-xl p-4 text-center space-y-1">
                      <BookOpen className="w-5 h-5 text-amber-600 mx-auto opacity-90" />
                      <p className="text-xs font-bold text-amber-900">Please Select a Department Above</p>
                      <p className="text-[11px] text-amber-700">
                        The subjects list will dynamically load only the curriculum offerings for that department and program.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Year Level, Semester & GE Filters */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                            <span>Year:</span>
                            <select
                              value={regYearLevel}
                              onChange={(e) => setRegYearLevel(Number(e.target.value))}
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
                              value={regSemester}
                              onChange={(e) => setRegSemester(Number(e.target.value))}
                              className="bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 rounded-lg px-1.5 py-1 outline-none cursor-pointer"
                            >
                              <option value={0}>All Semesters</option>
                              <option value={1}>1st Sem</option>
                              <option value={2}>2nd Sem</option>
                            </select>
                          </div>
                        </div>

                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none bg-white border border-slate-200/80 px-2 py-1 rounded-lg hover:border-slate-300">
                          <input
                            type="checkbox"
                            checked={regIncludeGE}
                            onChange={(e) => setRegIncludeGE(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                          />
                          <span>Include GE Subjects</span>
                        </label>
                      </div>

                      {/* Search box for subjects */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search department subjects by code or title..."
                          value={courseSearchQuery}
                          onChange={(e) => setCourseSearchQuery(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                        />
                      </div>

                      {/* Selected Courses Chips */}
                      {selectedCourseIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto py-1">
                          {selectedCourseIds.map((cId) => {
                            const courseObj = courses.find((c) => c.course_id === cId);
                            if (!courseObj) return null;
                            return (
                              <span
                                key={cId}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg shadow-xs"
                              >
                                <span className="font-mono">{courseObj.course_code}</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedCourseIds((prev) => prev.filter((id) => id !== cId))}
                                  className="hover:text-rose-600 cursor-pointer ml-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Checkbox List of Available Department Courses */}
                      <div className="max-h-48 overflow-y-auto space-y-1 bg-white border border-slate-200 rounded-xl p-2">
                        {availableRegisterCourses.map((c) => {
                          const isChecked = selectedCourseIds.includes(c.course_id);
                          const yearSem = getExpectedYearAndSemForCourse(c.course_code, c.course_title, regProgramCode || undefined);
                          return (
                            <label
                              key={c.course_id}
                              className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-indigo-50/80 font-bold text-indigo-900 border border-indigo-200/60"
                                  : "hover:bg-slate-50 text-slate-700 font-medium border border-transparent"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCourseIds((prev) => [...prev, c.course_id]);
                                  } else {
                                    setSelectedCourseIds((prev) => prev.filter((id) => id !== c.course_id));
                                  }
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                              />
                              <span className="font-mono text-[11px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                {c.course_code}
                              </span>
                              <span className="truncate flex-1">{c.course_title}</span>
                              {yearSem && (
                                <span className="text-[9.5px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                                  Yr {yearSem.yearLevel} Sem {yearSem.semester}
                                </span>
                              )}
                            </label>
                          );
                        })}
                        {availableRegisterCourses.length === 0 && (
                          <p className="text-[11px] text-slate-400 text-center py-4">
                            No subjects found matching this department / program filter.
                          </p>
                        )}
                      </div>
                    </>
                  )}
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
                </div>

                {/* Fixed Sticky Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/90 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReg}
                    className="px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-md transition-all cursor-pointer"
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

      {/* ASSIGN / EDIT COURSES MODAL */}
      {assignModalOpen && assignFacultyTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-white rounded-3xl max-w-3xl sm:max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto">
            {/* Modal Header (Fixed Top) */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-2xl">
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

            {assignFacultyTarget && (() => {
              const targetDeptId = assignFacultyTarget.department_id || assignFacultyTarget.department?.department_id;
              const deptName = assignFacultyTarget.department?.department_name ||
                departmentsList.find((d) => d.department_id === targetDeptId)?.department_name ||
                "Assigned Department";
              const deptProgs = getProgramsForDepartment(targetDeptId, deptName);

              return (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <span className="text-slate-500">Department:</span>{" "}
                      <strong className="text-indigo-950 font-bold">{deptName}</strong>
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
                          className="bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
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
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
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
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                        className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg"
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
                {availableEditCourses.map((c) => {
                  const isChecked = editCourseIds.includes(c.course_id);
                  return (
                    <label
                      key={c.course_id}
                      className={`flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                        isChecked ? "bg-indigo-50 font-bold text-indigo-900 border border-indigo-200" : "bg-white hover:bg-slate-100/80 text-slate-700 font-medium border border-transparent"
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
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span className="font-mono text-[11px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {c.course_code}
                      </span>
                      <span className="truncate">{c.course_title}</span>
                    </label>
                  );
                })}
                {availableEditCourses.length === 0 && (
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
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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

      {/* EDIT DIRECTOR PROFILE / NAME MODAL */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 text-indigo-700 p-2.5 rounded-2xl border border-indigo-100">
                  <UserCog className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Director Profile Name</h3>
                  <p className="text-xs text-slate-500 font-medium">Update your official name and academic prefix/title</p>
                </div>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {directorNameMsg && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-bold border flex items-center gap-2 ${
                  directorNameMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {directorNameMsg.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{directorNameMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveDirectorProfile} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Academic Title / Prefix <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr., Prof., Engr., Director"
                  value={dirTitle}
                  onChange={(e) => setDirTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan"
                    value={dirFirstName}
                    onChange={(e) => setDirFirstName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. D."
                    value={dirMiddleName}
                    onChange={(e) => setDirMiddleName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none transition-all"
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
                  placeholder="e.g. Dela Cruz"
                  value={dirLastName}
                  onChange={(e) => setDirLastName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 p-3 rounded-xl outline-none transition-all"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDirectorName}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl shadow-md shadow-indigo-700/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingDirectorName ? (
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
