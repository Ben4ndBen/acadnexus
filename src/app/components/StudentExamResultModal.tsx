"use client";

import { useEffect, useState } from "react";
import { 
  X, CheckCircle2, Clock, ShieldAlert, Award, AlertCircle, 
  Printer, BookOpen, Loader2, Sparkles, HelpCircle, ArrowRight
} from "lucide-react";
import { getStudentExamResultDetails, StudentExamResultData } from "@/app/actions/student";

interface StudentExamResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentExamId: number;
}

export function StudentExamResultModal({
  isOpen,
  onClose,
  studentExamId,
}: StudentExamResultModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StudentExamResultData | null>(null);

  useEffect(() => {
    if (!isOpen || !studentExamId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Retrieve the latest saved result directly from the database for this specific attempt
    getStudentExamResultDetails({ studentExamId })
      .then((res) => {
        if (!isMounted) return;
        if (res.error || !res.data) {
          setError(res.error || "Failed to load examination result.");
        } else {
          setData(res.data);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "An unexpected error occurred while loading results.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, studentExamId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full shadow-2xl relative flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4.5 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200/80 shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 leading-tight">
                Examination Results & Performance
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Review your submitted answers, scores, and instructor evaluations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm font-bold text-slate-600">Retrieving latest examination results...</p>
              <p className="text-xs text-slate-400">Fetching scores and grading records from database</p>
            </div>
          )}

          {!loading && error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-sm">Unable to Load Results</h3>
              <p className="text-xs text-rose-700 max-w-sm mx-auto">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          )}

          {!loading && data && (
            <div className="space-y-6">
              {/* Exam Title & Course Card */}
              <div className="border border-slate-200/90 rounded-2xl p-5 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Examination
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900">{data.examTitle}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {data.courseCode ? `${data.courseCode} • ` : ""}{data.courseTitle}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">Submitted On</span>
                    <span className="font-bold text-slate-700">
                      {data.submittedAt ? new Date(data.submittedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "N/A"}{" "}
                      {data.submittedAt ? `@ ${new Date(data.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">Duration</span>
                    <span className="font-bold text-slate-700">
                      {data.durationMinutes} min{data.durationMinutes !== 1 ? "s" : ""} / {data.timeLimitMinutes} min limit
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">Total Questions</span>
                    <span className="font-bold text-slate-700">{data.totalQuestions} Questions</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">Total Max Points</span>
                    <span className="font-bold text-slate-700">{data.maxPoints} Points</span>
                  </div>
                </div>
              </div>

              {/* Submission Status Banner */}
              <div className={`border rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                data.isLockout
                  ? "border-rose-200 bg-rose-50/40 text-rose-900"
                  : data.isTimeout
                  ? "border-amber-200 bg-amber-50/40 text-amber-900"
                  : "border-emerald-200 bg-emerald-50/40 text-emerald-900"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                    data.isLockout
                      ? "bg-rose-100 text-rose-700 border-rose-200"
                      : data.isTimeout
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-emerald-100 text-emerald-700 border-emerald-200"
                  }`}>
                    {data.isLockout ? <ShieldAlert className="w-5 h-5" /> : data.isTimeout ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm">{data.submissionStatusLabel}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-white/80">
                        {data.isManual ? "Manual" : "Automatic"}
                      </span>
                    </div>
                    <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                      {data.submissionStatusDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* Score & Evaluation Overview Cards */}
              {!data.canShowResults ? (
                // Hidden Results View (Requirement 7)
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span>{data.resultStatusLabel || "Results Pending Review"}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {data.resultExplanation || "Scores are configured to remain hidden until reviewed and released by your instructor."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Initial Score & Deductions */}
                  <div className="border border-slate-200 rounded-2xl p-4.5 bg-white shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Initial Score</span>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border">
                        At Submission
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-800">
                          {data.initialNetScore} <span className="text-xs font-semibold text-slate-400">/ {data.maxPoints} pts</span>
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {data.maxPoints > 0 ? `${Math.round((data.initialNetScore / data.maxPoints) * 100)}%` : "0%"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Auto-graded raw points: <span className="font-bold text-slate-700">{data.initialRawScore} pts</span>
                      </p>
                    </div>

                    {/* Deductions applied */}
                    <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Security Deductions:</span>
                        <span className={`font-bold ${data.totalDeductions > 0 ? "text-rose-600" : "text-slate-500"}`}>
                          {data.totalDeductions > 0 ? `-${data.totalDeductions} pts` : "0 pts (None)"}
                        </span>
                      </div>
                      {data.violationsCount > 0 && (
                        <p className="text-[10px] text-slate-400">
                          {data.violationsCount} security warning{data.violationsCount !== 1 ? "s" : ""} × {data.scorePenaltyPerViolation} pts penalty
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Updated Score */}
                  <div className={`border rounded-2xl p-4.5 shadow-xs space-y-3 ${
                    data.isScoreUpdated
                      ? "border-emerald-200 bg-emerald-50/20"
                      : "border-slate-200 bg-white"
                  }`}>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latest Score</span>
                      {data.hasInstructorGraded ? (
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          Teacher Graded
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border">
                          Initial Record
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-emerald-700">
                          {data.latestTotalScore} <span className="text-xs font-semibold text-slate-400">/ {data.maxPoints} pts</span>
                        </span>
                        <span className="text-xs font-bold text-emerald-700">
                          {data.maxPoints > 0 ? `${Math.round((data.latestTotalScore / data.maxPoints) * 100)}%` : "0%"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {data.hasInstructorGraded
                          ? `Includes +${data.instructorGradedPoints} pts awarded from manual grading`
                          : "No subsequent manual grading applied yet"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      {data.isScoreUpdated ? (
                        <span className="text-emerald-700 font-semibold">
                          Score increased by +{data.latestTotalScore - data.initialNetScore} pts after teacher review
                        </span>
                      ) : (
                        <span>Retrieved live from latest saved database record</span>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Pending Questions Status */}
                  <div className={`border rounded-2xl p-4.5 shadow-xs space-y-3 ${
                    data.pendingQuestionsCount > 0
                      ? "border-amber-200 bg-amber-50/20"
                      : "border-slate-200 bg-white"
                  }`}>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Evaluation Status</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        data.pendingQuestionsCount > 0
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}>
                        {data.pendingQuestionsCount > 0 ? "Incomplete" : "Completed"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl font-black text-slate-800">
                        {data.pendingQuestionsCount > 0 ? (
                          <span className="text-amber-700">{data.pendingQuestionsCount} Pending</span>
                        ) : (
                          <span className="text-emerald-700">0 Pending</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {data.pendingQuestionsCount > 0
                          ? `${data.pendingQuestionsCount} question${data.pendingQuestionsCount !== 1 ? "s" : ""} awaiting instructor review`
                          : "All questions have been evaluated and graded"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-[11px]">
                      {data.pendingQuestionsCount > 0 ? (
                        <span className="text-amber-800 font-medium">
                          Your score will automatically update when your teacher finishes grading
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">
                          All objective and essay items finalized
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Questions & Responses Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Questions & Responses Breakdown ({data.answers.length})</span>
                  </h4>
                  {data.pendingQuestionsCount > 0 && (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      {data.pendingQuestionsCount} awaiting score
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {data.answers.map((ans) => {
                    const isEssay = ans.questionType === "Essay";
                    const isPending = ans.isPending;
                    const isInstructorGraded = ans.isInstructorGraded;
                    const isCorrect = ans.isCorrect === true;
                    const isIncorrect = ans.isCorrect === false && ans.pointsAwarded === 0;
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
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Pending Instructor Grading
                              </span>
                            ) : isInstructorGraded ? (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-blue-600" />
                                Graded by Instructor
                              </span>
                            ) : isCorrect ? (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Correct
                              </span>
                            ) : isPartial ? (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                Partial Credit
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
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
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Results
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
