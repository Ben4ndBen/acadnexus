"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Settings, BookOpen, ClipboardCheck, ArrowLeft, ArrowRight, Save, 
  Upload, Trash2, Plus, Check, Eye, Trash, ArrowUp, ArrowDown, FileText, 
  Shuffle, AlertCircle, RefreshCw, FileUp, Sparkles, CheckCircle, Search, X,
  Tag, Layers, Sliders, Hash, ListFilter, Calendar, GraduationCap, Users,
  CheckSquare, Square, ChevronDown, ChevronUp, ChevronRight, Printer, HelpCircle, LogOut, Edit3 } from "lucide-react";
import { saveExamConfig, saveExamQuestions, updateExamStatus, uploadQuestionAttachment, uploadTosFileAction, getQuestionBankQuestions, importQuestionsToExam, getAssignedStudentsForCourse } from "@/app/actions/faculty";
import { determineSemesterFromDate, formatStudentName } from "@/lib/academicUtils";
import { Latex } from "@/app/components/Latex";
import { formatFullExamDate } from "@/app/components/BSCTableOfSpecificationsView";

interface Course {
  course_id: number;
  course_code: string;
  course_title: string;
}

interface StudentItem {
  student_id: number;
  institutional_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  program_code: string;
  program_name: string;
  year_level: number;
  section: string;
}

interface Exam {
  exam_id: number;
  title: string;
  course_id: number;
  tos_file_path: string;
  time_limit_minutes: number;
  randomize_items: boolean;
  time_penalty_seconds?: number;
  score_penalty_points?: number;
  current_status: "Draft" | "Pending_Chair" | "Pending_DI" | "Approved" | "Returned";
  course: Course;
  academic_year?: string | null;
  term?: string | null;
  exam_date?: Date | string | null;
  semester?: string | null;
  document_reference?: string | null;
  selected_student_ids?: number[];
  questionBank: Array<{
    question_id: number;
    question_text: string;
    question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type" | "Essay" | "Fill_In_The_Blanks";
    correct_answer: string;
    points: number;
    topic?: string | null;
  }>;
}

interface ExamBuilderWizardProps {
  exam: Exam;
  courses: Course[];
  assignedSubjects?: Course[];
  facultyId: number;
  academicPeriodSettings?: {
    active_academic_year: string;
    active_semester: string;
    active_term?: string;
    sem1_start: string;
    sem1_end: string;
    sem2_start: string;
    sem2_end: string;
  };
  initialAssignedStudents?: StudentItem[];
  returnUrl?: string;
  facultyDepartment?: string;
  userRole?: string;
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

export type TaxonomyLevel = 
  | "KNOWLEDGE / REMEMBERING"
  | "COMPREHENSION / UNDERSTANDING"
  | "APPLICATION / APPLYING"
  | "ANALYSIS / ANALYZING"
  | "SYNTHESIS / EVALUATING"
  | "EVALUATION / CREATING";

interface QuestionState {
  question_id?: number;
  text: string;
  question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type" | "Essay" | "Fill_In_The_Blanks";
  options: string[]; // Multiple Choice options
  premises: string[]; // Matching Column A
  matches: Array<{ premise: string; choice: string }>; // Matching correct mapping
  blanks: Array<{ id: number; answer: string; points: number }>; // Fill in the Blanks list
  min_words?: number; // Minimum word count limitation for Essay
  correctAnswer: string; // For MCQ / TF / Identification / Essay
  points: number;
  image_url?: string;
  topic?: string;
  year_level?: number;
  taxonomy_level?: TaxonomyLevel;
}

// Question Type priority mapping for automatic test arrangement
// 1 = Multiple Choice ("MULTIPLICATION"), 2 = Identification, 3 = True or False, 4 = Fill in the Blanks, 5 = Matching Type, 6 = Essay
const QUESTION_TYPE_ORDER: Record<string, number> = {
  Multiple_Choice: 1,
  Identification: 2,
  True_False: 3,
  Fill_In_The_Blanks: 4,
  Matching_Type: 5,
  Essay: 6,
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  Multiple_Choice: "Multiple Choice",
  Identification: "Identification",
  True_False: "True or False",
  Fill_In_The_Blanks: "Fill in the Blanks",
  Matching_Type: "Matching Type",
  Essay: "Essay",
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
  Multiple_Choice: "Read each question carefully and select the best answer from the options provided.",
  Identification: "Identify the correct term, concept, or answer described in each item.",
  True_False: "Read each statement carefully. Write 'True' if the statement is correct, or 'False' if it is incorrect.",
  Fill_In_The_Blanks: "Complete each statement by writing the appropriate word or phrase in the blank provided.",
  Matching_Type: "Match the items in Column A with their corresponding definitions or matches in Column B.",
  Essay: "Answer the following question(s) thoroughly and clearly in the space provided.",
};

function sortQuestionsByType(qs: QuestionState[]): QuestionState[] {
  return [...qs].sort((a, b) => {
    const orderA = QUESTION_TYPE_ORDER[a.question_type] ?? 99;
    const orderB = QUESTION_TYPE_ORDER[b.question_type] ?? 99;
    return orderA - orderB;
  });
}



export function cleanCorrectAnswer(val: any): string {
  if (!val || typeof val !== "string") return "";
  const trimmed = val.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed.answer === "string") return parsed.answer;
      if (parsed && typeof parsed.text === "string") return parsed.text;
      return "";
    } catch {
      return "";
    }
  }
  return val;
}

export function cleanQuestionText(rawText: string): string {
  if (!rawText) return "";
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.text === "string") return parsed.text;
    } catch {}
  }
  return rawText;
}

// Deserialization helper
function deserializeQuestions(dbQuestions: any[]): QuestionState[] {
  return dbQuestions.map(q => {
    let text = q.question_text;
    let options: string[] = [];
    let premises: string[] = [];
    let matches: Array<{ premise: string; choice: string }> = [];
    let blanks: Array<{ id: number; answer: string; points: number }> = [];
    let min_words: number | undefined = undefined;
    let correctAnswer = cleanCorrectAnswer(q.correct_answer);
    let image_url = "";
    let taxonomy_level: TaxonomyLevel = "KNOWLEDGE / REMEMBERING";

    // Check if the question text is a serialized JSON object
    if (q.question_text.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(q.question_text);
        text = typeof parsed.text === "string" ? parsed.text : (parsed.text ?? q.question_text);
        options = parsed.options || [];
        premises = parsed.premises || [];
        blanks = parsed.blanks || [];
        min_words = parsed.min_words;
        image_url = parsed.image_url || "";
        if (parsed.taxonomy_level) taxonomy_level = parsed.taxonomy_level;
      } catch {
        text = q.question_text;
      }
    } else if (q.question_type === "Multiple_Choice") {
      try {
        const parsed = JSON.parse(q.question_text);
        text = parsed.text || q.question_text;
        options = parsed.options || [];
        if (parsed.taxonomy_level) taxonomy_level = parsed.taxonomy_level;
      } catch {
        text = q.question_text;
        options = ["", "", "", ""];
      }
    } else if (q.question_type === "Matching_Type") {
      try {
        const parsedText = JSON.parse(q.question_text);
        text = typeof parsedText.text === "string" ? parsedText.text : (parsedText.text ?? q.question_text);
        premises = parsedText.premises || [];
        options = parsedText.options || [];
        if (parsedText.taxonomy_level) taxonomy_level = parsedText.taxonomy_level;
      } catch {
        text = q.question_text;
        premises = [];
        options = [];
      }
    }

    if (q.question_type === "Matching_Type") {
      try {
        const parsedAnswer = JSON.parse(q.correct_answer);
        matches = parsedAnswer.matches || [];
      } catch {
        matches = [];
      }
    } else if (q.question_type === "Fill_In_The_Blanks") {
      try {
        const parsedAnswer = JSON.parse(q.correct_answer);
        if (parsedAnswer.blanks) {
          blanks = parsedAnswer.blanks;
        }
      } catch {}
    }

    text = cleanQuestionText(text);
    // Clean any sample text or item prefixes
    if (text && text.match(/^\[Item \d+\]\s*(Multiple Choice Question for.*)?$/i)) {
      text = "";
    } else if (text && text.startsWith("[Item ")) {
      text = text.replace(/^\[Item \d+\]\s*/i, "");
    } else if (
      text === "Discuss in detail your analysis of the topic below." ||
      text === "The capital of Batanes is [blank] and it is located in the [blank] region of the Philippines." ||
      text === "The core concept of [blank] is applied in [blank]."
    ) {
      text = "";
    }

    // Clean sample options if they are default dummy strings
    if (options && options.length > 0) {
      if (options.every((opt, idx) => !opt || opt === `Option ${String.fromCharCode(65 + idx)}` || opt.startsWith("Option "))) {
        options = ["", "", "", ""];
      }
    }

    // Clean sample matches if they are default dummy strings
    if (matches && matches.length > 0) {
      matches = matches.map(m => ({
        premise: (m.premise && m.premise.startsWith("Premise ")) ? "" : m.premise,
        choice: (m.choice && (m.choice.startsWith("Match ") || m.choice.startsWith("Choice "))) ? "" : m.choice
      }));
    }

    // Clean sample blanks if they are default dummy strings
    // Clean sample blanks if they are default dummy strings or un-added empty placeholders
    if (blanks && blanks.length > 0) {
      blanks = blanks.filter(b => b.answer && b.answer.trim() !== "" && !b.answer.startsWith("Answer ") && b.answer !== "Basco" && b.answer !== "northern");
    }
    const finalCorrectAnswer = (correctAnswer && (correctAnswer.startsWith("Option ") || correctAnswer === "Option A")) ? "" : correctAnswer;

    return {
      question_id: q.question_id,
      text,
      question_type: q.question_type,
      options,
      premises,
      matches,
      blanks,
      min_words,
      correctAnswer: finalCorrectAnswer,
      points: q.points,
      image_url,
      topic: q.topic || "",
      year_level: q.year_level || undefined,
      taxonomy_level,
    };
  });
}

// Serialization helper
function serializeQuestions(questions: QuestionState[]) {
  return questions.map(q => {
    let question_text = q.text;
    let correct_answer = q.correctAnswer;

    // Build standard JSON wrapper to hold metadata like images and taxonomy level
    const serializedData: Record<string, any> = {
      text: q.text,
      taxonomy_level: q.taxonomy_level || "KNOWLEDGE / REMEMBERING",
    };
    if (q.image_url) {
      serializedData.image_url = q.image_url;
    }

    let calculatedPoints = Number(q.points) || 1;

    if (q.question_type === "Multiple_Choice") {
      serializedData.options = q.options;
      question_text = JSON.stringify(serializedData);
      correct_answer = q.correctAnswer;
    } else if (q.question_type === "Matching_Type") {
      const premises = q.matches.map(m => m.premise).filter(Boolean);
      const options = Array.from(new Set(q.matches.map(m => m.choice).filter(Boolean)));
      
      serializedData.premises = premises;
      serializedData.options = options;
      question_text = JSON.stringify(serializedData);
      correct_answer = JSON.stringify({
        matches: q.matches.filter(m => m.premise || m.choice)
      });
    } else if (q.question_type === "Fill_In_The_Blanks") {
      serializedData.blanks = q.blanks;
      question_text = JSON.stringify(serializedData);
      correct_answer = JSON.stringify({
        blanks: q.blanks
      });
      if (q.blanks && q.blanks.length > 0) {
        const sumPoints = q.blanks.reduce((sum, b) => sum + (Number(b.points) || 1), 0);
        if (sumPoints > 0) calculatedPoints = sumPoints;
      }
    } else if (q.question_type === "Essay") {
      if (q.min_words && q.min_words > 0) {
        serializedData.min_words = q.min_words;
      }
      question_text = JSON.stringify(serializedData);
      correct_answer = q.correctAnswer || "";
    } else {
      question_text = JSON.stringify(serializedData);
    }

    return {
      question_id: q.question_id,
      question_text,
      question_type: q.question_type,
      correct_answer,
      points: calculatedPoints,
      topic: q.topic || null,
      year_level: q.year_level ? Number(q.year_level) : null,
    };
  });
}

