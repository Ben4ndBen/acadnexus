export type ResultReleaseMode = "immediate" | "hidden_until_approved" | "schedule_end";

export interface ExamResultSettings {
  releaseMode: ResultReleaseMode;
  showResultsImmediately: boolean;
}

export interface ParsedResultVisibility {
  releaseMode: ResultReleaseMode;
  canShowResults: boolean;
  statusLabel: string;
  explanation: string;
}

/**
 * Parses and evaluates result settings for an examination.
 * Determines whether the student's initial score should be revealed immediately
 * or kept hidden until a later time or instructor approval.
 */
export function parseExamResultSettings(exam: {
  tos_file_path?: string | null;
  tableOfSpecifications?: { 
    learning_outcomes_json?: string | null;
    topic_plans_json?: string | null;
  } | null;
  examTargets?: Array<{
    scheduled_date: Date | string;
    end_time: Date | string;
  }> | null;
  target?: {
    scheduled_date: Date | string;
    end_time: Date | string;
  } | null;
  current_status?: string | null;
}): ParsedResultVisibility {
  let releaseMode: ResultReleaseMode = "immediate";

  // 1. Try parsing from tos_file_path if stored as JSON
  if (exam.tos_file_path && exam.tos_file_path.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(exam.tos_file_path);
      if (parsed.resultSettings?.releaseMode) {
        releaseMode = parsed.resultSettings.releaseMode;
      } else if (parsed.resultSettings?.showResultsImmediately === false) {
        releaseMode = "hidden_until_approved";
      } else if (parsed.showResultsImmediately === false) {
        releaseMode = "hidden_until_approved";
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // 2. Try parsing from tableOfSpecifications.learning_outcomes_json if not found
  if (releaseMode === "immediate" && exam.tableOfSpecifications?.learning_outcomes_json) {
    try {
      const parsedOutcomes = JSON.parse(exam.tableOfSpecifications.learning_outcomes_json);
      if (parsedOutcomes.__resultSettings?.releaseMode) {
        releaseMode = parsedOutcomes.__resultSettings.releaseMode;
      } else if (parsedOutcomes.__resultSettings?.showResultsImmediately === false) {
        releaseMode = "hidden_until_approved";
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // 3. Evaluate visibility based on release mode
  if (releaseMode === "hidden_until_approved") {
    return {
      releaseMode,
      canShowResults: false,
      statusLabel: "Results Pending Review",
      explanation: "Initial scores are configured to remain hidden until reviewed and approved by your instructor.",
    };
  }

  if (releaseMode === "schedule_end") {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    let hasSchedulePassed = false;
    let targetEndFound = false;

    // Check targets list or single target
    const targets = exam.examTargets || (exam.target ? [exam.target] : []);
    if (targets.length > 0) {
      targetEndFound = true;
      // If any target's end time is still in the future, keep results hidden
      for (const t of targets) {
        try {
          const sDate = new Date(t.scheduled_date);
          const eTime = new Date(t.end_time);
          const endWindow = new Date(
            sDate.getUTCFullYear(),
            sDate.getUTCMonth(),
            sDate.getUTCDate(),
            eTime.getUTCHours(),
            eTime.getUTCMinutes(),
            0
          );
          if (now >= endWindow) {
            hasSchedulePassed = true;
          } else {
            hasSchedulePassed = false;
            break;
          }
        } catch {
          // If date parsing fails, default to passed
          hasSchedulePassed = true;
        }
      }
    }

    if (targetEndFound && !hasSchedulePassed) {
      return {
        releaseMode,
        canShowResults: false,
        statusLabel: "Results Available After Exam Window",
        explanation: "Scores and detailed results will be displayed automatically after the scheduled examination period closes.",
      };
    }

    return {
      releaseMode,
      canShowResults: true,
      statusLabel: "Initial Score Available",
      explanation: "The exam schedule has concluded and initial results are now available.",
    };
  }

  // Default: immediate release
  return {
    releaseMode: "immediate",
    canShowResults: true,
    statusLabel: "Initial Score Available",
    explanation: "Initial score calculated based on your submitted answers.",
  };
}
