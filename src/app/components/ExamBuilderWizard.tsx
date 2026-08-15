"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Settings, BookOpen, ClipboardCheck, ArrowLeft, ArrowRight, Save, 
  Upload, Trash2, Plus, Check, Eye, Trash, ArrowUp, ArrowDown, FileText, 
  Shuffle, AlertCircle, RefreshCw, FileUp, Sparkles, CheckCircle, Search, X,
  Tag, Layers, Sliders, Hash, ListFilter
} from "lucide-react";
import { saveExamConfig, saveExamQuestions, updateExamStatus, uploadQuestionAttachment, getQuestionBankQuestions, importQuestionsToExam } from "@/app/actions/faculty";
import { Latex } from "@/app/components/Latex";

interface Course {
  course_id: number;
  course_code: string;
  course_title: string;
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
  questionBank: Array<{
    question_id: number;
    question_text: string;
    question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type" | "Essay" | "Fill_In_The_Blanks";
    correct_answer: string;
    points: number;
  }>;
}

interface ExamBuilderWizardProps {
  exam: Exam;
  courses: Course[];
  facultyId: number;
}

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
      } catch {
        text = q.question_text;
      }
    } else if (q.question_type === "Multiple_Choice") {
      try {
        const parsed = JSON.parse(q.question_text);
        text = parsed.text || q.question_text;
        options = parsed.options || [];
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
    };
  });
}

