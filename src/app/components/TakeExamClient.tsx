"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, ShieldAlert, CheckCircle2, AlertTriangle, Bookmark,
  ChevronLeft, ChevronRight, Maximize2, Monitor, Loader2, ArrowRight,
  Menu, X
} from "lucide-react";
import { saveStudentAnswers, submitStudentExam, logStudentWarning } from "@/app/actions/student";

interface Question {
  question_id: number;
  question_text: string;
  question_type: "Multiple_Choice" | "True_False" | "Identification" | "Matching_Type";
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

  // Mode: 'gate' | 'exam' | 'warning' | 'lockout' | 'success' | 'submitting'
  const [mode, setMode] = useState<"gate" | "exam" | "warning" | "lockout" | "success" | "submitting">("gate");
  
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialData.remainingSeconds);
  const [violations, setViolations] = useState<number>(0);
  const [warningReason, setWarningReason] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [finalScore, setFinalScore] = useState<number | null>(null);

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

  const violationsKey = `exam_violations_${initialData.studentExamId}`;

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
  }, [mode, answers]);

  // 3. Low-Overhead Background Auto-Save Loop (Every 15 Seconds)
  useEffect(() => {
    if (mode !== "exam") return;

    const autoSaveInterval = setInterval(() => {
      triggerBackgroundSave();
    }, 15000);

    return () => clearInterval(autoSaveInterval);
  }, [mode, answers, lastSavedAnswers]);

  // 4. Focus Loss & Tab Switching Monitor (Alt+Tab & Window Switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && mode === "exam") {
        triggerViolation("Tab or browser window switch detected.");
      }
    };

    const handleWindowBlur = () => {
      if (mode === "exam") {
        triggerViolation("Focus loss detected (window switch or Alt+Tab).");
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
        triggerViolation("Fullscreen exit detected.");
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
  const triggerViolation = (reason: string) => {
    const currentCount = Number(localStorage.getItem(violationsKey) || "0");
    const nextCount = currentCount + 1;
    localStorage.setItem(violationsKey, String(nextCount));
    setViolations(nextCount);

    if (nextCount < 3) {
      setMode("warning");
      setWarningReason(reason);
      logStudentWarning(studentId, examId, nextCount, reason);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
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
    const currentAnswers = overrideAnswers || answers;
    const changedList: { question_id: number; submitted_response: string }[] = [];

    Object.entries(currentAnswers).forEach(([qId, val]) => {
      const questionId = Number(qId);
      if (lastSavedAnswers[questionId] !== val) {
        changedList.push({ question_id: questionId, submitted_response: val });
      }
    });

    if (changedList.length === 0) return;

    setIsSaving(true);
    try {
      const res = await saveStudentAnswers(initialData.studentExamId, changedList);
      if (res.success) {
        setLastSavedAnswers((prev) => {
          const next = { ...prev };
          changedList.forEach((c) => {
            next[c.question_id] = c.submitted_response;
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Background auto-save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Update answer locally
  const handleAnswerChange = (questionId: number, response: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: response,
    }));
  };

  // Paginate questions (saves current dirty answer instantly on navigation)
  const handleNavigateQuestion = (newIdx: number) => {
    triggerBackgroundSave();
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
    setMode("submitting");
    const currentAnswersArray = Object.entries(answers).map(([qId, val]) => ({
      question_id: Number(qId),
      submitted_response: val,
    }));

    try {
      const res = await submitStudentExam(initialData.studentExamId, "Timeout", currentAnswersArray);
      if (res.success) {
        setFinalScore(res.totalScore ?? 0);
        localStorage.removeItem(violationsKey);
        setMode("success");
      }
    } catch (err) {
      console.error("Timeout submit failed:", err);
      setMode("success"); // Still show finish screen fallback
    }
  };

  // Cheating lockout auto-submit
  const submitViolationSubmission = async () => {
    const currentAnswersArray = Object.entries(answers).map(([qId, val]) => ({
      question_id: Number(qId),
      submitted_response: val,
    }));
    await submitStudentExam(initialData.studentExamId, "Cheating_Lockout", currentAnswersArray);
  };

  // Manual explicit submit
  const handleManualSubmit = async () => {
    setMode("submitting");
    setShowConfirmSubmit(false);
    
    // Attempt exit fullscreen gracefully
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }

    const currentAnswersArray = Object.entries(answers).map(([qId, val]) => ({
      question_id: Number(qId),
      submitted_response: val,
    }));

    try {
      const res = await submitStudentExam(initialData.studentExamId, "Manual", currentAnswersArray);
      if (res.success) {
        setFinalScore(res.totalScore ?? 0);
        localStorage.removeItem(violationsKey);
        setMode("success");
      } else {
        alert(res.error || "Submission failed. Please try again.");
        setMode("exam");
      }
    } catch (err) {
      console.error("Manual submit failed:", err);
      setMode("exam");
    }
  };

  // --- Helper parsing of questions ---
  const currentQuestion = initialData.questions[currentQuestionIdx];

  const parseQuestionText = (q: Question) => {
    if (q.question_type === "Multiple_Choice" || q.question_type === "Matching_Type") {
      try {
        return JSON.parse(q.question_text);
      } catch {
        return { text: q.question_text, options: [], premises: [] };
      }
    }
    return { text: q.question_text, options: [], premises: [] };
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
              <span className="font-extrabold text-sm tracking-tight text-white">AcadNexus SECURE SHELL</span>
            </div>
          </div>
          <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            Lockdown Initialized
          </span>
        </header>

        <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 flex flex-col justify-center gap-8">
          <div className="bg-[#1E293B] border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden space-y-6">
            {/* Sliding header glow */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#7A151A] via-[#E2A123] to-[#7A151A]" />
            
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">
                Verification Required
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight mt-2">{initialData.examTitle}</h1>
              <p className="text-xs text-slate-400 font-medium">
                Course: {initialData.courseTitle} ({initialData.courseCode})
              </p>
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
                <p className="text-slate-500 uppercase font-bold text-[10px]">Strict Duration</p>
                <p className="text-slate-200 font-bold text-sm mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-500" /> {initialData.remainingSeconds / 60} Minutes
                </p>
              </div>
              <div className="mt-2">
                <p className="text-slate-500 uppercase font-bold text-[10px]">Total items</p>
                <p className="text-slate-200 font-bold text-sm mt-0.5">{initialData.questions.length} Questions</p>
              </div>
            </div>

            {/* Lock-down Rules List */}
            <div className="space-y-3 bg-[#0F172A]/50 border border-slate-800/60 p-5 rounded-2xl">
              <h3 className="text-xs font-black text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-rose-500" /> Secure Environment Guidelines:
              </h3>
              <ul className="text-slate-400 text-xs space-y-2 list-disc list-inside leading-relaxed font-semibold">
                <li>Clicking outside this browser window or switching tabs will trigger security focus warnings.</li>
                <li>Exiting Fullscreen mode constitutes a security violation.</li>
                <li>You are allowed <span className="text-rose-400 font-bold">up to 2 warnings</span>. The 3rd violation triggers <span className="text-rose-500 font-black">immediate auto-submission</span> under Cheating Lockout status.</li>
                <li>Periodic checkpoints automatically backup your progress; network glitches will not lose your answers.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={handleStartExam}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-800 hover:to-rose-700 text-white font-black text-sm px-6 py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] border border-rose-600"
              >
                Enter Secure Exam Mode & Begin <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>

        <footer className="py-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
          © {new Date().getFullYear()} Batanes State College. Locked-Down Terminal Pipeline.
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
            <h2 className="text-xl font-black text-white tracking-tight uppercase">Security Alert!</h2>
            <p className="text-xs text-rose-400 font-black uppercase bg-rose-500/10 py-1.5 px-3 rounded-full inline-block border border-rose-500/20 mt-1">
              Warning {violations} of 2
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-3">
              We detected: <strong className="text-slate-200">{warningReason}</strong>
            </p>
            <p className="text-slate-500 text-xs leading-relaxed mt-2 font-medium">
              Academic honesty guidelines enforce a strict fullscreen window focus. On the next violation, your examination attempt will be closed and auto-submitted.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={handleReEnterSecureMode}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-sm px-5 py-3 rounded-xl transition-all shadow-md"
            >
              Re-enter Secure Mode & Resume
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
          <h2 className="text-lg font-bold">Submitting Examination</h2>
          <p className="text-slate-500 text-xs max-w-xs leading-normal">
            Processing objective responses against the answer schema and writing secure audit trails. Please do not close this window...
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
            <h2 className="text-xl font-black text-rose-500 tracking-tight uppercase">Lockout Triggered</h2>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed mt-2">
              Due to repeated security policy infractions (window changes, Alt+Tab, or leaving fullscreen mode), you have been locked out.
            </p>
            <div className="bg-rose-950/20 border border-rose-900/30 text-rose-400 p-4 rounded-2xl text-xs font-semibold text-left space-y-1">
              <p>● Max violation count exceeded (3/3 violations).</p>
              <p>● Your exam attempt has been auto-submitted.</p>
              <p>● Incident logged securely to the Audit Logs database.</p>
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
              Exit to Student Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // E. SUCCESS SUBMISSION SCREEN (SHOW SCORES DETAILED)
  if (mode === "success") {
    const scorePct = totalQuestions > 0 ? Math.round(((finalScore ?? 0) / initialData.questions.reduce((sum, q) => sum + q.points, 0)) * 100) : 0;
    
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-[#1E293B] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
          
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-9 h-9 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight uppercase">Exam Submitted</h2>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              Your exam has been parsed, graded, and uploaded successfully.
            </p>
          </div>

          <div className="bg-[#0F172A]/50 border border-slate-800 p-4 rounded-2xl text-left space-y-2 text-xs font-medium">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500">Grading Output</span>
              <span className="text-emerald-400 font-bold font-mono">Auto-Graded</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Earned Score</span>
              <span className="text-slate-200 font-black text-sm">
                {finalScore} / {initialData.questions.reduce((sum, q) => sum + q.points, 0)} pts ({scorePct}%)
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                router.push("/dashboard/student");
                router.refresh();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-5 py-3 rounded-xl transition-all shadow-md shadow-emerald-900/30"
            >
              Exit to Student Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // F. REGULAR CORE SECURE TAKING INTERFACE
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. SECURE NAVBAR */}
      <header className="bg-[#1E293B] border-b border-slate-800 py-3.5 px-6 flex items-center justify-between z-40 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-[#7A151A] text-white p-1.5 rounded-lg border border-rose-900/30">
            <Monitor className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm text-white truncate max-w-[180px] sm:max-w-xs leading-none">
              {initialData.examTitle}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Course: {initialData.courseCode}
            </p>
          </div>
        </div>

        {/* Sync status & Timer */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full">
            <span className={`w-1.5 h-1.5 rounded-full ${isSaving ? "bg-sky-400 animate-ping" : "bg-emerald-500"}`} />
            {isSaving ? "Saving..." : "All changes saved"}
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
            className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
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
              <p className="text-slate-100 font-bold text-base sm:text-lg leading-relaxed">
                {currentQuestion.question_type === "Multiple_Choice" || currentQuestion.question_type === "Matching_Type" 
                  ? currentParsed?.text 
                  : currentQuestion.question_text
                }
              </p>

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
                          <span className="text-sm font-semibold">{option}</span>
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
                            <span className="text-sm text-slate-300 font-bold">{premise}</span>
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

      {/* Mobile hidden save warning banner */}
      <div className="sm:hidden text-center text-[9px] text-slate-500 py-1 bg-slate-900 border-t border-slate-800">
        ● {isSaving ? "Saving changes..." : "All changes saved to database"}
      </div>

    </div>
  );
}