export function ExamBuilderWizard({ 
  exam, 
  courses, 
  assignedSubjects = [], 
  facultyId,
  academicPeriodSettings,
  initialAssignedStudents = [],
  returnUrl,
  facultyDepartment,
  userRole
}: ExamBuilderWizardProps) {
  const router = useRouter();

  // Steps: 1 = Config, 2 = Questions, 3 = Preview & Submit
  const [step, setStep] = useState<number>(1);

  // 1. Examination Term (Selectable by Faculty / Chairs) & Date
  const [term, setTerm] = useState<string>(
    exam.term || "Prelim"
  );
  const [examDate, setExamDate] = useState<string>(
    exam.exam_date
      ? typeof exam.exam_date === "string"
        ? exam.exam_date.split("T")[0]
        : new Date(exam.exam_date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );

  // Document / Reference Number (Top right field, like BSC-ODLF-017)
  const [documentReference, setDocumentReference] = useState<string>(
    exam.document_reference || "BSC-ODLF-017"
  );

  // 2. Assigned Subjects (Faculty's load)
  const effectiveAssignedSubjects = assignedSubjects.length > 0 ? assignedSubjects : courses;
  const [courseId, setCourseId] = useState<number>(exam.course_id || effectiveAssignedSubjects[0]?.course_id || 0);

  // Selected Course Object (for auto-populating course code and course title)
  const selectedCourse = effectiveAssignedSubjects.find(c => c.course_id === courseId)
    || courses.find(c => c.course_id === courseId)
    || exam.course
    || { course_id: courseId, course_code: "", course_title: "" };

  const dynamicDepartmentName = useMemo(() => {
    const code = (selectedCourse?.course_code || "").trim().toUpperCase();
    const title = (selectedCourse?.course_title || "").trim().toUpperCase();
    const progCode = (selectedCourse as any)?.programCode ? String((selectedCourse as any).programCode).trim().toUpperCase() : "";
    const deptRaw = (facultyDepartment || "").trim();

    // Specific sub-departments for courses with program chairs
    const isICT = code.startsWith("ITC") || code.startsWith("ITE") || code.startsWith("ITM") || code.startsWith("ITD") || code === "ENT 403" || code.includes("INFOTECH") || title.includes("COMPUTING") || title.includes("INFORMATION TECH") || progCode === "BSINFOTECH";
    if (isICT) return "INFORMATION AND COMMUNICATIONS TECHNOLOGY DEPARTMENT";

    const isIndustrialTech = code.startsWith("IND") || code.startsWith("BIT") || progCode === "BIT" || progCode === "BSINDTECH" || (code.startsWith("IT") && !isICT);
    if (isIndustrialTech) return "INDUSTRIAL TECHNOLOGY DEPARTMENT";

    const isTeacherEducation = code.startsWith("EDUC") || code.startsWith("BED") || code.startsWith("BSED") || code.startsWith("BEED") || title.includes("EDUCATION") || title.includes("TEACHING") || progCode === "BSED" || progCode === "BEED";
    if (isTeacherEducation) return "TEACHER EDUCATION DEPARTMENT";

    const isAgriculture = code.startsWith("AGRI") || title.includes("AGRICULTUR") || title.includes("FARM") || progCode === "BSA";
    if (isAgriculture) return "AGRICULTURE DEPARTMENT";

    const isHtm = code.startsWith("HTM") || code.startsWith("HM") || code.startsWith("TM") || title.includes("HOSPITALITY") || title.includes("TOURISM") || progCode === "BSHM" || progCode === "BSTM";
    if (isHtm) return "HOSPITALITY AND TOURISM MANAGEMENT DEPARTMENT";

    // Fallback to faculty raw department if present
    if (deptRaw) {
      const dLower = deptRaw.toLowerCase();
      if (dLower.includes("ict") || dLower.includes("information and communications")) return "INFORMATION AND COMMUNICATIONS TECHNOLOGY DEPARTMENT";
      if (dLower === "it department" || dLower.includes("industrial")) return "INDUSTRIAL TECHNOLOGY DEPARTMENT";
      if (dLower.includes("citd") || dLower.includes("computer and industrial")) return "COMPUTER AND INDUSTRIAL TECHNOLOGY DEPARTMENT";
      if (dLower.includes("agri")) return "AGRICULTURE DEPARTMENT";
      if (dLower.includes("teacher") || dLower.includes("ted") || dLower.includes("education")) return "TEACHER EDUCATION DEPARTMENT";
      if (dLower.includes("hospitality") || dLower.includes("tourism") || dLower.includes("htm")) return "HOSPITALITY AND TOURISM MANAGEMENT DEPARTMENT";
      if (dLower.includes("business") || dLower.includes("bsba")) return "BUSINESS ADMINISTRATION DEPARTMENT";
      
      if (deptRaw.toUpperCase().endsWith("DEPARTMENT")) {
        return deptRaw.toUpperCase();
      }
      return `${deptRaw.toUpperCase()} DEPARTMENT`;
    }

    return "ACADEMIC DEPARTMENT";
  }, [facultyDepartment, selectedCourse]);

  const hasProgramChair = useMemo(() => {
    const code = (selectedCourse?.course_code || "").trim().toUpperCase();
    const title = (selectedCourse?.course_title || "").trim().toUpperCase();
    const progCode = (selectedCourse as any)?.programCode ? String((selectedCourse as any).programCode).trim().toUpperCase() : "";

    // ICT (Information and Communications Technology / BSInfoTech)
    const isICT = code.startsWith("ITC") || code.startsWith("ITE") || code.startsWith("ITM") || code.startsWith("ITD") || code === "ENT 403" || code.includes("INFOTECH") || title.includes("COMPUTING") || title.includes("INFORMATION TECH") || progCode === "BSINFOTECH";

    // IT / Industrial Tech (Industrial Technology / BSIT / BIT / BSINDTECH)
    const isIndustrialTech = code.startsWith("IND") || code.startsWith("BIT") || progCode === "BIT" || progCode === "BSINDTECH" || (code.startsWith("IT") && !isICT);

    // TED (Teacher Education Department / BEED / BSED)
    const isTED = code.startsWith("EDUC") || progCode.includes("BSED") || progCode.includes("BEED") || progCode.includes("TED") || title.includes("EDUCATION");

    return isICT || isIndustrialTech || isTED;
  }, [selectedCourse]);

  const isProgChairAuthor = useMemo(() => {
    return userRole === "ProgramChair" || userRole === "Program Chair" || returnUrl === "/dashboard/chair";
  }, [userRole, returnUrl]);

  // Configuration Settings State - Title is auto-populated and not manually edited
  const defaultCourseTitleStr = selectedCourse?.course_title || selectedCourse?.course_code || "";
  const defaultExamTitle = defaultCourseTitleStr ? `${term} Examination in ${defaultCourseTitleStr}` : `${term} Examination`;
  const [title, setTitle] = useState<string>(
    exam.title && exam.title !== "New Examination Draft"
      ? exam.title
      : defaultExamTitle
  );
  const [timeLimit, setTimeLimit] = useState<number>(exam.time_limit_minutes);
  const [randomizeItems, setRandomizeItems] = useState<boolean>(exam.randomize_items);
  const [timePenalty, setTimePenalty] = useState<number>(exam.time_penalty_seconds ?? 60);
  const [scorePenalty, setScorePenalty] = useState<number>(exam.score_penalty_points ?? 2);

  // Signatory State for TOS Preview
  const initialFacName = (exam as any).faculty ? `${(exam as any).faculty.first_name || ""} ${(exam as any).faculty.last_name || ""}`.trim() : "";
  const [signatoryFacultyName, setSignatoryFacultyName] = useState<string>(initialFacName || "NAME OF FACULTY MEMBER");
  const [signatoryFacultyRank, setSignatoryFacultyRank] = useState<string>("Academic Rank/Designation");
  const [signatoryProgChairName, setSignatoryProgChairName] = useState<string>("NAME OF PROGRAM CHAIRPERSON");
  const [signatoryDeptChairName, setSignatoryDeptChairName] = useState<string>("NAME OF DEPARTMENT CHAIRPERSON");
  const [signatoryDirectorName, setSignatoryDirectorName] = useState<string>("NAME OF DIRECTOR FOR INSTRUCTION");
  const [signatoryLayoutMode, setSignatoryLayoutMode] = useState<"WITH_PC" | "WITHOUT_PC" | "PREPARED_BY_PC">("WITH_PC");

  // Editable Test Type Headers & Directions State
  const [customTypeTitles, setCustomTypeTitles] = useState<Record<string, string>>({});
  const [customDirections, setCustomDirections] = useState<Record<string, string>>({});

  // 3. Assigned Students Selection with Sort & Filter
  const [assignedStudents, setAssignedStudents] = useState<StudentItem[]>(initialAssignedStudents);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Filter & Sort State for Assigned Students
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [studentProgramFilter, setStudentProgramFilter] = useState<string>("ALL");
  const [studentMajorFilter, setStudentMajorFilter] = useState<string>("ALL");
  const [studentYearFilter, setStudentYearFilter] = useState<string>("ALL");
  const [studentSortBy, setStudentSortBy] = useState<"lastNameAsc" | "lastNameDesc" | "firstNameAsc" | "firstNameDesc" | "yearAsc" | "yearDesc" | "programAsc" | "majorAsc" | "majorDesc">("lastNameAsc");

  // Helper reference mapping for academic programs & departments
  const PROGRAM_REFERENCE_MAP: Record<string, { code: string; name: string; dept: string; majors?: string[] }> = useMemo(() => ({
    BSInfoTech: {
      code: "BSInfoTech",
      name: "Bachelor of Science in Information Technology",
      dept: "Computing and Industrial Technology Department (CITD)",
    },
    BSIT: {
      code: "BSIT",
      name: "Bachelor of Science in Industrial Technology",
      dept: "Computing and Industrial Technology Department (CITD)",
      majors: ["ARCHITECTURE TECHNOLOGY", "AUTOMOTIVE TECHNOLOGY", "ELECTRONICS TECHNOLOGY"],
    },
    BSA: {
      code: "BSA",
      name: "Bachelor of Science in Agriculture",
      dept: "Agriculture Department",
    },
    BEED: {
      code: "BEED",
      name: "Bachelor of Elementary Education",
      dept: "Teacher Education Department (TED)",
    },
    BSED: {
      code: "BSED",
      name: "Bachelor of Secondary Education",
      dept: "Teacher Education Department (TED)",
      majors: ["English", "Science", "Mathematics"],
    },
    BSHM: {
      code: "BSHM",
      name: "Bachelor of Science in Hospitality Management",
      dept: "HTM Department",
    },
    BSTM: {
      code: "BSTM",
      name: "Bachelor of Science in Tourism Management",
      dept: "HTM Department",
    },
  }), []);

  // Automatically determine the academic program based on assigned subject/course
  const determinedProgramInfo = useMemo(() => {
    const code = (selectedCourse?.course_code || "").trim().toUpperCase();
    const title = (selectedCourse?.course_title || "").trim().toUpperCase();

    // 1. BSInfoTech (Bachelor of Science in Information Technology) - CITD
    if (
      code.startsWith("ITC") || code.startsWith("ITE") || code.startsWith("ITM") || code.startsWith("ITD") ||
      code === "ENT 403" || code.includes("INFOTECH") || code === "BSINFOTECH" || title.includes("INFORMATION TECHNOLOGY") || title.includes("COMPUTING")
    ) {
      return PROGRAM_REFERENCE_MAP["BSInfoTech"];
    }

    // 2. BSIT (Bachelor of Science in Industrial Technology) - CITD
    if (
      code.startsWith("IND") || code.startsWith("BIT") || code === "BSIT" || code === "BSINDTECH" ||
      title.includes("INDUSTRIAL TECHNOLOGY") || title.includes("AUTOMOTIVE") || title.includes("ELECTRONICS") || title.includes("ARCHITECTURE")
    ) {
      return PROGRAM_REFERENCE_MAP["BSIT"];
    }

    // 3. BSA (Bachelor of Science in Agriculture) - AGRI
    if (
      code.startsWith("AGRI") || code.startsWith("AG EXT") || code.startsWith("AGB") || code.startsWith("AME") ||
      code.startsWith("ANSCI") || code.startsWith("CROP PROT") || code.startsWith("CROP SCI") || code.startsWith("SOIL SCI") ||
      code.startsWith("THESIS") || code === "PRACTICUM" || code.startsWith("SEM ") || code === "CA" || code === "BSA" || title.includes("AGRICULTURE")
    ) {
      return PROGRAM_REFERENCE_MAP["BSA"];
    }

    // 4. BEED (Bachelor of Elementary Education) - TED
    if (code.startsWith("BEED") || title.includes("ELEMENTARY EDUCATION")) {
      return PROGRAM_REFERENCE_MAP["BEED"];
    }

    // 5. BSED (Bachelor of Secondary Education) - TED
    if (code.startsWith("BSED") || title.includes("SECONDARY EDUCATION")) {
      return PROGRAM_REFERENCE_MAP["BSED"];
    }

    if (code.startsWith("EDUC") || title.includes("EDUCATION")) {
      const isSec = title.includes("SEC") || title.includes("SECONDARY");
      return isSec ? PROGRAM_REFERENCE_MAP["BSED"] : PROGRAM_REFERENCE_MAP["BEED"];
    }

    // 6. BSHM (Bachelor of Science in Hospitality Management) - HTM
    if (code.startsWith("HPC") || code.startsWith("HMPE") || code === "PRAC" || code === "BSHM" || title.includes("HOSPITALITY")) {
      return PROGRAM_REFERENCE_MAP["BSHM"];
    }

    // 7. BSTM (Bachelor of Science in Tourism Management) - HTM
    if (code.startsWith("TPC") || code.startsWith("TPE") || code.startsWith("ITRM") || code === "OJT" || code === "BSTM" || title.includes("TOURISM")) {
      return PROGRAM_REFERENCE_MAP["BSTM"];
    }

    // Fallback based on enrolled student program codes
    if (assignedStudents && assignedStudents.length > 0) {
      const studentProgs = Array.from(new Set(assignedStudents.map(s => s.program_code).filter(Boolean)));
      if (studentProgs.length > 0) {
        const pCode = studentProgs[0];
        if (PROGRAM_REFERENCE_MAP[pCode]) return PROGRAM_REFERENCE_MAP[pCode];
        if (pCode.toUpperCase() === "BSIT") return PROGRAM_REFERENCE_MAP["BSIT"];
        if (pCode.toUpperCase() === "BSINFOTECH") return PROGRAM_REFERENCE_MAP["BSInfoTech"];
      }
    }

    return PROGRAM_REFERENCE_MAP["BSInfoTech"];
  }, [selectedCourse, assignedStudents, PROGRAM_REFERENCE_MAP]);

  // Keep studentProgramFilter automatically synchronized to determined program code
  useEffect(() => {
    if (determinedProgramInfo?.code) {
      setStudentProgramFilter(determinedProgramInfo.code);
      setStudentMajorFilter("ALL");
    }
  }, [determinedProgramInfo]);

  const hasMajors = useMemo(() => {
    return Array.isArray(determinedProgramInfo.majors) && determinedProgramInfo.majors.length > 0;
  }, [determinedProgramInfo]);

  const availableStudentMajors = useMemo(() => {
    if (!hasMajors || !determinedProgramInfo.majors) return [];
    return determinedProgramInfo.majors;
  }, [determinedProgramInfo, hasMajors]);

  const availableStudentPrograms = useMemo(() => {
    return [determinedProgramInfo.code];
  }, [determinedProgramInfo]);

  const availableStudentYears = useMemo(() => {
    const defaultYears = [1, 2, 3, 4];
    const presentYears = assignedStudents.map(s => s.year_level).filter(Boolean);
    const set = new Set([...defaultYears, ...presentYears]);
    return Array.from(set).sort((a, b) => a - b);
  }, [assignedStudents]);

  const programLabel = useMemo(() => {
    return `Program: ${determinedProgramInfo.code} (${determinedProgramInfo.name})`;
  }, [determinedProgramInfo]);

  const yearLabel = useMemo(() => {
    const presentYears = Array.from(new Set(assignedStudents.map(s => s.year_level).filter(Boolean))).sort((a, b) => a - b);
    if (presentYears.length === 0) return "Year: N/A";
    if (presentYears.length === 1) return `Year: Year ${presentYears[0]}`;
    return `Year: Years ${presentYears.join(", ")}`;
  }, [assignedStudents]);

  const filteredAndSortedStudents = useMemo(() => {
    return assignedStudents
      .filter(s => {
        if (studentProgramFilter !== "ALL" && s.program_code !== studentProgramFilter) return false;
        if (hasMajors && studentMajorFilter !== "ALL" && (s.section || "General") !== studentMajorFilter) return false;
        if (studentYearFilter !== "ALL" && String(s.year_level) !== studentYearFilter) return false;
        if (studentSearch.trim()) {
          const q = studentSearch.toLowerCase();
          const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
          const instId = (s.institutional_id || "").toLowerCase();
          const sec = (s.section || "").toLowerCase();
          return fullName.includes(q) || instId.includes(q) || sec.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (studentSortBy === "lastNameAsc") {
          return a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
        } else if (studentSortBy === "lastNameDesc") {
          return b.last_name.localeCompare(a.last_name) || b.first_name.localeCompare(a.first_name);
        } else if (studentSortBy === "firstNameAsc") {
          return a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name);
        } else if (studentSortBy === "firstNameDesc") {
          return b.first_name.localeCompare(a.first_name) || b.last_name.localeCompare(a.last_name);
        } else if (studentSortBy === "yearAsc") {
          return (a.year_level - b.year_level) || a.last_name.localeCompare(b.last_name);
        } else if (studentSortBy === "yearDesc") {
          return (b.year_level - a.year_level) || a.last_name.localeCompare(b.last_name);
        } else if (studentSortBy === "programAsc") {
          return a.program_code.localeCompare(b.program_code) || a.last_name.localeCompare(b.last_name);
        } else if (studentSortBy === "majorAsc") {
          const mA = a.section || "";
          const mB = b.section || "";
          return mA.localeCompare(mB) || a.last_name.localeCompare(b.last_name);
        } else if (studentSortBy === "majorDesc") {
          const mA = a.section || "";
          const mB = b.section || "";
          return mB.localeCompare(mA) || a.last_name.localeCompare(b.last_name);
        }
        return 0;
      });
  }, [assignedStudents, studentSearch, studentProgramFilter, studentMajorFilter, studentYearFilter, studentSortBy, hasMajors]);

  // Automatically determine applicable semester based on exam date and active academic period configured by DI
  const defaultPeriodSettings = {
    active_academic_year: "2026-2027",
    active_semester: "1st Semester",
    sem1_start: "2026-08-01",
    sem1_end: "2026-12-31",
    sem2_start: "2027-01-01",
    sem2_end: "2027-05-31",
  };
  const activeSettings = academicPeriodSettings || defaultPeriodSettings;
  const determinedSemesterInfo = determineSemesterFromDate(examDate, activeSettings);
  const applicableSemester = determinedSemesterInfo.semester;
  const applicableAcademicYear = determinedSemesterInfo.academicYear;
  const applicableSemesterLabel = determinedSemesterInfo.label;

  const handleCourseChange = async (newId: number) => {
    setCourseId(newId);
    const newCourse = effectiveAssignedSubjects.find(c => c.course_id === newId) || courses.find(c => c.course_id === newId);
    let newTitle = title;
    if (newCourse) {
      newTitle = `${term} Examination in ${newCourse.course_title || newCourse.course_code}`;
      setTitle(newTitle);
    }
    
    setLoadingStudents(true);
    setSaveStatus({ type: "saving", message: "Auto-saving subject selection and updating title..." });

    try {
      const res = await getAssignedStudentsForCourse(newId);
      let newStudentIds: number[] = [];
      if (res.success && res.students) {
        setAssignedStudents(res.students);
        newStudentIds = [];
        setSelectedStudentIds([]);
      }

      // Auto-save updated subject & title configuration to DB immediately
      const configData = new FormData();
      configData.append("examId", String(exam.exam_id));
      configData.append("facultyId", String(facultyId));
      configData.append("title", newTitle);
      configData.append("courseId", String(newId));
      configData.append("timeLimitMinutes", String(timeLimit));
      configData.append("randomizeItems", String(randomizeItems));
      configData.append("timePenaltySeconds", String(timePenalty));
      configData.append("scorePenaltyPoints", String(scorePenalty));
      configData.append("term", term);
      configData.append("examDate", examDate);
      configData.append("semester", applicableSemester);
      configData.append("academicYear", applicableAcademicYear);
      configData.append("documentReference", documentReference);
      configData.append("selectedStudentIds", JSON.stringify(newStudentIds));

      const tosPayload = {
        targetTotalItems: tosTargetTotalItems,
        topicPlans: tosTopicPlans,
        learningOutcomes: learningOutcomes,
      };
      configData.append("tosDataJson", JSON.stringify(tosPayload));

      const configRes = await saveExamConfig(configData);
      const sortedQs = sortQuestionsByType(questions);
      const serializedQs = serializeQuestions(sortedQs);
      const questionsRes = await saveExamQuestions(exam.exam_id, serializedQs, facultyId);

      if (configRes.error || questionsRes.error) {
        setSaveStatus({ type: "error", message: `Auto-save Error: ${configRes.error || questionsRes.error}` });
      } else {
        setSaveStatus({ type: "success", message: `Subject updated & auto-saved as draft (${newCourse?.course_code || "Subject"})!` });
        setTimeout(() => setSaveStatus(null), 3000);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to load students and auto-save course:", err);
      setSaveStatus({ type: "error", message: "Failed to auto-save subject selection." });
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleToggleStudent = (studentId: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Select all students currently matching active search, filters, or sorting
  const handleSelectAllStudents = () => {
    const filteredIds = filteredAndSortedStudents.map(s => s.student_id);
    setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  // Deselect all students currently matching active search, filters, or sorting
  const handleDeselectAllStudents = () => {
    const filteredIdsSet = new Set(filteredAndSortedStudents.map(s => s.student_id));
    setSelectedStudentIds(prev => prev.filter(id => !filteredIdsSet.has(id)));
  };

  // Question Bank State - Automatically sorted by Question Type order
  const [questions, setQuestions] = useState<QuestionState[]>(() => {
    const loaded = sortQuestionsByType(deserializeQuestions(exam.questionBank));
    return loaded.map(q => {
      let cleanText = q.text || "";
      if (cleanText.match(/^\[Item \d+\]\s*(Multiple Choice Question for.*)?$/i)) {
        cleanText = "";
      } else if (cleanText.startsWith("[Item ")) {
        cleanText = cleanText.replace(/^\[Item \d+\]\s*/i, "");
      }
      return {
        ...q,
        text: cleanText,
      };
    });
  });
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(
    exam.questionBank.length > 0 ? 0 : -1
  );

  // Topic Accordion Dropdown Open/Closed State (Minimized by default)
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

  // Interactive Popup Modal State for Submission & Save Draft feedback
  interface ModalState {
    isOpen: boolean;
    type: "success" | "error" | "warning" | "save_draft";
    title: string;
    message: string;
    details?: string[];
    onConfirm?: () => void;
    confirmText?: string;
  }
  const [popupModal, setPopupModal] = useState<ModalState | null>(null);

  // Comprehensive examination question completeness validator
  const validateExamQuestions = (): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    if (!questions || questions.length === 0) {
      issues.push("No questions found in this examination.");
      return { valid: false, issues };
    }

    questions.forEach((q, idx) => {
      const itemNum = idx + 1;
      if (!q.text || q.text.trim() === "") {
        issues.push(`Item #${itemNum}: Question text prompt is empty.`);
      }

      if (q.question_type === "Multiple_Choice") {
        if (!q.options || q.options.length < 2) {
          issues.push(`Item #${itemNum}: Multiple Choice question requires at least 2 options.`);
        } else if (q.options.some(opt => !opt || opt.trim() === "")) {
          issues.push(`Item #${itemNum}: One or more Multiple Choice options are blank.`);
        }
        if (!q.correctAnswer || q.correctAnswer.trim() === "") {
          issues.push(`Item #${itemNum}: Answer Key / Correct Option is not selected.`);
        }
      } else if (q.question_type === "True_False") {
        if (q.correctAnswer !== "True" && q.correctAnswer !== "False") {
          issues.push(`Item #${itemNum}: True or False answer key is not selected.`);
        }
      } else if (q.question_type === "Identification") {
        if (!q.correctAnswer || q.correctAnswer.trim() === "") {
          issues.push(`Item #${itemNum}: Identification answer key is blank.`);
        }
      } else if (q.question_type === "Fill_In_The_Blanks") {
        if (!q.blanks || q.blanks.length === 0) {
          issues.push(`Item #${itemNum}: No blanks configured for Fill in the Blanks question.`);
        } else if (q.blanks.some(b => !b.answer || b.answer.trim() === "")) {
          issues.push(`Item #${itemNum}: One or more blank answer keys are left empty.`);
        }
      } else if (q.question_type === "Matching_Type") {
        if (!q.matches || q.matches.length === 0) {
          issues.push(`Item #${itemNum}: Matching Type table has no rows.`);
        } else if (q.matches.some(m => !m.premise || !m.choice || !m.premise.trim() || !m.choice.trim())) {
          issues.push(`Item #${itemNum}: Matching Type row contains blank premises or choices.`);
        }
      }
    });

    return { valid: issues.length === 0, issues };
  };

  const toggleTopicOpen = (topicName: string) => {
    setOpenTopics(prev => ({
      ...prev,
      [topicName]: !prev[topicName]
    }));
  };

  // Step 3 TQ & TOS Preview State
  const [previewTab, setPreviewTab] = useState<"exam" | "tos">("exam");
  const [previewViewMode, setPreviewViewMode] = useState<"paper" | "grouped">("paper");
  const [previewTopicFilter, setPreviewTopicFilter] = useState<string>("ALL");
  const [printMode, setPrintMode] = useState<"all" | "tos" | "exam">("all");

  const handlePrintTos = () => {
    setPrintMode("tos");
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintExam = () => {
    setPrintMode("exam");
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintAll = () => {
    setPrintMode("all");
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Helper to format Multiple Choice Answer Key representation
  const formatMcCorrectAnswer = (options: string[] | undefined, correctAnswer: string | undefined): string => {
    if (!correctAnswer) return "Not specified";
    if (!options || options.length === 0) return correctAnswer;
    const matchIdx = options.findIndex(opt => opt === correctAnswer || opt.trim().toLowerCase() === correctAnswer.trim().toLowerCase());
    if (matchIdx !== -1) {
      const letter = String.fromCharCode(65 + matchIdx);
      return `Option ${letter} (${options[matchIdx]})`;
    }
    return correctAnswer;
  };

  // Dynamic Map of active question types to sequential 1-indexed Test Part numbers (Test 1, Test 2, etc.)
  const questionTypeTestMap = useMemo(() => {
    const activeTypes = [
      "Multiple_Choice",
      "Identification",
      "True_False",
      "Fill_In_The_Blanks",
      "Matching_Type",
      "Essay"
    ].filter(type => questions.some(q => q.question_type === type));

    const typeToTestNum: Record<string, number> = {};
    const typeToTestBadge: Record<string, string> = {};
    const typeToItemNumbers: Record<string, number[]> = {};

    activeTypes.forEach((type, idx) => {
      const testNum = idx + 1; // 1-indexed strictly sequential without gaps (Test 1, Test 2, Test 3...)
      typeToTestNum[type] = testNum;
      typeToTestBadge[type] = `Test ${testNum}`;
    });

    questions.forEach((q, idx) => {
      const itemNum = idx + 1;
      if (!typeToItemNumbers[q.question_type]) {
        typeToItemNumbers[q.question_type] = [];
      }
      typeToItemNumbers[q.question_type].push(itemNum);
    });

    return {
      activeTypes,
      typeToTestNum,
      typeToTestBadge,
      typeToItemNumbers
    };
  }, [questions]);

  // Per-question map to track dynamic Test Part number & item index within that Test Part
  const questionTestInfoMap = useMemo(() => {
    const typeCounters: Record<string, number> = {};
    return questions.map(q => {
      const qType = q.question_type;
      typeCounters[qType] = (typeCounters[qType] || 0) + 1;
      const testNum = questionTypeTestMap.typeToTestNum[qType] || 1;
      const testItemNum = typeCounters[qType];
      return {
        testNum,
        testItemNum,
        label: `Test ${testNum}, Item ${testItemNum}`,
        badge: `Test ${testNum} • Item ${testItemNum}`
      };
    });
  }, [questions, questionTypeTestMap]);

  // Format 1-indexed item numbers into human-readable placement ranges taking dynamic Test Parts & Test Item Numbers into account
  const formatTopicPlacementString = (numbers: number[]): string => {
    if (!numbers || numbers.length === 0) return "No items";
    const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b);

    // Group items by dynamic test number using their Test Item Number
    const testGroups: Record<number, number[]> = {};
    sorted.forEach(itemNum => {
      const info = questionTestInfoMap[itemNum - 1];
      if (!info) return;
      const testNum = info.testNum;
      const testItemNum = info.testItemNum;
      if (!testGroups[testNum]) testGroups[testNum] = [];
      testGroups[testNum].push(testItemNum);
    });

    const groupKeys = Object.keys(testGroups).map(Number).sort((a, b) => a - b);
    if (groupKeys.length === 0) return "No items";

    const parts: string[] = [];
    groupKeys.forEach(testNum => {
      const items = testGroups[testNum].sort((a, b) => a - b);
      const ranges: string[] = [];
      let start = items[0];
      let end = items[0];

      for (let i = 1; i < items.length; i++) {
        if (items[i] === end + 1) {
          end = items[i];
        } else {
          ranges.push(start === end ? `${start}` : `${start}–${end}`);
          start = items[i];
          end = items[i];
        }
      }
      ranges.push(start === end ? `${start}` : `${start}–${end}`);

      const rangeText = ranges.length === 1 && items.length === 1
        ? `item ${ranges[0]}`
        : `items ${ranges.join(", ")}`;

      parts.push(`Test ${testNum} - ${rangeText}`);
    });

    return parts.join("; ");
  };

  // Native TOS Topic Alignment & Hours Allocation Calculator State
  // Helper to parse stored TOS JSON data if present
  const parsedTosData = useMemo(() => {
    if (exam.tos_file_path && exam.tos_file_path.trim().startsWith("{")) {
      try {
        return JSON.parse(exam.tos_file_path);
      } catch {}
    }
    return null;
  }, [exam.tos_file_path]);

  const [tosTargetTotalItems, setTosTargetTotalItems] = useState<number>(
    parsedTosData?.targetTotalItems || (exam.questionBank.length > 0 ? exam.questionBank.length : 50)
  );

  const [tosTopicPlans, setTosTopicPlans] = useState<Array<{ id: string; topic: string; hours: number }>>(() => {
    if (parsedTosData?.topicPlans && Array.isArray(parsedTosData.topicPlans) && parsedTosData.topicPlans.length > 0) {
      return parsedTosData.topicPlans.map((p: any) => ({
        ...p,
        hours: Math.max(1, Math.round(p.hours || 1))
      }));
    }
    const uniqueFromQuestions = Array.from(new Set(exam.questionBank.map(q => q.topic?.trim()).filter(Boolean))) as string[];
    if (uniqueFromQuestions.length > 0) {
      return uniqueFromQuestions.map((t, idx) => ({
        id: String(idx + 1),
        topic: t,
        hours: 6,
      }));
    }
    return [];
  });

  // Editable Learning Outcomes map per topic
  const [learningOutcomes, setLearningOutcomes] = useState<Record<string, string>>(
    parsedTosData?.learningOutcomes || {}
  );

  const handleUpdateLearningOutcome = (topicName: string, text: string) => {
    setLearningOutcomes(prev => ({
      ...prev,
      [topicName]: text
    }));
  };

  // Dynamically calculate TOS Topic statistics, hours taught, percentage & item placement ranges
  const tosTopicBreakdown = useMemo(() => {
    const map: Record<string, { itemNumbers: number[]; totalPoints: number }> = {};
    const totalExamPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const totalExamItems = questions.length;

    // Build map of hours from tosTopicPlans
    const planTopicsMap = new Map<string, number>();
    tosTopicPlans.forEach(p => {
      if (p.topic && p.topic.trim()) {
        planTopicsMap.set(p.topic.trim(), p.hours || 0);
      }
    });

    questions.forEach((q, idx) => {
      const topicName = (q.topic && q.topic.trim() !== "") ? q.topic.trim() : "Unassigned Topic";
      if (!map[topicName]) {
        map[topicName] = { itemNumbers: [], totalPoints: 0 };
      }
      map[topicName].itemNumbers.push(idx + 1);
      map[topicName].totalPoints += (q.points || 1);
    });

    const combinedTopics = Array.from(new Set([...Array.from(planTopicsMap.keys()), ...Object.keys(map)]));

    const totalHoursTaught = Array.from(planTopicsMap.values()).reduce((sum, h) => sum + h, 0);

    return combinedTopics.map(topic => {
      const data = map[topic] || { itemNumbers: [], totalPoints: 0 };
      const count = data.itemNumbers.length;
      const hoursTaught = planTopicsMap.get(topic) ?? 0;

      let weightPercentage = 0;
      if (totalHoursTaught > 0 && hoursTaught > 0) {
        weightPercentage = Number(((hoursTaught / totalHoursTaught) * 100).toFixed(1));
      } else if (totalExamItems > 0 && count > 0) {
        weightPercentage = Number(((count / totalExamItems) * 100).toFixed(1));
      }

      const rangeString = formatTopicPlacementString(data.itemNumbers);

      // Questions belonging to this topic for Taxonomy calculation
      const topicQs = questions.filter(q => (q.topic?.trim() || "Unassigned Topic") === topic);
      
      const rememberingCount = topicQs.filter(q => {
        const tax = (q.taxonomy_level || "KNOWLEDGE / REMEMBERING").toUpperCase();
        return tax.includes("REMEMBERING") || tax.includes("KNOWLEDGE");
      }).length;

      const understandingCount = topicQs.filter(q => {
        const tax = (q.taxonomy_level || "").toUpperCase();
        return tax.includes("UNDERSTANDING") || tax.includes("COMPREHENSION");
      }).length;

      const applyingCount = topicQs.filter(q => {
        const tax = (q.taxonomy_level || "").toUpperCase();
        return tax.includes("APPLYING") || tax.includes("APPLICATION");
      }).length;

      const analyzingCount = topicQs.filter(q => {
        const tax = (q.taxonomy_level || "").toUpperCase();
        return tax.includes("ANALYZING") || tax.includes("ANALYSIS");
      }).length;

      const evaluatingCount = topicQs.filter(q => {
        const tax = (q.taxonomy_level || "").toUpperCase();
        return tax.includes("EVALUATING") || tax.includes("SYNTHESIS");
      }).length;

      const creatingCount = topicQs.filter(q => {
        const tax = (q.taxonomy_level || "").toUpperCase();
        return tax.includes("CREATING") || tax.includes("EVALUATION");
      }).length;

      const rememberingPercent = totalExamItems > 0 ? Number(((rememberingCount / totalExamItems) * 100).toFixed(1)) : 0;
      const understandingPercent = totalExamItems > 0 ? Number(((understandingCount / totalExamItems) * 100).toFixed(1)) : 0;
      const applyingPercent = totalExamItems > 0 ? Number(((applyingCount / totalExamItems) * 100).toFixed(1)) : 0;
      const analyzingPercent = totalExamItems > 0 ? Number(((analyzingCount / totalExamItems) * 100).toFixed(1)) : 0;
      const evaluatingPercent = totalExamItems > 0 ? Number(((evaluatingCount / totalExamItems) * 100).toFixed(1)) : 0;
      const creatingPercent = totalExamItems > 0 ? Number(((creatingCount / totalExamItems) * 100).toFixed(1)) : 0;

      return {
        topic,
        hoursTaught,
        itemNumbers: data.itemNumbers,
        rangeString,
        count,
        totalPoints: data.totalPoints,
        weightPercentage,
        taxonomy: {
          remembering: { count: rememberingCount, percent: rememberingPercent },
          understanding: { count: understandingCount, percent: understandingPercent },
          applying: { count: applyingCount, percent: applyingPercent },
          analyzing: { count: analyzingCount, percent: analyzingPercent },
          evaluating: { count: evaluatingCount, percent: evaluatingPercent },
          creating: { count: creatingCount, percent: creatingPercent },
        }
      };
    });
  }, [questions, tosTopicPlans]);
  // Multi-page A4 Landscape TOS document pagination calculator
  const tosPages = useMemo(() => {
    const pages: Array<typeof tosTopicBreakdown> = [];
    let currentPage: typeof tosTopicBreakdown = [];
    let currentLines = 0;
    const MAX_PAGE_1_LINES = 7;
    const MAX_PAGE_N_LINES = 10;

    tosTopicBreakdown.forEach((row) => {
      const outcomeText = learningOutcomes[row.topic] ?? `Demonstrates competency and learning outcomes for ${row.topic.toLowerCase()}.`;
      const estimatedLines = Math.max(1, Math.ceil(outcomeText.length / 38));
      const capacity = pages.length === 0 ? MAX_PAGE_1_LINES : MAX_PAGE_N_LINES;

      if (currentLines + estimatedLines > capacity && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [row];
        currentLines = estimatedLines;
      } else {
        currentPage.push(row);
        currentLines += estimatedLines;
      }
    });

    if (currentPage.length > 0 || pages.length === 0) {
      pages.push(currentPage);
    }

    return pages;
  }, [tosTopicBreakdown, learningOutcomes]);

  // Calculated overall percentage breakdown per taxonomy level for TOS header sub-row
  const overallTaxonomyPercents = useMemo(() => {
    const totalExamItems = questions.length;
    if (totalExamItems === 0) {
      return { remembering: 0, understanding: 0, applying: 0, analyzing: 0, evaluating: 0, creating: 0 };
    }
    const remCount = tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.remembering.count, 0);
    const undCount = tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.understanding.count, 0);
    const appCount = tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.applying.count, 0);
    const anaCount = tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.analyzing.count, 0);
    const evaCount = tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.evaluating.count, 0);
    const creCount = tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.creating.count, 0);

    return {
      remembering: Number(((remCount / totalExamItems) * 100).toFixed(1)),
      understanding: Number(((undCount / totalExamItems) * 100).toFixed(1)),
      applying: Number(((appCount / totalExamItems) * 100).toFixed(1)),
      analyzing: Number(((anaCount / totalExamItems) * 100).toFixed(1)),
      evaluating: Number(((evaCount / totalExamItems) * 100).toFixed(1)),
      creating: Number(((creCount / totalExamItems) * 100).toFixed(1)),
    };
  }, [questions, tosTopicBreakdown]);

  // Multi-page A4 Preview pagination calculator
  const previewPages = useMemo(() => {
    interface PreviewBlock {
      id: string;
      type: "type-header" | "chapter-header" | "question-item";
      qType?: string;
      testNum?: number;
      count?: number;
      points?: number;
      topicName?: string;
      rangeStr?: string;
      q?: QuestionState;
      idx?: number;
      itemNumberLabel?: number;
      testInfo?: { testNum: number; testItemNum: number; badge: string };
      height: number;
    }

    function getItemEstimatedHeight(q: QuestionState): number {
      let h = 50;
      if (q.text && q.text.length > 100) h += 30;
      if (q.image_url) h += 120;
      if (q.question_type === "Multiple_Choice") h += 70;
      else if (q.question_type === "True_False") h += 35;
      else if (q.question_type === "Identification") h += 40;
      else if (q.question_type === "Matching_Type") h += 170;
      else if (q.question_type === "Essay") h += 90;
      else if (q.question_type === "Fill_In_The_Blanks") h += 50;
      return h;
    }

    const blocks: PreviewBlock[] = [];

    if (previewViewMode === "paper") {
      questionTypeTestMap.activeTypes.forEach((qType) => {
        const testNum = questionTypeTestMap.typeToTestNum[qType];
        const typeQuestions = questions
          .map((q, idx) => ({ q, idx }))
          .filter(
            ({ q }) =>
              q.question_type === qType &&
              (previewTopicFilter === "ALL" || (q.topic?.trim() || "Unassigned Topic") === previewTopicFilter)
          );

        if (typeQuestions.length === 0) return;

        const totalTypePoints = typeQuestions.reduce((sum, { q }) => sum + (q.points || 1), 0);

        blocks.push({
          id: `header-type-${qType}`,
          type: "type-header",
          qType,
          testNum,
          count: typeQuestions.length,
          points: totalTypePoints,
          height: 55,
        });

        typeQuestions.forEach(({ q, idx }, subIdx) => {
          const testInfo = questionTestInfoMap[idx];
          const itemNumberLabel = testInfo?.testItemNum || subIdx + 1;
          blocks.push({
            id: `q-${idx}`,
            type: "question-item",
            q,
            idx,
            itemNumberLabel,
            testInfo,
            height: getItemEstimatedHeight(q),
          });
        });
      });
    } else {
      const grouped = questions.reduce<Record<string, { q: QuestionState; origIdx: number }[]>>((acc, q, idx) => {
        const t = q.topic?.trim() || "Unassigned Topic";
        if (!acc[t]) acc[t] = [];
        acc[t].push({ q, origIdx: idx });
        return acc;
      }, {});

      Object.entries(grouped)
        .filter(([tName]) => previewTopicFilter === "ALL" || tName === previewTopicFilter)
        .forEach(([topicName, groupItems], gIdx) => {
          const itemNumbers = groupItems.map((gi) => gi.origIdx + 1);
          const groupPoints = groupItems.reduce((sum, gi) => sum + (gi.q.points || 1), 0);
          const rangeStr = formatTopicPlacementString(itemNumbers);

          blocks.push({
            id: `header-chapter-${gIdx}`,
            type: "chapter-header",
            topicName,
            rangeStr,
            count: groupItems.length,
            points: groupPoints,
            height: 55,
          });

          groupItems.forEach(({ q, origIdx }) => {
            const testInfo = questionTestInfoMap[origIdx];
            blocks.push({
              id: `q-${origIdx}`,
              type: "question-item",
              q,
              idx: origIdx,
              itemNumberLabel: origIdx + 1,
              testInfo,
              height: getItemEstimatedHeight(q),
            });
          });
        });
    }

    const pages: PreviewBlock[][] = [];
    let currentPage: PreviewBlock[] = [];
    let currentHeight = 0;
    const PAGE_1_CAPACITY = 680;
    const PAGE_N_CAPACITY = 850;

    blocks.forEach((block) => {
      const capacity = pages.length === 0 ? PAGE_1_CAPACITY : PAGE_N_CAPACITY;
      if (currentHeight + block.height > capacity && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [block];
        currentHeight = block.height;
      } else {
        currentPage.push(block);
        currentHeight += block.height;
      }
    });

    if (currentPage.length > 0 || pages.length === 0) {
      pages.push(currentPage);
    }

    return pages;
  }, [questions, previewViewMode, previewTopicFilter, questionTypeTestMap, questionTestInfoMap, formatTopicPlacementString]);

  const [newTopicName, setNewTopicName] = useState<string>("");
  const [newTopicHours, setNewTopicHours] = useState<string>("4");
  const [tosNotification, setTosNotification] = useState<string | null>(null);

  // Auto-calculated TOS Percentage and Items per topic based on faculty hours taught
  const tosDistribution = useMemo(() => {
    const totalHours = tosTopicPlans.reduce((sum, t) => sum + (t.hours || 0), 0);
    const targetItems = Math.max(1, Number(tosTargetTotalItems) || 50);

    if (totalHours <= 0) {
      return tosTopicPlans.map((t, idx) => ({
        ...t,
        percentage: 0,
        calculatedItems: 0,
        itemRange: `Test ${idx + 1} - No items`,
      }));
    }

    // 1. Raw exact items & percentage calculation
    const raw = tosTopicPlans.map(t => {
      const pct = ((t.hours || 0) / totalHours) * 100;
      const exactItems = ((t.hours || 0) / totalHours) * targetItems;
      const roundedItems = Math.round(exactItems);
      return {
        ...t,
        percentage: pct,
        exactItems,
        roundedItems,
      };
    });

    // 2. Adjust sum to match targetItems exactly
    let currentSum = raw.reduce((sum, r) => sum + r.roundedItems, 0);
    let diff = targetItems - currentSum;
    const adjusted = raw.map(r => ({ ...r, count: r.roundedItems }));

    if (diff !== 0 && adjusted.length > 0) {
      const remainders = raw.map((r, idx) => ({
        idx,
        rem: r.exactItems - r.roundedItems,
      }));

      if (diff > 0) {
        remainders.sort((a, b) => b.rem - a.rem);
        for (let i = 0; i < diff; i++) {
          adjusted[remainders[i % remainders.length].idx].count += 1;
        }
      } else if (diff < 0) {
        remainders.sort((a, b) => a.rem - b.rem);
        for (let i = 0; i < Math.abs(diff); i++) {
          const targetIdx = remainders[i % remainders.length].idx;
          if (adjusted[targetIdx].count > 0) {
            adjusted[targetIdx].count -= 1;
          }
        }
      }
    }

    // 3. Generate suggested item ranges
    let currentStart = 1;
    return adjusted.map((item, idx) => {
      const count = Math.max(0, item.count);
      let itemRange = `Test ${idx + 1} - No items`;
      if (count === 1) {
        itemRange = `Test ${idx + 1} - item ${currentStart}`;
        currentStart += 1;
      } else if (count > 1) {
        const end = currentStart + count - 1;
        itemRange = `Test ${idx + 1} - items ${currentStart}–${end}`;
        currentStart = end + 1;
      }

      return {
        id: item.id,
        topic: item.topic,
        hours: item.hours,
        percentage: Number(item.percentage.toFixed(1)),
        calculatedItems: count,
        itemRange,
      };
    });
  }, [tosTopicPlans, tosTargetTotalItems]);

  const totalTosHours = useMemo(() => {
    return Math.round(tosTopicPlans.reduce((sum, t) => sum + (t.hours || 0), 0));
  }, [tosTopicPlans]);

  const totalCalculatedTosItems = useMemo(() => {
    return tosDistribution.reduce((sum, t) => sum + t.calculatedItems, 0);
  }, [tosDistribution]);

  // Real-time background auto-save helper & debounced effect
  const isInitialMount = useRef<boolean>(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const autoSaveExamData = async (
    qsToSave: QuestionState[] = questions,
    plansToSave = tosTopicPlans,
    targetItemsToSave = tosTargetTotalItems,
    outcomesToSave = learningOutcomes
  ) => {
    try {
      setAutoSaveStatus("saving");

      const configData = new FormData();
      configData.append("examId", String(exam.exam_id));
      configData.append("facultyId", String(facultyId));
      configData.append("title", title);
      configData.append("courseId", String(courseId));
      configData.append("timeLimitMinutes", String(timeLimit));
      configData.append("randomizeItems", String(randomizeItems));
      configData.append("timePenaltySeconds", String(timePenalty));
      configData.append("scorePenaltyPoints", String(scorePenalty));
      configData.append("term", term);
      configData.append("examDate", examDate);
      configData.append("semester", applicableSemester);
      configData.append("academicYear", applicableAcademicYear);
      configData.append("documentReference", documentReference);
      configData.append("selectedStudentIds", JSON.stringify(selectedStudentIds));

      const tosPayload = {
        targetTotalItems: targetItemsToSave,
        topicPlans: plansToSave,
        learningOutcomes: outcomesToSave,
      };
      configData.append("tosDataJson", JSON.stringify(tosPayload));

      const configRes = await saveExamConfig(configData);

      const sortedQs = sortQuestionsByType(qsToSave);
      const serializedQs = serializeQuestions(sortedQs);
      const questionsRes = await saveExamQuestions(exam.exam_id, serializedQs, facultyId);

      if (!configRes.error && !questionsRes.error) {
        setAutoSaveStatus("saved");
        const now = new Date();
        setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        router.refresh();
        return { success: true };
      } else {
        setAutoSaveStatus("error");
        return { error: configRes.error || questionsRes.error };
      }
    } catch (err: any) {
      console.error("Auto save failed:", err);
      setAutoSaveStatus("error");
      return { error: err.message || "Auto-save failed" };
    }
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      autoSaveExamData();
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    questions,
    tosTopicPlans,
    tosTargetTotalItems,
    learningOutcomes,
    title,
    timeLimit,
    randomizeItems,
    timePenalty,
    scorePenalty,
    examDate,
    term,
    documentReference,
    selectedStudentIds
  ]);

  const handleAddTosTopic = () => {
    if (!newTopicName.trim()) return;
    const hrs = Math.max(1, Math.round(parseFloat(newTopicHours) || 1));
    const newEntry = {
      id: Date.now().toString(),
      topic: newTopicName.trim(),
      hours: hrs,
    };
    const updatedPlans = [...tosTopicPlans, newEntry];
    setTosTopicPlans(updatedPlans);
    setNewTopicName("");
    setNewTopicHours("4");
    setTosNotification(`Added "${newEntry.topic}" (${hrs} hrs) to TOS Alignment Matrix.`);
    setTimeout(() => setTosNotification(null), 4000);
    autoSaveExamData(questions, updatedPlans);
  };

  const handleUpdateTosTopic = (id: string, updatedName: string, updatedHours: number) => {
    const cleanHours = Math.max(1, Math.round(updatedHours));
    const updatedPlans = tosTopicPlans.map(t => (t.id === id ? { ...t, topic: updatedName, hours: cleanHours } : t));
    setTosTopicPlans(updatedPlans);
    autoSaveExamData(questions, updatedPlans);
  };

  const handleDeleteTosTopic = (id: string) => {
    const updatedPlans = tosTopicPlans.filter(t => t.id !== id);
    setTosTopicPlans(updatedPlans);
    autoSaveExamData(questions, updatedPlans);
  };

  const syncQuestionsWithTos = () => {
    if (tosDistribution.length === 0) return;

    const existingByTopic: Record<string, QuestionState[]> = {};
    questions.forEach(q => {
      const t = q.topic?.trim() || "__UNASSIGNED__";
      if (!existingByTopic[t]) existingByTopic[t] = [];
      existingByTopic[t].push(q);
    });

    const newQuestionList: QuestionState[] = [];
    let globalItemNum = 1;

    tosDistribution.forEach(dist => {
      const topicName = dist.topic;
      const targetCount = dist.calculatedItems;
      const existingForThisTopic = existingByTopic[topicName] || [];

      for (let i = 0; i < targetCount; i++) {
        if (i < existingForThisTopic.length) {
          const existingQ = existingForThisTopic[i];
          let cleanText = existingQ.text || "";
          if (cleanText.match(/^\[Item \d+\]\s*(Multiple Choice Question for.*)?$/i)) {
            cleanText = "";
          } else if (cleanText.startsWith("[Item ")) {
            cleanText = cleanText.replace(/^\[Item \d+\]\s*/i, "");
          }
          newQuestionList.push({
            ...existingQ,
            text: cleanText,
            topic: topicName,
          });
        } else {
          newQuestionList.push({
            text: "",
            question_type: "Multiple_Choice",
            options: ["", "", "", ""],
            correctAnswer: "",
            premises: [],
            matches: [],
            blanks: [],
            points: 1,
            topic: topicName,
          });
        }
        globalItemNum++;
      }
    });

    const sortedNew = sortQuestionsByType(newQuestionList);
    setQuestions(sortedNew);
    if (activeQuestionIdx === -1 && sortedNew.length > 0) {
      setActiveQuestionIdx(0);
    }
    return sortedNew;
  };

  const handleApplyTosToQuestions = () => {
    const sortedNew = syncQuestionsWithTos();
    setTosNotification(`Synchronized ${tosTargetTotalItems} exam items mapped to your TOS topics!`);
    setTimeout(() => setTosNotification(null), 4000);
    if (sortedNew) {
      autoSaveExamData(sortedNew, tosTopicPlans);
    }
  };



  const handleQuestionTypeChange = (newType: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type" | "Essay" | "Fill_In_The_Blanks", targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    const currentQ = updated[targetIdx];
    const q: QuestionState = {
      ...currentQ,
      question_type: newType,
    };

    if (newType === "Multiple_Choice") {
      if (!q.options || q.options.length === 0) {
        q.options = ["", "", "", ""];
      }
      if (!q.correctAnswer) {
        q.correctAnswer = "";
      }
    } else if (newType === "True_False") {
      if (q.correctAnswer !== "True" && q.correctAnswer !== "False") {
        q.correctAnswer = "True";
      }
    } else if (newType === "Identification") {
      q.correctAnswer = cleanCorrectAnswer(q.correctAnswer);
    } else if (newType === "Matching_Type") {
      if (!q.matches || q.matches.length === 0) {
        q.matches = [
          { premise: "", choice: "" },
          { premise: "", choice: "" },
        ];
      }
    } else if (newType === "Essay") {
      if (!q.min_words) q.min_words = 50;
      if (q.text && (q.text.startsWith("[Item ") || q.text.includes("Discuss in detail"))) {
        q.text = "";
      }
      if (q.points === 1) q.points = 5;
    } else if (newType === "Fill_In_The_Blanks") {
      if (!q.blanks) {
        q.blanks = [];
      }
      if (q.text && (q.text.startsWith("[Item ") || q.text.includes("The core concept"))) {
        q.text = "";
      }
    }

    updated[targetIdx] = q;
    setQuestions(updated);
  };

  const existingUniqueTopics = useMemo(() => {
    const fromPlans = tosTopicPlans.map(p => p.topic.trim()).filter(Boolean);
    const fromQuestions = questions.map(q => q.topic?.trim()).filter(Boolean) as string[];
    return Array.from(new Set([...fromPlans, ...fromQuestions]));
  }, [tosTopicPlans, questions]);



  // Notification Toast / Save Status
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error" | "saving"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // TOS PDF Upload State & Input Refs
  const [tosFilePath, setTosFilePath] = useState<string>(exam.tos_file_path || "");
  const [uploadingTos, setUploadingTos] = useState<boolean>(false);
  const tosHeaderInputRef = useRef<HTMLInputElement | null>(null);
  const tosFooterInputRef = useRef<HTMLInputElement | null>(null);
  const tosStep1InputRef = useRef<HTMLInputElement | null>(null);

  // Step 1 Validation
  const isConfigValid = title.trim() !== "" && courseId > 0 && timeLimit > 0 && examDate.trim() !== "";

  // Submission validation: requires valid config, questions > 0, not submitting
  const hasTosUploaded = Boolean(tosFilePath && tosFilePath.trim() !== "");
  const isSubmitAllowed = isConfigValid && questions.length > 0 && !isSubmitting;

  // TOS File Upload Handler (Enforces PDF format & 10MB maximum file size limit)
  const handleTosFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so choosing the same file triggers onChange again if needed
    e.target.value = "";

    // 1. Strict PDF file validation
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setSaveStatus({
        type: "error",
        message: "Strict Requirement: Only PDF files (.pdf) are allowed for Table of Specifications (TOS).",
      });
      return;
    }

    // 2. Max 10MB size limit validation (10 * 1024 * 1024 bytes)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setSaveStatus({
        type: "error",
        message: `File Size Limit Exceeded: TOS PDF file size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 10MB.`,
      });
      return;
    }

    setUploadingTos(true);
    setSaveStatus({
      type: "saving",
      message: `Uploading TOS PDF file "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`,
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadTosFileAction(exam.exam_id, facultyId, formData);
      if (res.success && res.tos_file_path) {
        setTosFilePath(res.tos_file_path);
        setSaveStatus({
          type: "success",
          message: `TOS PDF file "${file.name}" uploaded successfully! Final Submit to Chair is now activated.`,
        });
      } else {
        setSaveStatus({
          type: "error",
          message: res.error || "Failed to upload TOS PDF file.",
        });
      }
    } catch (err: any) {
      console.error("Error uploading TOS PDF:", err);
      setSaveStatus({
        type: "error",
        message: err.message || "An error occurred while uploading the TOS PDF file.",
      });
    } finally {
      setUploadingTos(false);
    }
  };

  // Question Image Upload handlers
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  const handleUploadQuestionImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeQuestionIdx === -1) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadQuestionAttachment(facultyId, formData);
      if (res.success && res.url) {
        const updated = [...questions];
        updated[activeQuestionIdx].image_url = res.url;
        setQuestions(updated);
      } else {
        alert(res.error || "Failed to upload image.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveQuestionImage = () => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    delete updated[activeQuestionIdx].image_url;
    setQuestions(updated);
  };

  // Handles adding a new question
  const handleAddQuestion = (type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type" | "Essay" | "Fill_In_The_Blanks") => {
    let newQ: QuestionState = {
      text: "",
      question_type: type,
      options: [],
      premises: [],
      matches: [],
      blanks: [],
      min_words: type === "Essay" ? 50 : undefined,
      correctAnswer: "",
      points: 1,
    };

    if (type === "Multiple_Choice") {
      newQ.options = ["", "", "", ""];
      newQ.correctAnswer = "";
    } else if (type === "True_False") {
      newQ.correctAnswer = "True";
    } else if (type === "Identification") {
      newQ.correctAnswer = "";
    } else if (type === "Matching_Type") {
      newQ.matches = [
        { premise: "", choice: "" },
        { premise: "", choice: "" },
      ];
    } else if (type === "Essay") {
      newQ.text = "";
      newQ.min_words = 50;
      newQ.points = 5;
    } else if (type === "Fill_In_The_Blanks") {
      newQ.text = "";
      newQ.blanks = [];
      newQ.points = 1;
    }

    // Group existing questions by type
    const groups: Record<string, QuestionState[]> = {};
    questions.forEach(item => {
      if (!groups[item.question_type]) groups[item.question_type] = [];
      groups[item.question_type].push(item);
    });

    // Place newQ at top of its type group
    if (!groups[type]) {
      groups[type] = [newQ];
    } else {
      groups[type] = [newQ, ...groups[type]];
    }

    const orderedTypes = [
      "Multiple_Choice",
      "Identification",
      "True_False",
      "Fill_In_The_Blanks",
      "Matching_Type",
      "Essay"
    ];

    const sortedList: QuestionState[] = [];
    orderedTypes.forEach(t => {
      if (groups[t]) sortedList.push(...groups[t]);
    });
    Object.keys(groups).forEach(t => {
      if (!orderedTypes.includes(t)) sortedList.push(...groups[t]);
    });

    setQuestions(sortedList);
    const newIdx = sortedList.findIndex(item => item === newQ);
    setActiveQuestionIdx(newIdx !== -1 ? newIdx : sortedList.length - 1);
  };

  // Handles deleting a question
  const handleDeleteQuestion = (indexToDelete: number) => {
    const updated = questions.filter((_, idx) => idx !== indexToDelete);
    setQuestions(updated);
    
    if (updated.length === 0) {
      setActiveQuestionIdx(-1);
    } else if (activeQuestionIdx >= updated.length) {
      setActiveQuestionIdx(updated.length - 1);
    }
  };

  // Reorder questions
  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === questions.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setQuestions(updated);
    if (activeQuestionIdx === index) {
      setActiveQuestionIdx(targetIndex);
    } else if (activeQuestionIdx === targetIndex) {
      setActiveQuestionIdx(index);
    }
  };

  // Updates question text
  const updateQuestionText = (text: string, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].text = text;
    setQuestions(updated);
  };

  // Updates points
  const updateQuestionPoints = (points: number, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].points = Math.max(1, points);
    setQuestions(updated);
  };

  // Updates topic
  const updateQuestionTopic = (topic: string, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].topic = topic;
    setQuestions(updated);
  };

  // Updates taxonomy level (Bloom's Taxonomy)
  const updateQuestionTaxonomy = (taxonomy: TaxonomyLevel, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].taxonomy_level = taxonomy;
    setQuestions(updated);
  };

  // Updates year level
  const updateQuestionYearLevel = (yearLevel: number | undefined, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].year_level = yearLevel;
    setQuestions(updated);
  };

  // Updates essay min words limitation
  const updateEssayMinWords = (words: number, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].min_words = Math.max(0, words);
    setQuestions(updated);
  };

  // Updates Fill in the Blanks row
  const updateBlankItem = (blankIdx: number, field: "answer" | "points", val: any, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    const q = updated[targetIdx];
    if (!q.blanks) q.blanks = [];
    if (q.blanks[blankIdx]) {
      if (field === "points") {
        q.blanks[blankIdx].points = Math.max(1, Number(val) || 1);
      } else {
        q.blanks[blankIdx].answer = String(val);
      }
      // Re-calculate total question points
      const totalBlanksPoints = q.blanks.reduce((sum, b) => sum + (Number(b.points) || 1), 0);
      if (totalBlanksPoints > 0) q.points = totalBlanksPoints;
    }
    setQuestions(updated);
  };

  // Delete a blank item
  const deleteBlankItem = (blankIdx: number, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    const q = updated[targetIdx];
    q.blanks = (q.blanks || []).filter((_, idx) => idx !== blankIdx);
    // Re-index blank IDs
    q.blanks = q.blanks.map((b, idx) => ({ ...b, id: idx + 1 }));
    const totalBlanksPoints = q.blanks.reduce((sum, b) => sum + (Number(b.points) || 1), 0);
    if (totalBlanksPoints > 0) q.points = totalBlanksPoints;
    setQuestions(updated);
  };

  // Add a blank item & append [blank] tag to text prompt
  const addBlankItem = (targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    const q = updated[targetIdx];
    if (!q.blanks) q.blanks = [];
    const newId = q.blanks.length + 1;
    q.blanks.push({ id: newId, answer: "", points: 1 });
    if (!q.text.includes("[blank]")) {
      q.text = q.text ? `${q.text} [blank]` : "[blank]";
    }
    const totalBlanksPoints = q.blanks.reduce((sum, b) => sum + (Number(b.points) || 1), 0);
    if (totalBlanksPoints > 0) q.points = totalBlanksPoints;
    setQuestions(updated);
  };

  // Updates Multiple Choice options
  const updateMcOption = (optionIdx: number, val: string, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    const q = updated[targetIdx];
    
    // If the changed option was the correct answer, update the correct answer reference too
    const oldVal = q.options[optionIdx];
    q.options[optionIdx] = val;
    if (q.correctAnswer === oldVal || !q.correctAnswer || q.correctAnswer.startsWith("__OPT_")) {
      q.correctAnswer = val;
    }
    
    setQuestions(updated);
  };

  // Sets correct choice for Multiple Choice
  const setMcCorrectAnswer = (val: string, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].correctAnswer = val;
    setQuestions(updated);
  };

  // Sets correct answer for True/False
  const setTfCorrectAnswer = (val: "True" | "False", targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].correctAnswer = val;
    setQuestions(updated);
  };

  // Updates correct answer for Identification
  const updateIdCorrectAnswer = (val: string, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].correctAnswer = val;
    setQuestions(updated);
  };

  // Updates Matching Type row
  const updateMatchRow = (rowIdx: number, field: "premise" | "choice", val: string, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].matches[rowIdx][field] = val;
    setQuestions(updated);
  };

  // Deletes matching row
  const deleteMatchRow = (rowIdx: number, targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].matches = updated[targetIdx].matches.filter((_, idx) => idx !== rowIdx);
    setQuestions(updated);
  };

  // Adds matching row
  const addMatchRow = (targetIdx: number = activeQuestionIdx) => {
    if (targetIdx === -1 || !questions[targetIdx]) return;
    const updated = [...questions];
    updated[targetIdx].matches.push({ premise: "", choice: "" });
    setQuestions(updated);
  };



  // Save changes to draft
  const handleSaveDraft = async () => {
    setSaveStatus({ type: "saving", message: "Saving examination details and TOS structure..." });

    try {
      // Step 1: Save Configuration Settings
      const configData = new FormData();
      configData.append("examId", String(exam.exam_id));
      configData.append("facultyId", String(facultyId));
      configData.append("title", title);
      configData.append("courseId", String(courseId));
      configData.append("timeLimitMinutes", String(timeLimit));
      configData.append("randomizeItems", String(randomizeItems));
      configData.append("timePenaltySeconds", String(timePenalty));
      configData.append("scorePenaltyPoints", String(scorePenalty));
      configData.append("term", term);
      configData.append("examDate", examDate);
      configData.append("semester", applicableSemester);
      configData.append("academicYear", applicableAcademicYear);
      configData.append("documentReference", documentReference);
      configData.append("selectedStudentIds", JSON.stringify(selectedStudentIds));

      const tosPayload = {
        targetTotalItems: tosTargetTotalItems,
        topicPlans: tosTopicPlans,
        learningOutcomes: learningOutcomes,
      };
      configData.append("tosDataJson", JSON.stringify(tosPayload));

      const configRes = await saveExamConfig(configData);
      if (configRes.error) {
        setSaveStatus({ type: "error", message: `Config Error: ${configRes.error}` });
        setPopupModal({
          isOpen: true,
          type: "error",
          title: "Save Draft Failed",
          message: configRes.error,
        });
        return;
      }

      // Step 2: Save Questions (Auto-arranged by Question Type)
      const sortedQs = sortQuestionsByType(questions);
      const serializedQs = serializeQuestions(sortedQs);
      const questionsRes = await saveExamQuestions(exam.exam_id, serializedQs, facultyId);

      if (questionsRes.error) {
        setSaveStatus({ type: "error", message: `Questions Error: ${questionsRes.error}` });
        setPopupModal({
          isOpen: true,
          type: "error",
          title: "Save Draft Failed",
          message: questionsRes.error,
        });
        return;
      }

      setSaveStatus({ type: "success", message: "Examination draft saved successfully!" });
      setTimeout(() => setSaveStatus(null), 3000);
      router.refresh();

      // Display Save Draft Success Modal
      setPopupModal({
        isOpen: true,
        type: "save_draft",
        title: "Draft Saved Successfully!",
        message: "Your examination settings, Table of Specifications (TOS), and Question Bank items have been saved as a draft.",
        details: [
          `Course: ${selectedCourse.course_code || selectedCourse.course_title}`,
          `Total Questions: ${questions.length} items`,
          `Saved at: ${new Date().toLocaleTimeString()}`
        ],
        confirmText: "Continue Editing"
      });
    } catch (err: any) {
      console.error("Save draft error:", err);
      setSaveStatus({ type: "error", message: err?.message || "An error occurred while saving the draft." });
      setPopupModal({
        isOpen: true,
        type: "error",
        title: "Save Draft Error",
        message: err?.message || "An unexpected error occurred while saving your draft.",
      });
    }
  };

  // Save and Submit for Review
  const handleSubmitForReview = async () => {
    // 1. Comprehensive question completeness validation
    const validation = validateExamQuestions();
    if (!validation.valid) {
      setPopupModal({
        isOpen: true,
        type: "warning",
        title: "Incomplete Question Items Detected",
        message: "Your examination contains incomplete questions or unassigned answer keys. Please complete all required fields before submitting.",
        details: validation.issues.slice(0, 8),
        confirmText: "Review & Fix Questions"
      });
      return;
    }

    setIsSubmitting(true);
    setSaveStatus({ type: "saving", message: "Finalizing and saving exam before submission..." });

    try {
      // First save configurations
      const configData = new FormData();
      configData.append("examId", String(exam.exam_id));
      configData.append("facultyId", String(facultyId));
      configData.append("title", title);
      configData.append("courseId", String(courseId));
      configData.append("timeLimitMinutes", String(timeLimit));
      configData.append("randomizeItems", String(randomizeItems));
      configData.append("timePenaltySeconds", String(timePenalty));
      configData.append("scorePenaltyPoints", String(scorePenalty));
      configData.append("term", term);
      configData.append("examDate", examDate);
      configData.append("semester", applicableSemester);
      configData.append("academicYear", applicableAcademicYear);
      configData.append("documentReference", documentReference);
      configData.append("selectedStudentIds", JSON.stringify(selectedStudentIds));

      const tosPayload = {
        targetTotalItems: tosTargetTotalItems,
        topicPlans: tosTopicPlans,
        learningOutcomes: learningOutcomes,
      };
      configData.append("tosDataJson", JSON.stringify(tosPayload));

      const configRes = await saveExamConfig(configData);
      if (configRes.error) {
        setSaveStatus({ type: "error", message: `Config Error: ${configRes.error}` });
        setPopupModal({
          isOpen: true,
          type: "error",
          title: "Submission Failed",
          message: configRes.error,
        });
        setIsSubmitting(false);
        return;
      }

      // Save questions (Auto-arranged by Question Type)
      const sortedQs = sortQuestionsByType(questions);
      const serializedQs = serializeQuestions(sortedQs);
      const questionsRes = await saveExamQuestions(exam.exam_id, serializedQs, facultyId);

      if (questionsRes.error) {
        setSaveStatus({ type: "error", message: `Questions Error: ${questionsRes.error}` });
        setPopupModal({
          isOpen: true,
          type: "error",
          title: "Submission Failed",
          message: questionsRes.error,
        });
        setIsSubmitting(false);
        return;
      }

      // Transition status to Pending_Chair
      const statusRes = await updateExamStatus(exam.exam_id, "Pending_Chair", facultyId);
      if (statusRes.error) {
        setSaveStatus({ type: "error", message: `Submission Error: ${statusRes.error}` });
        setPopupModal({
          isOpen: true,
          type: "error",
          title: "Submission Failed",
          message: statusRes.error,
        });
        setIsSubmitting(false);
        return;
      }

      const isProgChairAuthor = userRole === "ProgramChair" || userRole === "Program Chair" || returnUrl === "/dashboard/chair";
      const reviewTarget = isProgChairAuthor ? "Department Chairperson" : (hasProgramChair ? "Program Chairperson" : "Department Chairperson");
      setSaveStatus({ type: "success", message: `Examination successfully submitted to ${reviewTarget} for review!` });
      setIsSubmitting(false);

      // Display Submission Success Modal
      setPopupModal({
        isOpen: true,
        type: "success",
        title: "Examination Submitted Successfully!",
        message: `Your examination "${title}" has been successfully submitted to the ${reviewTarget} for review.`,
        details: [
          `Review Target: ${reviewTarget}`,
          `Total Items: ${questions.length} questions`,
          `Status: Pending Review`
        ],
        confirmText: "Return to Dashboard",
        onConfirm: () => {
          router.push(returnUrl || "/dashboard/faculty");
          router.refresh();
        }
      });
    } catch (err: any) {
      console.error("Submit for review error:", err);
      setSaveStatus({ type: "error", message: err?.message || "An error occurred while submitting the exam." });
      setPopupModal({
        isOpen: true,
        type: "error",
        title: "Submission Error",
        message: err?.message || "An unexpected error occurred during submission.",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 select-none">
      
      {/* Sticky Top Header & Step Progress Bar */}
      <div className="sticky top-16 z-40 bg-slate-50/95 backdrop-blur-md pt-2 pb-3 space-y-3 transition-all border-b border-slate-200/60 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 shadow-xs print:hidden">
        {/* Top Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/95 backdrop-blur-md border border-slate-200/80 p-4 rounded-2xl sm:rounded-3xl shadow-xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                await autoSaveExamData();
                router.push(returnUrl || "/dashboard/faculty");
                router.refresh();
              }}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all shadow-xs cursor-pointer"
              title="Save and Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">Exam Creator Wizard</h1>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">Real-time Auto-Save enabled for configuration, TOS, and questions</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {autoSaveStatus === "saving" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1 rounded-full shadow-2xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" /> Auto-saving...
              </span>
            )}
            {autoSaveStatus === "saved" && lastSavedTime && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-2xs">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Saved ({lastSavedTime})
              </span>
            )}
            {autoSaveStatus === "error" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Auto-save warning
              </span>
            )}

            <button
              onClick={handleSaveDraft}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </button>
          </div>
        </div>

        {/* Step Progress Indicators */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-2 sm:p-3 shadow-xs">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 relative">
            
            {/* Step 1 Indicator */}
            <button 
              onClick={() => setStep(1)}
              className={`flex items-center gap-2.5 sm:gap-3.5 text-left p-2 sm:p-2.5 rounded-xl transition-all duration-300 ${
                step === 1 
                  ? "bg-emerald-50/80 border border-emerald-200 text-emerald-900 shadow-2xs" 
                  : "text-slate-400 hover:bg-slate-50/50 hover:text-slate-700"
              }`}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-extrabold text-xs transition-all ${
                step === 1 ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-400"
              }`}>
                <Settings className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600/70">Step 1</p>
                <p className="text-xs sm:text-sm font-bold truncate">Configuration</p>
              </div>
            </button>

            {/* Step 2 Indicator */}
            <button 
              disabled={!isConfigValid}
              onClick={() => setStep(2)}
              className={`flex items-center gap-2.5 sm:gap-3.5 text-left p-2 sm:p-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none ${
                step === 2 
                  ? "bg-emerald-50/80 border border-emerald-200 text-emerald-900 shadow-2xs" 
                  : "text-slate-400 hover:bg-slate-50/50 hover:text-slate-700"
              }`}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-extrabold text-xs transition-all ${
                step === 2 ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-400"
              }`}>
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600/70">Step 2</p>
                <p className="text-xs sm:text-sm font-bold truncate">Question Bank</p>
              </div>
            </button>

            {/* Step 3 Indicator */}
            <button 
              disabled={!isConfigValid || questions.length === 0}
              onClick={() => setStep(3)}
              className={`flex items-center gap-2.5 sm:gap-3.5 text-left p-2 sm:p-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none ${
                step === 3 
                  ? "bg-emerald-50/80 border border-emerald-200 text-emerald-900 shadow-2xs" 
                  : "text-slate-400 hover:bg-slate-50/50 hover:text-slate-700"
              }`}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-extrabold text-xs transition-all ${
                step === 3 ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-400"
              }`}>
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600/70">Step 3</p>
                <p className="text-xs sm:text-sm font-bold truncate">Review & Preview</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* STEP 1: EXAM CONFIGURATION */}
      {step === 1 && (
        <div className="space-y-8">
          
          {/* Settings Fields */}
          <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
              Examination Setup & Roster
            </h2>

            <div className="space-y-6">
              {/* 1. Examination Term & Exam Date (First Asked!) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    1. Examination Term & Scheduled Date
                  </h3>
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Required Step
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Academic Year & Semester (Auto / Non-editable) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 block">
                      Academic Year & Semester
                    </label>
                    <div className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-extrabold px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                      <span className="truncate">{applicableSemesterLabel}</span>
                    </div>
                  </div>

                  {/* 2. Examination Term (Selected by Faculty) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 block">
                      Examination Term <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={term}
                      onChange={(e) => {
                        const newTerm = e.target.value;
                        setTerm(newTerm);
                        const courseTitleStr = selectedCourse?.course_title || selectedCourse?.course_code || "";
                        const courseStr = courseTitleStr ? ` in ${courseTitleStr}` : "";
                        const newTitle = `${newTerm} Examination${courseStr}`;
                        setTitle(newTitle);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 text-sm font-extrabold px-3.5 py-2.5 rounded-xl transition-all outline-none cursor-pointer"
                    >
                      <option value="Prelim">Prelim Examination</option>
                      <option value="Midterm">Midterm Examination</option>
                      <option value="Final">Final Examination</option>
                    </select>
                  </div>

                  {/* 3. Exam Administration Date (Editable) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 block">
                      Exam Administration Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 text-sm font-bold px-3.5 py-2.5 rounded-xl transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Assigned Subject Selection (Official Course Details) */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    2. Assigned Subject
                  </h3>
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Official Course Parameters
                  </span>
                </div>


                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-700 block">Select Assigned Subject <span className="text-rose-500">*</span></label>
                  <select
                    value={courseId}
                    onChange={(e) => handleCourseChange(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-bold text-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300"
                  >
                    {effectiveAssignedSubjects.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_code} — {c.course_title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Course Code & Title Syllabus Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Course Code (Syllabus)</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-sm">
                        {selectedCourse.course_code || "N/A"}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Verified</span>
                    </div>
                  </div>

                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Course Title (Syllabus)</span>
                    <p className="text-sm font-bold text-slate-800 line-clamp-1">
                      {selectedCourse.course_title || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Assigned Students Selection (Who will take the exam) */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      3. Assigned Students for Selected Subject
                    </h3>

                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllStudents}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      title={filteredAndSortedStudents.length !== assignedStudents.length ? `Select all ${filteredAndSortedStudents.length} filtered students` : "Select all students"}
                    >
                      {filteredAndSortedStudents.length !== assignedStudents.length
                        ? `Select Filtered (${filteredAndSortedStudents.length})`
                        : "Select All"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllStudents}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      title={filteredAndSortedStudents.length !== assignedStudents.length ? `Deselect all ${filteredAndSortedStudents.length} filtered students` : "Deselect all students"}
                    >
                      {filteredAndSortedStudents.length !== assignedStudents.length
                        ? "Deselect Filtered"
                        : "Deselect All"}
                    </button>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300/60 flex items-center gap-1">
                      <span>{selectedStudentIds.length} / {assignedStudents.length} Selected</span>
                      {filteredAndSortedStudents.length !== assignedStudents.length && (
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 font-extrabold px-1.5 py-0.5 rounded">
                          ({filteredAndSortedStudents.length} filtered)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Sort & Filter Controls Toolbar for Assigned Students */}
                {assignedStudents.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {/* Search */}
                      <div className="relative sm:col-span-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search student..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Sort By (Name, Year Level, Program, Major) */}
                      <div className="sm:col-span-1">
                        <select
                          value={studentSortBy}
                          onChange={(e) => setStudentSortBy(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="lastNameAsc">Sort by Last Name (A-Z)</option>
                          <option value="lastNameDesc">Sort by Last Name (Z-A)</option>
                          <option value="firstNameAsc">Sort by First Name (A-Z)</option>
                          <option value="firstNameDesc">Sort by First Name (Z-A)</option>
                          <option value="yearAsc">Sort by Year Level (1 to 4)</option>
                          <option value="yearDesc">Sort by Year Level (4 to 1)</option>
                          <option value="programAsc">Sort by Program Code</option>
                          {hasMajors && (
                            <>
                              <option value="majorAsc">Sort by Major (A-Z)</option>
                              <option value="majorDesc">Sort by Major (Z-A)</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Automated Program Display (Read-Only) */}
                      <div className="sm:col-span-1 bg-white border border-slate-200 rounded-xl px-3 py-1 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="truncate">
                          <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider block">Program</span>
                          <span className="text-xs font-extrabold text-slate-800 truncate block" title={`${determinedProgramInfo.code} — ${determinedProgramInfo.name}`}>
                            {determinedProgramInfo.code}
                          </span>
                        </div>
                      </div>

                      {/* Major / Specialization Dropdown (Disabled if program has no majors, shows only connected majors when available) */}
                      <div className="sm:col-span-1">
                        <select
                          disabled={!hasMajors}
                          value={hasMajors ? studentMajorFilter : "ALL"}
                          onChange={(e) => setStudentMajorFilter(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
                        >
                          {!hasMajors ? (
                            <option value="ALL">Major: N/A (No Majors)</option>
                          ) : (
                            <>
                              <option value="ALL">Major: All Majors</option>
                              {availableStudentMajors.map((maj) => (
                                <option key={maj} value={maj}>
                                  {maj}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>

                      {/* Year Level Filter (Selectable across all year levels 1 to 4) */}
                      <div className="sm:col-span-1">
                        <select
                          value={studentYearFilter}
                          onChange={(e) => setStudentYearFilter(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="ALL">Year Level: All Year Levels (1-4)</option>
                          {availableStudentYears.map((yr) => (
                            <option key={yr} value={String(yr)}>
                              Year {yr}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {loadingStudents ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Loading class students for this subject...</p>
                  </div>
                ) : assignedStudents.length === 0 ? (
                  <div className="p-6 text-center bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-amber-800">No class students currently registered for this subject.</p>
                    <p className="text-[11px] text-amber-600">Students who register or enroll in this course code will automatically become eligible.</p>
                  </div>
                ) : filteredAndSortedStudents.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                    <p className="text-xs font-bold text-slate-500">No students match the selected filter criteria.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto bg-slate-50/40">
                    {filteredAndSortedStudents.map((student) => {
                      const isSelected = selectedStudentIds.includes(student.student_id);
                      return (
                        <div
                          key={student.student_id}
                          onClick={() => handleToggleStudent(student.student_id)}
                          className={`p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected ? "bg-emerald-50/60 hover:bg-emerald-50" : "bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                              isSelected ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white"
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black uppercase">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {formatStudentName(student)}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                ID: {student.institutional_id}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-extrabold text-slate-800 block" title={student.program_name}>
                              {student.program_code} {student.section && student.section !== "General" ? `(${student.section}) ` : ""}— Year {student.year_level}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium block truncate max-w-[220px]" title={student.program_name}>
                              {student.program_name || student.program_code}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Strict Time Limit */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  4. Time Limit & Item Shuffling
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Strict Time Limit */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">Strict Time Limit (Minutes)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="10"
                        max="300"
                        required
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-bold text-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">minutes</span>
                    </div>
                  </div>

                  {/* Item Randomization Toggle */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">Question Shuffling</label>
                    <div className="bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-2 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <Shuffle className="w-4 h-4 text-emerald-600" />
                        Randomize Question Order
                      </p>
                      <button
                        type="button"
                        onClick={() => setRandomizeItems(!randomizeItems)}
                        className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-all duration-300 focus:outline-none cursor-pointer ${
                          randomizeItems ? "bg-emerald-600 justify-end" : "bg-slate-300 justify-start"
                        }`}
                      >
                        <span className="bg-white w-5 h-5 rounded-full shadow-md" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Security Violations Penalties Configuration */}
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Security Violation Penalties
                  </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Time Penalty */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">Time Penalty per Violation</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={timePenalty}
                        onChange={(e) => setTimePenalty(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-bold text-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">seconds</span>
                    </div>
                  </div>

                  {/* Score Penalty */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">Score Penalty per Violation</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={scorePenalty}
                        onChange={(e) => setScorePenalty(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-bold text-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">points</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

          {/* Table of Specifications (TOS) Native System Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                  Native TOS Topic Alignment & Hours Calculator
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                </p>
              </div>

              {/* Target Exam Items Input Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Target Exam Items
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">Total exam questions</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={tosTargetTotalItems}
                  onChange={(e) => setTosTargetTotalItems(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-black text-slate-900 text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-inner"
                />
              </div>
            </div>

            {/* Notification Toast */}
            {tosNotification && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center justify-between gap-2 transition-all">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{tosNotification}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTosNotification(null)}
                  className="text-emerald-500 hover:text-emerald-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Add Topic Entry Form Bar */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                Add Topic & Discussion Hours Taught
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Topic Name Textbox */}
                <div className="sm:col-span-7">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Course Topic Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chapter 1: Introduction to Data Structures & Algorithms"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTosTopic())}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Hours Discussed Input */}
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Hours Taught (hrs) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 6"
                      value={newTopicHours}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setNewTopicHours("");
                          return;
                        }
                        const parsed = parseFloat(val);
                        const num = isNaN(parsed) ? 1 : Math.max(1, Math.round(parsed));
                        setNewTopicHours(String(num));
                      }}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTosTopic())}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] font-extrabold text-slate-400">
                      hrs
                    </span>
                  </div>
                </div>

                {/* Add Button */}
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={handleAddTosTopic}
                    disabled={!newTopicName.trim()}
                    className="w-full inline-flex justify-center items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black py-2 px-3 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Topic
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Calculation Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-extrabold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">TOPIC</th>
                      <th className="py-3 px-4 w-32 text-center">HRS TAUGHT</th>
                      <th className="py-3 px-4 w-32 text-center">PERCENTAGE</th>
                      <th className="py-3 px-4 w-28 text-center">ITEMS</th>
                      <th className="py-3 px-4 w-16 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tosDistribution.length > 0 ? (
                      tosDistribution.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={item.topic}
                              onChange={(e) => handleUpdateTosTopic(item.id, e.target.value, item.hours)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 text-xs font-extrabold text-slate-800 focus:outline-none py-1"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1 justify-center">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={Math.round(item.hours)}
                                onChange={(e) => {
                                  const parsed = parseFloat(e.target.value);
                                  const num = isNaN(parsed) ? 1 : Math.max(1, Math.round(parsed));
                                  handleUpdateTosTopic(item.id, item.topic, num);
                                }}
                                className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                              <span className="text-[10px] font-extrabold text-slate-400">hrs</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-black">
                              {item.percentage}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-black">
                              {item.calculatedItems} Item{item.calculatedItems !== 1 ? "s" : ""}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteTosTopic(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Delete Topic"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs font-semibold text-slate-400">
                          No topics added yet. Add a course topic and discussion hours above to calculate TOS weightings.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Totals & Actions Footer */}
              <div className="bg-slate-900 text-white p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    Total Teaching Hours: <strong className="text-white font-black">{totalTosHours} hrs</strong>
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Hash className="w-4 h-4 text-[#E2A123]" />
                    Target Exam Items: <strong className="text-white font-black">{tosTargetTotalItems} items</strong>
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Layers className="w-4 h-4 text-amber-400" />
                    Allocated Sum: <strong className="text-emerald-400 font-black">{totalCalculatedTosItems} / {tosTargetTotalItems} items (100%)</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    disabled={!isConfigValid}
                    onClick={() => {
                      syncQuestionsWithTos();
                      setStep(2);
                    }}
                    className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Proceed to Questions & TOS Setup
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: QUESTION BANK BUILDER */}
      {step === 2 && (
        <div className="space-y-6">
          

          {/* Topics Accordion Dropdown List (Click topic header to drop down items) */}
          <div className="space-y-4">
            {tosTopicBreakdown.length > 0 ? (
              tosTopicBreakdown.map((tItem, topicIdx) => {
                const topicName = tItem.topic;
                const isUnassigned = topicName === "Unassigned Topic";
                const isOpen = Boolean(openTopics[topicName]); // minimized (closed) by default

                // Hours taught matching from TOS plans
                const matchingPlan = tosDistribution.find(d => d.topic.trim().toLowerCase() === topicName.trim().toLowerCase());
                const hoursTaught = matchingPlan ? matchingPlan.hours : 0;

                // Questions belonging to this topic
                const topicQuestions = questions
                  .map((q, globalIdx) => ({ q, globalIdx }))
                  .filter(({ q }) => (q.topic?.trim() || "Unassigned Topic") === topicName);

                return (
                  <div 
                    key={topicIdx}
                    className={`border rounded-3xl overflow-hidden transition-all shadow-sm ${
                      isUnassigned
                        ? "bg-rose-50/30 border-rose-200"
                        : "bg-white border-slate-200/90"
                    }`}
                  >
                    {/* Topic Accordion Header Div (Topic Title & Item Placement) */}
                    <div
                      onClick={() => toggleTopicOpen(topicName)}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                        isOpen 
                          ? isUnassigned ? "bg-rose-100/60 border-b border-rose-200" : "bg-slate-50 border-b border-slate-200/80"
                          : "hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border transition-transform duration-200 ${
                          isOpen ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}>
                          {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                              {topicName}
                            </h3>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              isUnassigned
                                ? "bg-rose-100 text-rose-800 border-rose-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}>
                              {isUnassigned ? "Unassigned Items" : `Topic ${topicIdx + 1}`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {isOpen ? "Click to minimize items" : "Click to drop down items"}
                          </p>
                        </div>
                      </div>

                      {/* Topic Item Placement Badges inside the header Div */}
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs font-black">
                        {hoursTaught > 0 && (
                          <span className="bg-slate-100 text-slate-800 border border-slate-300/80 px-2.5 py-1 rounded-xl" title="HRS TAUGHT">
                            ⏱️ {hoursTaught} hrs
                          </span>
                        )}
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl" title="PERCENTAGE">
                          {tItem.weightPercentage}%
                        </span>
                        <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-xl" title="ITEMS">
                          {tItem.count} Item{tItem.count !== 1 ? "s" : ""}
                        </span>
                        <span className="bg-indigo-100 text-indigo-950 border border-indigo-300/80 px-3 py-1 rounded-xl shadow-2xs flex items-center gap-1.5" title="ITEM PLACEMENT">
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Placement:</span>
                          <strong className="text-indigo-900 font-black">{tItem.rangeString}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Content: Questions List under this Topic */}
                    {isOpen && (
                      <div className="p-4 sm:p-6 space-y-5">
                        {topicQuestions.length > 0 ? (
                          topicQuestions.map(({ q, globalIdx }, topicItemIdx) => (
                            <div key={globalIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all">
                              
                              {/* Question Item Bar */}
                              <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200/90 gap-2.5 overflow-x-auto scrollbar-none shadow-2xs">
                                
                                {/* Left: Badges & Type/Taxonomy/Topic Selectors */}
                                <div className="flex items-center gap-2.5 shrink-0">
                                  <span className="text-sm font-black text-slate-900 shrink-0 px-1">
                                    {topicItemIdx + 1}.
                                  </span>


                                  {/* Question Type Selector Dropdown per Item */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 whitespace-nowrap">Type:</label>
                                    <select
                                      value={q.question_type}
                                      onChange={(e) => handleQuestionTypeChange(e.target.value as any, globalIdx)}
                                      className="bg-emerald-50 border border-emerald-300 text-emerald-950 font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer shrink-0"
                                    >
                                      <option value="Multiple_Choice">Test Part: Multiple Choice</option>
                                      <option value="Identification">Test Part: Identification</option>
                                      <option value="True_False">Test Part: True or False</option>
                                      <option value="Fill_In_The_Blanks">Test Part: Fill in the Blanks</option>
                                      <option value="Matching_Type">Test Part: Matching Type</option>
                                      <option value="Essay">Test Part: Essay</option>
                                    </select>
                                  </div>

                                  {/* Taxonomy of Learning Level Selector (Bloom's Taxonomy) */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 whitespace-nowrap">Taxonomy Level:</label>
                                    <select
                                      value={q.taxonomy_level || "KNOWLEDGE / REMEMBERING"}
                                      onChange={(e) => updateQuestionTaxonomy(e.target.value as TaxonomyLevel, globalIdx)}
                                      className="bg-indigo-50 border border-indigo-300 text-indigo-950 font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer shrink-0 max-w-[210px] truncate"
                                    >
                                      <option value="KNOWLEDGE / REMEMBERING">1. Knowledge / Remembering</option>
                                      <option value="COMPREHENSION / UNDERSTANDING">2. Comprehension / Understanding</option>
                                      <option value="APPLICATION / APPLYING">3. Application / Applying</option>
                                      <option value="ANALYSIS / ANALYZING">4. Analysis / Analyzing</option>
                                      <option value="SYNTHESIS / EVALUATING">5. Synthesis / Evaluating</option>
                                      <option value="EVALUATION / CREATING">6. Evaluation / Creating</option>
                                    </select>
                                  </div>

                                </div>

                                {/* Right: Points & Reorder/Delete Buttons */}
                                <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 whitespace-nowrap">Points:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={q.points}
                                      onChange={(e) => updateQuestionPoints(Number(e.target.value), globalIdx)}
                                      className="w-12 bg-white border border-slate-300 rounded-xl text-center text-xs font-bold text-slate-800 py-1 focus:outline-emerald-500 shadow-2xs shrink-0"
                                    />
                                  </div>

                                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2 shrink-0">
                                    <button
                                      type="button"
                                      disabled={globalIdx === 0}
                                      onClick={() => handleMoveQuestion(globalIdx, "up")}
                                      className="p-1 rounded-md text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 transition-colors cursor-pointer"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={globalIdx === questions.length - 1}
                                      onClick={() => handleMoveQuestion(globalIdx, "down")}
                                      className="p-1 rounded-md text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 transition-colors cursor-pointer"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuestion(globalIdx)}
                                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Delete Question"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Prompt Input Textarea */}
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-extrabold text-slate-700 block">Question Prompt / Text</label>
                                    <textarea
                                      rows={2}
                                      placeholder={
                                        q.question_type === "Fill_In_The_Blanks"
                                          ? "e.g. The capital of Batanes is [blank] and it is located in [blank] region."
                                          : "Enter the question details here..."
                                      }
                                      value={cleanQuestionText(q.text)}
                                      onChange={(e) => updateQuestionText(e.target.value, globalIdx)}
                                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-medium text-slate-800 placeholder:text-slate-400 p-3 rounded-xl transition-all duration-300 outline-none"
                                    />
                                  </div>
                                  {/* Option to Upload PNG or Photo */}
                                  <div className="flex flex-wrap items-center gap-3">
                                    <input
                                      type="file"
                                      accept="image/png, image/jpeg, image/jpg, image/webp"
                                      id={`question-img-${globalIdx}`}
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setUploadingImage(true);
                                        const formData = new FormData();
                                        formData.append("file", file);
                                        try {
                                          const res = await uploadQuestionAttachment(facultyId, formData);
                                          if (res.success && res.url) {
                                            const updated = [...questions];
                                            updated[globalIdx].image_url = res.url;
                                            setQuestions(updated);
                                          }
                                        } catch (err) {
                                          console.error(err);
                                        } finally {
                                          setUploadingImage(false);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => document.getElementById(`question-img-${globalIdx}`)?.click()}
                                      className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer transition-colors"
                                    >
                                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Upload PNG or Photo</span>
                                    </button>
                                    {q.image_url && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...questions];
                                          delete updated[globalIdx].image_url;
                                          setQuestions(updated);
                                        }}
                                        className="text-rose-600 text-xs font-bold hover:underline cursor-pointer"
                                      >
                                        Remove Photo
                                      </button>
                                    )}
                                  </div>

                                  {q.image_url && (
                                    <div className="w-full max-w-xs rounded-xl border border-slate-200 overflow-hidden bg-white p-2">
                                      <img src={q.image_url} alt="Question Asset" className="w-full h-auto max-h-40 object-contain rounded-lg" />
                                    </div>
                                  )}

                              {/* MULTIPLE CHOICE EDITOR */}
                              {q.question_type === "Multiple_Choice" && (
                                <div className="space-y-3 pt-1">
                                  <label className="text-xs font-extrabold text-slate-600 block">Configure Multiple Choice Options (Mark correct answer):</label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {q.options.map((option, opIdx) => {
                                      const isCorrect = (q.correctAnswer === option && option !== "") || (q.correctAnswer === `__OPT_${opIdx}__`) || (!q.correctAnswer && opIdx === 0);
                                      return (
                                        <div key={opIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                                          <button
                                            type="button"
                                            onClick={() => setMcCorrectAnswer(option || `__OPT_${opIdx}__`, globalIdx)}
                                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                              isCorrect 
                                                ? "border-emerald-500 bg-emerald-500 text-white" 
                                                : "border-slate-300 hover:border-slate-400 bg-white"
                                            }`}
                                          >
                                            {isCorrect && <Check className="w-3 h-3 font-bold" />}
                                          </button>
                                          <span className="text-xs font-bold text-slate-400 w-4 uppercase">
                                            {String.fromCharCode(65 + opIdx)}.
                                          </span>
                                          <input
                                            type="text"
                                            value={option}
                                            placeholder={`Option ${String.fromCharCode(65 + opIdx)}`}
                                            onChange={(e) => updateMcOption(opIdx, e.target.value, globalIdx)}
                                            className="flex-1 bg-white border border-slate-200 text-xs font-semibold text-slate-800 px-3 py-1.5 rounded-lg focus:outline-emerald-500"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* TRUE / FALSE EDITOR */}
                              {q.question_type === "True_False" && (
                                <div className="space-y-2 pt-1">
                                  <label className="text-xs font-extrabold text-slate-600 block">Correct Choice:</label>
                                  <div className="flex gap-4 max-w-xs">
                                    {["True", "False"].map((choice) => {
                                      const isSelected = q.correctAnswer === choice;
                                      return (
                                        <button
                                          key={choice}
                                          type="button"
                                          onClick={() => setTfCorrectAnswer(choice as any, globalIdx)}
                                          className={`flex-1 py-2 text-center rounded-xl text-xs font-extrabold border transition-all ${
                                            isSelected 
                                              ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs" 
                                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                                          }`}
                                        >
                                          {choice}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* IDENTIFICATION EDITOR */}
                              {q.question_type === "Identification" && (
                                <div className="space-y-1.5 pt-1">
                                  <label className="text-xs font-extrabold text-slate-600 block">Expected Text Answer:</label>
                                  <input
                                    type="text"
                                    placeholder="Type expected text answer..."
                                    value={cleanCorrectAnswer(q.correctAnswer)}
                                    onChange={(e) => updateIdCorrectAnswer(e.target.value, globalIdx)}
                                    className="w-full max-w-md bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 px-3 py-2 rounded-xl focus:outline-emerald-500"
                                  />
                                </div>
                              )}

                              {/* MATCHING TYPE EDITOR */}
                              {q.question_type === "Matching_Type" && (
                                <div className="space-y-3 pt-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-extrabold text-slate-600">Matching Column Pairs:</label>
                                    <button
                                      type="button"
                                      onClick={() => addMatchRow(globalIdx)}
                                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" /> Add Pair
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {q.matches.map((match, matchIdx) => (
                                      <div key={matchIdx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                                        <span className="text-slate-400 font-bold w-4 text-center">{matchIdx + 1}</span>
                                        <input
                                          type="text"
                                          placeholder="Premise (Column A)"
                                          value={match.premise}
                                          onChange={(e) => updateMatchRow(matchIdx, "premise", e.target.value, globalIdx)}
                                          className="flex-1 bg-white border border-slate-200 font-bold text-slate-800 px-2.5 py-1.5 rounded-lg focus:outline-emerald-500"
                                        />
                                        <span className="text-slate-400 font-bold">→</span>
                                        <input
                                          type="text"
                                          placeholder="Choice (Column B)"
                                          value={match.choice}
                                          onChange={(e) => updateMatchRow(matchIdx, "choice", e.target.value, globalIdx)}
                                          className="flex-1 bg-white border border-slate-200 font-bold text-slate-800 px-2.5 py-1.5 rounded-lg focus:outline-emerald-500"
                                        />
                                        <button
                                          type="button"
                                          disabled={q.matches.length <= 1}
                                          onClick={() => deleteMatchRow(matchIdx, globalIdx)}
                                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                                        >
                                          <Trash className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ESSAY EDITOR */}
                              {q.question_type === "Essay" && (
                                <div className="space-y-2 pt-1">
                                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                                    <span className="font-bold text-emerald-900">Minimum Word Limitation:</span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="0"
                                        value={q.min_words ?? 50}
                                        onChange={(e) => updateEssayMinWords(Number(e.target.value), globalIdx)}
                                        className="w-20 bg-white border border-emerald-300 rounded-lg text-center font-extrabold text-emerald-950 py-1"
                                      />
                                      <span className="font-bold text-emerald-800">words min</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* FILL IN THE BLANKS EDITOR */}
                              {q.question_type === "Fill_In_The_Blanks" && (
                                <div className="space-y-3 pt-1">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-teal-50/70 border border-teal-200/80 p-2.5 rounded-xl">
                                    <div className="text-[11px] font-semibold text-teal-950">
                                      Set the expected correct answer key for each <code className="bg-teal-100/90 text-teal-900 px-1 py-0.5 rounded border border-teal-300 font-bold">[blank]</code> in order:
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => addBlankItem(globalIdx)}
                                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" /> Insert Blank
                                    </button>
                                  </div>
                                  {(q.blanks || []).length > 0 && (
                                    <div className="space-y-2">
                                    {(q.blanks || []).map((blank, blankIdx) => (
                                      <div key={blankIdx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-teal-50/40 border border-teal-200/80 p-2.5 rounded-xl text-xs">
                                        <span className="font-black bg-teal-600 text-white px-2 py-0.5 rounded-md text-[10px]">
                                          Blank #{blankIdx + 1}
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="Expected answer..."
                                          value={blank.answer}
                                          onChange={(e) => updateBlankItem(blankIdx, "answer", e.target.value, globalIdx)}
                                          className="flex-1 bg-white border border-slate-200 font-bold text-slate-800 px-3 py-1.5 rounded-lg focus:outline-teal-500"
                                        />
                                        <div className="flex items-center gap-1">
                                          <label className="text-[10px] font-bold text-slate-500">Pts:</label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={blank.points || 1}
                                            onChange={(e) => updateBlankItem(blankIdx, "points", e.target.value, globalIdx)}
                                            className="w-14 bg-white border border-slate-200 text-center font-bold text-slate-800 py-1 rounded-lg focus:outline-teal-500"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => deleteBlankItem(blankIdx, globalIdx)}
                                             className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                          >
                                            <Trash className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  )}
                                </div>
                              )}

                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-xs font-semibold text-slate-400">
                            No questions assigned to this topic yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">No topics or questions created yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Go back to Step 1 to add topics and discussion hours.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* STEP 3: REVIEW & LIVE PREVIEW */}
      {step === 3 && (
        <div className="space-y-8">

          {/* STEP 3 VERTICALLY STACKED PREVIEW CONTAINER */}
          <div className="space-y-8 font-sans">

            {/* DOCUMENT 1: OFFICIAL BATANES STATE COLLEGE TOS MATRIX (BSC-ODI-F-121 - A4 LANDSCAPE PAGINATED) */}
            <div className={`space-y-6 ${printMode === "exam" ? "print:hidden" : ""}`}>
              {tosPages.map((pageRows, pageIdx) => (
                <div key={pageIdx} className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-3 rounded-2xl print:hidden max-w-[1123px] mx-auto">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span className="font-extrabold text-xs uppercase tracking-wider">
                        Official Table of Specifications (TOS) Matrix — Page {pageIdx + 1} of {tosPages.length} — A4 Landscape (BSC-ODI-F-121)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePrintTos}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-3 py-1 rounded-xl transition-all shadow-2xs cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-indigo-200" />
                        <span>Print TOS</span>
                      </button>
                      <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-xl">
                        Page {pageIdx + 1} of {tosPages.length}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                    className="tos-container w-full max-w-[1123px] mx-auto bg-white border-none rounded-none shadow-md font-sans select-text relative min-h-[794px] flex flex-col justify-between overflow-hidden print:max-w-none print:min-h-0 print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none print:break-after-page"
                  >
                    <style>{`
                      .tos-container, .tos-container *, .tq-container, .tq-container * {
                        font-family: Arial, Helvetica, sans-serif !important;
                      }
                      @media print {
                        ${printMode === "tos" ? `
                          @page {
                            size: landscape;
                            margin: 0;
                          }
                        ` : printMode === "exam" ? `
                          @page {
                            size: portrait;
                            margin: 0;
                          }
                        ` : `
                          @page {
                            margin: 0;
                          }
                        `}
                        body {
                          background: white !important;
                        }
                      }
                    `}</style>

                    {/* BSC OFFICIAL HEADER IMAGE */}
                    <div className="w-full relative overflow-hidden leading-none block shrink-0">
                      <img
                        src="/bsc-header.png"
                        alt="Batanes State College Header"
                        className="w-full h-auto object-cover block mx-auto print:w-full"
                      />
                    </div>

                    {/* INNER CONTENT BODY WITH PADDING */}
                    <div className="px-6 pb-6 pt-2 sm:px-10 sm:pb-10 sm:pt-3 space-y-3 flex-1">

                      {/* PAGE 1 ONLY: TOS TITLE & METADATA GRID */}
                      {pageIdx === 0 ? (
                        <>
                          {/* TOS TITLE & TERM */}
                          <div className="text-center space-y-0.5 pt-0 pb-1">
                            <h2 className="text-base sm:text-lg font-black font-sans text-black tracking-wider uppercase">
                              TABLE OF SPECIFICATIONS
                            </h2>
                            <p className="text-xs sm:text-sm font-black text-black uppercase tracking-wide">
                              <span>{term ? term.toUpperCase() : "TERM"} EXAMINATION</span>
                            </p>
                            <p className="text-xs font-bold text-black tracking-wide">
                              <span>{applicableSemesterLabel}</span>
                            </p>
                          </div>

                          {/* COURSE & EXAMINATION METADATA GRID MATCHING PDF */}
                          <div className="space-y-2 text-xs font-extrabold text-black uppercase pt-1 pb-2">
                            <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4">
                              <div className="flex items-baseline gap-2 flex-1 w-full">
                                <span className="shrink-0 font-black text-[11px] tracking-wide">COURSE CODE:</span>
                                <span className="border-b border-black flex-1 font-mono font-bold text-black px-1 text-[11px] min-h-[18px]">
                                  {selectedCourse.course_code || ""}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-2 flex-1 w-full">
                                <span className="shrink-0 font-black text-[11px] tracking-wide">DATE OF EXAMINATION:</span>
                                <span className="border-b border-black flex-1 font-mono font-bold text-black px-1 text-[11px] min-h-[18px]">
                                  {formatFullExamDate(examDate)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-baseline gap-2 w-full">
                              <span className="shrink-0 font-black text-[11px] tracking-wide">COURSE TITLE:</span>
                              <span className="border-b border-black flex-1 font-bold text-black px-1 text-[11px] min-h-[18px]">
                                {selectedCourse.course_title || ""}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {/* BSC-ODI-F-121 OFFICIAL TABLE FORMAT MATCHING PDF */}
                      <div className="w-full max-w-full overflow-hidden rounded-none border border-black shadow-2xs print:overflow-visible">
                        <table className="w-full text-left border-collapse text-[9px] print:text-[8.5px] table-fixed border-black font-sans">
                          <thead>
                            <tr className="bg-white text-black font-black uppercase text-center border-b border-black">
                              <th rowSpan={3} className="py-2 px-1 border-r border-black w-[14%] text-left font-black align-middle text-[8.5px] leading-tight">LESSON / TOPIC</th>
                              <th rowSpan={3} className="py-2 px-1.5 border-r border-black w-[24%] text-left font-black align-middle text-[8.5px] leading-tight">LEARNING OUTCOMES</th>
                              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[5.5%] font-black text-center align-middle text-[7.5px] leading-tight">NO. OF TEACHING HOURS</th>
                              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[5.5%] font-black text-center align-middle text-[7.5px] leading-tight">% OF ALLOCATION</th>
                              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[5.5%] font-black text-center align-middle text-[7.5px] leading-tight">NO. OF ITEMS</th>
                              <th colSpan={7} className="py-1.5 px-0.5 border-r border-b border-black bg-white text-black font-black text-center text-[8.5px] tracking-tight">
                                ITEM SPECIFICATION PER TAXONOMY OF LEARNING
                              </th>
                              <th rowSpan={3} className="py-2 px-1 border-black w-[11.7%] font-black text-center align-middle text-[7.5px] leading-tight">ITEM PLACEMENT</th>
                            </tr>
                            <tr className="bg-white text-black font-black text-[7px] uppercase text-center border-b border-black">
                              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                                KNOW LEDGE /<br />REMEMBERING
                              </th>
                              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                                COMPRE HENSION /<br />UNDERSTANDING
                              </th>
                              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                                APPLICATION /<br />APPLYING
                              </th>
                              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                                ANALYSIS /<br />ANALYZING
                              </th>
                              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                                SYNTHESIS /<br />EVALUATING
                              </th>
                              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                                EVALUATION /<br />CREA TING
                              </th>
                              <th rowSpan={2} className="py-2 px-0.5 border-r border-black bg-white font-black text-black text-[8.5px] text-center align-middle w-[5%]">TOTAL</th>
                            </tr>
                            <tr className="bg-white text-black font-black text-[8.5px] uppercase text-center border-b border-black">
                              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                                {overallTaxonomyPercents.remembering}%
                              </th>
                              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                                {overallTaxonomyPercents.understanding}%
                              </th>
                              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                                {overallTaxonomyPercents.applying}%
                              </th>
                              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                                {overallTaxonomyPercents.analyzing}%
                              </th>
                              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                                {overallTaxonomyPercents.evaluating}%
                              </th>
                              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                                {overallTaxonomyPercents.creating}%
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black font-medium text-black bg-white">
                            {pageRows.map((row, idx) => {
                              const t = row.taxonomy;
                              return (
                                <tr key={idx} className="bg-white border-b border-black">
                                  <td className="py-2 px-2 font-bold text-black border-r border-black align-top text-[9px] leading-normal break-words">
                                    {row.topic}
                                  </td>
                                  <td className="py-1.5 px-2 text-black border-r border-black text-[9px] align-top whitespace-pre-wrap break-words leading-normal">
                                    <div
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => handleUpdateLearningOutcome(row.topic, e.currentTarget.innerText || "")}
                                      className="w-full min-h-[36px] bg-transparent outline-none font-sans text-[9px] leading-normal text-black font-medium focus:bg-amber-50 focus:ring-1 focus:ring-amber-400 rounded p-1 transition-all cursor-text print:p-0 print:focus:bg-transparent print:focus:ring-0 whitespace-pre-wrap break-words"
                                      title="Faculty: Click to edit learning outcomes for this topic"
                                    >
                                      {learningOutcomes[row.topic] ?? `Demonstrates competency and learning outcomes for ${row.topic.toLowerCase()}.`}
                                    </div>
                                  </td>
                                  <td className="py-2 px-1 text-center font-bold text-black border-r border-black align-top">
                                    {row.hoursTaught > 0 ? row.hoursTaught : "0"}
                                  </td>
                                  <td className="py-2 px-1 text-center font-extrabold text-black border-r border-black align-top">
                                    {row.weightPercentage}%
                                  </td>
                                  <td className="py-2 px-1 text-center font-extrabold text-black border-r border-black align-top">
                                    {row.count}
                                  </td>
                                  <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                                    {t.remembering.count}
                                  </td>
                                  <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                                    {t.understanding.count}
                                  </td>
                                  <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                                    {t.applying.count}
                                  </td>
                                  <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                                    {t.analyzing.count}
                                  </td>
                                  <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                                    {t.evaluating.count}
                                  </td>
                                  <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                                    {t.creating.count}
                                  </td>
                                  <td className="py-2 px-0.5 text-center border-r border-black font-black text-black bg-white align-top">
                                    {row.count}
                                  </td>
                                  <td className="py-2 px-1.5 font-sans font-bold text-black text-[9px] align-top text-center whitespace-nowrap">
                                    {row.rangeString}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {pageIdx === tosPages.length - 1 && (
                            <tfoot>
                              <tr className="bg-[#F5B000] text-black font-black text-xs uppercase border-t-2 border-black divide-x divide-black">
                                <td colSpan={2} className="py-2 px-3 border-r border-black text-left font-black bg-[#F5B000]">TOTAL</td>
                                <td className="py-2 px-1 text-center border-r border-black font-black bg-[#F5B000]">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.hoursTaught, 0)}
                                </td>
                                <td className="py-2 px-1 text-center border-r border-black font-black bg-[#F5B000]">
                                  {questions.length > 0 ? "100%" : "0%"}
                                </td>
                                <td className="py-2 px-1 text-center border-r border-black font-black bg-[#F5B000]">
                                  {questions.length}
                                </td>
                                <td className="py-2 px-0.5 text-center border-r border-black font-black bg-[#F5B000]">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.remembering.count, 0)}
                                </td>
                                <td className="py-2 px-0.5 text-center border-r border-black font-black bg-[#F5B000]">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.understanding.count, 0)}
                                </td>
                                <td className="py-2 px-0.5 text-center border-r border-black font-black bg-[#F5B000]">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.applying.count, 0)}
                                </td>
                                <td className="py-2 px-0.5 text-center border-r border-black font-black bg-[#F5B000]">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.analyzing.count, 0)}
                                </td>
                                <td className="py-2 px-0.5 text-center border-r border-black font-black bg-[#F5B000]">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.evaluating.count, 0)}
                                </td>
                                <td className="py-2 px-0.5 text-center border-r border-black font-black bg-[#F5B000]">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.creating.count, 0)}
                                </td>
                                <td className="py-2 px-0.5 text-center border-r border-black font-black bg-[#F5B000]">
                                  {questions.length}
                                </td>
                                <td className="py-2 px-1.5 text-[9px] font-black bg-[#F5B000]">
                                  —
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>

                      {/* EDITABLE SIGNATORIES SECTION FOR EXAM BUILDER TOS PREVIEW */}
                      {pageIdx === tosPages.length - 1 && (
                        <div className="pt-6 border-t border-black space-y-6">


                          {/* OPTION 1: WITH PROGRAM CHAIR */}
                          {signatoryLayoutMode === "WITH_PC" && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12 text-xs text-black font-sans pt-1">
                                <div className="space-y-6">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Prepared by:</p>
                                  <div>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryFacultyName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryFacultyName || "NAME OF FACULTY MEMBER"}
                                    </p>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryFacultyRank(e.currentTarget.innerText || "")}
                                      className="text-[11px] text-black font-semibold mt-1 outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryFacultyRank || "Academic Rank/Designation"}
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-6">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Reviewed by:</p>
                                  <div>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryProgChairName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryProgChairName || "NAME OF PROGRAM CHAIRPERSON"}
                                    </p>
                                    <p className="text-[11px] text-black font-semibold mt-1">Program Chairperson</p>
                                  </div>
                                </div>

                                <div className="space-y-6">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Recommending Approval:</p>
                                  <div>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryDeptChairName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryDeptChairName || "NAME OF DEPARTMENT CHAIRPERSON"}
                                    </p>
                                    <p className="text-[11px] text-black font-semibold mt-1">Department Chairperson</p>
                                  </div>
                                </div>

                                <div className="space-y-6">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Approved by:</p>
                                  <div>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryDirectorName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryDirectorName || "NAME OF DIRECTOR FOR INSTRUCTION"}
                                    </p>
                                    <p className="text-[11px] text-black font-semibold mt-1">Director for Instruction</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* OPTION 2: WITHOUT PROGRAM CHAIR */}
                          {signatoryLayoutMode === "WITHOUT_PC" && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12 text-xs text-black font-sans pt-1">
                                <div className="space-y-6">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Prepared by:</p>
                                  <div>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryFacultyName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryFacultyName || "NAME OF FACULTY MEMBER"}
                                    </p>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryFacultyRank(e.currentTarget.innerText || "")}
                                      className="text-[11px] text-black font-semibold mt-1 outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryFacultyRank || "Academic Rank/Designation"}
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-6">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Reviewed by:</p>
                                  <div>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryDeptChairName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryDeptChairName || "NAME OF DEPARTMENT CHAIRPERSON"}
                                    </p>
                                    <p className="text-[11px] text-black font-semibold mt-1">Department Chairperson</p>
                                  </div>
                                </div>

                                <div className="sm:col-span-2 max-w-sm mx-auto w-full space-y-6 pt-2">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px] text-center">Approved by:</p>
                                  <div className="text-center">
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryDirectorName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryDirectorName || "NAME OF DIRECTOR FOR INSTRUCTION"}
                                    </p>
                                    <p className="text-[11px] text-black font-semibold mt-1">Director for Instruction</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* OPTION 3: PREPARED BY PROGRAM CHAIR */}
                          {signatoryLayoutMode === "PREPARED_BY_PC" && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12 text-xs text-black font-sans pt-1">
                                <div className="space-y-6">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Prepared by:</p>
                                  <div>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryProgChairName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryProgChairName || signatoryFacultyName || "NAME OF PROGRAM CHAIRPERSON"}
                                    </p>
                                    <p className="text-[11px] text-black font-semibold mt-1">Program Chairperson</p>
                                  </div>
                                </div>

                                <div className="space-y-6">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Recommending Approval:</p>
                                  <div>
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryDeptChairName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryDeptChairName || "NAME OF DEPARTMENT CHAIRPERSON"}
                                    </p>
                                    <p className="text-[11px] text-black font-semibold mt-1">Department Chairperson</p>
                                  </div>
                                </div>

                                <div className="sm:col-span-2 max-w-sm mx-auto w-full space-y-6 pt-2">
                                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px] text-center">Approved by:</p>
                                  <div className="text-center">
                                    <p
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => setSignatoryDirectorName(e.currentTarget.innerText || "")}
                                      className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 cursor-text print:p-0 print:bg-transparent"
                                    >
                                      {signatoryDirectorName || "NAME OF DIRECTOR FOR INSTRUCTION"}
                                    </p>
                                    <p className="text-[11px] text-black font-semibold mt-1">Director for Instruction</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      </div>

                      {/* BSC OFFICIAL TOS FOOTER IMAGE (BORDERLESS AT BOTTOM EDGE) */}
                      <div className="w-full mt-auto relative overflow-hidden leading-none block shrink-0">
                        <img
                          src="/bsc-tos-footer.png"
                          alt="Batanes State College TOS Footer"
                          className="w-full h-auto object-cover block mx-auto print:w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>


            {/* DOCUMENT 2: OFFICIAL EXAMINATION PAPER (A4 SIZE PAGINATED PAGES) */}
            <div className={`space-y-6 pt-4 font-sans print:pt-0 ${printMode === "tos" ? "print:hidden" : ""}`}>
                <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-3 rounded-2xl print:hidden">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="font-extrabold text-xs uppercase tracking-wider">
                      Official Examination Paper — A4 Print Format ({previewPages.length} {previewPages.length === 1 ? "Page" : "Pages"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handlePrintExam}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-xl transition-all shadow-2xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Print Test Questions</span>
                    </button>
                    <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-xl">
                      Standard A4 Sheet Layout
                    </span>
                  </div>
                </div>

                {/* A4 PAGINATED PAGES rendering */}
                {previewPages.map((pageBlocks, pageIdx) => (
                  <div
                    key={pageIdx}
                    style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                    className="tq-container w-full max-w-[794px] mx-auto bg-white border-none rounded-none shadow-md font-sans select-text relative min-h-[1123px] flex flex-col justify-between overflow-hidden print:max-w-none print:min-h-0 print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none print:break-after-page"
                  >
                    {/* BSC OFFICIAL HEADER IMAGE FOR EVERY A4 PAGE */}
                    <div className="w-full relative overflow-hidden leading-none block shrink-0">
                      <img
                        src="/bsc-header.png"
                        alt="Batanes State College Header"
                        className="w-full h-auto object-cover block mx-auto print:w-full"
                      />
                    </div>

                    {/* INNER CONTENT BODY WITH PADDING */}
                    <div className="px-6 pb-6 pt-2 sm:px-10 sm:pb-10 sm:pt-3 space-y-3 flex-1">

                      {/* PAGE 1: FULL EXAMINATION METADATA HEADER */}
                      {pageIdx === 0 ? (
                        <>
                          <div className="text-center space-y-0.5 pt-0 pb-1 border-b border-slate-200">
                            <h2 className="text-base sm:text-lg font-black font-sans text-slate-900 tracking-wider uppercase">
                              {selectedCourse.course_code}{selectedCourse.course_title ? ` — ${selectedCourse.course_title}` : ""}
                            </h2>
                            <p className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                              {term.toUpperCase()} EXAMINATION
                            </p>
                            <p className="text-xs font-bold text-slate-700">
                              {applicableSemesterLabel}
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
                        </>
                      ) : (
                        /* PAGE 2+: COMPACT PAGE HEADER */
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-bold text-slate-600">
                          <span className="uppercase tracking-wide font-black text-slate-900">
                            {term.toUpperCase()} EXAMINATION PAPER — {selectedCourse.course_code}
                          </span>
                          <span className="bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded text-[10px] text-slate-700 font-extrabold">
                            Page {pageIdx + 1} of {previewPages.length}
                          </span>
                        </div>
                      )}

                      {/* BLOCKS ON THIS A4 PAGE */}
                      <div className="space-y-4 pt-1">
                        {pageBlocks.map((block) => {
                          if (block.type === "type-header") {
                            const typeTitles: Record<string, string> = {
                              Multiple_Choice: "MULTIPLE CHOICE",
                              Identification: "IDENTIFICATION",
                              True_False: "TRUE OR FALSE",
                              Fill_In_The_Blanks: "FILL IN THE BLANKS",
                              Matching_Type: "MATCHING TYPE",
                              Essay: "ESSAY / COMPREHENSION",
                            };
                            const typeDirections: Record<string, string> = {
                              Multiple_Choice: "Read each question carefully and select the letter corresponding to the correct answer.",
                              Identification: "Identify the concept, term, or statement described in each item. Write your answer clearly.",
                              True_False: "Read each statement carefully. Write True if the statement is correct; otherwise write False.",
                              Fill_In_The_Blanks: "Fill in the blank space(s) with the correct word or phrase to complete the statement.",
                              Matching_Type: "Match the premises in Column A with the corresponding correct options in Column B.",
                              Essay: "Answer each question concisely and thoroughly in the space provided.",
                            };
                            const qType = block.qType || "";
                            return (
                              <div key={block.id} className="pt-3 pb-1.5 border-b-2 border-slate-900 mt-4 mb-2">
                                <div className="flex items-baseline justify-between">
                                  <h4
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const val = e.currentTarget.innerText || "";
                                      setCustomTypeTitles((prev) => ({ ...prev, [qType]: val }));
                                    }}
                                    className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-wide uppercase font-sans outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                                    title="Click to edit test section header title"
                                  >
                                    {customTypeTitles[qType] !== undefined
                                      ? customTypeTitles[qType]
                                      : `TEST ${toRomanNumeral(block.testNum!)}. ${typeTitles[qType] || qType.toUpperCase()}`}
                                  </h4>
                                  <span className="text-xs font-extrabold text-slate-900 font-sans tracking-tight shrink-0">
                                    ({block.points} {block.points === 1 ? "Point" : "Points"})
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 italic font-sans mt-0.5 leading-tight">
                                  <span className="font-bold not-italic">Directions: </span>
                                  <span
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const val = e.currentTarget.innerText || "";
                                      setCustomDirections((prev) => ({ ...prev, [qType]: val }));
                                    }}
                                    className="outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                                    title="Click to edit directions for this test type"
                                  >
                                    {customDirections[qType] !== undefined
                                      ? customDirections[qType]
                                      : (typeDirections[qType] || "Read each question carefully and answer accordingly.")}
                                  </span>
                                </p>
                              </div>
                            );
                          }

                          if (block.type === "question-item" && block.q) {
                            const q = block.q;
                            const itemNumLabel = block.itemNumberLabel || (block.idx! + 1);

                            return (
                              <div key={block.id} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs shadow-2xs">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <span className="font-extrabold text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[11px] shrink-0">
                                      Item {itemNumLabel}.
                                    </span>
                                    <p className="font-extrabold text-slate-900 leading-relaxed text-xs">
                                      {q.text || "(Question prompt empty)"}
                                    </p>
                                  </div>
                                  <span className="text-[9px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded shrink-0">
                                    {q.taxonomy_level || "KNOWLEDGE / REMEMBERING"} • {q.points || 1} pt(s)
                                  </span>
                                </div>

                                {/* Prompt Image if any */}
                                {q.image_url && (
                                  <div className="pl-6 pt-1">
                                    <img src={q.image_url} alt={`Question ${itemNumLabel}`} className="max-h-36 rounded-lg border border-slate-300 object-contain" />
                                  </div>
                                )}

                                {/* Multiple Choice Options */}
                                {q.question_type === "Multiple_Choice" && q.options && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {q.options.map((opt: string, optIdx: number) => {
                                        const label = String.fromCharCode(65 + optIdx);
                                        return (
                                          <div
                                            key={optIdx}
                                            className="flex items-center gap-2 font-medium text-xs px-2.5 py-1.5 rounded-lg border bg-slate-50 border-slate-200/80 text-slate-800"
                                          >
                                            <span className="font-bold px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-900">
                                              {label}.
                                            </span>
                                            <span>{opt || `Option ${label}`}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* True / False Options */}
                                {q.question_type === "True_False" && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="flex items-center gap-4 font-semibold text-slate-700">
                                      {["True", "False"].map((choice) => (
                                        <div
                                          key={choice}
                                          className="flex items-center gap-1.5 border px-3 py-1 rounded-lg text-xs bg-slate-50 border-slate-300 text-slate-700"
                                        >
                                          <div className="w-3.5 h-3.5 border-2 border-slate-400 rounded-sm flex items-center justify-center" />
                                          <span>{choice}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Identification Line */}
                                {q.question_type === "Identification" && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="border-b-2 border-dashed border-slate-400 w-full max-w-xs h-6 text-slate-400 font-mono text-[10px] flex items-end">
                                      Answer: _______________________
                                    </div>
                                  </div>
                                )}

                                {/* Fill In The Blanks */}
                                {q.question_type === "Fill_In_The_Blanks" && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="text-slate-600 font-medium">
                                      {(q.blanks || []).map((b: any, bIdx: number) => (
                                        <div key={bIdx} className="inline-block mr-3 mt-1 text-[11px] font-mono text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                                          Blank #{bIdx + 1}: ____________
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Matching Type Table */}
                                {q.question_type === "Matching_Type" && q.matches && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="grid grid-cols-2 gap-4 text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                                      <div className="space-y-1">
                                        <p className="font-bold text-[10px] text-slate-500 uppercase border-b pb-1">Column A (Premises)</p>
                                        {q.matches.map((m: any, mIdx: number) => (
                                          <p key={mIdx} className="font-semibold text-slate-800">{mIdx + 1}. {m.premise || `Premise ${mIdx + 1}`}</p>
                                        ))}
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-bold text-[10px] text-slate-500 uppercase border-b pb-1">Column B (Choices)</p>
                                        {q.matches.map((m: any, mIdx: number) => (
                                          <p key={mIdx} className="font-semibold text-slate-800">{String.fromCharCode(65 + mIdx)}. {m.choice || `Choice ${String.fromCharCode(65 + mIdx)}`}</p>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Essay Response Area */}
                                {q.question_type === "Essay" && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="border border-slate-300 rounded-lg p-2.5 h-16 bg-slate-50/50 text-slate-400 text-[10px] italic">
                                      [ Space for student response - Min {q.min_words || 50} words ]
                                    </div>
                                  </div>
                                )}

                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    </div>

                      {/* BSC OFFICIAL FOOTER IMAGE */}
                      <div className="w-full mt-auto relative overflow-hidden leading-none block shrink-0">
                        <img
                          src="/bsc-footer.png"
                          alt="Batanes State College Footer"
                          className="w-full h-auto object-cover block mx-auto print:w-full"
                        />
                      </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Floating Bottom Navigation Bar (Visible while scrolling in all steps) */}
      <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl flex items-center justify-between gap-4 transition-all print:hidden">
        {/* Left Side Navigation Button */}
        {step === 1 ? (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 px-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Exam Setup & TOS</span>
            <span className="sm:hidden">Step 1</span>
          </div>
        ) : step === 2 ? (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Config Settings</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Questions</span>
          </button>
        )}

        {/* Right Side Action Buttons */}
        <div className="flex items-center gap-2.5">


          {step === 1 ? (
            <button
              type="button"
              disabled={!isConfigValid}
              onClick={() => {
                syncQuestionsWithTos();
                setStep(2);
              }}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>Proceed to Questions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : step === 2 ? (
            <button
              type="button"
              disabled={questions.length === 0}
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <span>Proceed to Preview</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting || questions.length === 0}
              onClick={handleSubmitForReview}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-emerald-600/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              title={isProgChairAuthor ? "Submit directly to Department Chairperson" : (hasProgramChair ? "Final Submit to Program Chairperson" : "Final Submit to Department Chairperson")}
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isProgChairAuthor ? "Submit to Chair" : (hasProgramChair ? "Final Submit to Prog Chair" : "Final Submit to Dept Chair")}</span>
            </button>
          )}
        </div>
      </div>



      {/* Interactive Notification Popup Modal */}
      {popupModal && popupModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 select-none">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header / Banner */}
            <div className={`p-6 text-center border-b ${
              popupModal.type === "success" || popupModal.type === "save_draft"
                ? "bg-emerald-50/80 border-emerald-100 text-emerald-950"
                : popupModal.type === "warning"
                ? "bg-amber-50/80 border-amber-100 text-amber-950"
                : "bg-rose-50/80 border-rose-100 text-rose-950"
            }`}>
              <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-white/60 bg-white">
                {popupModal.type === "success" ? (
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                ) : popupModal.type === "save_draft" ? (
                  <Save className="w-8 h-8 text-emerald-600" />
                ) : popupModal.type === "warning" ? (
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-rose-600" />
                )}
              </div>
              <h3 className="text-lg font-extrabold tracking-tight">{popupModal.title}</h3>
              <p className="text-xs font-semibold text-slate-600 mt-1">{popupModal.message}</p>
            </div>

            {/* Details Summary List */}
            {popupModal.details && popupModal.details.length > 0 && (
              <div className="p-5 bg-slate-50 border-b border-slate-100 space-y-2 max-h-48 overflow-y-auto">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Details Summary:</p>
                <ul className="space-y-1.5">
                  {popupModal.details.map((item, idx) => (
                    <li key={idx} className="text-xs font-medium text-slate-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Footer */}
            <div className="p-4 bg-white border-t border-slate-100">
              {popupModal.type === "save_draft" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setPopupModal(null);
                      router.push(returnUrl || "/dashboard/faculty");
                    }}
                    className="w-full inline-flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    <LogOut className="w-4 h-4 text-slate-600 shrink-0" />
                    <span>Exit Exam Builder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (popupModal.onConfirm) {
                        popupModal.onConfirm();
                      }
                      setPopupModal(null);
                    }}
                    className="w-full inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold py-2.5 px-3 rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 shrink-0" />
                    <span>Continue Editing</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (popupModal.onConfirm) {
                      popupModal.onConfirm();
                    }
                    setPopupModal(null);
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold shadow-sm transition-all text-white cursor-pointer ${
                    popupModal.type === "success"
                      ? "bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/20"
                      : popupModal.type === "warning"
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-slate-900 hover:bg-slate-800"
                  }`}
                >
                  {popupModal.confirmText || (popupModal.type === "success" ? "Got it!" : "Close")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