// Serialization helper
function serializeQuestions(questions: QuestionState[]) {
  return questions.map(q => {
    let question_text = q.text;
    let correct_answer = q.correctAnswer;

    // Build standard JSON wrapper to hold metadata like images
    const serializedData: Record<string, any> = {
      text: q.text,
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
      if (q.image_url || (q.min_words && q.min_words > 0)) {
        question_text = JSON.stringify(serializedData);
      } else {
        question_text = q.text;
      }
      correct_answer = q.correctAnswer || "";
    } else {
      // For identification, T/F serialize to JSON if there's an image
      if (q.image_url) {
        question_text = JSON.stringify(serializedData);
      } else {
        question_text = q.text;
      }
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

export function ExamBuilderWizard({ exam, courses, facultyId }: ExamBuilderWizardProps) {
  const router = useRouter();

  // Steps: 1 = Config, 2 = Questions, 3 = Preview & Submit
  const [step, setStep] = useState<number>(1);
  
  // Configuration Settings State
  const [title, setTitle] = useState<string>(exam.title);
  const [courseId, setCourseId] = useState<number>(exam.course_id);
  const [timeLimit, setTimeLimit] = useState<number>(exam.time_limit_minutes);
  const [randomizeItems, setRandomizeItems] = useState<boolean>(exam.randomize_items);
  const [timePenalty, setTimePenalty] = useState<number>(exam.time_penalty_seconds ?? 60);
  const [scorePenalty, setScorePenalty] = useState<number>(exam.score_penalty_points ?? 2);

  // Question Bank State
  const [questions, setQuestions] = useState<QuestionState[]>(deserializeQuestions(exam.questionBank));
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(
    exam.questionBank.length > 0 ? 0 : -1
  );

  // Import Question Bank Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importFilters, setImportFilters] = useState({
    course_id: String(exam.course_id),
    topic: "",
    year_level: ""
  });
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<number[]>([]);
  const [loadingImportQs, setLoadingImportQs] = useState<boolean>(false);

  // Batch TOS Topic Modal & Filter State
  const [isBatchTopicModalOpen, setIsBatchTopicModalOpen] = useState<boolean>(false);
  const [batchTopicName, setBatchTopicName] = useState<string>("");
  const [batchStartItem, setBatchStartItem] = useState<number>(1);
  const [batchEndItem, setBatchEndItem] = useState<number>(1);
  const [topicFilterInList, setTopicFilterInList] = useState<string>("ALL");

  // Step 3 TQ Preview State
  const [previewViewMode, setPreviewViewMode] = useState<"paper" | "grouped">("paper");
  const [previewTopicFilter, setPreviewTopicFilter] = useState<string>("ALL");

  // Format 1-indexed item numbers into human-readable ranges e.g. "Items 1–5, 8, 10–12"
  const formatItemRanges = (numbers: number[]): string => {
    if (!numbers || numbers.length === 0) return "No items";
    const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}–${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}–${end}`);

    return ranges.length === 1 && sorted.length === 1
      ? `Item ${ranges[0]}`
      : `Items ${ranges.join(", ")}`;
  };

  // Dynamically calculate TOS Topic statistics & item ranges
  const tosTopicBreakdown = (() => {
    const map: Record<string, { itemNumbers: number[]; totalPoints: number }> = {};
    const totalExamPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

    questions.forEach((q, idx) => {
      const topicName = (q.topic && q.topic.trim() !== "") ? q.topic.trim() : "Unassigned Topic";
      if (!map[topicName]) {
        map[topicName] = { itemNumbers: [], totalPoints: 0 };
      }
      map[topicName].itemNumbers.push(idx + 1);
      map[topicName].totalPoints += (q.points || 1);
    });

    return Object.entries(map).map(([topic, data]) => {
      const count = data.itemNumbers.length;
      const weightPercentage = totalExamPoints > 0 ? Math.round((data.totalPoints / totalExamPoints) * 100) : 0;
      return {
        topic,
        itemNumbers: data.itemNumbers,
        rangeString: formatItemRanges(data.itemNumbers),
        count,
        totalPoints: data.totalPoints,
        weightPercentage,
      };
    });
  })();

  const existingUniqueTopics = Array.from(new Set(questions.map(q => q.topic?.trim()).filter(Boolean))) as string[];

  // Open batch topic modal with defaults
  const openBatchTopicModal = (initialTopic?: string) => {
    setBatchTopicName(initialTopic || (activeQuestionIdx !== -1 ? questions[activeQuestionIdx]?.topic || "" : ""));
    setBatchStartItem(1);
    setBatchEndItem(questions.length > 0 ? questions.length : 1);
    setIsBatchTopicModalOpen(true);
  };

  // Apply TOS topic across item range
  const handleApplyBatchTopic = () => {
    const trimmedTopic = batchTopicName.trim();
    if (!trimmedTopic) {
      alert("Please enter or select a topic name.");
      return;
    }
    if (batchStartItem < 1 || batchEndItem > questions.length || batchStartItem > batchEndItem) {
      alert(`Invalid item range! Must be between 1 and ${questions.length}.`);
      return;
    }

    const updated = [...questions];
    for (let i = batchStartItem - 1; i <= batchEndItem - 1; i++) {
      updated[i].topic = trimmedTopic;
    }

    setQuestions(updated);
    setIsBatchTopicModalOpen(false);
    setSaveStatus({
      type: "success",
      message: `TOS Topic set to "${trimmedTopic}" for Items ${batchStartItem}–${batchEndItem}`
    });
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // Notification Toast / Save Status
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error" | "saving"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step 1 Validation
  const isConfigValid = title.trim() !== "" && courseId > 0 && timeLimit > 0;

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

    const updated = [...questions, newQ];
    setQuestions(updated);
    setActiveQuestionIdx(updated.length - 1);
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
  const updateQuestionText = (text: string) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].text = text;
    setQuestions(updated);
  };

  // Updates points
  const updateQuestionPoints = (points: number) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].points = Math.max(1, points);
    setQuestions(updated);
  };

  // Updates topic
  const updateQuestionTopic = (topic: string) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].topic = topic;
    setQuestions(updated);
  };

  // Updates year level
  const updateQuestionYearLevel = (yearLevel: number | undefined) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].year_level = yearLevel;
    setQuestions(updated);
  };

  // Updates essay min words limitation
  const updateEssayMinWords = (words: number) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].min_words = Math.max(0, words);
    setQuestions(updated);
  };

  // Updates Fill in the Blanks row
  const updateBlankItem = (blankIdx: number, field: "answer" | "points", val: any) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    const q = updated[activeQuestionIdx];
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
  const deleteBlankItem = (blankIdx: number) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    const q = updated[activeQuestionIdx];
    q.blanks = (q.blanks || []).filter((_, idx) => idx !== blankIdx);
    // Re-index blank IDs
    q.blanks = q.blanks.map((b, idx) => ({ ...b, id: idx + 1 }));
    const totalBlanksPoints = q.blanks.reduce((sum, b) => sum + (Number(b.points) || 1), 0);
    if (totalBlanksPoints > 0) q.points = totalBlanksPoints;
    setQuestions(updated);
  };

  // Add a blank item & append [blank] tag to text prompt
  const addBlankItem = () => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    const q = updated[activeQuestionIdx];
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
  const updateMcOption = (optionIdx: number, val: string) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    const q = updated[activeQuestionIdx];
    
    // If the changed option was the correct answer, update the correct answer reference too
    const oldVal = q.options[optionIdx];
    q.options[optionIdx] = val;
    if (q.correctAnswer === oldVal) {
      q.correctAnswer = val;
    }
    
    setQuestions(updated);
  };

  // Sets correct choice for Multiple Choice
  const setMcCorrectAnswer = (val: string) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].correctAnswer = val;
    setQuestions(updated);
  };

  // Sets correct answer for True/False
  const setTfCorrectAnswer = (val: "True" | "False") => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].correctAnswer = val;
    setQuestions(updated);
  };

  // Updates correct answer for Identification
  const updateIdCorrectAnswer = (val: string) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].correctAnswer = val;
    setQuestions(updated);
  };

  // Updates Matching Type row
  const updateMatchRow = (rowIdx: number, field: "premise" | "choice", val: string) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].matches[rowIdx][field] = val;
    setQuestions(updated);
  };

  // Deletes matching row
  const deleteMatchRow = (rowIdx: number) => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].matches = updated[activeQuestionIdx].matches.filter((_, idx) => idx !== rowIdx);
    setQuestions(updated);
  };

  // Adds matching row
  const addMatchRow = () => {
    if (activeQuestionIdx === -1) return;
    const updated = [...questions];
    updated[activeQuestionIdx].matches.push({ premise: "", choice: "" });
    setQuestions(updated);
  };

  // Fetch questions for the import modal when filters or modal state changes
  useEffect(() => {
    if (!isImportModalOpen) return;

    const fetchImportQuestions = async () => {
      setLoadingImportQs(true);
      try {
        const res = await getQuestionBankQuestions({
          course_id: importFilters.course_id ? Number(importFilters.course_id) : undefined,
          topic: importFilters.topic || undefined,
          year_level: importFilters.year_level ? Number(importFilters.year_level) : undefined
        });
        if (res.success && res.questions) {
          setAvailableQuestions(res.questions);
        }
      } catch (err) {
        console.error("Failed to load questions from question bank", err);
      } finally {
        setLoadingImportQs(false);
      }
    };

    fetchImportQuestions();
  }, [isImportModalOpen, importFilters]);

  // Submit selected questions to import
  const handleImportSubmit = async () => {
    if (selectedImportIds.length === 0) return;
    setSaveStatus({ type: "saving", message: "Importing selected questions..." });
    try {
      const res = await importQuestionsToExam(exam.exam_id, selectedImportIds, facultyId);
      if (res.success) {
        setSaveStatus({ type: "success", message: `Successfully imported ${selectedImportIds.length} questions!` });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setSaveStatus({ type: "error", message: res.error || "Failed to import questions." });
      }
    } catch (err: any) {
      setSaveStatus({ type: "error", message: err.message || "An error occurred during import." });
    }
    setIsImportModalOpen(false);
    setSelectedImportIds([]);
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

    const configRes = await saveExamConfig(configData);
    if (configRes.error) {
      setSaveStatus({ type: "error", message: `Config Error: ${configRes.error}` });
      return;
    }

    // Step 2: Save Questions
    const serializedQs = serializeQuestions(questions);
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

    const configRes = await saveExamConfig(configData);
    if (configRes.error) {
      setSaveStatus({ type: "error", message: `Config Error: ${configRes.error}` });
      setIsSubmitting(false);
      return;
    }

    // Save questions
    const serializedQs = serializeQuestions(questions);
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

        {/* Wizard Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300/60 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>

          <button
            disabled={!isConfigValid || questions.length === 0 || isSubmitting}
            onClick={handleSubmitForReview}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-emerald-600/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Submit for Review
          </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Settings Fields */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
              Main Parameters
            </h2>

            <div className="space-y-4">
              {/* Exam Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-600 block">Exam Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midterm Examination in Artificial Intelligence"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-800 placeholder:text-slate-400 px-4 py-2.5 rounded-xl transition-all duration-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Course Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-600 block">Course Assignment</label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-bold text-slate-700 px-4 py-2.5 rounded-xl transition-all duration-300"
                  >
                    {courses.map(course => (
                      <option key={course.course_id} value={course.course_id}>
                        {course.course_code} - {course.course_title}
                      </option>
                    ))}
                  </select>
                </div>

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

          {/* Table of Specifications (TOS) Native System Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                Native TOS Topic Alignment
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                The Table of Specifications (TOS) matrix is natively integrated into the Question Bank Builder. Exam item ranges (e.g. Items 1–20), topic weighting, and objective distributions are automatically tracked dynamically.
              </p>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex gap-3 items-start">
              <Layers className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-emerald-900">Dynamic TOS Matrix Active</p>
                <p className="text-[11px] text-emerald-700 leading-normal mt-0.5">
                  No manual TOS file upload required. In Step 2, you can map topics directly to item numbers and ranges.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                disabled={!isConfigValid}
                onClick={() => setStep(2)}
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                Proceed to Questions & TOS Setup
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: QUESTION BANK BUILDER */}
      {step === 2 && (
        <div className="space-y-6">
          
          {/* TOS Syllabus Alignment & Topic Distribution Overview Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#7A151A] text-white p-5 sm:p-6 rounded-3xl shadow-lg border border-slate-700/50 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#E2A123]/20 p-2.5 rounded-2xl border border-[#E2A123]/40 text-[#E2A123]">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Table of Specifications (TOS) Topic Alignment
                    </h2>
                    <span className="bg-[#E2A123] text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full">
                      TOS Matrix
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    Organize test items by course topics, module objectives, and TOS item ranges (e.g. Items 1–20).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openBatchTopicModal()}
                className="inline-flex items-center gap-2 bg-[#E2A123] hover:bg-amber-400 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition-all shrink-0 hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <Tag className="w-4 h-4" />
                Batch Assign Items by Topic (TOS Range)
              </button>
            </div>

            {/* Topic Distribution Grid / Cards */}
            {tosTopicBreakdown.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {tosTopicBreakdown.map((item, idx) => {
                  const isUnassigned = item.topic === "Unassigned Topic";
                  const isSelected = topicFilterInList === item.topic;
                  return (
                    <div
                      key={idx}
                      onClick={() => setTopicFilterInList(isSelected ? "ALL" : item.topic)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/20 border-[#E2A123] text-white ring-2 ring-[#E2A123]/40"
                          : isUnassigned
                          ? "bg-rose-950/40 border-rose-800/60 hover:bg-rose-900/50 text-rose-200"
                          : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isUnassigned ? "bg-rose-900/80 text-rose-300" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}>
                          {isUnassigned ? "Requires TOS Alignment" : `${item.count} Item${item.count !== 1 ? "s" : ""}`}
                        </span>
                        <span className="text-[11px] font-black text-amber-300">
                          {item.weightPercentage}% weight ({item.totalPoints} pts)
                        </span>
                      </div>
                      
                      <h4 className="font-extrabold text-xs text-white truncate" title={item.topic}>
                        {item.topic}
                      </h4>

                      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-300 pt-2 border-t border-white/10">
                        <span className="inline-flex items-center gap-1 text-[#E2A123]">
                          <Hash className="w-3 h-3" />
                          {item.rangeString}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isSelected ? "Showing" : "Click to filter"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3 text-xs font-semibold text-slate-400">
                No items created yet. Add questions below to set up TOS topic distributions.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Panel: Question List */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-1 h-5 bg-emerald-600 rounded-full" />
                  Question List ({questions.length})
                </h2>
                <span className="text-xs font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Total Pts: {questions.reduce((sum, q) => sum + q.points, 0)}
                </span>
              </div>

              {/* Topic Filter Dropdown */}
              {tosTopicBreakdown.length > 0 && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5 text-slate-500 shrink-0">
                    <ListFilter className="w-3.5 h-3.5 text-slate-600" />
                    Filter Topic:
                  </span>
                  <select
                    value={topicFilterInList}
                    onChange={(e) => setTopicFilterInList(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 px-2 py-1 focus:outline-emerald-500 max-w-[160px] truncate"
                  >
                    <option value="ALL">All Topics ({questions.length})</option>
                    {tosTopicBreakdown.map((t, idx) => (
                      <option key={idx} value={t.topic}>
                        {t.topic} ({t.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* List Body */}
              {questions.length > 0 ? (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {questions.map((q, idx) => {
                    const isFilteredOut = topicFilterInList !== "ALL" && (
                      (topicFilterInList === "Unassigned Topic" && q.topic?.trim()) ||
                      (topicFilterInList !== "Unassigned Topic" && q.topic?.trim() !== topicFilterInList)
                    );
                    if (isFilteredOut) return null;

                    const isActive = activeQuestionIdx === idx;
                    let typeColor = "bg-slate-100 text-slate-700 border-slate-200";
                    if (q.question_type === "Multiple_Choice") typeColor = "bg-blue-50 text-blue-700 border-blue-100";
                    if (q.question_type === "True_False") typeColor = "bg-purple-50 text-purple-700 border-purple-100";
                    if (q.question_type === "Identification") typeColor = "bg-amber-50 text-amber-700 border-amber-100";
                    if (q.question_type === "Matching_Type") typeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                    if (q.question_type === "Essay") typeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                    if (q.question_type === "Fill_In_The_Blanks") typeColor = "bg-teal-50 text-teal-700 border-teal-100";

                    return (
                      <div 
                        key={idx}
                        onClick={() => setActiveQuestionIdx(idx)}
                        className={`border p-3.5 rounded-2xl flex items-start justify-between gap-3 cursor-pointer transition-all duration-300 ${
                          isActive 
                            ? "bg-slate-50 border-emerald-500 shadow-sm" 
                            : "bg-white hover:bg-slate-50/50 border-slate-200/80"
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-800">Q{idx + 1}</span>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColor}`}>
                              {q.question_type.replace("_", " ")}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">{q.points} pt{q.points !== 1 && "s"}</span>
                            
                            {/* TOS Topic Badge on question list item */}
                            {q.topic?.trim() ? (
                              <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md truncate max-w-[120px]" title={`Topic: ${q.topic}`}>
                                🏷️ {q.topic}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                                ⚠️ No Topic
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {q.text ? q.text : <em className="text-slate-400 font-normal">Blank prompt text...</em>}
                          </p>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion(idx, "up")}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 transition-colors"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === questions.length - 1}
                            onClick={() => handleMoveQuestion(idx, "down")}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 transition-colors"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(idx)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                  <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No questions added yet</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Use the templates below to add items.</p>
                </div>
              )}

              {/* Quick Templates Panel */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Add Item Templates</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAddQuestion("Multiple_Choice")}
                    className="flex items-center gap-1.5 justify-center bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-extrabold p-2 rounded-xl transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Mult. Choice
                  </button>
                  <button
                    onClick={() => handleAddQuestion("True_False")}
                    className="flex items-center gap-1.5 justify-center bg-purple-50/80 hover:bg-purple-100 border border-purple-200 text-purple-700 text-[10px] font-extrabold p-2 rounded-xl transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + True / False
                  </button>
                  <button
                    onClick={() => handleAddQuestion("Identification")}
                    className="flex items-center gap-1.5 justify-center bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-extrabold p-2 rounded-xl transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Identification
                  </button>
                  <button
                    onClick={() => handleAddQuestion("Matching_Type")}
                    className="flex items-center gap-1.5 justify-center bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold p-2 rounded-xl transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Matching
                  </button>
                  <button
                    onClick={() => handleAddQuestion("Essay")}
                    className="flex items-center gap-1.5 justify-center bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold p-2 rounded-xl transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Essay
                  </button>
                  <button
                    onClick={() => handleAddQuestion("Fill_In_The_Blanks")}
                    className="col-span-2 flex items-center gap-1.5 justify-center bg-teal-50/80 hover:bg-teal-100 border border-teal-200 text-teal-700 text-[10px] font-extrabold p-2 rounded-xl transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Fill in the Blanks
                  </button>
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="col-span-2 flex items-center gap-1.5 justify-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 text-[10px] font-extrabold p-2 rounded-xl transition-all shadow-sm mt-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Import from Question Bank
                  </button>
                </div>
              </div>
            </div>

            {/* Right Panel: Question Editor */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              {activeQuestionIdx !== -1 && questions[activeQuestionIdx] ? (
                <div className="space-y-6">
                  
                  {/* Editor Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-slate-800">
                        Editing Question #{activeQuestionIdx + 1}
                      </h3>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        Type: {questions[activeQuestionIdx].question_type.replace("_", " ")}
                      </p>
                    </div>
                    
                    {/* Metadata: Points, Year Level */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] font-bold text-slate-500">Points:</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={questions[activeQuestionIdx].points}
                          onChange={(e) => updateQuestionPoints(Number(e.target.value))}
                          className="w-12 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-bold text-slate-800 py-1.5 focus:outline-emerald-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] font-bold text-slate-500">Year Level:</label>
                        <select
                          value={questions[activeQuestionIdx].year_level || ""}
                          onChange={(e) => updateQuestionYearLevel(e.target.value ? Number(e.target.value) : undefined)}
                          className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 px-1 py-1.5 focus:outline-emerald-500"
                        >
                          <option value="">N/A</option>
                          <option value="1">1st Yr</option>
                          <option value="2">2nd Yr</option>
                          <option value="3">3rd Yr</option>
                          <option value="4">4th Yr</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Interactive TOS Topic Alignment Section for active item */}
                  <div className="bg-slate-50/90 border border-slate-200/90 p-4 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-black text-slate-700 shrink-0">TOS Topic Alignment:</span>
                        
                        {/* Existing Topics Dropdown + Custom Input */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-[200px]">
                          {existingUniqueTopics.length > 0 && (
                            <select
                              value={existingUniqueTopics.includes(questions[activeQuestionIdx].topic?.trim() || "") ? questions[activeQuestionIdx].topic?.trim() : "__CUSTOM__"}
                              onChange={(e) => {
                                if (e.target.value !== "__CUSTOM__") {
                                  updateQuestionTopic(e.target.value);
                                }
                              }}
                              className="bg-white border border-slate-300 rounded-xl text-xs font-extrabold text-slate-800 px-3 py-2 focus:outline-emerald-500 shadow-sm"
                            >
                              <option value="__CUSTOM__">✍️ Custom Topic Name...</option>
                              {existingUniqueTopics.map((top, tIdx) => {
                                const topStats = tosTopicBreakdown.find(t => t.topic === top);
                                return (
                                  <option key={tIdx} value={top}>
                                    📌 {top} ({topStats?.rangeString || "0 items"})
                                  </option>
                                );
                              })}
                            </select>
                          )}

                          <input
                            type="text"
                            placeholder="Type topic name (e.g. Arrays & Collections)..."
                            value={questions[activeQuestionIdx].topic || ""}
                            onChange={(e) => updateQuestionTopic(e.target.value)}
                            className="flex-1 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 px-3 py-2 focus:outline-emerald-500 shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Batch Range Button */}
                      <button
                        type="button"
                        onClick={() => openBatchTopicModal(questions[activeQuestionIdx].topic || "")}
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                        title="Apply this topic across a custom item range (e.g. Items 1 to 20)"
                      >
                        <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                        Set Range (e.g. Items 1-20)...
                      </button>
                    </div>

                    {/* Live TOS Alignment Indicator */}
                    {questions[activeQuestionIdx].topic?.trim() ? (
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-emerald-900 font-bold bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl gap-2">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Aligned with Topic: <strong className="text-emerald-950">"{questions[activeQuestionIdx].topic}"</strong>
                        </span>
                        <span className="text-emerald-700 font-extrabold">
                          {(() => {
                            const stats = tosTopicBreakdown.find(t => t.topic === questions[activeQuestionIdx].topic?.trim());
                            return stats ? `${stats.rangeString} (${stats.count} item${stats.count !== 1 ? "s" : ""} • ${stats.weightPercentage}% weight)` : "";
                          })()}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-rose-900 font-bold bg-rose-50 border border-rose-200/80 px-3 py-1.5 rounded-xl gap-2">
                        <span className="inline-flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          No Topic Assigned to Question #{activeQuestionIdx + 1}
                        </span>
                        <span className="text-rose-700 font-normal">Select or type a topic above to map to TOS specifications</span>
                      </div>
                    )}
                  </div>

                {/* Prompt Text Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-600 block">Question Prompt / Instructions</label>
                  <textarea
                    rows={3}
                    placeholder="Enter the question query details here..."
                    value={questions[activeQuestionIdx].text}
                    onChange={(e) => updateQuestionText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-medium text-slate-800 placeholder:text-slate-400 p-4 rounded-xl transition-all duration-300 outline-none"
                  />
                </div>

                {/* Image Attachment & Math/Equation Helpers */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-155">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-slate-800">Rich-Text & Math Attachments</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        To add mathematical equations, enclose LaTeX symbols in <code>$formula$</code> (inline) or <code>$$formula$$</code> (block).
                      </p>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="question-image-file"
                        className="hidden"
                        onChange={handleUploadQuestionImage}
                      />
                      <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => document.getElementById("question-image-file")?.click()}
                        className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {uploadingImage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Attach Image
                      </button>
                    </div>
                  </div>

                  {/* Render preview of image if attached */}
                  {questions[activeQuestionIdx].image_url && (
                    <div className="relative w-full max-w-md rounded-2xl border border-slate-200 overflow-hidden bg-white p-2">
                      <img
                        src={questions[activeQuestionIdx].image_url}
                        alt="Attached question asset"
                        className="w-full h-auto max-h-[220px] object-contain rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveQuestionImage}
                        className="absolute top-4 right-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 p-2 rounded-xl shadow-sm transition-all cursor-pointer"
                        title="Remove Image"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Math & Rich-Text Prompt Preview */}
                <div className="bg-emerald-50/20 border border-emerald-100/50 p-4.5 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Live Prompt & Math Preview:</span>
                  <div className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                    <Latex text={questions[activeQuestionIdx].text || "Type your prompt text to preview rendering..."} />
                  </div>
                </div>

                {/* MULTIPLE CHOICE EDITOR */}
                {questions[activeQuestionIdx].question_type === "Multiple_Choice" && (
                  <div className="space-y-4">
                    <label className="text-xs font-extrabold text-slate-600 block">Configure Options (Mark the correct answer)</label>
                    <div className="space-y-3">
                      {questions[activeQuestionIdx].options.map((option, opIdx) => {
                        const isCorrect = questions[activeQuestionIdx].correctAnswer === option;
                        return (
                          <div key={opIdx} className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setMcCorrectAnswer(option)}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                isCorrect 
                                  ? "border-emerald-500 bg-emerald-500 text-white" 
                                  : "border-slate-300 hover:border-slate-400 bg-white"
                              }`}
                            >
                              {isCorrect && <Check className="w-3 h-3 font-bold" />}
                            </button>
                            <span className="text-xs font-bold text-slate-400 w-6 uppercase">
                              {String.fromCharCode(65 + opIdx)}.
                            </span>
                            <input
                              type="text"
                              value={option}
                              placeholder={`Option ${String.fromCharCode(65 + opIdx)}`}
                              onChange={(e) => updateMcOption(opIdx, e.target.value)}
                              className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-800 px-4 py-2 rounded-xl transition-all outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TRUE / FALSE EDITOR */}
                {questions[activeQuestionIdx].question_type === "True_False" && (
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-600 block">Correct Option Answer</label>
                    <div className="flex gap-4">
                      {["True", "False"].map((choice) => {
                        const isSelected = questions[activeQuestionIdx].correctAnswer === choice;
                        return (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => setTfCorrectAnswer(choice as any)}
                            className={`flex-1 py-3 text-center rounded-xl text-sm font-bold border transition-all ${
                              isSelected 
                                ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm" 
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
                {questions[activeQuestionIdx].question_type === "Identification" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">Correct Target Answer</label>
                    <input
                      type="text"
                      placeholder="Type the exact expected text answer..."
                      value={questions[activeQuestionIdx].correctAnswer}
                      onChange={(e) => updateIdCorrectAnswer(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-800 px-4 py-2.5 rounded-xl transition-all outline-none"
                    />
                    <p className="text-[10px] text-slate-400">Identification checks are case-insensitive by default during grading.</p>
                  </div>
                )}

                {/* MATCHING TYPE EDITOR */}
                {questions[activeQuestionIdx].question_type === "Matching_Type" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-slate-600">Matching Column Alignments</label>
                      <button
                        type="button"
                        onClick={addMatchRow}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 hover:border-indigo-200 shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                        Add Pair
                      </button>
                    </div>

                    <div className="space-y-3">
                      {questions[activeQuestionIdx].matches.map((match, matchIdx) => (
                        <div key={matchIdx} className="flex gap-2 items-center bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 w-6 shrink-0 text-center">{matchIdx + 1}</span>
                          <input
                            type="text"
                            placeholder="Premise (Column A)"
                            value={match.premise}
                            onChange={(e) => updateMatchRow(matchIdx, "premise", e.target.value)}
                            className="flex-1 min-w-0 bg-white border border-slate-200 text-xs font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-emerald-500"
                          />
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">→</span>
                          <input
                            type="text"
                            placeholder="Correct Match (Column B)"
                            value={match.choice}
                            onChange={(e) => updateMatchRow(matchIdx, "choice", e.target.value)}
                            className="flex-1 min-w-0 bg-white border border-slate-200 text-xs font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-emerald-500"
                          />
                          <button
                            type="button"
                            disabled={questions[activeQuestionIdx].matches.length <= 1}
                            onClick={() => deleteMatchRow(matchIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ESSAY EDITOR */}
                {questions[activeQuestionIdx].question_type === "Essay" && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="text-xs font-black text-emerald-900 block">Minimum Word Count Limitation</label>
                          <p className="text-[11px] text-emerald-700">Enforce a least word count requirement that students must satisfy in their essay response.</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="0"
                            max="1000"
                            value={questions[activeQuestionIdx].min_words ?? 50}
                            onChange={(e) => updateEssayMinWords(Number(e.target.value))}
                            className="w-24 bg-white border border-emerald-300 rounded-xl text-center text-xs font-extrabold text-emerald-950 p-2 focus:outline-emerald-600 shadow-sm"
                          />
                          <span className="text-xs font-bold text-emerald-800">words min</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 italic">
                        * Set to 0 if there is no minimum word count constraint. Essays are manually graded by faculty.
                      </div>
                    </div>
                  </div>
                )}

                {/* FILL IN THE BLANKS EDITOR */}
                {questions[activeQuestionIdx].question_type === "Fill_In_The_Blanks" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-extrabold text-slate-600 block">Blanks & Points Configuration</label>
                        <p className="text-[10px] text-slate-400">Insert <code>[blank]</code> tags into your prompt text above, then set the correct answer and points per blank below.</p>
                      </div>
                      <button
                        type="button"
                        onClick={addBlankItem}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 shadow-sm transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Insert Blank
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(questions[activeQuestionIdx].blanks || []).map((blank, blankIdx) => (
                        <div key={blankIdx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-teal-50/40 border border-teal-200/80 p-3 rounded-2xl">
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black bg-teal-600 text-white px-2 py-0.5 rounded-lg">
                              Blank #{blankIdx + 1}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              placeholder={`Expected answer for Blank #${blankIdx + 1}...`}
                              value={blank.answer}
                              onChange={(e) => updateBlankItem(blankIdx, "answer", e.target.value)}
                              className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-teal-500 shadow-sm"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <label className="text-[10px] font-bold text-slate-500">Points:</label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={blank.points || 1}
                              onChange={(e) => updateBlankItem(blankIdx, "points", e.target.value)}
                              className="w-16 bg-white border border-slate-200 text-center text-xs font-bold text-slate-800 py-1.5 rounded-xl focus:outline-teal-500 shadow-sm"
                            />
                            <span className="text-[10px] text-slate-400 font-semibold">pt{blank.points !== 1 && "s"}</span>

                            <button
                              type="button"
                              disabled={(questions[activeQuestionIdx].blanks || []).length <= 1}
                              onClick={() => deleteBlankItem(blankIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              title="Delete Blank"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Inline preview of prompt with blanks */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-black uppercase text-teal-800 tracking-wider">Fill-in-the-Blanks Interactive Prompt Preview:</span>
                      <div className="text-xs font-bold text-slate-800 leading-relaxed">
                        {(() => {
                          const text = questions[activeQuestionIdx].text || "";
                          const blanks = questions[activeQuestionIdx].blanks || [];
                          if (!text.includes("[blank]")) {
                            return (
                              <span className="text-amber-600 font-normal italic">
                                ⚠️ Notice: Include <code>[blank]</code> tag in your prompt text above to position fill-in slots inline.
                              </span>
                            );
                          }
                          const parts = text.split("[blank]");
                          return parts.map((part, pIdx) => (
                            <span key={pIdx}>
                              {part}
                              {pIdx < parts.length - 1 && (
                                <span className="inline-flex items-center gap-1 mx-1 px-2.5 py-0.5 bg-teal-100 border border-teal-300 text-teal-900 font-extrabold text-[11px] rounded-lg shadow-2xs">
                                  {`_____ (Blank ${pIdx + 1}: ${blanks[pIdx]?.answer || "answer"} [${blanks[pIdx]?.points || 1}pt])`}
                                </span>
                              )}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="text-center py-24 bg-slate-50/20 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col justify-center items-center">
                <Sparkles className="w-10 h-10 text-emerald-600/30 mb-4 animate-bounce" />
                <h4 className="font-extrabold text-slate-800 text-base">Question Bank empty</h4>
                <p className="text-slate-500 text-xs max-w-xs mt-1.5 leading-relaxed">
                  Start building your examination by clicking one of the templates on the left panel (Multiple Choice, True/False, etc.).
                </p>
              </div>
            )}

            {/* Back & Next Navigation in wizard footer */}
            <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex justify-center items-center gap-2 border border-slate-200 bg-white text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Config Settings
              </button>

              <button
                type="button"
                disabled={questions.length === 0}
                onClick={() => setStep(3)}
                className="inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                Proceed to Preview
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* STEP 3: REVIEW & LIVE PREVIEW */}
      {step === 3 && (
        <div className="space-y-8">
          
          {/* Info Card Summary */}
          <div className="bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-950 text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Selected Course</p>
                <p className="font-extrabold text-slate-200 mt-1">
                  {courses.find(c => c.course_id === courseId)?.course_code} - {courses.find(c => c.course_id === courseId)?.course_title}
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

          {/* Chapter & Topic TOS Matrix Summary Card */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-2xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Chapter & Topic Item Breakdown (TOS Mapping)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Overview of corresponding items, point allocations, and coverage per chapter
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>{tosTopicBreakdown.length} Chapter{tosTopicBreakdown.length !== 1 && "s"} / Topics</span>
              </div>
            </div>

            {/* Grid of Chapters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tosTopicBreakdown.map((item, idx) => {
                const isUnassigned = item.topic === "Unassigned Topic";
                const isSelectedFilter = previewTopicFilter === item.topic;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (previewTopicFilter === item.topic) {
                        setPreviewTopicFilter("ALL");
                      } else {
                        setPreviewTopicFilter(item.topic);
                      }
                    }}
                    className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
                      isUnassigned
                        ? "bg-amber-50/40 border-amber-200 hover:border-amber-300"
                        : isSelectedFilter
                        ? "bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                        : "bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isUnassigned
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-100"
                        }`}>
                          {isUnassigned ? "⚠️ Unassigned" : `Chapter ${idx + 1}`}
                        </span>
                        <span className="text-[11px] font-black text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                          {item.weightPercentage}% Weight
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-slate-800 line-clamp-2 leading-snug">
                        {item.topic}
                      </h4>
                    </div>

                    <div className="border-t border-slate-200/60 pt-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-extrabold text-indigo-900">{item.rangeString}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {item.count} item{item.count !== 1 && "s"} ({item.totalPoints} pt{item.totalPoints !== 1 && "s"})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Warning if unassigned questions exist */}
            {tosTopicBreakdown.some((t) => t.topic === "Unassigned Topic") && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <strong className="font-extrabold">Notice: Some questions do not have a chapter/topic assigned.</strong>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Assign topics to organize questions according to your course outline and Table of Specifications (TOS).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openBatchTopicModal()}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  Assign Topics by Range
                </button>
              </div>
            )}
          </div>

          {/* Toolbar Controls for Preview */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 max-w-4xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm font-sans">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPreviewViewMode("paper")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  previewViewMode === "paper"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-600" />
                Standard Exam Paper
              </button>

              <button
                type="button"
                onClick={() => setPreviewViewMode("grouped")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  previewViewMode === "grouped"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="w-4 h-4 text-indigo-600" />
                Grouped by Chapter
              </button>
            </div>

            {/* Filter by Chapter / Topic Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Chapter Filter:</span>
              <select
                value={previewTopicFilter}
                onChange={(e) => setPreviewTopicFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-800 px-3 py-2 rounded-xl focus:outline-emerald-500 cursor-pointer"
              >
                <option value="ALL">All Chapters ({questions.length} items)</option>
                {tosTopicBreakdown.map((t, idx) => (
                  <option key={idx} value={t.topic}>
                    {t.topic} ({t.rangeString})
                  </option>
                ))}
              </select>
              {previewTopicFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setPreviewTopicFilter("ALL")}
                  className="text-xs text-rose-600 font-bold hover:underline px-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Printable Exam Paper Style Preview */}
          <div className="bg-white border-2 border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8 max-w-4xl mx-auto font-serif">
            
            {/* Header branding */}
            <div className="text-center space-y-1.5 border-b-2 border-double border-slate-900 pb-5">
              <h2 className="text-lg font-black tracking-widest uppercase text-slate-900">BATANES STATE COLLEGE</h2>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Department of Computer Studies</p>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 mt-4">{title}</h1>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-700 font-semibold pt-1">
                <span>Course: {courses.find(c => c.course_id === courseId)?.course_code} - {courses.find(c => c.course_id === courseId)?.course_title}</span>
                <span>•</span>
                <span>Duration: {timeLimit} minutes</span>
                <span>•</span>
                <span>Points: {questions.reduce((sum, q) => sum + q.points, 0)}</span>
              </div>
            </div>

            {/* Exam metadata grid for student */}
            <div className="grid grid-cols-2 gap-4 text-xs font-bold border-b border-slate-200 pb-4 text-slate-700">
              <div className="flex gap-2">
                <span>Student Name:</span>
                <div className="flex-1 border-b border-dashed border-slate-400" />
              </div>
              <div className="flex gap-2">
                <span>Score:</span>
                <div className="w-16 border-b border-dashed border-slate-400" />
              </div>
              <div className="flex gap-2">
                <span>Year & Section:</span>
                <div className="flex-1 border-b border-dashed border-slate-400" />
              </div>
              <div className="flex gap-2">
                <span>Date:</span>
                <div className="flex-1 border-b border-dashed border-slate-400" />
              </div>
            </div>

            {/* Instruction note */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs leading-normal font-sans italic text-slate-600">
              <strong>Instructions:</strong> Read each question prompt carefully. Provide your answers in the designated areas. Cheating lockout protocols will trigger automatically on unauthorized window defocus.
            </div>

            {/* Question Items Listing */}
            <div className="space-y-8">
              {previewViewMode === "paper" ? (
                /* Continuous Standard View with Chapter Badges */
                questions
                  .map((q, idx) => ({ q, idx }))
                  .filter(({ q }) => previewTopicFilter === "ALL" || (q.topic?.trim() || "Unassigned Topic") === previewTopicFilter)
                  .map(({ q, idx }) => {
                    const topicName = q.topic?.trim() || "Unassigned Topic";
                    return (
                      <div key={idx} className="space-y-3 border-b border-slate-100 pb-6 last:border-b-0">
                        {/* Chapter Badge Header */}
                        <div className="flex items-center justify-between gap-2 font-sans">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Tag className="w-3 h-3 text-indigo-500" />
                            Chapter: {topicName}
                          </span>
                        </div>

                        <div className="flex justify-between items-start gap-4">
                          <div className="text-sm font-bold text-slate-950 leading-relaxed font-sans">
                            {idx + 1}. <Latex text={q.text} />
                          </div>
                          <span className="text-xs font-bold text-slate-500 shrink-0 font-sans">
                            ({q.points} pt{q.points !== 1 && "s"})
                          </span>
                        </div>

                        {/* Rendering choices for Multiple Choice */}
                        {q.question_type === "Multiple_Choice" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pl-4 font-sans">
                            {q.options.map((option, opIdx) => {
                              const isCorrect = q.correctAnswer === option;
                              return (
                                <div key={opIdx} className={`text-xs font-medium flex items-center gap-2 ${isCorrect ? "text-emerald-700 bg-emerald-50/50 border border-emerald-200 px-2 py-1.5 rounded-lg font-bold" : "text-slate-800"}`}>
                                  <span className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center shrink-0 font-sans font-bold text-[10px]">
                                    {String.fromCharCode(65 + opIdx)}
                                  </span>
                                  <span>{option}</span>
                                  {isCorrect && <span className="text-[9px] font-black uppercase text-emerald-600 ml-auto border border-emerald-400 px-1 py-0.5 rounded">Correct Answer</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Rendering choices for True / False */}
                        {q.question_type === "True_False" && (
                          <div className="flex gap-6 pl-4 font-sans">
                            {["True", "False"].map((choice) => {
                              const isCorrect = q.correctAnswer === choice;
                              return (
                                <div key={choice} className={`text-xs font-medium flex items-center gap-2 ${isCorrect ? "text-emerald-700 bg-emerald-50/50 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-bold" : "text-slate-800"}`}>
                                  <span className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center shrink-0" />
                                  <span>{choice}</span>
                                  {isCorrect && <span className="text-[9px] font-black uppercase text-emerald-600 border border-emerald-400 px-1 py-0.5 rounded ml-1">Correct Answer</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Rendering fill check for Identification */}
                        {q.question_type === "Identification" && (
                          <div className="pl-4 space-y-1 font-sans">
                            <div className="flex gap-2 items-center text-xs">
                              <span className="text-slate-500">Your Answer:</span>
                              <div className="w-48 border-b border-slate-400" />
                            </div>
                            <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50/50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-block">
                              Expected Answer: <strong className="underline">{q.correctAnswer}</strong>
                            </div>
                          </div>
                        )}

                        {/* Rendering Columns for Matching Type */}
                        {q.question_type === "Matching_Type" && (
                          <div className="pl-4 space-y-4 font-sans">
                            <div className="grid grid-cols-2 gap-8 text-xs border border-slate-100 bg-slate-50/50 p-4 rounded-2xl">
                              <div className="space-y-2">
                                <p className="font-extrabold text-slate-800 border-b border-slate-200 pb-1.5">Column A (Premises)</p>
                                {q.matches.map((match, mIdx) => (
                                  <p key={mIdx} className="font-medium text-slate-700">
                                    {String.fromCharCode(97 + mIdx)}. {match.premise}
                                  </p>
                                ))}
                              </div>
                              <div className="space-y-2">
                                <p className="font-extrabold text-slate-800 border-b border-slate-200 pb-1.5">Column B (Choices - Shuffled)</p>
                                {q.matches.map((match, mIdx) => (
                                  <p key={mIdx} className="font-medium text-slate-700 flex justify-between gap-2">
                                    <span>{String.fromCharCode(65 + mIdx)}. {match.choice}</span>
                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 shrink-0">Matches {String.fromCharCode(97 + mIdx)}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Rendering Essay */}
                        {q.question_type === "Essay" && (
                          <div className="pl-4 space-y-2 font-sans">
                            <div className="w-full h-24 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 p-3 text-xs text-slate-400 italic">
                              [ Student essay response area ]
                            </div>
                            {q.min_words && q.min_words > 0 ? (
                              <div className="text-[10px] text-emerald-800 font-extrabold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                📝 Minimum Limitation: {q.min_words} words required
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Rendering Fill in the Blanks */}
                        {q.question_type === "Fill_In_The_Blanks" && (
                          <div className="pl-4 space-y-3 font-sans">
                            <div className="text-xs font-semibold text-slate-900 bg-teal-50/40 border border-teal-100 p-3.5 rounded-xl space-y-2">
                              <p className="text-[10px] font-black uppercase text-teal-800 tracking-wider">Inline Blanks & Answer Key:</p>
                              <div className="flex flex-wrap gap-2">
                                {(q.blanks || []).map((blank, bIdx) => (
                                  <span key={bIdx} className="text-xs bg-white border border-teal-300 text-teal-950 font-bold px-3 py-1 rounded-lg shadow-2xs">
                                    Blank #{bIdx + 1}: <strong className="underline text-teal-700">{blank.answer || "(blank)"}</strong> ({blank.points || 1} pt{blank.points !== 1 && "s"})
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                /* Grouped by Chapter View */
                Object.entries(
                  questions.reduce<Record<string, { q: QuestionState; origIdx: number }[]>>((acc, q, idx) => {
                    const t = q.topic?.trim() || "Unassigned Topic";
                    if (!acc[t]) acc[t] = [];
                    acc[t].push({ q, origIdx: idx });
                    return acc;
                  }, {})
                )
                  .filter(([tName]) => previewTopicFilter === "ALL" || tName === previewTopicFilter)
                  .map(([topicName, groupItems], gIdx) => {
                    const itemNumbers = groupItems.map((gi) => gi.origIdx + 1);
                    const groupPoints = groupItems.reduce((sum, gi) => sum + (gi.q.points || 1), 0);
                    const rangeStr = formatItemRanges(itemNumbers);

                    return (
                      <div key={gIdx} className="space-y-6 border-b border-slate-200 pb-8 last:border-b-0 font-sans">
                        {/* Chapter Section Header Banner */}
                        <div className="bg-slate-100/90 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="bg-emerald-600 text-white p-2 rounded-xl">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-extrabold text-slate-900 text-sm">
                                Chapter: {topicName}
                              </h3>
                              <p className="text-[11px] text-slate-500 font-medium">
                                Corresponding Items: <strong className="text-indigo-700">{rangeStr}</strong>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700">
                            <span>{groupItems.length} Item{groupItems.length !== 1 && "s"}</span>
                            <span>•</span>
                            <span className="text-emerald-700">{groupPoints} Points</span>
                          </div>
                        </div>

                        {/* Questions in this Chapter */}
                        <div className="space-y-6 pl-2">
                          {groupItems.map(({ q, origIdx }) => (
                            <div key={origIdx} className="space-y-3 border-b border-slate-100 pb-4 last:border-b-0">
                              <div className="flex justify-between items-start gap-4">
                                <div className="text-sm font-bold text-slate-950 leading-relaxed font-sans">
                                  {origIdx + 1}. <Latex text={q.text} />
                                </div>
                                <span className="text-xs font-bold text-slate-500 shrink-0 font-sans">
                                  ({q.points} pt{q.points !== 1 && "s"})
                                </span>
                              </div>

                              {/* Rendering choices for Multiple Choice */}
                              {q.question_type === "Multiple_Choice" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pl-4">
                                  {q.options.map((option, opIdx) => {
                                    const isCorrect = q.correctAnswer === option;
                                    return (
                                      <div key={opIdx} className={`text-xs font-medium flex items-center gap-2 ${isCorrect ? "text-emerald-700 bg-emerald-50/50 border border-emerald-200 px-2 py-1.5 rounded-lg font-bold" : "text-slate-800"}`}>
                                        <span className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center shrink-0 font-sans font-bold text-[10px]">
                                          {String.fromCharCode(65 + opIdx)}
                                        </span>
                                        <span>{option}</span>
                                        {isCorrect && <span className="text-[9px] font-black uppercase text-emerald-600 ml-auto border border-emerald-400 px-1 py-0.5 rounded">Correct Answer</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Rendering choices for True / False */}
                              {q.question_type === "True_False" && (
                                <div className="flex gap-6 pl-4">
                                  {["True", "False"].map((choice) => {
                                    const isCorrect = q.correctAnswer === choice;
                                    return (
                                      <div key={choice} className={`text-xs font-medium flex items-center gap-2 ${isCorrect ? "text-emerald-700 bg-emerald-50/50 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-bold" : "text-slate-800"}`}>
                                        <span className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center shrink-0" />
                                        <span>{choice}</span>
                                        {isCorrect && <span className="text-[9px] font-black uppercase text-emerald-600 border border-emerald-400 px-1 py-0.5 rounded ml-1">Correct Answer</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Rendering fill check for Identification */}
                              {q.question_type === "Identification" && (
                                <div className="pl-4 space-y-1">
                                  <div className="flex gap-2 items-center text-xs">
                                    <span className="text-slate-500">Your Answer:</span>
                                    <div className="w-48 border-b border-slate-400" />
                                  </div>
                                  <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50/50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-block">
                                    Expected Answer: <strong className="underline">{q.correctAnswer}</strong>
                                  </div>
                                </div>
                              )}

                              {/* Rendering Columns for Matching Type */}
                              {q.question_type === "Matching_Type" && (
                                <div className="pl-4 space-y-4">
                                  <div className="grid grid-cols-2 gap-8 text-xs border border-slate-100 bg-slate-50/50 p-4 rounded-2xl">
                                    <div className="space-y-2">
                                      <p className="font-extrabold text-slate-800 border-b border-slate-200 pb-1.5">Column A (Premises)</p>
                                      {q.matches.map((match, mIdx) => (
                                        <p key={mIdx} className="font-medium text-slate-700">
                                          {String.fromCharCode(97 + mIdx)}. {match.premise}
                                        </p>
                                      ))}
                                    </div>
                                    <div className="space-y-2">
                                      <p className="font-extrabold text-slate-800 border-b border-slate-200 pb-1.5">Column B (Choices - Shuffled)</p>
                                      {q.matches.map((match, mIdx) => (
                                        <p key={mIdx} className="font-medium text-slate-700 flex justify-between gap-2">
                                          <span>{String.fromCharCode(65 + mIdx)}. {match.choice}</span>
                                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 shrink-0">Matches {String.fromCharCode(97 + mIdx)}</span>
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Rendering Essay */}
                              {q.question_type === "Essay" && (
                                <div className="pl-4 space-y-2 font-sans">
                                  <div className="w-full h-24 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 p-3 text-xs text-slate-400 italic">
                                    [ Student essay response area ]
                                  </div>
                                  {q.min_words && q.min_words > 0 ? (
                                    <div className="text-[10px] text-emerald-800 font-extrabold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                      📝 Minimum Limitation: {q.min_words} words required
                                    </div>
                                  ) : null}
                                </div>
                              )}

                              {/* Rendering Fill in the Blanks */}
                              {q.question_type === "Fill_In_The_Blanks" && (
                                <div className="pl-4 space-y-3 font-sans">
                                  <div className="text-xs font-semibold text-slate-900 bg-teal-50/40 border border-teal-100 p-3.5 rounded-xl space-y-2">
                                    <p className="text-[10px] font-black uppercase text-teal-800 tracking-wider">Inline Blanks & Answer Key:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {(q.blanks || []).map((blank, bIdx) => (
                                        <span key={bIdx} className="text-xs bg-white border border-teal-300 text-teal-950 font-bold px-3 py-1 rounded-lg shadow-2xs">
                                          Blank #{bIdx + 1}: <strong className="underline text-teal-700">{blank.answer || "(blank)"}</strong> ({blank.points || 1} pt{blank.points !== 1 && "s"})
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Exam End Marker */}
            <div className="text-center text-xs font-bold text-slate-400 border-t border-slate-200 pt-6">
              *** End of Examination ***
            </div>

          </div>

          {/* Wizard Navigation Footer */}
          <div className="flex justify-between items-center bg-white border border-slate-200 rounded-3xl p-5 shadow-sm max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex justify-center items-center gap-2 border border-slate-200 bg-white text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Questions
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300/60 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>

              <button
                disabled={isSubmitting}
                onClick={handleSubmitForReview}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-emerald-600/20"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Final Submit to Chair
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Import Questions Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center border-b border-slate-850">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 p-2 rounded-xl text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Import from Question Bank</h3>
                  <p className="text-xs text-slate-400 font-medium">Re-use categorized questions from the BSC repository</p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-50 border-b border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filter by Course</label>
                <select
                  value={importFilters.course_id}
                  onChange={(e) => setImportFilters({ ...importFilters, course_id: e.target.value })}
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
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Search by Topic</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Arrays, Recursion"
                    value={importFilters.topic}
                    onChange={(e) => setImportFilters({ ...importFilters, topic: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 pl-9 pr-4 py-2.5 focus:outline-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filter by Year Level</label>
                <select
                  value={importFilters.year_level}
                  onChange={(e) => setImportFilters({ ...importFilters, year_level: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 px-3 py-2.5 focus:outline-emerald-500 shadow-sm"
                >
                  <option value="">All Years</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loadingImportQs ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-xs text-slate-400 font-bold">Querying BSC repository...</p>
                </div>
              ) : availableQuestions.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl">
                  <AlertCircle className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No questions found</p>
                  <p className="text-[10px] text-slate-400 mt-1">Try expanding your course filter or checking spelling.</p>
                </div>
              ) : (
                availableQuestions.map((q) => {
                  const isChecked = selectedImportIds.includes(q.question_id);
                  let typeColor = "bg-slate-100 text-slate-700 border-slate-200";
                  if (q.question_type === "Multiple_Choice") typeColor = "bg-blue-50 text-blue-700 border-blue-100";
                  if (q.question_type === "True_False") typeColor = "bg-purple-50 text-purple-700 border-purple-100";
                  if (q.question_type === "Identification") typeColor = "bg-amber-50 text-amber-700 border-amber-100";
                  if (q.question_type === "Matching_Type") typeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";

                  // Extract prompt preview
                  let displayPrompt = q.question_text;
                  if (q.question_text.trim().startsWith("{")) {
                    try {
                      displayPrompt = JSON.parse(q.question_text).text || q.question_text;
                    } catch {}
                  }

                  return (
                    <div 
                      key={q.question_id}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedImportIds(selectedImportIds.filter(id => id !== q.question_id));
                        } else {
                          setSelectedImportIds([...selectedImportIds, q.question_id]);
                        }
                      }}
                      className={`border p-4 rounded-2xl flex items-start gap-4 cursor-pointer transition-all duration-300 ${
                        isChecked 
                          ? "bg-emerald-50/20 border-emerald-500 shadow-sm" 
                          : "bg-white hover:bg-slate-50/50 border-slate-200/80"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColor}`}>
                            {q.question_type.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">{q.points} pt{q.points !== 1 && "s"}</span>
                          {q.course && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                              {q.course.course_code}
                            </span>
                          )}
                          {q.topic && (
                            <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-bold">
                              Topic: {q.topic}
                            </span>
                          )}
                          {q.year_level && (
                            <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full font-bold">
                              {q.year_level} Year
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-relaxed">
                          {displayPrompt}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-5 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-slate-500">
                {selectedImportIds.length} question{selectedImportIds.length !== 1 && "s"} selected
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSelectedImportIds([]);
                  }}
                  className="bg-white border border-slate-250 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedImportIds.length === 0}
                  onClick={handleImportSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-emerald-600/20"
                >
                  Import Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch TOS Topic Range Assignment Modal */}
      {isBatchTopicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-100 p-2.5 rounded-2xl text-emerald-700">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Assign Topic by Item Range</h3>
                  <p className="text-xs text-slate-500 font-medium">Map multiple exam items to a TOS Topic</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchTopicModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Topic Input / Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">TOS Topic Name</label>
                <div className="space-y-2">
                  {existingUniqueTopics.length > 0 && (
                    <select
                      value={existingUniqueTopics.includes(batchTopicName) ? batchTopicName : ""}
                      onChange={(e) => {
                        if (e.target.value) setBatchTopicName(e.target.value);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 p-3 focus:outline-emerald-500"
                    >
                      <option value="">-- Choose Existing Topic --</option>
                      {existingUniqueTopics.map((top, idx) => (
                        <option key={idx} value={top}>
                          📌 {top}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    placeholder="Or enter new topic (e.g. Arrays & Collections)..."
                    value={batchTopicName}
                    onChange={(e) => setBatchTopicName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 p-3 focus:outline-emerald-500"
                  />
                </div>
              </div>

              {/* Item Range Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">From Item No.</label>
                  <input
                    type="number"
                    min="1"
                    max={questions.length || 1}
                    value={batchStartItem}
                    onChange={(e) => setBatchStartItem(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 p-3 text-center focus:outline-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">To Item No.</label>
                  <input
                    type="number"
                    min="1"
                    max={questions.length || 1}
                    value={batchEndItem}
                    onChange={(e) => setBatchEndItem(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 p-3 text-center focus:outline-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Range Presets */}
              {questions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-400 block">Quick Range Presets:</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setBatchStartItem(1); setBatchEndItem(questions.length); }}
                      className="text-[10px] font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      All Items (1–{questions.length})
                    </button>
                    {questions.length >= 10 && (
                      <button
                        type="button"
                        onClick={() => { setBatchStartItem(1); setBatchEndItem(10); }}
                        className="text-[10px] font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        Items 1–10
                      </button>
                    )}
                    {questions.length >= 20 && (
                      <button
                        type="button"
                        onClick={() => { setBatchStartItem(11); setBatchEndItem(20); }}
                        className="text-[10px] font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        Items 11–20
                      </button>
                    )}
                    {questions.length >= 30 && (
                      <button
                        type="button"
                        onClick={() => { setBatchStartItem(21); setBatchEndItem(30); }}
                        className="text-[10px] font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        Items 21–30
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBatchTopicModalOpen(false)}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBatchTopic}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Apply TOS Topic (Items {batchStartItem}–{batchEndItem})
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
