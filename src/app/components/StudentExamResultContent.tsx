"use client";

import { useState, useEffect } from "react";
import { 
  CheckCircle2, Clock, ShieldAlert, Award, AlertCircle, 
  Printer, BookOpen, Sparkles, ArrowLeft, Download, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { StudentExamResultData, submitStudentExam } from "@/app/actions/student";

interface StudentExamResultContentProps {
  data: StudentExamResultData;
  onClose?: () => void;
  isModal?: boolean;
}

export function StudentExamResultContent({
  data,
  onClose,
  isModal = false,
}: StudentExamResultContentProps) {
  const [unsyncedAnswers, setUnsyncedAnswers] = useState<{ question_id: number; submitted_response: string }[]>([]);
  const [isSyncingBackup, setIsSyncingBackup] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const backupKey = `exam_backup_${data.studentExamId}`;
      const raw = localStorage.getItem(backupKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const unsynced: { question_id: number; submitted_response: string }[] = [];
          for (const [qIdStr, val] of Object.entries(parsed)) {
            const qId = Number(qIdStr);
            const serverAns = data.answers.find((a) => a.questionId === qId);
            if (typeof val === "string" && val.trim() !== "" && (!serverAns || (serverAns.submittedResponse || "") !== val)) {
              unsynced.push({ question_id: qId, submitted_response: val });
            }
          }
          if (unsynced.length > 0) {
            setUnsyncedAnswers(unsynced);
          } else {
            localStorage.removeItem(backupKey);
          }
        }
      }
    } catch (e) {
      console.warn("Failed checking offline local backup in result content:", e);
    }
  }, [data.studentExamId, data.answers]);

  const handleSyncOfflineAnswers = async () => {
    setIsSyncingBackup(true);
    setSyncMessage(null);
    try {
      const res = await submitStudentExam(data.studentExamId, "Timeout", unsyncedAnswers);
      if (res.success) {
        localStorage.removeItem(`exam_backup_${data.studentExamId}`);
        setSyncMessage("Recoverable answers successfully synchronized! Refreshing scores...");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setSyncMessage(res.error || "Failed to synchronize recoverable answers. You may download the backup JSON below.");
      }
    } catch (err: any) {
      setSyncMessage("Network error during sync. Please ensure you are connected or download the backup JSON below.");
    } finally {
      setIsSyncingBackup(false);
    }
  };

  const handleDownloadOfflineBackup = () => {
    const raw = localStorage.getItem(`exam_backup_${data.studentExamId}`);
    const backupObj = {
      studentExamId: data.studentExamId,
      examTitle: data.examTitle,
      courseCode: data.courseCode,
      courseTitle: data.courseTitle,
      exportedAt: new Date().toISOString(),
      offlineAnswers: raw ? JSON.parse(raw) : {},
      unsyncedItems: unsyncedAnswers,
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Recoverable_Exam_Backup_${data.courseCode || "Exam"}_${data.studentExamId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Recoverable offline answers banner */}
      {unsyncedAnswers.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-amber-900 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-amber-900">
                Recoverable Answers Preserved Locally ({unsyncedAnswers.length} item{unsyncedAnswers.length !== 1 ? "s" : ""})
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                We detected unsynchronized examination answers safely preserved in your browser from an internet disconnection. You can synchronize them now with the server or export a backup file for academic verification.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={handleSyncOfflineAnswers}
              disabled={isSyncingBackup}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBackup ? "animate-spin" : ""}`} />
              {isSyncingBackup ? "Synchronizing..." : "Synchronize Recoverable Answers"}
            </button>
            <button
              onClick={handleDownloadOfflineBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Download Backup (JSON)
            </button>
          </div>
          {syncMessage && (
            <p className="text-xs font-semibold text-slate-700 pt-1">{syncMessage}</p>
          )}
        </div>
      )}
      {/* Exam Title & Course Information Card */}
      <div className="border border-slate-200/90 rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                Examination Record
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                Attempt ID #{data.studentExamId}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {data.examTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-900 text-white shadow-xs">
              {data.courseCode ? `${data.courseCode} • ` : ""}{data.courseTitle}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Submitted On</span>
            <span className="font-bold text-slate-800">
              {data.submittedAt ? new Date(data.submittedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
              {" "}{data.submittedAt ? `@ ${new Date(data.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ""}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Attempt Duration</span>
            <span className="font-bold text-slate-800">
              {data.durationMinutes} min{data.durationMinutes !== 1 ? "s" : ""} <span className="text-slate-400 font-normal">/ {data.timeLimitMinutes}m limit</span>
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Total Questions</span>
            <span className="font-bold text-slate-800">{data.totalQuestions} Questions</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Max Total Points</span>
            <span className="font-bold text-slate-800">{data.maxPoints} Points</span>
          </div>
        </div>
      </div>

      {/* Submission Status Banner */}
      <div className={`border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
        data.isLockout
          ? "border-rose-200 bg-rose-50/40 text-rose-900"
          : data.isTimeout
          ? "border-amber-200 bg-amber-50/40 text-amber-900"
          : "border-emerald-200 bg-emerald-50/40 text-emerald-900"
      }`}>
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
            data.isLockout
              ? "bg-rose-100 text-rose-700 border-rose-200 shadow-xs"
              : data.isTimeout
              ? "bg-amber-100 text-amber-700 border-amber-200 shadow-xs"
              : "bg-emerald-100 text-emerald-700 border-emerald-200 shadow-xs"
          }`}>
            {data.isLockout ? (
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            ) : data.isTimeout ? (
              <Clock className="w-5 h-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm sm:text-base">{data.submissionStatusLabel}</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-white/90 shadow-2xs">
                {data.isManual ? "Manual Submission" : "Automatic Submission"}
              </span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed pt-0.5">
              {data.submissionStatusDescription}
            </p>
          </div>
        </div>
      </div>

      {/* Notice for examinations with pending manual grading */}
      {data.hasManualGrading && (
        <div className="bg-amber-50 border border-amber-300/90 rounded-2xl p-4.5 sm:p-5 flex items-start gap-3.5 text-amber-950 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300 mt-0.5">
            <Clock className="w-5 h-5 text-amber-700" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-amber-900">
                Notice on Essay Grading
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                Initial Score
              </span>
            </div>
            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-medium">
              Your initial score is shown below. Total score will be available once your instructor completes scoring the essay questions.
            </p>
          </div>
        </div>
      )}

      {/* Score & Evaluation Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Initial Score (if manual grading) or Total Score (if objective) */}
        <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {data.hasManualGrading ? "Initial Score" : "Total Score"}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              data.hasManualGrading ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}>
              {data.hasManualGrading ? "Initial" : "Total"}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-slate-800">
                {data.initialNetScore} <span className="text-xs font-semibold text-slate-400">/ {data.maxPoints} pts</span>
              </span>
              <span className="text-xs font-bold text-slate-500">
                {data.maxPoints > 0 ? `${Math.round((data.initialNetScore / data.maxPoints) * 100)}%` : "0%"}
              </span>
            </div>
            {data.totalDeductions > 0 && (
              <p className="text-[11px] text-slate-500">
                Auto-graded raw points: <span className="font-bold text-slate-700">{data.initialRawScore} pts</span>
              </p>
            )}
          </div>

          {/* Deductions breakdown: show ONLY if there is a deduction */}
          {data.totalDeductions > 0 && (
            <div className="pt-2.5 border-t border-slate-100 text-[11px] space-y-1">
              <div className="flex justify-between items-center text-slate-600">
                <span>Security Deductions:</span>
                <span className="font-bold text-rose-600">
                  -{data.totalDeductions} pts
                </span>
              </div>
              {data.violationsCount > 0 && (
                <div className="space-y-0.5 pt-0.5 text-[10px] text-slate-400">
                  <p>
                    Score penalty: {data.violationsCount} warning{data.violationsCount !== 1 ? "s" : ""} × {data.scorePenaltyPerViolation} pts = -{data.totalDeductions} pts
                  </p>
                  {(data.timePenaltyPerViolation ?? 0) > 0 && (
                    <p>
                      Timer penalty: {data.violationsCount} warning{data.violationsCount !== 1 ? "s" : ""} × {data.timePenaltyPerViolation}s = -{(data.totalTimeDeductedSeconds ?? (data.violationsCount * (data.timePenaltyPerViolation || 0)))}s deducted
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Total / Updated Score */}
        <div className={`border rounded-2xl p-5 shadow-xs space-y-3 ${
          data.isScoreUpdated
            ? "border-emerald-300 bg-emerald-50/25"
            : "border-slate-200 bg-white"
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Score
            </span>
            {data.hasInstructorGraded ? (
              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Teacher Graded
              </span>
            ) : data.hasManualGrading ? (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Pending Review
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Finalized
              </span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                {data.latestTotalScore} <span className="text-xs font-semibold text-slate-400">/ {data.maxPoints} pts</span>
              </span>
              <span className="text-xs font-bold text-emerald-700">
                {data.maxPoints > 0 ? `${Math.round((data.latestTotalScore / data.maxPoints) * 100)}%` : "0%"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {data.hasInstructorGraded
                ? `Includes +${data.instructorGradedPoints} pts awarded from teacher manual grading`
                : data.hasManualGrading
                ? "Total score will be finalized once instructor completes essay scoring"
                : "All questions scored and finalized"}
            </p>
          </div>

          <div className="pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            {data.isScoreUpdated ? (
              <span className="text-emerald-700 font-semibold">
                Score updated (+{data.latestTotalScore - data.initialNetScore} pts) following instructor evaluation
              </span>
            ) : (
              <span>Retrieved from latest saved attempt in database</span>
            )}
          </div>
        </div>

          {/* Card 3: Pending Questions Status */}
          <div className={`border rounded-2xl p-5 shadow-xs space-y-3 ${
            data.pendingQuestionsCount > 0
              ? "border-amber-300 bg-amber-50/25"
              : "border-slate-200 bg-white"
          }`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Evaluation Status</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                data.pendingQuestionsCount > 0
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
              }`}>
                {data.pendingQuestionsCount > 0 ? "Pending Items" : "Finalized"}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-slate-800">
                {data.pendingQuestionsCount > 0 ? (
                  <span className="text-amber-700">{data.pendingQuestionsCount} Pending</span>
                ) : (
                  <span className="text-emerald-700">0 Pending</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {data.pendingQuestionsCount > 0
                  ? `${data.pendingQuestionsCount} question${data.pendingQuestionsCount !== 1 ? "s" : ""} awaiting teacher scoring`
                  : "All questions have been evaluated and graded"}
              </p>
            </div>

            <div className="pt-2.5 border-t border-slate-100 text-[11px]">
              {data.pendingQuestionsCount > 0 ? (
                <span className="text-amber-800 font-medium">
                  Your score will automatically update when your teacher finishes grading
                </span>
              ) : (
                <span className="text-slate-500 font-medium">
                  All objective and essay items have received final marks
                </span>
              )}
            </div>
          </div>
        </div>

      {/* Questions & Responses Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <h4 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Questions & Responses Breakdown ({data.answers.length})</span>
          </h4>
          {data.pendingQuestionsCount > 0 && (
            <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
              {data.pendingQuestionsCount} question{data.pendingQuestionsCount !== 1 ? "s" : ""} pending instructor grading
            </span>
          )}
        </div>

        <div className="space-y-3.5">
          {data.answers.map((ans) => {
            const isPending = ans.isPending;
            const isInstructorGraded = ans.isInstructorGraded;
            const isCorrect = ans.isCorrect === true;
            const isPartial = ans.pointsAwarded !== null && ans.pointsAwarded > 0 && ans.pointsAwarded < ans.pointsPossible;

            return (
              <div
                key={ans.questionId}
                className={`border rounded-2xl p-4 sm:p-5 transition-all space-y-3 ${
                  isPending
                    ? "border-amber-200 bg-amber-50/20"
                    : isInstructorGraded
                    ? "border-blue-200 bg-blue-50/15"
                    : isCorrect
                    ? "border-emerald-200/80 bg-emerald-50/15"
                    : "border-slate-200/80 bg-white"
                }`}
              >
                {/* Header: Question Number, Type, and Status Badge */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center">
                      {ans.questionNumber}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/80">
                      {ans.questionType.replace(/_/g, " ")}
                    </span>

                    {/* Status Pill */}
                    {isPending ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Pending Instructor Grading
                      </span>
                    ) : isInstructorGraded ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        Graded by Instructor
                      </span>
                    ) : isCorrect ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Correct
                      </span>
                    ) : isPartial ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Partial Credit
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        Incorrect / 0 pts
                      </span>
                    )}
                  </div>

                  {/* Points Display */}
                  <div className="shrink-0 text-right">
                    {data.canShowResults ? (
                      isPending ? (
                        <span className="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          -- / {ans.pointsPossible} pts
                        </span>
                      ) : (
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                          ans.pointsAwarded && ans.pointsAwarded > 0
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}>
                          {ans.pointsAwarded ?? 0} / {ans.pointsPossible} pts
                        </span>
                      )
                    ) : (
                      <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border">
                        {ans.pointsPossible} pts
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                  {ans.questionText}
                </div>

                {/* Student Response */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Your Submitted Answer:
                  </span>
                  <div className="font-mono text-slate-800 whitespace-pre-wrap break-words">
                    {ans.submittedResponse ? (
                      ans.submittedResponse
                    ) : (
                      <span className="text-slate-400 italic">No answer was submitted for this question.</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t border-slate-100 pt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          Print Results
        </button>

        {isModal && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Close
          </button>
        ) : (
          <Link
            href="/dashboard/student"
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
