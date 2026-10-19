"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, ShieldAlert, CheckCircle2, AlertTriangle, Bookmark,
  ChevronLeft, ChevronRight, Maximize2, Monitor, Loader2, ArrowRight,
  Menu, X, ShieldCheck
} from "lucide-react";
import { saveStudentAnswers, submitStudentExam, logStudentWarning, keepAliveStudentExam } from "@/app/actions/student";
import { Latex } from "@/app/components/Latex";

interface Question {
  question_id: number;
  question_text: string;
  question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type" | "Essay" | "Fill_In_The_Blanks";
  points: number;
}

interface TakeExamClientProps {
  studentId: number;
  studentName: string;
  institutionalId: string;
  examId: number;
  initialData: {
    studentExamId: number;
    remainingSeconds: number;
    questions: Question[];
    savedAnswers: { question_id: number; submitted_response: string }[];
    examTitle: string;
    courseTitle: string;
    courseCode: string;
    timePenaltySeconds: number;
    scorePenaltyPoints: number;
    timeLimitMinutes?: number;
    isInProgress?: boolean;
  };
}

export function TakeExamClient({
  studentId,
  studentName,
  institutionalId,
  examId,
  initialData,
}: TakeExamClientProps) {
  const router = useRouter();

  // Mode: 'gate' | 'exam' | 'warning' | 'lockout' | 'success' | 'submitting' | 'timeout_offline'
  const [mode, setMode] = useState<"gate" | "exam" | "warning" | "lockout" | "success" | "submitting" | "timeout_offline">("gate");
  
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialData.remainingSeconds);
  const [violations, setViolations] = useState<number>(0);
  const [warningReason, setWarningReason] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "offline">("saved");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    totalScore: number;
    rawScore?: number;
    penaltyPoints?: number;
    violationsCount?: number;
    maxPoints?: number;
    trigger?: string;
  } | null>(null);

  // Answers State: Record<question_id, response>
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    initialData.savedAnswers.forEach((ans) => {
      initial[ans.question_id] = ans.submitted_response;
    });
    return initial;
  });

  // Keep track of answers in last saved state
  const [lastSavedAnswers, setLastSavedAnswers] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    initialData.savedAnswers.forEach((ans) => {
      initial[ans.question_id] = ans.submitted_response;
    });
    return initial;
  });

  // Flagged/Bookmarked Questions: Record<question_id, boolean>
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});

  const remainingSecondsRef = useRef(remainingSeconds);
  const autoSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef<Record<number, string>>(answers);
  const lastSavedAnswersRef = useRef<Record<number, string>>(lastSavedAnswers);
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveQueuedRef = useRef<boolean>(false);

  const violationsKey = `exam_violations_${initialData.studentExamId}`;
  const localBackupKey = `exam_answers_backup_${initialData.studentExamId}`;

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    lastSavedAnswersRef.current = lastSavedAnswers;
  }, [lastSavedAnswers]);

  // 0. Crash Recovery & Answer Preservation from Local Storage on Mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(localBackupKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          let hasDiff = false;
          const merged = { ...answersRef.current };
          for (const [qIdStr, val] of Object.entries(parsed)) {
            const qId = Number(qIdStr);
            const dbVal = initialData.savedAnswers.find((a) => a.question_id === qId)?.submitted_response || "";
            if (val && val !== dbVal) {
              merged[qId] = String(val);
              hasDiff = true;
            }
          }
          if (hasDiff) {
            setAnswers(merged);
            answersRef.current = merged;
            // Synchronize restored changes with database immediately
            triggerBackgroundSave(merged);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to restore answers from localStorage:", e);
    }
  }, [localBackupKey]);

  // 0.5 Network connectivity monitor for resilient offline handling & sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (mode === "timeout_offline") {
        triggerTimeoutSubmission();
      } else {
        triggerBackgroundSave(answersRef.current);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSaveStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      setSaveStatus("offline");
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [mode]);

  // 1. Initialize local violation count from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(violationsKey);
    if (stored) {
      const parsed = Number(stored);
      setViolations(parsed);
      if (parsed >= 3) {
        setMode("lockout");
        submitStudentExam(initialData.studentExamId, "Cheating_Lockout");
      }
    }
  }, [violationsKey]);

  // 2. Countdown Timer Loop
  useEffect(() => {
    if (mode !== "exam" && mode !== "warning") return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerTimeoutSubmission();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode]);

  // 2.5 Heartbeat Timer Sync Loop (Every 10 Seconds)
  useEffect(() => {
    if (mode !== "exam" && mode !== "warning") return;

    const heartbeat = setInterval(async () => {
      try {
        await keepAliveStudentExam(initialData.studentExamId, remainingSecondsRef.current);
      } catch (err) {
        console.error("Timer heartbeat sync failed:", err);
      }
    }, 10000);

    return () => clearInterval(heartbeat);
  }, [mode]);

  // 3. Periodic Background Auto-Save Loop (Every 10 Seconds)
  useEffect(() => {
    if (mode !== "exam") return;

    const autoSaveInterval = setInterval(() => {
      triggerBackgroundSave();
    }, 10000);

    return () => clearInterval(autoSaveInterval);
  }, [mode]);

  // 4. Focus Loss & Tab Switching Monitor (Alt+Tab & Window Switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && mode === "exam") {
        triggerViolation("Leaving the exam window or switching tabs.");
      }
    };

    const handleWindowBlur = () => {
      if (mode === "exam") {
        triggerViolation("Switching away from the exam screen.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [mode, violations, answers]);

  // 5. Fullscreen Exit Monitor
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement === null && mode === "exam") {
        triggerViolation("Exiting full screen mode.");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [mode, violations, answers]);

  // --- Core Handlers ---

  // Request secure fullscreen & begin exam
  const handleStartExam = async () => {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      }
      setMode("exam");
    } catch (err) {
      console.error("Fullscreen request rejected:", err);
      // Fallback: Proceed anyway
      setMode("exam");
    }
  };

  // Re-enter secure mode after a warning
  const handleReEnterSecureMode = async () => {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      }
      setMode("exam");
    } catch (err) {
      console.error("Re-entering fullscreen failed:", err);
      setMode("exam");
    }
  };

  // Log and increment violation attempts
  const triggerViolation = async (reason: string) => {
    const currentCount = Number(localStorage.getItem(violationsKey) || "0");
    const nextCount = currentCount + 1;
    localStorage.setItem(violationsKey, String(nextCount));
    setViolations(nextCount);

    if (nextCount < 3) {
      setMode("warning");
      setWarningReason(reason);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      try {
        const res = await logStudentWarning(studentId, examId, nextCount, reason, initialData.studentExamId);
        if (res.success && res.remainingSeconds !== undefined) {
          setRemainingSeconds(res.remainingSeconds);
          remainingSecondsRef.current = res.remainingSeconds;
        }
      } catch (err) {
        console.error("Failed to log warning / apply penalty on server:", err);
      }
    } else {
      // 3rd violation triggers lockout
      setMode("lockout");
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      submitViolationSubmission();
    }
  };

  // Background save dirty responses
  const triggerBackgroundSave = async (overrideAnswers?: Record<number, string>) => {
    const currentAnswers = overrideAnswers || answersRef.current;

    // If offline, preserve locally and transition status
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSaveStatus("offline");
      return;
    }

    // If save is already in progress, queue a subsequent sync to avoid race conditions
    if (isSavingRef.current) {
      pendingSaveQueuedRef.current = true;
      return;
    }

    const changedList: { question_id: number; submitted_response: string }[] = [];

    Object.entries(currentAnswers).forEach(([qId, val]) => {
      const questionId = Number(qId);
      if (lastSavedAnswersRef.current[questionId] !== val) {
        changedList.push({ question_id: questionId, submitted_response: val });
      }
    });

    if (changedList.length === 0) {
      setSaveStatus("saved");
      return;
    }

    isSavingRef.current = true;
    setSaveStatus("saving");

    try {
      const res = await saveStudentAnswers(initialData.studentExamId, changedList);
      if (res.success) {
        setLastSavedAnswers((prev) => {
          const next = { ...prev };
          changedList.forEach((c) => {
            next[c.question_id] = c.submitted_response;
          });
          lastSavedAnswersRef.current = next;
          return next;
        });
        setSaveStatus("saved");
      } else {
        if (res.error?.includes("locked") || res.error?.includes("already been submitted")) {
          console.warn("Save rejected: Exam attempt is locked.");
        } else {
          setSaveStatus("offline");
        }
      }
    } catch (err) {
      console.error("Background auto-save failed:", err);
      setSaveStatus("offline");
    } finally {
      isSavingRef.current = false;
      // If student answered or typed while this network save was in flight, process queue immediately
      if (pendingSaveQueuedRef.current) {
        pendingSaveQueuedRef.current = false;
        triggerBackgroundSave(answersRef.current);
      }
    }
  };

  // Update answer locally, write to local crash backup, and trigger responsive auto-saving
  const handleAnswerChange = (questionId: number, response: string) => {
    setAnswers((prev) => {
      const newAnswers = {
        ...prev,
        [questionId]: response,
      };
      answersRef.current = newAnswers;

      // Synchronously write to local storage mirror so answers survive abrupt tab closing / refresh
      try {
        localStorage.setItem(localBackupKey, JSON.stringify(newAnswers));
      } catch (err) {
        console.warn("Failed to write to local storage mirror:", err);
      }

      const targetQuestion = initialData.questions.find(
        (q) => q.question_id === questionId
      );
      const isTextType =
        targetQuestion?.question_type === "Essay" ||
        targetQuestion?.question_type === "Identification" ||
        targetQuestion?.question_type === "Fill_In_The_Blanks";

      if (autoSaveDebounceRef.current) {
        clearTimeout(autoSaveDebounceRef.current);
      }

      if (isTextType) {
        setSaveStatus("saving");
        // Debounce text inputs by 600ms of inactivity for prompt saving
        autoSaveDebounceRef.current = setTimeout(() => {
          triggerBackgroundSave(newAnswers);
        }, 600);
      } else {
        // Save choice selections, true/false, and matching immediately
        triggerBackgroundSave(newAnswers);
      }

      return newAnswers;
    });
  };

  // Instantly flush pending text answer saves on input blur
  const handleTextBlur = () => {
    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
    }
    triggerBackgroundSave(answersRef.current);
  };

  // Paginate questions (flushes current dirty answer instantly on navigation)
  const handleNavigateQuestion = (newIdx: number) => {
    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
    }
    triggerBackgroundSave(answersRef.current);
    setCurrentQuestionIdx(newIdx);
  };

  // Bookmark / Flag toggle
  const toggleFlagQuestion = (questionId: number) => {
    setFlagged((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Time Limit Expired Submit
  const triggerTimeoutSubmission = async () => {
    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
    }
    setMode("submitting");

    const currentAnswersArray = Object.entries(answersRef.current).map(([qId, val]) => ({
      question_id: Number(qId),
      submitted_response: val,
    }));

    try {
      const res = await submitStudentExam(initialData.studentExamId, "Timeout", currentAnswersArray);
      if (res.success) {
        setFinalScore(res.totalScore);
        setSubmissionResult({
          totalScore: res.totalScore,
          rawScore: res.rawScore,
          penaltyPoints: res.penaltyPoints,
          violationsCount: res.violationsCount,
          maxPoints: res.maxPoints,
          trigger: "Timeout",
        });
        localStorage.removeItem(violationsKey);
        localStorage.removeItem(localBackupKey);
        setMode("success");
      } else {
        // Network or server submission issue: handle safely with offline retry
        setMode("timeout_offline");
      }
    } catch (err) {
      console.error("Timeout submit failed:", err);
      setMode("timeout_offline");
    }
  };

  // Cheating lockout auto-submit
  const submitViolationSubmission = async () => {
    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
    }
    const currentAnswersArray = Object.entries(answersRef.current).map(([qId, val]) => ({
      question_id: Number(qId),
      submitted_response: val,
    }));
    try {
      await submitStudentExam(initialData.studentExamId, "Cheating_Lockout", currentAnswersArray);
      localStorage.removeItem(localBackupKey);
    } catch (err) {
      console.error("Lockout submission failed:", err);
    }
  };

  // Manual explicit submit
  const handleManualSubmit = async () => {
    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
    }
    setMode("submitting");
    setShowConfirmSubmit(false);
    
    // Attempt exit fullscreen gracefully
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }

    const currentAnswersArray = Object.entries(answersRef.current).map(([qId, val]) => ({
      question_id: Number(qId),
      submitted_response: val,
    }));

    try {
      const res = await submitStudentExam(initialData.studentExamId, "Manual", currentAnswersArray);
      if (res.success) {
        setFinalScore(res.totalScore);
        setSubmissionResult({
          totalScore: res.totalScore,
          rawScore: res.rawScore,
          penaltyPoints: res.penaltyPoints,
          violationsCount: res.violationsCount,
          maxPoints: res.maxPoints,
          trigger: "Manual",
        });
        localStorage.removeItem(violationsKey);
        localStorage.removeItem(localBackupKey);
        setMode("success");
      } else {
        alert(res.error || "Submission failed. Please check your internet connection and try again.");
        setMode("exam");
      }
    } catch (err) {
      console.error("Manual submit failed:", err);
      alert("Submission error. Your answers have been preserved on this device. Please try submitting again.");
      setMode("exam");
    }
  };

  // --- Helper parsing of questions ---
  const currentQuestion = initialData.questions[currentQuestionIdx];

  const parseQuestionText = (q: Question) => {
    if (q.question_type === "Multiple_Choice" || q.question_type === "Matching_Type" || q.question_type === "Fill_In_The_Blanks" || q.question_type === "Essay" || q.question_text.trim().startsWith("{")) {
      try {
        return JSON.parse(q.question_text);
      } catch {
        return { text: q.question_text, options: [], premises: [], blanks: [] };
      }
    }
    return { text: q.question_text, options: [], premises: [], blanks: [] };
  };

  const currentParsed = currentQuestion ? parseQuestionText(currentQuestion) : null;

  // Matching type specific helpers
  const getMatchingChoice = (questionId: number, premise: string): string => {
    const response = answers[questionId];
    if (!response) return "";
    try {
      const parsed = JSON.parse(response);
      const match = parsed.matches?.find((m: any) => m.premise === premise);
      return match?.choice || "";
    } catch {
      return "";
    }
  };

  const handleMatchingChoiceChange = (questionId: number, premise: string, choice: string) => {
    const response = answers[questionId];
    let matches = [];
    if (response) {
      try {
        const parsed = JSON.parse(response);
        matches = parsed.matches || [];
      } catch {}
    }

    matches = matches.filter((m: any) => m.premise !== premise);
    if (choice) {
      matches.push({ premise, choice });
    }

    const updatedResponse = JSON.stringify({ matches });
    handleAnswerChange(questionId, updatedResponse);
  };

  // Fill in the Blanks specific helpers
  const getBlankResponse = (questionId: number, blankId: number | string): string => {
    const resp = answers[questionId];
    if (!resp) return "";
    try {
      if (resp.trim().startsWith("{")) {
        const parsed = JSON.parse(resp);
        return parsed.blanks?.[String(blankId)] || "";
      }
      return resp;
    } catch {
      return resp;
    }
  };

  const handleBlankResponseChange = (questionId: number, blankId: number | string, val: string) => {
    const resp = answers[questionId];
    let blanksMap: Record<string, string> = {};
    if (resp && resp.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(resp);
        blanksMap = parsed.blanks || {};
      } catch {}
    }
    blanksMap[String(blankId)] = val;
    const updatedResponse = JSON.stringify({ blanks: blanksMap });
    handleAnswerChange(questionId, updatedResponse);
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  };

  const timeLimitUrgent = remainingSeconds < 60;

  // Calculate answer stats for confirm submit dialog
  const totalQuestions = initialData.questions.length;
  const answeredCount = initialData.questions.filter((q) => {
    const ans = answers[q.question_id];
    if (!ans) return false;
    if (q.question_type === "Matching_Type") {
      try {
        const parsed = JSON.parse(ans);
        return (parsed.matches?.length || 0) > 0;
      } catch {
        return false;
      }
    }
    if (q.question_type === "Fill_In_The_Blanks") {
      try {
        if (ans.trim().startsWith("{")) {
          const parsed = JSON.parse(ans);
          const bValues = Object.values(parsed.blanks || {}) as string[];
          return bValues.some(v => v.trim() !== "");
        }
        return ans.trim() !== "";
      } catch {
        return ans.trim() !== "";
      }
    }
    return ans.trim() !== "";
  }).length;

  // --- Rendering UI States ---

  // A. SECURE ENTRY GATE
  if (mode === "gate") {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans select-none justify-between">
        <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 py-4 px-6 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="bg-[#7A151A] text-white p-2 rounded-xl border border-rose-950/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white">AcadNexus Exam Portal</span>
            </div>
          </div>
          <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            Secure Test Ready
          </span>
        </header>

        <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 flex flex-col justify-center gap-8">
          <div className="bg-[#1E293B] border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden space-y-6">
            {/* Sliding header glow */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#7A151A] via-[#E2A123] to-[#7A151A]" />
            
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">
                Exam Details
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight mt-2">{initialData.examTitle}</h1>
              <p className="text-xs text-slate-400 font-medium">
                Course: {initialData.courseTitle} ({initialData.courseCode})
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-2.5 py-1 rounded-lg w-fit shadow-md">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Approved by School Administration
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y border-slate-800 py-4 text-xs font-medium text-slate-400">
              <div>
                <p className="text-slate-500 uppercase font-bold text-[10px]">Student Name</p>
                <p className="text-slate-200 font-semibold text-sm mt-0.5">{studentName}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase font-bold text-[10px]">Institutional ID</p>
                <p className="text-slate-200 font-semibold text-sm mt-0.5">{institutionalId}</p>
              </div>
              <div className="mt-2">
                <p className="text-slate-500 uppercase font-bold text-[10px]">
                  {initialData.isInProgress ? "Remaining Time" : "Time Limit"}
                </p>
                <p className="text-slate-200 font-bold text-sm mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-500" />{" "}
                  {initialData.isInProgress
                    ? `${Math.max(1, Math.ceil(initialData.remainingSeconds / 60))} Minutes Remaining`
                    : `${initialData.timeLimitMinutes || Math.ceil(initialData.remainingSeconds / 60)} Minutes`}
                </p>
              </div>
              <div className="mt-2">
                <p className="text-slate-500 uppercase font-bold text-[10px]">Total Questions</p>
                <p className="text-slate-200 font-bold text-sm mt-0.5">{initialData.questions.length} Questions</p>
              </div>
            </div>

            {/* Lock-down Rules List */}
            <div className="space-y-3 bg-[#0F172A]/50 border border-slate-800/60 p-5 rounded-2xl">
              <h3 className="text-xs font-black text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-rose-500" /> Exam Rules:
              </h3>
              <ul className="text-slate-400 text-xs space-y-2 list-disc list-inside leading-relaxed font-semibold">
                <li>Stay on this page: Switching tabs or opening other applications will give you a warning.</li>
                <li>Stay in full screen: Exiting full screen is not allowed during the exam.</li>
                <li>You get <span className="text-rose-400 font-bold">up to 2 warnings</span>. On the 3rd warning, your exam will <span className="text-rose-500 font-black">end and submit automatically</span>.</li>
                <li>Your answers save automatically as you work, so your progress is safe.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={handleStartExam}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-800 hover:to-rose-700 text-white font-black text-sm px-6 py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] border border-rose-600"
              >
                {initialData.isInProgress ? "Resume Exam" : "Start Exam Now"} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>

        <footer className="py-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
          © {new Date().getFullYear()} Batanes State College. Secure Exam Environment.
        </footer>
      </div>
    );
  }

  // B. SECURITY VIOLATION WARNING MODAL (LOCAL MODAL SCREEN)
  if (mode === "warning") {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-[#1E293B] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 to-rose-600" />
          
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
            <AlertTriangle className="w-9 h-9 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight uppercase">Warning!</h2>
            <p className="text-xs text-rose-400 font-black uppercase bg-rose-500/10 py-1.5 px-3 rounded-full inline-block border border-rose-500/20 mt-1">
              Warning {violations} of 2
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-3">
              We detected: <strong className="text-slate-200">{warningReason}</strong>
            </p>
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-2xl text-xs font-semibold max-w-sm mx-auto my-3 text-left space-y-1">
              <p className="font-extrabold text-rose-400 flex items-center gap-1.5">⚠️ Penalty Applied:</p>
              <p className="ml-1">Time lost: <strong className="text-white">-{initialData.timePenaltySeconds} seconds</strong> removed from timer</p>
              <p className="ml-1">Score deduction: <strong className="text-white">-{initialData.scorePenaltyPoints} points</strong> on this exam</p>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed mt-2 font-medium">
              Please stay on this exam screen in full screen mode. On the next warning, your exam will end and submit automatically.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={handleReEnterSecureMode}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-sm px-5 py-3 rounded-xl transition-all shadow-md"
            >
              Return to Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  // C. SUBMITTING WAITING OVERLAY
  if (mode === "submitting") {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col items-center justify-center p-6 font-sans select-none">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold">Submitting Your Exam...</h2>
          <p className="text-slate-500 text-xs max-w-xs leading-normal">
            Saving your answers and recording your score. Please wait a moment and do not close this window...
          </p>
        </div>
      </div>
    );
  }

  // D. CHEATING LOCKOUT SUBMISSION SCREEN
  if (mode === "lockout") {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-[#1E293B] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-600" />
          
          <div className="mx-auto w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-500/20">
            <ShieldAlert className="w-9 h-9 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-rose-500 tracking-tight uppercase">Exam Ended</h2>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed mt-2">
              Your exam was automatically submitted because test rules were broken 3 times (such as switching tabs or leaving full screen).
            </p>
            <div className="bg-rose-950/20 border border-rose-900/30 text-rose-400 p-4 rounded-2xl text-xs font-semibold text-left space-y-1">
              <p>● Maximum warnings reached (3 warnings).</p>
              <p>● Your exam answers have been saved and submitted.</p>
              <p>● Your teacher has been notified.</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                localStorage.removeItem(violationsKey);
                router.push("/dashboard/student");
                router.refresh();
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-5 py-3 rounded-xl transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // E. TIMEOUT OFFLINE VIEW (Answers safely queued, awaiting connection)
  if (mode === "timeout_offline") {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-[#1E293B] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
          
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
            <Clock className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-amber-400 tracking-tight uppercase">Time Limit Reached</h2>
            <p className="text-xs text-slate-300 font-semibold leading-relaxed mt-2">
              Your examination time has expired. Further answer changes have been locked.
            </p>
            <div className="bg-amber-950/20 border border-amber-900/30 text-amber-300 p-4 rounded-2xl text-xs font-semibold text-left space-y-1.5">
              <p className="flex items-center gap-1.5 font-bold text-amber-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Answers Preserved Safely
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Your responses are preserved safely on your device. We are waiting for an active internet connection to finalize your submission and record your final score.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-3">
            <button
              onClick={() => triggerTimeoutSubmission()}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-5 py-3 rounded-xl transition-all shadow-md cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" /> Finalize Submission Now
            </button>
            <p className="text-[11px] text-slate-500">
              This page will submit automatically as soon as your internet connection is restored.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // F. SUCCESS SUBMISSION SCREEN (SHOW SCORES DETAILED)
  if (mode === "success") {
    const totalPossible = initialData.questions.reduce((sum, q) => sum + q.points, 0);
    const scorePct = totalPossible > 0 ? Math.round(((finalScore ?? 0) / totalPossible) * 100) : 0;
    const isTimeout = submissionResult?.trigger === "Timeout";
    const hasPenalty = (submissionResult?.penaltyPoints ?? 0) > 0;
    const hasEssay = initialData.questions.some((q) => q.question_type === "Essay");
    
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-[#1E293B] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
          
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-9 h-9 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight uppercase">
              {isTimeout ? "Exam Time Expired" : "Exam Submitted!"}
            </h2>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              {isTimeout
                ? "Your allocated exam time ran out. Your answers were automatically saved and submitted."
                : "Your exam has been submitted and saved successfully."}
            </p>
          </div>

          <div className="bg-[#0F172A]/50 border border-slate-800 p-4 rounded-2xl text-left space-y-2.5 text-xs font-medium">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Submission Status</span>
              <span className={`font-bold font-mono ${isTimeout ? "text-amber-400" : "text-emerald-400"}`}>
                {isTimeout ? "Auto-Submitted (Time Ran Out)" : "Submitted Successfully"}
              </span>
            </div>

            {submissionResult?.rawScore !== undefined && hasPenalty && (
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Initial Score</span>
                <span className="text-slate-300 font-bold font-mono">
                  {submissionResult.rawScore} / {totalPossible} pts
                </span>
              </div>
            )}

            {hasPenalty && (
              <div className="flex justify-between border-b border-slate-800 pb-2 text-rose-400">
                <span>Security Penalties</span>
                <span className="font-bold font-mono">
                  -{submissionResult?.penaltyPoints} pts ({submissionResult?.violationsCount} warning{submissionResult?.violationsCount !== 1 ? "s" : ""})
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-0.5">
              <span className="text-slate-400 font-semibold">Final Score</span>
              <span className="text-emerald-400 font-black text-base font-mono">
                {finalScore} / {totalPossible} pts ({scorePct}%)
              </span>
            </div>

            {hasEssay && (
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                ℹ️ Objective questions were scored automatically. Any essay responses will be reviewed and graded by your instructor.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                localStorage.removeItem(violationsKey);
                localStorage.removeItem(localBackupKey);
                router.push("/dashboard/student");
                router.refresh();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-5 py-3 rounded-xl transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // G. REGULAR CORE SECURE TAKING INTERFACE
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. SECURE NAVBAR */}
      <header className="bg-[#1E293B] border-b border-slate-800 py-3.5 px-4 sm:px-6 flex items-center justify-between z-40 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-[#7A151A] text-white p-1.5 rounded-lg border border-rose-900/30">
            <Monitor className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm text-white truncate max-w-[140px] sm:max-w-xs leading-none">
              {initialData.examTitle}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Course: {initialData.courseCode}
            </p>
          </div>
        </div>

        {/* Sync status & Timer */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Status Indicator */}
          <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 sm:px-3 py-1 rounded-full border transition-all ${
            saveStatus === "saving"
              ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
              : saveStatus === "offline"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          }`}>
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveStatus === "offline" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Offline (Saved on device)</span>
                <span className="sm:hidden">Offline</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Saved</span>
              </>
            )}
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
            timeLimitUrgent 
              ? "bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse" 
              : "bg-slate-900 border-slate-800 text-slate-200"
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono text-xs font-black">{formatTime(remainingSeconds)}</span>
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 2. BODY GRID */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Side: Question Pane */}
        <main className="flex-1 flex flex-col justify-between overflow-y-auto p-4 sm:p-8 space-y-6">
          <div className="max-w-2xl w-full mx-auto space-y-6">
            
            {/* Question title card */}
            <div className="bg-[#1E293B] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                  Question {currentQuestionIdx + 1} of {totalQuestions}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {currentQuestion.question_type.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">{currentQuestion.points} Point{currentQuestion.points !== 1 && "s"}</span>
                </div>
              </div>

              {/* Text prompt */}
              <div className="text-slate-100 font-bold text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
                <Latex 
                  text={
                    currentQuestion.question_type === "Multiple_Choice" || currentQuestion.question_type === "Matching_Type" || currentQuestion.question_text.trim().startsWith("{")
                      ? currentParsed?.text || ""
                      : currentQuestion.question_text
                  } 
                />
              </div>

              {/* Attached Image Asset */}
              {currentParsed?.image_url && (
                <div className="my-4 bg-slate-900/20 border border-slate-800/80 rounded-2xl p-2 max-w-xl overflow-hidden">
                  <img 
                    src={currentParsed.image_url} 
                    alt="Question asset" 
                    className="w-full h-auto max-h-[300px] object-contain rounded-xl"
                  />
                </div>
              )}

              {/* Option Rendering by Type */}
              <div className="mt-6">
                
                {/* 1. Multiple Choice */}
                {currentQuestion.question_type === "Multiple_Choice" && currentParsed?.options && (
                  <div className="grid grid-cols-1 gap-3">
                    {currentParsed.options.map((option: string) => {
                      const isSelected = answers[currentQuestion.question_id] === option;
                      return (
                        <button
                          key={option}
                          onClick={() => handleAnswerChange(currentQuestion.question_id, option)}
                          className={`flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-rose-500/10 border-rose-500/50 text-rose-300 shadow-sm" 
                              : "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/60"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-rose-500 text-rose-500" : "border-slate-600 text-transparent"
                          }`}>
                            {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />}
                          </div>
                          <span className="text-sm font-semibold"><Latex text={option} /></span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. True / False */}
                {currentQuestion.question_type === "True_False" && (
                  <div className="flex gap-4">
                    {["True", "False"].map((option) => {
                      const isSelected = answers[currentQuestion.question_id] === option;
                      return (
                        <button
                          key={option}
                          onClick={() => handleAnswerChange(currentQuestion.question_id, option)}
                          className={`flex-1 flex items-center justify-center gap-3 p-6 rounded-xl border font-black text-sm cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-rose-500/10 border-rose-500/50 text-rose-300 shadow-sm" 
                              : "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/60"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-rose-500 text-rose-500" : "border-slate-600 text-transparent"
                          }`}>
                            {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />}
                          </div>
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. Identification */}
                {currentQuestion.question_type === "Identification" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your Response:</label>
                    <input
                      type="text"
                      value={answers[currentQuestion.question_id] || ""}
                      onChange={(e) => handleAnswerChange(currentQuestion.question_id, e.target.value)}
                      onBlur={handleTextBlur}
                      placeholder="Type your response here..."
                      className="w-full bg-slate-900 border border-slate-800 focus:bg-slate-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 text-sm font-semibold text-slate-100 placeholder:text-slate-500 px-4 py-3 rounded-xl transition-all"
                    />
                  </div>
                )}

                {/* 4. Matching Type */}
                {currentQuestion.question_type === "Matching_Type" && currentParsed?.premises && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Match Column A with Column B:</p>
                    <div className="space-y-3">
                      {currentParsed.premises.map((premise: string) => {
                        const selectedVal = getMatchingChoice(currentQuestion.question_id, premise);
                        return (
                          <div key={premise} className="flex flex-col sm:flex-row sm:items-center justify-between border border-slate-800/60 bg-slate-900/20 p-4 rounded-xl gap-3">
                            <span className="text-sm text-slate-300 font-bold"><Latex text={premise} /></span>
                            <select
                              value={selectedVal}
                              onChange={(e) => handleMatchingChoiceChange(currentQuestion.question_id, premise, e.target.value)}
                              className="bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                            >
                              <option value="">-- Select Matching Option --</option>
                              {currentParsed.options?.map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. Essay */}
                {currentQuestion.question_type === "Essay" && (() => {
                  const essayText = answers[currentQuestion.question_id] || "";
                  const wordCount = essayText.trim() ? essayText.trim().split(/\s+/).filter(Boolean).length : 0;
                  const minWords = currentParsed?.min_words ?? 0;
                  const meetsMinWords = minWords === 0 || wordCount >= minWords;

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your Essay Response:</label>
                        {minWords > 0 && (
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                            meetsMinWords 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                          }`}>
                            {meetsMinWords ? "✓ Minimum limit met" : `⚠️ Minimum limit: ${wordCount} / ${minWords} words`}
                          </span>
                        )}
                      </div>

                      <textarea
                        value={essayText}
                        onChange={(e) => handleAnswerChange(currentQuestion.question_id, e.target.value)}
                        onBlur={handleTextBlur}
                        placeholder="Write your detailed answer response here..."
                        rows={7}
                        className="w-full bg-slate-900 border border-slate-800 focus:bg-slate-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 text-sm font-semibold text-slate-100 placeholder:text-slate-500 p-4 rounded-xl transition-all resize-y outline-none"
                      />

                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>Word Count: <strong className="text-slate-200">{wordCount}</strong> words</span>
                        {minWords > 0 && !meetsMinWords && (
                          <span className="text-amber-400 text-[11px] font-bold">
                            Please write at least {minWords - wordCount} more word{minWords - wordCount !== 1 ? "s" : ""} to satisfy requirements.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 6. Fill in the Blanks */}
                {currentQuestion.question_type === "Fill_In_The_Blanks" && (() => {
                  const text = typeof currentParsed?.text === "string" ? currentParsed.text : (currentQuestion.question_text || "");
                  const blanks = currentParsed?.blanks || [];

                  if (text.includes("[blank]")) {
                    const parts = text.split("[blank]");
                    return (
                      <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fill in the missing blank slots below:</p>
                        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl text-slate-100 text-sm font-bold leading-loose">
                          {parts.map((part: string, pIdx: number) => {
                            const blankId = pIdx + 1;
                            const val = getBlankResponse(currentQuestion.question_id, blankId);
                            const blankMeta = blanks[pIdx];

                            return (
                              <span key={pIdx}>
                                <Latex text={part} />
                                {pIdx < parts.length - 1 && (
                                  <input
                                    type="text"
                                    value={val}
                                    placeholder={`Blank #${blankId} (${blankMeta?.points || 1} pt)`}
                                    onChange={(e) => handleBlankResponseChange(currentQuestion.question_id, blankId, e.target.value)}
                                    onBlur={handleTextBlur}
                                    className="mx-1.5 px-3 py-1 bg-slate-950 border border-rose-500/40 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-300 font-bold text-xs rounded-xl shadow-inner outline-none min-w-[130px] inline-block"
                                  />
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  // Fallback if [blank] tag wasn't in prompt
                  return (
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Provide answers for each blank:</p>
                      <div className="space-y-3">
                        {(blanks.length > 0 ? blanks : [{ id: 1, points: 1 }]).map((b: any, bIdx: number) => {
                          const blankId = b.id || bIdx + 1;
                          const val = getBlankResponse(currentQuestion.question_id, blankId);

                          return (
                            <div key={bIdx} className="flex items-center gap-3 bg-slate-900/40 border border-slate-800 p-3 rounded-xl">
                              <span className="text-xs font-black text-slate-400 shrink-0">Blank #{blankId} ({b.points || 1} pt):</span>
                              <input
                                type="text"
                                value={val}
                                placeholder="Type answer..."
                                onChange={(e) => handleBlankResponseChange(currentQuestion.question_id, blankId, e.target.value)}
                                onBlur={handleTextBlur}
                                className="flex-1 bg-slate-950 border border-slate-800 focus:border-rose-500 text-xs font-semibold text-slate-100 px-3 py-2 rounded-lg"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

            {/* Flag / Bookmarked action */}
            <button
              onClick={() => toggleFlagQuestion(currentQuestion.question_id)}
              className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all ${
                flagged[currentQuestion.question_id]
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Bookmark className={`w-4.5 h-4.5 ${flagged[currentQuestion.question_id] ? "fill-amber-500 text-amber-500" : ""}`} />
              {flagged[currentQuestion.question_id] ? "Flagged for Review" : "Flag Question"}
            </button>
          </div>

          {/* Navigation Controls footer bar */}
          <div className="bg-[#1E293B] border border-slate-800 p-4 rounded-2xl flex items-center justify-between max-w-2xl w-full mx-auto shadow-md">
            <button
              disabled={currentQuestionIdx === 0}
              onClick={() => handleNavigateQuestion(currentQuestionIdx - 1)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            {currentQuestionIdx < totalQuestions - 1 ? (
              <button
                onClick={() => handleNavigateQuestion(currentQuestionIdx + 1)}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-4 py-2 rounded-xl transition-all"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowConfirmSubmit(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 rounded-xl transition-all"
              >
                Submit Examination
              </button>
            )}
          </div>
        </main>

        {/* Right Side: Status Sidebar */}
        <aside className={`border-l border-slate-800 bg-[#1E293B] w-72 flex flex-col justify-between transition-all duration-300 z-30 lg:relative absolute top-0 bottom-0 right-0 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0 lg:w-0 lg:border-l-0 lg:overflow-hidden"
        }`}>
          
          <div className="p-5 space-y-5 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-extrabold text-sm text-slate-200">Question Grid</h2>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-extrabold px-2 py-0.5 rounded-md">
                {answeredCount} / {totalQuestions} Answered
              </span>
            </div>

            {/* Grid list */}
            <div className="grid grid-cols-4 gap-2.5">
              {initialData.questions.map((q, idx) => {
                const isCurrent = currentQuestionIdx === idx;
                const isFlagged = flagged[q.question_id];
                const ans = answers[q.question_id];
                
                let isAnswered = false;
                if (ans && ans.trim() !== "") {
                  if (q.question_type === "Matching_Type") {
                    try {
                      const parsed = JSON.parse(ans);
                      isAnswered = (parsed.matches?.length || 0) > 0;
                    } catch {}
                  } else {
                    isAnswered = true;
                  }
                }

                // Determine styling
                let btnColor = "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/60";
                if (isCurrent) {
                  btnColor = "bg-rose-600 text-white border-rose-500 shadow-md";
                } else if (isFlagged) {
                  btnColor = "bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30";
                } else if (isAnswered) {
                  btnColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30";
                }

                return (
                  <button
                    key={q.question_id}
                    onClick={() => handleNavigateQuestion(idx)}
                    className={`h-10 rounded-xl font-black text-xs border transition-all flex items-center justify-center ${btnColor}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            
            {/* Color keys */}
            <div className="border-t border-slate-800 pt-4 space-y-2 text-xs font-semibold text-slate-400">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Legend</p>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-rose-600 border border-rose-500" />
                <span>Current Question</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500/40" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-500/40" />
                <span>Flagged for Review</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-slate-900 border border-slate-800" />
                <span>Unanswered</span>
              </div>
            </div>
          </div>

          {/* Direct Submit Action at bottom of sidebar */}
          <div className="p-5 border-t border-slate-800 bg-[#1E293B]">
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-xl transition-all shadow-md shadow-emerald-950/20"
            >
              Submit Examination
            </button>
          </div>
        </aside>
      </div>

      {/* 3. CONFIRM SUBMISSION DIALOG MODAL */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-6 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
          <div className="bg-[#1E293B] border border-slate-800 max-w-sm w-full rounded-3xl p-6 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white">Confirm Submission</h3>
              <p className="text-slate-400 text-xs leading-normal">
                Are you sure you want to finalize and submit your responses? This action is irreversible.
              </p>
            </div>

            <div className="bg-[#0F172A]/60 border border-slate-800/80 p-4 rounded-2xl text-xs font-semibold text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Answered Questions</span>
                <span className="text-slate-200 font-bold">{answeredCount} of {totalQuestions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Remaining Time</span>
                <span className="text-slate-200 font-bold font-mono">{formatTime(remainingSeconds)}</span>
              </div>
              {answeredCount < totalQuestions && (
                <p className="text-amber-400 font-bold text-[10px] bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 text-center mt-2">
                  ⚠️ Warning: You have left {totalQuestions - answeredCount} items unanswered.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                Go Back
              </button>
              <button
                onClick={handleManualSubmit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile save status footer banner */}
      <div className="sm:hidden text-center text-[9px] text-slate-500 py-1 bg-slate-900 border-t border-slate-800">
        ● {saveStatus === "saving" ? "Saving changes..." : saveStatus === "offline" ? "Offline (Saved on device)" : "All changes saved to database"}
      </div>

    </div>
  );
}
