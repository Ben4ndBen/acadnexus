"use client";

import { useActionState, useEffect, useState, useMemo } from "react";
import { registerAction } from "@/app/actions/auth";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  Check,
  X,
  BookOpen,
  ChevronDown,
  Search,
  Sparkles,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  BookCheck,
} from "lucide-react";
import Link from "next/link";
import {
  BSIT_CURRICULUM,
  BSHM_CURRICULUM,
  BSIT_TRACKS,
  BSHM_MAJORS,
  CurriculumItem,
} from "@/lib/bsitCurriculum";

interface Program {
  program_id: number;
  program_code: string;
  program_name: string;
}

interface Course {
  course_id: number;
  course_code: string;
  course_title: string;
}

export function RegisterForm({
  programs = [],
  courses = [],
}: {
  programs?: Program[];
  courses?: Course[];
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time Input States
  const [institutionalId, setInstitutionalId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>("1");
  const [selectedMajor, setSelectedMajor] = useState<string>("");

  // Multi-select Dropdown States for Enrolled Subjects
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("");
  const [semesterTabFilter, setSemesterTabFilter] = useState<"all" | "1" | "2">("all");

  const [state, formAction, isPending] = useActionState(registerAction, null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Map program names / codes -> available majors/tracks
  const PROGRAM_MAJORS: Record<string, string[]> = {
    "information technology": [...BSIT_TRACKS, "General BSIT"],
    "bsit": [...BSIT_TRACKS, "General BSIT"],
    "hospitality management": [...BSHM_MAJORS],
    "bshm": [...BSHM_MAJORS],
    "secondary education": ["English", "Science", "Mathematics"],
    "bsed": ["English", "Science", "Mathematics"],
    "industrial technology": ["Automotive Technology", "Architecture Technology", "Electronics Technology"],
    "bsindtech": ["Automotive Technology", "Architecture Technology", "Electronics Technology"],
  };

  /** Returns the major options for the currently selected program */
  const availableMajors = useMemo(() => {
    if (!selectedProgramId) return [];
    const prog = programs.find((p) => String(p.program_id) === selectedProgramId);
    if (!prog) return [];
    const nameLower = prog.program_name.toLowerCase();
    const codeLower = prog.program_code.toLowerCase();

    for (const [keyword, majors] of Object.entries(PROGRAM_MAJORS)) {
      if (nameLower.includes(keyword) || codeLower.includes(keyword)) {
        return majors;
      }
    }
    return ["General Major"];
  }, [selectedProgramId, programs]);

  // Identify active program code (BSIT, BSHM, etc.)
  const selectedProg = programs.find((p) => String(p.program_id) === selectedProgramId);

  const activeProgramCode = useMemo(() => {
    if (!selectedProg) return null;
    const codeUpper = selectedProg.program_code.toUpperCase();
    const nameLower = selectedProg.program_name.toLowerCase();

    if (codeUpper === "BSIT" || nameLower.includes("information technology")) return "BSIT";
    if (codeUpper === "BSHM" || nameLower.includes("hospitality")) return "BSHM";
    return null;
  }, [selectedProg]);

  const currentYearNum = Number(selectedYearLevel) || 1;

  // Filter curriculum items for current program & year level
  const allottedCurriculumItems = useMemo(() => {
    if (!activeProgramCode) return [];
    const sourceCurriculum = activeProgramCode === "BSIT" ? BSIT_CURRICULUM : BSHM_CURRICULUM;

    return sourceCurriculum.filter((item) => {
      if (item.yearLevel !== currentYearNum) return false;

      // Handle track electives filter if a track is selected
      if (item.isTrackElective && item.trackName) {
        if (selectedMajor && selectedMajor.includes("Track")) {
          return item.trackName === selectedMajor;
        }
      }
      return true;
    });
  }, [activeProgramCode, currentYearNum, selectedMajor]);

  // Map curriculum items to actual DB courses
  const allottedCourses = useMemo(() => {
    if (!selectedProgramId) return [];
    if (!activeProgramCode) return courses; // Fallback for other programs

    const allottedCodes = allottedCurriculumItems.map((item) => item.code);

    return courses.filter((c) => {
      if (allottedCodes.includes(c.course_code)) return true;
      // Match track elective variants like ITD 304-CS, ITD 304-WM, etc.
      return allottedCurriculumItems.some(
        (item) => item.isTrackElective && c.course_code.startsWith(item.code.replace("*", ""))
      );
    });
  }, [selectedProgramId, activeProgramCode, allottedCurriculumItems, courses]);

  // Helper to find curriculum metadata for a course
  const getCurriculumMeta = (courseCode: string): CurriculumItem | undefined => {
    const sourceCurriculum = activeProgramCode === "BSHM" ? BSHM_CURRICULUM : BSIT_CURRICULUM;
    return sourceCurriculum.find(
      (item) =>
        item.code === courseCode ||
        (item.isTrackElective && courseCode.startsWith(item.code.replace("*", "")))
    );
  };

  // Auto-preselect all allotted subjects whenever Program, Year Level, or Major changes
  useEffect(() => {
    if (!selectedProgramId || !selectedYearLevel) return;

    if (activeProgramCode && allottedCourses.length > 0) {
      const ids = allottedCourses.map((c) => c.course_id);
      setSelectedCourseIds(ids);
    }
  }, [selectedProgramId, selectedYearLevel, selectedMajor, activeProgramCode, allottedCourses]);

  // Toggle subject selection
  const toggleCourse = (courseId: number) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  // Select all allotted courses for current year level
  const selectAllAllottedCourses = () => {
    const allottedIds = allottedCourses.map((c) => c.course_id);
    setSelectedCourseIds(allottedIds);
  };

  // Clear all selections
  const clearAllCourses = () => {
    setSelectedCourseIds([]);
  };

  // Select courses by semester (1 or 2)
  const selectSemesterCourses = (semesterNum: number) => {
    const semCourses = allottedCourses.filter((c) => {
      const meta = getCurriculumMeta(c.course_code);
      return meta?.semester === semesterNum;
    });
    const semIds = semCourses.map((c) => c.course_id);

    // Add these semIds to existing selected course IDs without duplicates
    setSelectedCourseIds((prev) => Array.from(new Set([...prev, ...semIds])));
  };

  // Filtered courses for multi-select dropdown search & semester tab filter
  const filteredCourses = useMemo(() => {
    return allottedCourses.filter((c) => {
      const matchesSearch =
        c.course_code.toLowerCase().includes(subjectSearchQuery.toLowerCase()) ||
        c.course_title.toLowerCase().includes(subjectSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (semesterTabFilter === "all") return true;

      const meta = getCurriculumMeta(c.course_code);
      return meta?.semester === Number(semesterTabFilter);
    });
  }, [allottedCourses, subjectSearchQuery, semesterTabFilter]);

  // Group filtered courses by semester for neat rendering
  const sem1Courses = useMemo(() => {
    return filteredCourses.filter((c) => {
      const meta = getCurriculumMeta(c.course_code);
      return meta?.semester === 1;
    });
  }, [filteredCourses]);

  const sem2Courses = useMemo(() => {
    return filteredCourses.filter((c) => {
      const meta = getCurriculumMeta(c.course_code);
      return meta?.semester === 2;
    });
  }, [filteredCourses]);

  const otherCourses = useMemo(() => {
    return filteredCourses.filter((c) => {
      const meta = getCurriculumMeta(c.course_code);
      return !meta || (meta.semester !== 1 && meta.semester !== 2);
    });
  }, [filteredCourses]);

  // Real-time Institutional ID check
  const isIdEmpty = institutionalId.trim() === "";
  const isIdValid = /^\d{4}-\d{4}-AB$/.test(institutionalId.trim().toUpperCase());

  // Password strength criteria check
  const criteria = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const strengthScore = Object.values(criteria).filter(Boolean).length;
  const isPasswordEmpty = password === "";

  const getStrengthDetails = () => {
    if (isPasswordEmpty) return { label: "", color: "bg-stone-200", text: "text-stone-400", width: "w-0" };
    if (strengthScore <= 2) return { label: "Weak Password", color: "bg-rose-500", text: "text-[#7A151A]", width: "w-1/3" };
    if (strengthScore <= 4) return { label: "Medium Password", color: "bg-amber-500", text: "text-amber-600", width: "w-2/3" };
    return { label: "Strong Password", color: "bg-emerald-500", text: "text-emerald-600", width: "w-full" };
  };

  const strength = getStrengthDetails();

  // Confirm password match check
  const isConfirmEmpty = confirmPassword === "";
  const passwordsMatch = password === confirmPassword;

  useEffect(() => {
    if (state?.success) {
      setSuccessMsg("Account successfully registered! You can now sign in to your student portal dashboard.");
    }
  }, [state]);

  if (successMsg) {
    return (
      <div className="space-y-6 text-center py-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-center">
          <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full border border-emerald-100 animate-bounce shadow-sm">
            <CheckCircle className="w-12 h-12" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-neutral-900">Student Account Created</h3>
        <p className="text-sm text-neutral-600 leading-relaxed max-w-sm mx-auto">
          {successMsg}
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-[#7A151A] hover:bg-[#580B0F] text-white font-bold rounded-xl px-8 py-3.5 text-sm shadow-md transition-all duration-300 hover:scale-105"
          >
            Go to Login Page
          </Link>
        </div>
      </div>
    );
  }

  const yearLevelLabel =
    selectedYearLevel === "1"
      ? "1st Year"
      : selectedYearLevel === "2"
      ? "2nd Year"
      : selectedYearLevel === "3"
      ? "3rd Year"
      : selectedYearLevel === "4"
      ? "4th Year"
      : "Year Level";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="role" value="Student" />
      <input type="hidden" name="enrolledCourses" value={selectedCourseIds.join(",")} />

      {state?.error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-xl text-sm shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="font-semibold">{state.error}</p>
        </div>
      )}

      {/* Dedicated Student Role Indicator Header Badge */}
      <div className="flex items-center justify-between p-3.5 bg-[#7A151A]/5 border border-[#7A151A]/15 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#7A151A] text-white rounded-lg shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#7A151A] uppercase tracking-wider">
              Student Registration Portal
            </h4>
            <p className="text-[11px] text-stone-500 font-medium">
              Dynamic Curriculum & Subject Selection Engine
            </p>
          </div>
        </div>
        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-[#7A151A] text-white rounded-md tracking-wider shadow-xs">
          Student
        </span>
      </div>

      {/* Name Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            placeholder="e.g. Michael"
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor="middleName" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            Middle Name
          </label>
          <input
            id="middleName"
            name="middleName"
            type="text"
            placeholder="e.g. Agustin (Optional)"
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            placeholder="e.g. Castro"
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Student Onboarding Academic Program, Year Level & Major */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-stone-100 pt-4">
        <div>
          <label htmlFor="programId" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            Academic Program <span className="text-rose-500">*</span>
          </label>
          <select
            id="programId"
            name="programId"
            required
            value={selectedProgramId}
            onChange={(e) => {
              setSelectedProgramId(e.target.value);
              setSelectedMajor("");
            }}
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200 font-medium"
            disabled={isPending}
          >
            <option value="" disabled>Select Program</option>
            {programs.map((prog) => (
              <option key={prog.program_id} value={prog.program_id}>
                {prog.program_code} - {prog.program_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="yearLevel" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            Year Level <span className="text-rose-500">*</span>
          </label>
          <select
            id="yearLevel"
            name="yearLevel"
            required
            value={selectedYearLevel}
            onChange={(e) => setSelectedYearLevel(e.target.value)}
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200 font-medium"
            disabled={isPending}
          >
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
        </div>

        <div>
          <label htmlFor="major" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
            Academic Major / Track <span className="text-rose-500">*</span>
          </label>
          <select
            id="major"
            name="section"
            required
            value={selectedMajor}
            onChange={(e) => setSelectedMajor(e.target.value)}
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200 disabled:text-stone-400 font-medium"
            disabled={isPending || availableMajors.length === 0}
          >
            {availableMajors.length === 0 ? (
              <option value="" disabled>
                {selectedProgramId ? "No majors for this program" : "Select a program first"}
              </option>
            ) : (
              <>
                <option value="" disabled>Select Major / Track</option>
                {availableMajors.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      {/* DYNAMIC MULTI-SELECT DROPDOWN FOR ENROLLED SUBJECTS */}
      <div className="border-t border-stone-100 pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#7A151A]" />
            <span>Enrolled Subjects</span>
            {selectedProgramId && (
              <span className="text-[11px] font-semibold text-[#7A151A] bg-[#7A151A]/10 px-2 py-0.5 rounded-md normal-case border border-[#7A151A]/20">
                {selectedProg?.program_code} • {yearLevelLabel} Allotted
              </span>
            )}
          </label>

          {selectedProgramId && allottedCourses.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllAllottedCourses}
                className="text-[11px] font-bold text-[#7A151A] hover:bg-[#7A151A]/10 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Select All {yearLevelLabel}
              </button>
              {selectedCourseIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllCourses}
                  className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors"
                >
                  Clear Selection
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          {/* Interactive Dropdown Trigger Button */}
          <button
            type="button"
            onClick={() => {
              if (!selectedProgramId) return;
              setIsSubjectDropdownOpen(!isSubjectDropdownOpen);
            }}
            disabled={isPending || !selectedProgramId}
            className={`w-full bg-stone-50/60 hover:bg-stone-50 focus:bg-white border rounded-xl px-4 py-3 text-left flex items-center justify-between transition-all duration-200 ${
              !selectedProgramId
                ? "cursor-not-allowed opacity-75 border-stone-200/80 bg-stone-100/50"
                : isSubjectDropdownOpen
                ? "border-[#7A151A] ring-2 ring-[#7A151A]/20 bg-white shadow-sm"
                : "border-stone-200/80"
            }`}
          >
            <div className="flex items-center gap-1.5 flex-wrap max-w-[85%]">
              {!selectedProgramId ? (
                <div className="flex items-center gap-2 text-stone-400 text-xs py-0.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                  <span>Please select your Academic Program above to view allotted subjects...</span>
                </div>
              ) : selectedCourseIds.length === 0 ? (
                <div className="flex items-center gap-2 text-stone-400 text-xs py-0.5">
                  <BookOpen className="w-4 h-4 text-stone-400 shrink-0" />
                  <span>Select your enrolled subjects for {selectedProg?.program_code} ({yearLevelLabel})...</span>
                </div>
              ) : (
                courses
                  .filter((c) => selectedCourseIds.includes(c.course_id))
                  .map((c) => (
                    <span
                      key={c.course_id}
                      className="inline-flex items-center gap-1 bg-[#7A151A]/10 text-[#7A151A] border border-[#7A151A]/20 px-2.5 py-1 rounded-lg text-xs font-bold animate-in fade-in"
                    >
                      <span>{c.course_code}</span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCourse(c.course_id);
                        }}
                        className="hover:text-rose-800 p-0.5 rounded hover:bg-[#7A151A]/20 cursor-pointer transition-colors"
                        title={`Remove ${c.course_code}`}
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </span>
                  ))
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {selectedCourseIds.length > 0 && (
                <span className="text-[11px] font-black bg-[#7A151A] text-white px-2.5 py-0.5 rounded-full shadow-xs">
                  {selectedCourseIds.length}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${
                  isSubjectDropdownOpen ? "rotate-180 text-[#7A151A]" : ""
                }`}
              />
            </div>
          </button>

          {/* Dynamic Dropdown Menu Overlay */}
          {isSubjectDropdownOpen && selectedProgramId && (
            <div className="absolute z-40 left-0 right-0 mt-2 bg-white border border-stone-200 shadow-2xl rounded-2xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              
              {/* Top Toolbar: Search & Semester Filter Pills */}
              <div className="space-y-2 pb-2 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={subjectSearchQuery}
                      onChange={(e) => setSubjectSearchQuery(e.target.value)}
                      placeholder={`Search ${selectedProg?.program_code} ${yearLevelLabel} subjects...`}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-[#7A151A] focus:ring-1 focus:ring-[#7A151A]"
                    />
                    {subjectSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSubjectSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Filter Semester Tabs */}
                {activeProgramCode && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1 bg-stone-100/70 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setSemesterTabFilter("all")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                          semesterTabFilter === "all"
                            ? "bg-white text-[#7A151A] shadow-xs"
                            : "text-stone-500 hover:text-stone-800"
                        }`}
                      >
                        All ({allottedCourses.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSemesterTabFilter("1")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                          semesterTabFilter === "1"
                            ? "bg-white text-[#7A151A] shadow-xs"
                            : "text-stone-500 hover:text-stone-800"
                        }`}
                      >
                        1st Semester
                      </button>
                      <button
                        type="button"
                        onClick={() => setSemesterTabFilter("2")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                          semesterTabFilter === "2"
                            ? "bg-white text-[#7A151A] shadow-xs"
                            : "text-stone-500 hover:text-stone-800"
                        }`}
                      >
                        2nd Semester
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectSemesterCourses(1)}
                        className="text-[10px] font-bold text-stone-600 hover:text-[#7A151A] hover:underline"
                      >
                        + 1st Sem
                      </button>
                      <button
                        type="button"
                        onClick={() => selectSemesterCourses(2)}
                        className="text-[10px] font-bold text-stone-600 hover:text-[#7A151A] hover:underline"
                      >
                        + 2nd Sem
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Course Listing Container */}
              <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                {filteredCourses.length === 0 ? (
                  <div className="text-center py-6 space-y-1">
                    <p className="text-xs font-semibold text-stone-500">No subjects matching search query.</p>
                    <p className="text-[11px] text-stone-400">Try clearing filters or search term.</p>
                  </div>
                ) : (
                  <>
                    {/* First Semester Group */}
                    {sem1Courses.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-900">
                          <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-700" />
                            {yearLevelLabel} – First Semester
                          </span>
                          <span className="text-[10px] font-black bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                            {sem1Courses.length} Subjects
                          </span>
                        </div>

                        <div className="divide-y divide-stone-100">
                          {sem1Courses.map((course) => {
                            const isSelected = selectedCourseIds.includes(course.course_id);
                            const meta = getCurriculumMeta(course.course_code);
                            return (
                              <div
                                key={course.course_id}
                                onClick={() => toggleCourse(course.course_id)}
                                className={`flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-[#7A151A]/10 text-[#7A151A] font-semibold"
                                    : "hover:bg-stone-50 text-stone-700"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                                      isSelected
                                        ? "bg-[#7A151A] border-[#7A151A] text-white shadow-xs"
                                        : "border-stone-300 bg-white"
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black tracking-tight">
                                        {course.course_code}
                                      </span>
                                      {meta?.isTrackElective && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-700 border border-purple-200 rounded">
                                          {meta.trackName || "Track Elective"}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-stone-500 font-medium leading-tight mt-0.5">
                                      {course.course_title}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Second Semester Group */}
                    {sem2Courses.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-900">
                          <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-700" />
                            {yearLevelLabel} – Second Semester
                          </span>
                          <span className="text-[10px] font-black bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded-md">
                            {sem2Courses.length} Subjects
                          </span>
                        </div>

                        <div className="divide-y divide-stone-100">
                          {sem2Courses.map((course) => {
                            const isSelected = selectedCourseIds.includes(course.course_id);
                            const meta = getCurriculumMeta(course.course_code);
                            return (
                              <div
                                key={course.course_id}
                                onClick={() => toggleCourse(course.course_id)}
                                className={`flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-[#7A151A]/10 text-[#7A151A] font-semibold"
                                    : "hover:bg-stone-50 text-stone-700"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                                      isSelected
                                        ? "bg-[#7A151A] border-[#7A151A] text-white shadow-xs"
                                        : "border-stone-300 bg-white"
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black tracking-tight">
                                        {course.course_code}
                                      </span>
                                      {meta?.isTrackElective && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-700 border border-purple-200 rounded">
                                          {meta.trackName || "Track Elective"}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-stone-500 font-medium leading-tight mt-0.5">
                                      {course.course_title}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Other / Unclassified Courses Group */}
                    {otherCourses.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between px-2 py-1 bg-stone-100 border border-stone-200 rounded-lg text-stone-800">
                          <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <BookCheck className="w-3.5 h-3.5 text-stone-600" />
                            Additional / Custom Subjects
                          </span>
                          <span className="text-[10px] font-black bg-stone-200 text-stone-800 px-2 py-0.5 rounded-md">
                            {otherCourses.length} Subjects
                          </span>
                        </div>

                        <div className="divide-y divide-stone-100">
                          {otherCourses.map((course) => {
                            const isSelected = selectedCourseIds.includes(course.course_id);
                            return (
                              <div
                                key={course.course_id}
                                onClick={() => toggleCourse(course.course_id)}
                                className={`flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-[#7A151A]/10 text-[#7A151A] font-semibold"
                                    : "hover:bg-stone-50 text-stone-700"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                                      isSelected
                                        ? "bg-[#7A151A] border-[#7A151A] text-white shadow-xs"
                                        : "border-stone-300 bg-white"
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black tracking-tight">{course.course_code}</p>
                                    <p className="text-[11px] text-stone-500 font-medium leading-tight mt-0.5">
                                      {course.course_title}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-stone-500 font-medium">
                  {selectedCourseIds.length} of {allottedCourses.length} subjects selected
                </span>
                <button
                  type="button"
                  onClick={() => setIsSubjectDropdownOpen(false)}
                  className="bg-[#7A151A] hover:bg-[#580B0F] text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-xs"
                >
                  Done Selecting
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Student Institutional ID Field */}
      <div className="border-t border-stone-100 pt-4">
        <label htmlFor="institutionalId" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
          Student Institutional ID (Format: YYYY-NNNN-AB)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <User className="w-5 h-5" />
          </div>
          <input
            id="institutionalId"
            name="institutionalId"
            type="text"
            required
            value={institutionalId}
            onChange={(e) => setInstitutionalId(e.target.value)}
            placeholder="e.g. 2023-0001-AB"
            className={`w-full bg-stone-50/60 focus:bg-white border rounded-xl pl-11 pr-10 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200 ${
              isIdEmpty 
                ? "border-stone-200/80" 
                : isIdValid 
                  ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20" 
                  : "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
            }`}
            disabled={isPending}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {!isIdEmpty && (
              isIdValid 
                ? <Check className="w-5 h-5 text-emerald-500" />
                : <X className="w-5 h-5 text-rose-500" />
            )}
          </div>
        </div>
        {!isIdEmpty && !isIdValid && (
          <p className="text-[11px] text-rose-600 mt-1 font-semibold">
            Must follow format: YYYY-NNNN-AB (e.g. 2023-0001-AB).
          </p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-stone-50/60 focus:bg-white border border-stone-200/80 focus:border-[#7A151A] rounded-xl pl-11 pr-11 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none"
            disabled={isPending}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Password Strength Meter */}
        {!isPasswordEmpty && (
          <div className="mt-2.5 space-y-2 bg-stone-50/50 border border-stone-100 rounded-xl p-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-stone-500">Security Strength:</span>
              <span className={`font-bold ${strength.text}`}>{strength.label}</span>
            </div>
            
            <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ease-out ${strength.color} ${strength.width}`} />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.length ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.length ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.length ? "text-emerald-700 font-medium" : "text-stone-400"}>8+ Characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.upper ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.upper ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.upper ? "text-emerald-700 font-medium" : "text-stone-400"}>Uppercase Letter</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.lower ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.lower ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.lower ? "text-emerald-700 font-medium" : "text-stone-400"}>Lowercase Letter</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.number ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.number ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.number ? "text-emerald-700 font-medium" : "text-stone-400"}>Number (0-9)</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border ${
                  criteria.special ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-stone-50 border-stone-200 text-stone-400"
                }`}>
                  {criteria.special ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 bg-stone-300 rounded-full" />}
                </span>
                <span className={criteria.special ? "text-emerald-700 font-medium" : "text-stone-400"}>Special Character (!@#$, etc.)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password Field */}
      <div>
        <label htmlFor="confirmPassword" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
          Confirm Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className={`w-full bg-stone-50/60 focus:bg-white border rounded-xl pl-11 pr-11 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A151A]/20 transition-all duration-200 ${
              isConfirmEmpty 
                ? "border-stone-200/80" 
                : passwordsMatch 
                  ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20" 
                  : "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
            }`}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none"
            disabled={isPending}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {!isConfirmEmpty && (
          <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold">
            {passwordsMatch ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Passwords match
              </span>
            ) : (
              <span className="text-rose-600 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Passwords do not match
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full relative flex items-center justify-center bg-[#7A151A] hover:bg-[#580B0F] text-white font-bold rounded-xl py-3.5 text-sm shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#7A151A] focus:ring-offset-2 transition-all duration-300 disabled:opacity-85 disabled:cursor-not-allowed group overflow-hidden mt-6"
      >
        <span className="absolute right-0 top-0 w-24 h-full bg-[#E2A123]/10 skew-x-12 translate-x-12 group-hover:translate-x-[-180px] transition-transform duration-1000 ease-out" />
        {isPending ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#E2A123]" />
            <span>Creating Student Account...</span>
          </div>
        ) : (
          <span>Register Student Account</span>
        )}
      </button>

      <div className="text-center pt-2">
        <p className="text-xs text-stone-500">
          Already have an account?{" "}
          <Link href="/" className="font-bold text-[#7A151A] hover:underline">
            Sign In Here
          </Link>
        </p>
      </div>
    </form>
  );
}
