"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Settings, BookOpen, ClipboardCheck, ArrowLeft, ArrowRight, Save, 
  Upload, Trash2, Plus, Check, Eye, Trash, ArrowUp, ArrowDown, FileText, 
  Shuffle, AlertCircle, RefreshCw, FileUp, Sparkles, CheckCircle
} from "lucide-react";
import { saveExamConfig, saveExamQuestions, updateExamStatus } from "@/app/actions/faculty";

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
  current_status: "Draft" | "Pending_Chair" | "Pending_DI" | "Approved" | "Returned";
  course: Course;
  questionBank: Array<{
    question_id: number;
    question_text: string;
    question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type";
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
  question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type";
  options: string[]; // Multiple Choice options
  premises: string[]; // Matching Column A
  matches: Array<{ premise: string; choice: string }>; // Matching correct mapping
  correctAnswer: string; // For MCQ / TF / Identification
  points: number;
}

// Deserialization helper
function deserializeQuestions(dbQuestions: any[]): QuestionState[] {
  return dbQuestions.map(q => {
    let text = q.question_text;
    let options: string[] = [];
    let premises: string[] = [];
    let matches: Array<{ premise: string; choice: string }> = [];
    let correctAnswer = q.correct_answer;

    if (q.question_type === "Multiple_Choice") {
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

      try {
        const parsedAnswer = JSON.parse(q.correct_answer);
        matches = parsedAnswer.matches || [];
      } catch {
        matches = [];
      }
    }

    return {
      question_id: q.question_id,
      text,
      question_type: q.question_type,
      options,
      premises,
      matches,
      correctAnswer,
      points: q.points,
    };
  });
}

// Serialization helper
function serializeQuestions(questions: QuestionState[]) {
  return questions.map(q => {
    let question_text = q.text;
    let correct_answer = q.correctAnswer;

    if (q.question_type === "Multiple_Choice") {
      question_text = JSON.stringify({
        text: q.text,
        options: q.options,
      });
      correct_answer = q.correctAnswer;
    } else if (q.question_type === "Matching_Type") {
      // Extract premises and options from matches
      const premises = q.matches.map(m => m.premise).filter(Boolean);
      const options = Array.from(new Set(q.matches.map(m => m.choice).filter(Boolean)));
      
      question_text = JSON.stringify({
        text: q.text,
        premises,
        options,
      });
      correct_answer = JSON.stringify({
        matches: q.matches.filter(m => m.premise || m.choice)
      });
    }

    return {
      question_id: q.question_id,
      question_text,
      question_type: q.question_type,
      correct_answer,
      points: Number(q.points) || 1,
    };
  });
}

export function ExamBuilderWizard({ exam, courses, facultyId }: ExamBuilderWizardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps: 1 = Config, 2 = Questions, 3 = Preview & Submit
  const [step, setStep] = useState<number>(1);
  
  // Configuration Settings State
  const [title, setTitle] = useState<string>(exam.title);
  const [courseId, setCourseId] = useState<number>(exam.course_id);
  const [timeLimit, setTimeLimit] = useState<number>(exam.time_limit_minutes);
  const [randomizeItems, setRandomizeItems] = useState<boolean>(exam.randomize_items);
  const [tosFile, setTosFile] = useState<File | null>(null);
  const [existingTosPath, setExistingTosPath] = useState<string>(exam.tos_file_path);

  // Question Bank State
  const [questions, setQuestions] = useState<QuestionState[]>(deserializeQuestions(exam.questionBank));
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(
    exam.questionBank.length > 0 ? 0 : -1
  );

  // Notification Toast / Save Status
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error" | "saving"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step 1 Validation
  const isConfigValid = title.trim() !== "" && courseId > 0 && timeLimit > 0;

  // Handles adding a new question
  const handleAddQuestion = (type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type") => {
    let newQ: QuestionState = {
      text: "",
      question_type: type,
      options: [],
      premises: [],
      matches: [],
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
    if (tosFile) {
      configData.append("tosFile", tosFile);
    }

    const configRes = await saveExamConfig(configData);
    if (configRes.error) {
      setSaveStatus({ type: "error", message: `Config Error: ${configRes.error}` });
      return;
    }

    if (configRes.exam?.tos_file_path) {
      setExistingTosPath(configRes.exam.tos_file_path);
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
    if (tosFile) {
      configData.append("tosFile", tosFile);
    }

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

  // File drop/upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setTosFile(e.target.files[0]);
    }
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
            </div>
          </div>

          {/* Table of Specifications (TOS) File Upload */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                TOS Syllabus Alignment
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Table of Specifications (TOS) must map out objectives, topic weight, and cognitive level distribution. Required for clearing internal audit logs.
              </p>
            </div>

            {/* Current TOS indicator */}
            {existingTosPath ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-3 items-start">
                <FileText className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-800 truncate">TOS Document Seeded</p>
                  <a 
                    href={existingTosPath} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 underline font-bold mt-1 inline-block"
                  >
                    View Current TOS File
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-amber-800">TOS Missing</p>
                  <p className="text-[10px] text-amber-600 leading-normal mt-0.5">Please upload the TOS spreadsheet/PDF to verify alignment.</p>
                </div>
              </div>
            )}

            {/* File upload drag-and-drop zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/30 hover:bg-emerald-50/10 transition-all duration-300 group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
              />
              <FileUp className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mx-auto transition-colors duration-300" />
              <p className="text-xs font-bold text-slate-700 mt-3 group-hover:text-emerald-800">
                {tosFile ? tosFile.name : "Upload TOS File"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {tosFile ? `${(tosFile.size / 1024).toFixed(1)} KB` : "Drag or click to choose (PDF/Doc/XLSX)"}
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                disabled={!isConfigValid}
                onClick={() => setStep(2)}
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                Proceed to Questions
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: QUESTION BANK BUILDER */}
      {step === 2 && (
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

            {/* List Body */}
            {questions.length > 0 ? (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isActive = activeQuestionIdx === idx;
                  let typeColor = "bg-slate-100 text-slate-700 border-slate-200";
                  if (q.question_type === "Multiple_Choice") typeColor = "bg-blue-50 text-blue-700 border-blue-100";
                  if (q.question_type === "True_False") typeColor = "bg-purple-50 text-purple-700 border-purple-100";
                  if (q.question_type === "Identification") typeColor = "bg-amber-50 text-amber-700 border-amber-100";
                  if (q.question_type === "Matching_Type") typeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";

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
              </div>
            </div>
          </div>

          {/* Right Panel: Question Editor */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            {activeQuestionIdx !== -1 && questions[activeQuestionIdx] ? (
              <div className="space-y-6">
                
                {/* Editor Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-slate-800">
                      Editing Question #{activeQuestionIdx + 1}
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Type: {questions[activeQuestionIdx].question_type.replace("_", " ")}
                    </p>
                  </div>
                  
                  {/* Points Modifier */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500">Points:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={questions[activeQuestionIdx].points}
                      onChange={(e) => updateQuestionPoints(Number(e.target.value))}
                      className="w-16 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold text-slate-800 py-1.5 focus:outline-emerald-500"
                    />
                  </div>
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
              {questions.map((q, idx) => {
                return (
                  <div key={idx} className="space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-sm font-bold text-slate-950 leading-relaxed">
                        {idx + 1}. {q.text}
                      </p>
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
                            {/* In actual student view this is shuffled. Here we list them for view, highlighting correctness */}
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

                  </div>
                );
              })}
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

    </div>
  );
}
