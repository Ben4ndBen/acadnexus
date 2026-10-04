"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Settings, BookOpen, ClipboardCheck, ArrowLeft, ArrowRight, Save, 
  Upload, Trash2, Plus, Check, Eye, Trash, ArrowUp, ArrowDown, FileText, 
  Shuffle, AlertCircle, RefreshCw, FileUp, Sparkles, CheckCircle, Search, X,
  Tag, Layers, Sliders, Hash, ListFilter, Calendar, GraduationCap, Users,
  CheckSquare, Square, ChevronDown, ChevronUp, ChevronRight, Printer
} from "lucide-react";
import { saveExamConfig, saveExamQuestions, updateExamStatus, uploadQuestionAttachment, uploadTosFileAction, getQuestionBankQuestions, importQuestionsToExam, getAssignedStudentsForCourse } from "@/app/actions/faculty";
import { determineSemesterFromDate, formatStudentName } from "@/lib/academicUtils";
import { Latex } from "@/app/components/Latex";

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

// Deserialization helper
function deserializeQuestions(dbQuestions: any[]): QuestionState[] {
  return dbQuestions.map(q => {
    let text = q.question_text;
    let options: string[] = [];
    let premises: string[] = [];
    let matches: Array<{ premise: string; choice: string }> = [];
    let blanks: Array<{ id: number; answer: string; points: number }> = [];
    let min_words: number | undefined = undefined;
    let correctAnswer = q.correct_answer;
    let image_url = "";
    let taxonomy_level: TaxonomyLevel = "KNOWLEDGE / REMEMBERING";

    // Check if the question text is a serialized JSON object
    if (q.question_text.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(q.question_text);
        text = parsed.text || q.question_text;
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
        text = parsedText.text || q.question_text;
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

    return {
      question_id: q.question_id,
      text,
      question_type: q.question_type,
      options,
      premises,
      matches,
      blanks,
      min_words,
      correctAnswer,
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
  initialAssignedStudents = []
}: ExamBuilderWizardProps) {
  const router = useRouter();

  // Steps: 1 = Config, 2 = Questions, 3 = Preview & Submit
  const [step, setStep] = useState<number>(1);

  // 1. Examination Term (Default from DI choice, non-editable by faculty) & Date
  const term = exam.term || academicPeriodSettings?.active_term || "Midterm";
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

  // Configuration Settings State - Title is auto-populated and not manually edited
  const [title, setTitle] = useState<string>(
    exam.title && exam.title !== "New Examination Draft"
      ? exam.title
      : `${term} Examination in ${selectedCourse.course_title || selectedCourse.course_code}`
  );
  const [timeLimit, setTimeLimit] = useState<number>(exam.time_limit_minutes);
  const [randomizeItems, setRandomizeItems] = useState<boolean>(exam.randomize_items);
  const [timePenalty, setTimePenalty] = useState<number>(exam.time_penalty_seconds ?? 60);
  const [scorePenalty, setScorePenalty] = useState<number>(exam.score_penalty_points ?? 2);

  // 3. Assigned Students Selection with Sort & Filter
  const [assignedStudents, setAssignedStudents] = useState<StudentItem[]>(initialAssignedStudents);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(
    exam.selected_student_ids && exam.selected_student_ids.length > 0
      ? exam.selected_student_ids
      : initialAssignedStudents.map(s => s.student_id)
  );
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Filter & Sort State for Assigned Students
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [studentProgramFilter, setStudentProgramFilter] = useState<string>("ALL");
  const [studentMajorFilter, setStudentMajorFilter] = useState<string>("ALL");
  const [studentYearFilter, setStudentYearFilter] = useState<string>("ALL");
  const [studentSortBy, setStudentSortBy] = useState<"lastNameAsc" | "lastNameDesc" | "firstNameAsc" | "firstNameDesc" | "yearAsc" | "yearDesc" | "programAsc" | "majorAsc" | "majorDesc">("lastNameAsc");

  const availableStudentPrograms = useMemo(() => {
    return Array.from(new Set(assignedStudents.map(s => s.program_code).filter(Boolean)));
  }, [assignedStudents]);

  const availableStudentMajors = useMemo(() => {
    const defaultMajors = [
      "AUTOMOTIVE TECHNOLOGY",
      "ELECTRONICS TECHNOLOGY",
      "ARCHITECTURE TECHNOLOGY",
      "SCIENCE",
      "ENGLISH",
      "MATH"
    ];
    const presentMajors = assignedStudents.map(s => s.section).filter(Boolean);
    const set = new Set([...defaultMajors, ...presentMajors]);
    return Array.from(set).sort();
  }, [assignedStudents]);

  const availableStudentYears = useMemo(() => {
    const defaultYears = [1, 2, 3, 4];
    const presentYears = assignedStudents.map(s => s.year_level).filter(Boolean);
    const set = new Set([...defaultYears, ...presentYears]);
    return Array.from(set).sort((a, b) => a - b);
  }, [assignedStudents]);

  const filteredAndSortedStudents = useMemo(() => {
    return assignedStudents
      .filter(s => {
        if (studentProgramFilter !== "ALL" && s.program_code !== studentProgramFilter) return false;
        if (studentMajorFilter !== "ALL" && (s.section || "General") !== studentMajorFilter) return false;
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
  }, [assignedStudents, studentSearch, studentProgramFilter, studentMajorFilter, studentYearFilter, studentSortBy]);

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
    if (newCourse) {
      setTitle(`${term} Examination in ${newCourse.course_title || newCourse.course_code}`);
    }
    setLoadingStudents(true);
    try {
      const res = await getAssignedStudentsForCourse(newId);
      if (res.success && res.students) {
        setAssignedStudents(res.students);
        setSelectedStudentIds(res.students.map(s => s.student_id));
      }
    } catch (err) {
      console.error("Failed to load students for course:", err);
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
  const [questions, setQuestions] = useState<QuestionState[]>(() =>
    sortQuestionsByType(deserializeQuestions(exam.questionBank))
  );
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(
    exam.questionBank.length > 0 ? 0 : -1
  );

  // Topic Accordion Dropdown Open/Closed State (Minimized by default)
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

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
  const [showAnswerKey, setShowAnswerKey] = useState<boolean>(true);

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
  const [tosTargetTotalItems, setTosTargetTotalItems] = useState<number>(
    exam.questionBank.length > 0 ? exam.questionBank.length : 50
  );

  const [tosTopicPlans, setTosTopicPlans] = useState<Array<{ id: string; topic: string; hours: number }>>(() => {
    const uniqueFromQuestions = Array.from(new Set(exam.questionBank.map(q => q.topic?.trim()).filter(Boolean))) as string[];
    if (uniqueFromQuestions.length > 0) {
      return uniqueFromQuestions.map((t, idx) => ({
        id: String(idx + 1),
        topic: t,
        hours: 6,
      }));
    }
    return [
      { id: "1", topic: "Module 1: Core Fundamentals & Concepts", hours: 6 },
      { id: "2", topic: "Module 2: Analytical Methods & Implementation", hours: 10 },
      { id: "3", topic: "Module 3: Advanced Applications & Problem Solving", hours: 8 },
    ];
  });

  // Editable Learning Outcomes map per topic
  const [learningOutcomes, setLearningOutcomes] = useState<Record<string, string>>({});

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
    return tosTopicPlans.reduce((sum, t) => sum + (t.hours || 0), 0);
  }, [tosTopicPlans]);

  const totalCalculatedTosItems = useMemo(() => {
    return tosDistribution.reduce((sum, t) => sum + t.calculatedItems, 0);
  }, [tosDistribution]);

  const handleAddTosTopic = () => {
    if (!newTopicName.trim()) return;
    const hrs = parseFloat(newTopicHours) || 1;
    const newEntry = {
      id: Date.now().toString(),
      topic: newTopicName.trim(),
      hours: Math.max(0.5, hrs),
    };
    setTosTopicPlans(prev => [...prev, newEntry]);
    setNewTopicName("");
    setNewTopicHours("4");
    setTosNotification(`Added "${newEntry.topic}" (${hrs} hrs) to TOS Alignment Matrix.`);
    setTimeout(() => setTosNotification(null), 4000);
  };

  const handleUpdateTosTopic = (id: string, updatedName: string, updatedHours: number) => {
    setTosTopicPlans(prev =>
      prev.map(t => (t.id === id ? { ...t, topic: updatedName, hours: Math.max(0.1, updatedHours) } : t))
    );
  };

  const handleDeleteTosTopic = (id: string) => {
    setTosTopicPlans(prev => prev.filter(t => t.id !== id));
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
          newQuestionList.push({
            ...existingForThisTopic[i],
            topic: topicName,
          });
        } else {
          newQuestionList.push({
            text: `[Item ${globalItemNum}] Multiple Choice Question for ${topicName}`,
            question_type: "Multiple_Choice",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: "Option A",
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

    setQuestions(sortQuestionsByType(newQuestionList));
    if (activeQuestionIdx === -1 && newQuestionList.length > 0) {
      setActiveQuestionIdx(0);
    }
  };

  const handleApplyTosToQuestions = () => {
    syncQuestionsWithTos();
    setTosNotification(`Synchronized ${tosTargetTotalItems} exam items mapped to your TOS topics!`);
    setTimeout(() => setTosNotification(null), 4000);
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
        q.options = ["Option A", "Option B", "Option C", "Option D"];
      }
      if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) {
        q.correctAnswer = q.options[0] || "Option A";
      }
    } else if (newType === "True_False") {
      if (q.correctAnswer !== "True" && q.correctAnswer !== "False") {
        q.correctAnswer = "True";
      }
    } else if (newType === "Identification") {
      if (typeof q.correctAnswer !== "string") q.correctAnswer = "";
    } else if (newType === "Matching_Type") {
      if (!q.matches || q.matches.length === 0) {
        q.matches = [
          { premise: "Premise 1", choice: "Match 1" },
          { premise: "Premise 2", choice: "Match 2" },
        ];
      }
    } else if (newType === "Essay") {
      if (!q.min_words) q.min_words = 50;
      if (!q.text || q.text.startsWith("[Item ")) {
        q.text = "Discuss in detail your analysis of the topic below.";
      }
      if (q.points === 1) q.points = 5;
    } else if (newType === "Fill_In_The_Blanks") {
      if (!q.blanks || q.blanks.length === 0) {
        q.text = "The core concept of [blank] is applied in [blank].";
        q.blanks = [
          { id: 1, answer: "Answer 1", points: 2 },
          { id: 2, answer: "Answer 2", points: 2 },
        ];
        q.points = 4;
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

  // Submission validation: requires valid config, questions > 0, not submitting, AND TOS PDF uploaded
  const hasTosUploaded = Boolean(tosFilePath && tosFilePath.trim() !== "");
  const isSubmitAllowed = isConfigValid && questions.length > 0 && !isSubmitting && hasTosUploaded;

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
      newQ.options = ["Option A", "Option B", "Option C", "Option D"];
      newQ.correctAnswer = "Option A";
    } else if (type === "True_False") {
      newQ.correctAnswer = "True";
    } else if (type === "Identification") {
      newQ.correctAnswer = "";
    } else if (type === "Matching_Type") {
      newQ.matches = [
        { premise: "Premise 1", choice: "Match 1" },
        { premise: "Premise 2", choice: "Match 2" },
      ];
    } else if (type === "Essay") {
      newQ.text = "Discuss in detail your analysis of the topic below.";
      newQ.min_words = 50;
      newQ.points = 10;
    } else if (type === "Fill_In_The_Blanks") {
      newQ.text = "The capital of Batanes is [blank] and it is located in the [blank] region of the Philippines.";
      newQ.blanks = [
        { id: 1, answer: "Basco", points: 2 },
        { id: 2, answer: "northern", points: 2 },
      ];
      newQ.points = 4;
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
    if (q.correctAnswer === oldVal) {
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
    setSaveStatus({ type: "saving", message: "Saving examination details..." });

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

    const configRes = await saveExamConfig(configData);
    if (configRes.error) {
      setSaveStatus({ type: "error", message: `Config Error: ${configRes.error}` });
      return;
    }

    // Step 2: Save Questions (Auto-arranged by Question Type)
    const sortedQs = sortQuestionsByType(questions);
    const serializedQs = serializeQuestions(sortedQs);
    const questionsRes = await saveExamQuestions(exam.exam_id, serializedQs, facultyId);

    if (questionsRes.error) {
      setSaveStatus({ type: "error", message: `Questions Error: ${questionsRes.error}` });
      return;
    }

    setSaveStatus({ type: "success", message: "Examination saved as Draft successfully!" });
    setTimeout(() => setSaveStatus(null), 3000);
    router.refresh();
  };

  // Save and Submit for Review
  const handleSubmitForReview = async () => {
    setIsSubmitting(true);
    setSaveStatus({ type: "saving", message: "Finalizing and saving exam before submission..." });

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

    const configRes = await saveExamConfig(configData);
    if (configRes.error) {
      setSaveStatus({ type: "error", message: `Config Error: ${configRes.error}` });
      setIsSubmitting(false);
      return;
    }

    // Save questions (Auto-arranged by Question Type)
    const sortedQs = sortQuestionsByType(questions);
    const serializedQs = serializeQuestions(sortedQs);
    const questionsRes = await saveExamQuestions(exam.exam_id, serializedQs, facultyId);

    if (questionsRes.error) {
      setSaveStatus({ type: "error", message: `Questions Error: ${questionsRes.error}` });
      setIsSubmitting(false);
      return;
    }

    // Transition status to Pending_Chair
    const statusRes = await updateExamStatus(exam.exam_id, "Pending_Chair", facultyId);
    if (statusRes.error) {
      setSaveStatus({ type: "error", message: `Submission Error: ${statusRes.error}` });
      setIsSubmitting(false);
      return;
    }

    setSaveStatus({ type: "success", message: "Examination successfully submitted to Department Chair for review!" });
    setIsSubmitting(false);
    setTimeout(() => {
      router.push("/dashboard/faculty");
      router.refresh();
    }, 2000);
  };

  return (
    <div className="space-y-8 select-none">
      
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md border border-slate-200/80 p-5 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push("/dashboard/faculty")}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Exam Creator Wizard</h1>
            <p className="text-xs text-slate-400 font-medium">Draft Exam ID: #{exam.exam_id} • Status: {exam.current_status}</p>
          </div>
        </div>

        {/* Wizard Action Buttons & Document Reference on Top Right */}
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">

          {/* Top Right Field for Exam Document / Reference Number (like BSC-ODLF-017) */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 px-3.5 py-1.5 rounded-2xl shadow-inner">
            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Doc / Ref No.</span>
              <input
                type="text"
                value={documentReference}
                onChange={(e) => setDocumentReference(e.target.value)}
                placeholder="e.g. BSC-ODLF-017"
                className="bg-transparent text-xs font-mono font-black text-slate-800 placeholder:text-slate-400 focus:outline-none w-32 uppercase"
              />
            </div>
          </div>

          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300/60 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>

          <div className="flex items-center gap-2">
            <button
              disabled={!isSubmitAllowed}
              onClick={handleSubmitForReview}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-emerald-600/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              title={
                !hasTosUploaded
                  ? "Please go to Step 3 (Review & Preview) and upload a TOS PDF file (Max 10MB) to activate submission"
                  : "Submit examination draft to Chair"
              }
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Submit for Review
            </button>
          </div>
        </div>
      </div>

      {/* Save Notification Banner */}
      {saveStatus && (
        <div className={`p-4 rounded-2xl border text-xs font-extrabold flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
          saveStatus.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-100 shadow-sm" 
            : saveStatus.type === "saving"
            ? "bg-sky-50 text-sky-800 border-sky-100 shadow-sm"
            : "bg-rose-50 text-rose-800 border-rose-100 shadow-sm"
        }`}>
          {saveStatus.type === "saving" ? (
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
          ) : saveStatus.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{saveStatus.message}</span>
        </div>
      )}

      {/* Step Progress Indicators */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          
          {/* Step 1 Indicator */}
          <button 
            onClick={() => setStep(1)}
            className={`flex items-center gap-4 text-left p-3 rounded-2xl transition-all duration-300 ${
              step === 1 
                ? "bg-emerald-50/70 border border-emerald-100 text-emerald-900 shadow-sm" 
                : "text-slate-400 hover:bg-slate-50/50 hover:text-slate-700"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm transition-all ${
              step === 1 ? "bg-emerald-600 text-white shadow-md" : "bg-slate-100 text-slate-400"
            }`}>
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600/70">Step 1</p>
              <p className="text-sm font-bold">Exam Configuration</p>
            </div>
          </button>

          {/* Step 2 Indicator */}
          <button 
            disabled={!isConfigValid}
            onClick={() => setStep(2)}
            className={`flex items-center gap-4 text-left p-3 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none ${
              step === 2 
                ? "bg-emerald-50/70 border border-emerald-100 text-emerald-900 shadow-sm" 
                : "text-slate-400 hover:bg-slate-50/50 hover:text-slate-700"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm transition-all ${
              step === 2 ? "bg-emerald-600 text-white shadow-md" : "bg-slate-100 text-slate-400"
            }`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600/70">Step 2</p>
              <p className="text-sm font-bold">Question Bank</p>
            </div>
          </button>

          {/* Step 3 Indicator */}
          <button 
            disabled={!isConfigValid || questions.length === 0}
            onClick={() => setStep(3)}
            className={`flex items-center gap-4 text-left p-3 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none ${
              step === 3 
                ? "bg-emerald-50/70 border border-emerald-100 text-emerald-900 shadow-sm" 
                : "text-slate-400 hover:bg-slate-50/50 hover:text-slate-700"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm transition-all ${
              step === 3 ? "bg-emerald-600 text-white shadow-md" : "bg-slate-100 text-slate-400"
            }`}>
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600/70">Step 3</p>
              <p className="text-sm font-bold">Review & Preview</p>
            </div>
          </button>
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
              <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-2xl p-5 sm:p-6 space-y-4 shadow-md border border-emerald-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-white tracking-tight">1. Examination Term & Scheduled Date</h2>
                      <p className="text-xs text-emerald-200/80">Select examination term and planned test administration date first.</p>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                    Required Step
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Examination Term (Configured by Directorate - Non-editable) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-emerald-200 block">
                      Examination Term <span className="text-emerald-300/80 font-normal">(Directorate Standard)</span>
                    </label>
                    <div className="w-full bg-slate-900/90 border border-emerald-500/40 text-emerald-300 text-sm font-extrabold px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                      <span>{term} Examination</span>
                      <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-md">
                        Directorate Standard
                      </span>
                    </div>
                  </div>

                  {/* Exam Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-emerald-200 block">Exam Administration Date <span className="text-rose-400">*</span></label>
                    <input
                      type="date"
                      required
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full bg-slate-900/90 border border-emerald-500/40 text-white text-sm font-bold px-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Automatically Determined Applicable Semester Banner */}
                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Applicable Academic Semester:</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Automatically determined based on exam date (<span className="text-white font-mono font-bold">{examDate}</span>) and active academic period set by the Academic Directorate.
                    </p>
                  </div>
                  <div className="bg-emerald-500 text-slate-950 text-xs font-black px-3.5 py-1.5 rounded-xl shadow-sm shrink-0 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{applicableSemesterLabel}</span>
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
                <p className="text-xs text-slate-400">
                  Select from your official teaching load. Course code and title will load automatically.
                </p>

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
                    <p className="text-xs text-slate-400">
                      Designate class students eligible to take this examination.
                    </p>
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
                          <option value="majorAsc">Sort by Major (A-Z)</option>
                          <option value="majorDesc">Sort by Major (Z-A)</option>
                        </select>
                      </div>

                      {/* Filter by Program */}
                      <div className="sm:col-span-1">
                        <select
                          value={studentProgramFilter}
                          onChange={(e) => setStudentProgramFilter(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="ALL">Program: All Programs</option>
                          {availableStudentPrograms.map(prog => (
                            <option key={prog} value={prog}>{prog}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter by Major / Specialization */}
                      <div className="sm:col-span-1">
                        <select
                          value={studentMajorFilter}
                          onChange={(e) => setStudentMajorFilter(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="ALL">Major: All Majors</option>
                          {availableStudentMajors.map(maj => (
                            <option key={maj} value={maj}>{maj}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter by Year Level */}
                      <div className="sm:col-span-1">
                        <select
                          value={studentYearFilter}
                          onChange={(e) => setStudentYearFilter(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="ALL">Year: All Years</option>
                          {availableStudentYears.map(yr => (
                            <option key={yr} value={String(yr)}>Year Level {yr}</option>
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
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto bg-slate-50/40">
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

                          <div className="text-right">
                            <span className="text-[11px] font-bold text-slate-700 block">
                              {student.program_code} {student.section && student.section !== "General" ? `(${student.section}) ` : ""}— Year {student.year_level}
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
              </div>

              {/* Item Randomization Toggle */}
              <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Shuffle className="w-4 h-4 text-emerald-600" />
                    Randomize Question Order
                  </p>
                  <p className="text-xs text-slate-400">Shuffles questions randomly for each student session to mitigate collusion.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRandomizeItems(!randomizeItems)}
                  className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-all duration-300 focus:outline-none ${
                    randomizeItems ? "bg-emerald-600 justify-end" : "bg-slate-200 justify-start"
                  }`}
                >
                  <span className="bg-white w-4.5 h-4.5 rounded-full shadow-sm" />
                </button>
              </div>

              {/* Security Violations Penalties Configuration */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Security Violation Penalties
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure automatic time or score reductions executed when a student exits fullscreen, switches browser tabs, or loses window focus.
                </p>

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
                  Enter course topics, discussion hours taught, and total planned exam items. The TOS engine automatically calculates topic percentage weightings and target item allocations based on faculty teaching hours.
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
                      min="0.5"
                      step="0.5"
                      placeholder="e.g. 6"
                      value={newTopicHours}
                      onChange={(e) => setNewTopicHours(e.target.value)}
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
                                min="0.1"
                                step="0.5"
                                value={item.hours}
                                onChange={(e) => handleUpdateTosTopic(item.id, item.topic, parseFloat(e.target.value) || 0)}
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
                      <div className="p-4 sm:p-6 space-y-6 divide-y divide-slate-100">
                        {topicQuestions.length > 0 ? (
                          topicQuestions.map(({ q, globalIdx }) => (
                            <div key={globalIdx} className="pt-6 first:pt-0 space-y-5">
                              
                              {/* Question Item Bar */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/90 gap-3">
                                
                                {/* Left: Item # & Type Dropdown Selector */}
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs font-black text-white bg-slate-900 px-2.5 py-1 rounded-xl shadow-2xs">
                                    Item #{globalIdx + 1}
                                  </span>

                                  {/* Dynamic Test Part & Test Item Badge */}
                                  <span className="text-xs font-extrabold text-indigo-950 bg-indigo-100 border border-indigo-300/80 px-2.5 py-1 rounded-xl shadow-2xs">
                                    {questionTestInfoMap[globalIdx]?.badge || "Test 1 • Item 1"}
                                  </span>

                                  {/* Question Type Selector Dropdown per Item */}
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Type:</label>
                                    <select
                                      value={q.question_type}
                                      onChange={(e) => handleQuestionTypeChange(e.target.value as any, globalIdx)}
                                      className="bg-emerald-50 border border-emerald-300 text-emerald-950 font-extrabold text-xs px-3 py-1 rounded-xl shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
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
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                      Taxonomy Level:
                                    </label>
                                    <select
                                      value={q.taxonomy_level || "KNOWLEDGE / REMEMBERING"}
                                      onChange={(e) => updateQuestionTaxonomy(e.target.value as TaxonomyLevel, globalIdx)}
                                      className="bg-indigo-50 border border-indigo-300 text-indigo-950 font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                                    >
                                      <option value="KNOWLEDGE / REMEMBERING">1. Knowledge / Remembering</option>
                                      <option value="COMPREHENSION / UNDERSTANDING">2. Comprehension / Understanding</option>
                                      <option value="APPLICATION / APPLYING">3. Application / Applying</option>
                                      <option value="ANALYSIS / ANALYZING">4. Analysis / Analyzing</option>
                                      <option value="SYNTHESIS / EVALUATING">5. Synthesis / Evaluating</option>
                                      <option value="EVALUATION / CREATING">6. Evaluation / Creating</option>
                                    </select>
                                  </div>

                                  {/* Topic Assignment Dropdown Selector */}
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Topic:</label>
                                    <select
                                      value={q.topic || ""}
                                      onChange={(e) => updateQuestionTopic(e.target.value, globalIdx)}
                                      className="bg-slate-100 border border-slate-300 text-slate-900 font-bold text-xs px-2.5 py-1 rounded-xl shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer max-w-[200px] truncate"
                                    >
                                      <option value="">-- Select Topic --</option>
                                      {existingUniqueTopics.map((tName, tIdx) => (
                                        <option key={tIdx} value={tName}>
                                          {tName}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                    {/* Right: Points & Reorder/Delete Buttons */}
                                    <div className="flex flex-wrap items-center gap-3">
                                      <div className="flex items-center gap-1.5">
                                        <label className="text-[11px] font-bold text-slate-500">Points:</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max="100"
                                          value={q.points}
                                          onChange={(e) => updateQuestionPoints(Number(e.target.value), globalIdx)}
                                          className="w-12 bg-white border border-slate-300 rounded-lg text-center text-xs font-bold text-slate-800 py-1 focus:outline-emerald-500 shadow-2xs"
                                        />
                                      </div>

                                      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
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
                                      placeholder="Enter the question details here..."
                                      value={q.text}
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
                                      const isCorrect = q.correctAnswer === option;
                                      return (
                                        <div key={opIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                                          <button
                                            type="button"
                                            onClick={() => setMcCorrectAnswer(option, globalIdx)}
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
                                    value={q.correctAnswer}
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
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-extrabold text-slate-600">Blanks & Answer Keys:</label>
                                    <button
                                      type="button"
                                      onClick={() => addBlankItem(globalIdx)}
                                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" /> Insert Blank
                                    </button>
                                  </div>
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
                                            disabled={(q.blanks || []).length <= 1}
                                            onClick={() => deleteBlankItem(blankIdx, globalIdx)}
                                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                                          >
                                            <Trash className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
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

          {/* Footer Wizard Navigation */}
          <div className="flex justify-between items-center bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex justify-center items-center gap-2 border border-slate-200 bg-white text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Config Settings
            </button>

            <button
              type="button"
              disabled={questions.length === 0}
              onClick={() => setStep(3)}
              className="inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              Proceed to Preview
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* STEP 3: REVIEW & LIVE PREVIEW */}
      {step === 3 && (
        <div className="space-y-8">
          
          {/* Info Card Summary */}
          <div className="bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-950 text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 text-sm">
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Selected Course</p>
                <p className="font-extrabold text-slate-200 mt-1">
                  {courses.find(c => c.course_id === courseId)?.course_code} - {courses.find(c => c.course_id === courseId)?.course_title}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Assigned Students</p>
                <p className="font-extrabold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>{selectedStudentIds.length} / {assignedStudents.length} Students</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Time Limit</p>
                <p className="font-extrabold text-slate-200 mt-1">{timeLimit} Minutes</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Question Bank Size</p>
                <p className="font-extrabold text-slate-200 mt-1">{questions.length} Items ({questions.reduce((sum, q) => sum + q.points, 0)} points)</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Item Randomization</p>
                <p className={`font-extrabold mt-1 ${randomizeItems ? "text-emerald-400" : "text-amber-400"}`}>
                  {randomizeItems ? "Enabled (Shuffle on)" : "Disabled (Sequential)"}
                </p>
              </div>
            </div>
          </div>

          {/* ASSIGNED CLASS ROSTER VERIFICATION CARD */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-3 font-sans print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow-sm">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Assigned Class Roster ({selectedStudentIds.length} Eligible Students)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Verified roster of students authorized to take this examination.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl self-start sm:self-auto">
                {selectedStudentIds.length} / {assignedStudents.length} Selected
              </span>
            </div>

            {selectedStudentIds.length === 0 ? (
              <div className="p-4 text-center bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-800">
                No students selected. Go back to Step 1 to select assigned class students.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                {assignedStudents
                  .filter(s => selectedStudentIds.includes(s.student_id))
                  .map((s) => (
                    <div key={s.student_id} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[10px] uppercase shrink-0">
                        {s.first_name[0]}{s.last_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-slate-900 truncate">
                          {formatStudentName(s)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {s.institutional_id || "N/A"} • {s.program_code} {s.section && s.section !== "General" ? `(${s.section}) ` : ""}Y{s.year_level}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* STEP 3 PREVIEW TOP ACTION BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-3xl p-4 shadow-sm font-sans print:hidden">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2.5 rounded-2xl shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Step 3: Verification & Official Academic Documents
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Review the Official TOS Matrix (BSC-ODI-F-121) followed by the Examination Paper & Answer Key.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowAnswerKey(!showAnswerKey)}
                className={`inline-flex items-center justify-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-2xs border cursor-pointer ${
                  showAnswerKey
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100"
                    : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                }`}
                title="Toggle Answer Key visibility on Test Questionnaire preview"
              >
                <CheckCircle className={`w-4 h-4 ${showAnswerKey ? "text-emerald-600" : "text-slate-400"}`} />
                <span>{showAnswerKey ? "Answer Key Active" : "Show Answer Key"}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print All Documents</span>
              </button>
            </div>
          </div>

          {/* STEP 3 VERTICALLY STACKED PREVIEW CONTAINER */}
          <div className="space-y-8 font-sans">

            {/* DOCUMENT 1: OFFICIAL BATANES STATE COLLEGE TOS MATRIX (BSC-ODI-F-121 - A4 LANDSCAPE PAGINATED) */}
            <div className="space-y-6">
              {tosPages.map((pageRows, pageIdx) => (
                <div key={pageIdx} className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-3 rounded-2xl print:hidden max-w-[1123px] mx-auto">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span className="font-extrabold text-xs uppercase tracking-wider">
                        Official Table of Specifications (TOS) Matrix — Page {pageIdx + 1} of {tosPages.length} — A4 Landscape (BSC-ODI-F-121)
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-xl">
                      Page {pageIdx + 1} of {tosPages.length}
                    </span>
                  </div>

                  <div
                    style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                    className="w-full max-w-[1123px] mx-auto bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-10 shadow-xl space-y-4 select-text relative min-h-[790px] flex flex-col justify-between overflow-hidden print:max-w-none print:min-h-0 print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none print:break-after-page"
                  >
                    <style>{`
                      .tos-container, .tos-container * {
                        font-family: Arial, Helvetica, sans-serif !important;
                      }
                      @media print {
                        @page {
                          size: landscape;
                          margin: 8mm;
                        }
                        body {
                          background: white !important;
                        }
                      }
                    `}</style>

                    <div className="space-y-4">
                      {/* BSC OFFICIAL HEADER IMAGE */}
                      <div className="w-full border-b border-slate-200 pb-3 relative">
                        <div className="absolute top-1 right-2 sm:top-2 sm:right-4 z-10 print:top-0 print:right-0">
                          <span className="font-mono font-black text-[11px] sm:text-xs text-slate-900 bg-white/95 border-2 border-slate-400 px-2.5 py-0.5 rounded shadow-2xs uppercase tracking-wider">
                            BSC-ODI-F-121
                          </span>
                        </div>
                        <img
                          src="/bsc-header.png"
                          alt="Batanes State College Header"
                          className="w-full h-auto object-contain mx-auto max-h-[160px] print:max-h-none"
                        />
                      </div>

                      {/* PAGE 1 ONLY: TOS TITLE & METADATA GRID */}
                      {pageIdx === 0 ? (
                        <>
                          {/* TOS TITLE & TERM */}
                          <div className="text-center space-y-1 py-1 border-b border-slate-200">
                            <h2 className="text-lg sm:text-xl font-black font-serif text-slate-900 tracking-wide uppercase">
                              TABLE OF SPECIFICATIONS
                            </h2>
                            <p className="text-xs font-bold text-slate-800 uppercase">
                              <span className="underline font-black">[{term.toUpperCase()}] EXAMINATION</span>
                            </p>
                            <p className="text-xs font-semibold text-slate-700">
                              <span className="underline font-bold">{applicableSemesterLabel}</span>
                            </p>
                          </div>

                          {/* COURSE & EXAMINATION METADATA GRID */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs font-bold border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-bold uppercase min-w-[120px]">COURSE CODE:</span>
                              <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{selectedCourse.course_code || "N/A"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-bold uppercase min-w-[140px]">DATE OF EXAMINATION:</span>
                              <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{examDate}</span>
                            </div>
                            <div className="flex items-center gap-2 sm:col-span-2">
                              <span className="text-slate-500 font-bold uppercase min-w-[120px]">COURSE TITLE:</span>
                              <span className="font-extrabold text-slate-900">{selectedCourse.course_title || "N/A"}</span>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {/* BSC-ODI-F-121 OFFICIAL TABLE FORMAT */}
                      <div className="w-full max-w-full overflow-hidden rounded-xl border border-slate-300 shadow-2xs print:overflow-visible">
                        <table className="w-full text-left border-collapse text-[10px] print:text-[9px] table-fixed">
                          <thead>
                            <tr className="bg-white text-black font-black uppercase text-center border-b border-slate-400">
                              <th rowSpan={3} className="py-2.5 px-1.5 border-r border-slate-300 w-[14%] text-left font-black align-middle text-[9.5px] leading-tight">LESSON / TOPIC</th>
                              <th rowSpan={3} className="py-2.5 px-1.5 border-r border-slate-300 w-[21%] text-left font-black align-middle text-[9.5px] leading-tight">LEARNING OUTCOMES</th>
                              <th rowSpan={3} className="py-2.5 px-1 border-r border-slate-300 w-[5.5%] font-black align-middle text-[8.5px] leading-tight">NO. OF TEACHING HOURS</th>
                              <th rowSpan={3} className="py-2.5 px-1 border-r border-slate-300 w-[5.5%] font-black align-middle text-[8.5px] leading-tight">% OF ALLOCATION</th>
                              <th rowSpan={3} className="py-2.5 px-1 border-r border-slate-300 w-[5.5%] font-black align-middle text-[8.5px] leading-tight">NO. OF ITEMS</th>
                              <th colSpan={7} className="py-1.5 px-1 border-r border-b border-slate-300 bg-white text-black font-black text-[9.5px] tracking-tight">
                                ITEM SPECIFICATION PER TAXONOMY OF LEARNING
                              </th>
                              <th rowSpan={3} className="py-2.5 px-1 w-[9.5%] font-black align-middle text-[8.5px] leading-tight">ITEM PLACEMENT</th>
                            </tr>
                            <tr className="bg-white text-black font-black text-[8px] uppercase text-center border-b border-slate-300">
                              <th className="py-1.5 px-0.5 border-r border-b border-slate-300 font-black leading-snug break-words">
                                KNOWLEDGE /<br />REMEMBERING
                              </th>
                              <th className="py-1.5 px-0.5 border-r border-b border-slate-300 font-black leading-snug break-words">
                                COMPREHENSION /<br />UNDERSTANDING
                              </th>
                              <th className="py-1.5 px-0.5 border-r border-b border-slate-300 font-black leading-snug break-words">
                                APPLICATION /<br />APPLYING
                              </th>
                              <th className="py-1.5 px-0.5 border-r border-b border-slate-300 font-black leading-snug break-words">
                                ANALYSIS /<br />ANALYZING
                              </th>
                              <th className="py-1.5 px-0.5 border-r border-b border-slate-300 font-black leading-snug break-words">
                                SYNTHESIS /<br />EVALUATING
                              </th>
                              <th className="py-1.5 px-0.5 border-r border-b border-slate-300 font-black leading-snug break-words">
                                EVALUATION /<br />CREATING
                              </th>
                              <th rowSpan={2} className="py-2 px-1 border-r border-slate-300 bg-white font-black text-black text-[9.5px] align-middle">TOTAL</th>
                            </tr>
                            <tr className="bg-white text-black font-black text-[11px] uppercase text-center border-b-2 border-slate-400">
                              <th className="py-1 px-1 border-r border-slate-300 font-black">
                                {overallTaxonomyPercents.remembering > 0 ? `${overallTaxonomyPercents.remembering}%` : "—"}
                              </th>
                              <th className="py-1 px-1 border-r border-slate-300 font-black">
                                {overallTaxonomyPercents.understanding > 0 ? `${overallTaxonomyPercents.understanding}%` : "—"}
                              </th>
                              <th className="py-1 px-1 border-r border-slate-300 font-black">
                                {overallTaxonomyPercents.applying > 0 ? `${overallTaxonomyPercents.applying}%` : "—"}
                              </th>
                              <th className="py-1 px-1 border-r border-slate-300 font-black">
                                {overallTaxonomyPercents.analyzing > 0 ? `${overallTaxonomyPercents.analyzing}%` : "—"}
                              </th>
                              <th className="py-1 px-1 border-r border-slate-300 font-black">
                                {overallTaxonomyPercents.evaluating > 0 ? `${overallTaxonomyPercents.evaluating}%` : "—"}
                              </th>
                              <th className="py-1 px-1 border-r border-slate-300 font-black">
                                {overallTaxonomyPercents.creating > 0 ? `${overallTaxonomyPercents.creating}%` : "—"}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-300 font-medium text-black bg-white">
                            {pageRows.map((row, idx) => {
                              const t = row.taxonomy;
                              return (
                                <tr key={idx} className="bg-white">
                                  <td className="py-3 px-3 font-bold text-black border-r border-slate-300 align-top">
                                    {row.topic}
                                  </td>
                                  <td className="py-2 px-2 text-black border-r border-slate-300 text-[10px] align-top">
                                    <textarea
                                      rows={2}
                                      value={learningOutcomes[row.topic] ?? `Demonstrates competency and learning outcomes for ${row.topic.toLowerCase()}.`}
                                      onChange={(e) => {
                                        handleUpdateLearningOutcome(row.topic, e.target.value);
                                        e.target.style.height = "auto";
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.height = "auto";
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                      }}
                                      placeholder="Enter learning outcomes for this topic..."
                                      className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200/80 hover:border-slate-300 focus:border-emerald-500 rounded-lg p-1.5 font-sans text-[10px] text-black font-medium focus:outline-none transition-all print:border-none print:bg-transparent print:p-0 print:m-0 resize-y whitespace-pre-wrap break-words overflow-hidden"
                                      title="Faculty: Click to edit learning outcomes for this topic"
                                    />
                                  </td>
                                  <td className="py-3 px-2 text-center font-bold text-black border-r border-slate-300 align-top">
                                    {row.hoursTaught > 0 ? row.hoursTaught : "—"}
                                  </td>
                                  <td className="py-3 px-2 text-center font-extrabold text-black border-r border-slate-300 align-top">
                                    {row.weightPercentage}%
                                  </td>
                                  <td className="py-3 px-2 text-center font-extrabold text-black border-r border-slate-300 align-top">
                                    {row.count}
                                  </td>
                                  {/* Taxonomy 6 Columns - Whole Numbers Only */}
                                  <td className="py-3 px-1 text-center border-r border-slate-300 font-bold text-black align-top">
                                    {t.remembering.count > 0 ? t.remembering.count : "—"}
                                  </td>
                                  <td className="py-3 px-1 text-center border-r border-slate-300 font-bold text-black align-top">
                                    {t.understanding.count > 0 ? t.understanding.count : "—"}
                                  </td>
                                  <td className="py-3 px-1 text-center border-r border-slate-300 font-bold text-black align-top">
                                    {t.applying.count > 0 ? t.applying.count : "—"}
                                  </td>
                                  <td className="py-3 px-1 text-center border-r border-slate-300 font-bold text-black align-top">
                                    {t.analyzing.count > 0 ? t.analyzing.count : "—"}
                                  </td>
                                  <td className="py-3 px-1 text-center border-r border-slate-300 font-bold text-black align-top">
                                    {t.evaluating.count > 0 ? t.evaluating.count : "—"}
                                  </td>
                                  <td className="py-3 px-1 text-center border-r border-slate-300 font-bold text-black align-top">
                                    {t.creating.count > 0 ? t.creating.count : "—"}
                                  </td>
                                  <td className="py-3 px-1 text-center border-r border-slate-300 font-black text-black bg-white align-top">
                                    {row.count}
                                  </td>
                                  <td className="py-3 px-3 font-mono font-bold text-black text-[10px] align-top">
                                    {row.rangeString}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {pageIdx === tosPages.length - 1 && (
                            <tfoot>
                              <tr className="bg-amber-400 text-slate-950 font-black text-xs uppercase border-t-2 border-slate-900">
                                <td colSpan={2} className="py-3 px-3">TOTAL</td>
                                <td className="py-3 px-2 text-center">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.hoursTaught, 0)}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  {questions.length > 0 ? 100 : 0}%
                                </td>
                                <td className="py-3 px-2 text-center">
                                  {questions.length}
                                </td>
                                {/* Total per Taxonomy level - Whole Numbers Only */}
                                <td className="py-3 px-1 text-center font-extrabold">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.remembering.count, 0) || "—"}
                                </td>
                                <td className="py-3 px-1 text-center font-extrabold">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.understanding.count, 0) || "—"}
                                </td>
                                <td className="py-3 px-1 text-center font-extrabold">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.applying.count, 0) || "—"}
                                </td>
                                <td className="py-3 px-1 text-center font-extrabold">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.analyzing.count, 0) || "—"}
                                </td>
                                <td className="py-3 px-1 text-center font-extrabold">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.evaluating.count, 0) || "—"}
                                </td>
                                <td className="py-3 px-1 text-center font-extrabold">
                                  {tosTopicBreakdown.reduce((sum, r) => sum + r.taxonomy.creating.count, 0) || "—"}
                                </td>
                                <td className="py-3 px-1 text-center font-black bg-amber-500 text-slate-950">
                                  {questions.length}
                                </td>
                                <td className="py-3 px-3 text-[10px] lowercase font-semibold">
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>

                    {/* BSC FOOTER GRAPHIC */}
                    <div className="w-full border-t border-slate-300 pt-3 mt-4 flex items-center justify-between">
                      <img
                        src="/bsc-footer.png"
                        alt="Batanes State College Footer"
                        className="w-full h-auto object-contain mx-auto max-h-[140px] print:max-h-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>


            {/* DOCUMENT 2: OFFICIAL EXAMINATION PAPER (A4 SIZE PAGINATED PAGES) */}
            <div className="space-y-6 pt-4 font-sans print:pt-0">
                <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-3 rounded-2xl print:hidden">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="font-extrabold text-xs uppercase tracking-wider">
                      Official Examination Paper — A4 Print Format ({previewPages.length} {previewPages.length === 1 ? "Page" : "Pages"})
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-xl">
                    Standard A4 Sheet Layout
                  </span>
                </div>

                {/* A4 PAGINATED PAGES rendering */}
                {previewPages.map((pageBlocks, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="w-full max-w-[850px] mx-auto bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-10 shadow-xl space-y-4 font-sans select-text relative min-h-[1050px] flex flex-col justify-between print:min-h-0 print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none"
                  >
                    <div className="space-y-4">
                      {/* BSC OFFICIAL HEADER IMAGE FOR EVERY A4 PAGE */}
                      <div className="w-full border-b border-slate-200 pb-3">
                        <img
                          src="/bsc-header.png"
                          alt="Batanes State College Header"
                          className="w-full h-auto object-contain mx-auto max-h-[140px] print:max-h-none"
                        />
                      </div>

                      {/* PAGE 1: FULL EXAMINATION METADATA HEADER */}
                      {pageIdx === 0 ? (
                        <>
                          <div className="text-center space-y-1 py-1 border-b border-slate-200">
                            <h2 className="text-base sm:text-lg font-black font-serif text-slate-900 tracking-wide uppercase">
                              OFFICIAL EXAMINATION PAPER
                            </h2>
                            <p className="text-xs font-bold text-slate-800 uppercase">
                              <span className="underline font-black">[{term.toUpperCase()}] EXAMINATION</span>
                            </p>
                            <p className="text-xs font-semibold text-slate-700">
                              <span className="underline font-bold">{applicableSemesterLabel}</span>
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs font-bold border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-bold uppercase min-w-[100px]">COURSE:</span>
                              <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{selectedCourse.course_code}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-bold uppercase min-w-[110px]">DATE:</span>
                              <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{examDate}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-bold uppercase min-w-[100px]">TIME LIMIT:</span>
                              <span className="font-black text-slate-900">{timeLimit} Minutes</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-bold uppercase min-w-[110px]">TOTAL ITEMS:</span>
                              <span className="font-black text-slate-900">{questions.length} Items ({questions.reduce((sum, q) => sum + (q.points || 1), 0)} Pts)</span>
                            </div>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                            <p className="font-black text-slate-900 uppercase tracking-wider text-[10px]">General Instructions:</p>
                            <p className="text-slate-700 font-medium text-[11px] leading-relaxed">
                              Read each item carefully before answering. Ensure your responses are clear and legibly written. Manage your time wisely across all test parts ({timeLimit} minutes).
                            </p>
                          </div>
                        </>
                      ) : (
                        /* PAGE 2+: COMPACT PAGE HEADER */
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-bold text-slate-600">
                          <span className="uppercase tracking-wide font-black text-slate-900">
                            [{term.toUpperCase()}] EXAMINATION PAPER — {selectedCourse.course_code}
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
                              <div key={block.id} className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between shadow-2xs mt-3">
                                <div>
                                  <h4 className="font-black text-xs uppercase tracking-wider">
                                    TEST {block.testNum}. {typeTitles[qType] || qType.toUpperCase()}
                                  </h4>
                                  <p className="text-[10px] text-slate-300 font-medium mt-0.5">
                                    {typeDirections[qType]}
                                  </p>
                                </div>
                                <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md shrink-0">
                                  {block.points} Pts Total
                                </span>
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
                                        const isCorrect = (q.correctAnswer === opt) || (q.correctAnswer?.trim().toUpperCase() === label);
                                        return (
                                          <div
                                            key={optIdx}
                                            className={`flex items-center gap-2 font-medium text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                                              showAnswerKey && isCorrect
                                                ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-extrabold shadow-2xs"
                                                : "bg-slate-50 border-slate-200/80 text-slate-800"
                                            }`}
                                          >
                                            <span
                                              className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                                showAnswerKey && isCorrect
                                                  ? "bg-emerald-600 text-white"
                                                  : "bg-slate-200 text-slate-900"
                                              }`}
                                            >
                                              {label}.
                                            </span>
                                            <span>{opt || `Option ${label}`}</span>
                                            {showAnswerKey && isCorrect && (
                                              <span className="ml-auto text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                                <Check className="w-3 h-3 text-emerald-600 font-black" /> Key
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {showAnswerKey && (
                                      <div className="inline-flex items-center gap-1.5 bg-emerald-50/90 border border-emerald-300/80 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-950">
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Answer Key:</span>
                                        <span className="font-extrabold text-emerald-950 bg-white border border-emerald-200 px-2 py-0.5 rounded font-mono">
                                          {formatMcCorrectAnswer(q.options, q.correctAnswer)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* True / False Options */}
                                {q.question_type === "True_False" && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="flex items-center gap-4 font-semibold text-slate-700">
                                      {["True", "False"].map((choice) => {
                                        const isSelected = q.correctAnswer === choice;
                                        return (
                                          <div
                                            key={choice}
                                            className={`flex items-center gap-1.5 border px-3 py-1 rounded-lg text-xs transition-all ${
                                              showAnswerKey && isSelected
                                                ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-extrabold shadow-2xs"
                                                : "bg-slate-50 border-slate-300 text-slate-700"
                                            }`}
                                          >
                                            <div
                                              className={`w-3.5 h-3.5 border-2 rounded-sm flex items-center justify-center ${
                                                showAnswerKey && isSelected
                                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                                  : "border-slate-400"
                                              }`}
                                            >
                                              {showAnswerKey && isSelected && <Check className="w-3 h-3 text-white font-black" />}
                                            </div>
                                            <span>{choice}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {showAnswerKey && (
                                      <div className="inline-flex items-center gap-1.5 bg-emerald-50/90 border border-emerald-300/80 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-950">
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Answer Key:</span>
                                        <span className="font-extrabold text-emerald-950 bg-white border border-emerald-200 px-2 py-0.5 rounded font-mono">
                                          {q.correctAnswer || "Not specified"}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Identification Line */}
                                {q.question_type === "Identification" && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="border-b-2 border-dashed border-slate-400 w-full max-w-xs h-6 text-slate-400 font-mono text-[10px] flex items-end">
                                      Answer: _______________________
                                    </div>
                                    {showAnswerKey && (
                                      <div className="inline-flex items-center gap-1.5 bg-emerald-50/90 border border-emerald-300/80 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-950">
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Answer Key:</span>
                                        <span className="font-extrabold text-emerald-950 bg-white border border-emerald-200 px-2 py-0.5 rounded font-mono">
                                          {q.correctAnswer || "(Not specified)"}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Fill In The Blanks */}
                                {q.question_type === "Fill_In_The_Blanks" && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="text-slate-600 font-medium">
                                      {(q.blanks || [{ id: 1 }]).map((b: any, bIdx: number) => (
                                        <div key={bIdx} className="inline-block mr-3 mt-1 text-[11px] font-mono text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                                          Blank #{bIdx + 1}: ____________
                                        </div>
                                      ))}
                                    </div>
                                    {showAnswerKey && (
                                      <div className="flex flex-wrap items-center gap-2 bg-emerald-50/90 border border-emerald-300/80 p-2.5 rounded-xl text-[11px] font-bold text-emerald-950">
                                        <span className="flex items-center gap-1 font-extrabold uppercase text-emerald-950 text-[10px]">
                                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Answer Keys:
                                        </span>
                                        {(q.blanks || []).map((b: any, bIdx: number) => (
                                          <span key={bIdx} className="bg-white border border-emerald-300 px-2 py-0.5 rounded font-mono text-emerald-950">
                                            Blank #{bIdx + 1}: <strong className="text-emerald-800">{b.answer || "___"}</strong> ({b.points || 1} pt)
                                          </span>
                                        ))}
                                      </div>
                                    )}
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
                                    {showAnswerKey && (
                                      <div className="flex flex-wrap items-center gap-2 bg-emerald-50/90 border border-emerald-300/80 p-2.5 rounded-xl text-[11px] font-bold text-emerald-950">
                                        <span className="flex items-center gap-1 font-extrabold uppercase text-emerald-950 text-[10px]">
                                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Answer Key Mapping:
                                        </span>
                                        {q.matches.map((m: any, mIdx: number) => (
                                          <span key={mIdx} className="bg-white border border-emerald-300 px-2 py-0.5 rounded font-mono text-emerald-950 text-[10px]">
                                            {mIdx + 1} → Choice {String.fromCharCode(65 + mIdx)} ({m.choice})
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Essay Response Area */}
                                {q.question_type === "Essay" && (
                                  <div className="pl-6 pt-1 space-y-2">
                                    <div className="border border-slate-300 rounded-lg p-2.5 h-16 bg-slate-50/50 text-slate-400 text-[10px] italic">
                                      [ Space for student response - Min {q.min_words || 50} words ]
                                    </div>
                                    {showAnswerKey && (
                                      <div className="inline-flex items-center gap-1.5 bg-emerald-50/90 border border-emerald-300/80 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-950">
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Answer Guide / Key Rubric:</span>
                                        <span className="font-extrabold text-emerald-950 bg-white border border-emerald-200 px-2 py-0.5 rounded font-sans">
                                          {q.correctAnswer || `Evaluated by faculty. Min ${q.min_words || 50} words required.`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    </div>

                    {/* BSC OFFICIAL FOOTER IMAGE & PAGE BADGE */}
                    <div className="space-y-2 pt-4">
                      <div className="w-full border-t border-slate-300 pt-2">
                        <img
                          src="/bsc-footer.png"
                          alt="Batanes State College Footer"
                          className="w-full h-auto object-contain mx-auto max-h-[120px] print:max-h-none"
                        />
                      </div>
                      <div className="text-center print:hidden">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Examination Paper Sheet • Page {pageIdx + 1} of {previewPages.length}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>




          </div>

          {/* Wizard Navigation Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm w-full">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex justify-center items-center gap-2 border border-slate-200 bg-white text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Questions
            </button>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300/60 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>

              <button
                disabled={isSubmitting || questions.length === 0}
                onClick={handleSubmitForReview}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-emerald-600/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                title="Final Submit to Department Chair"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Final Submit to Chair
              </button>
            </div>
          </div>

        </div>
      )}



    </div>
  );
}
