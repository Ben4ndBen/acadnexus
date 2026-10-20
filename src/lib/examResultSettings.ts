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
  // Post-submission results are always displayed immediately to students
  return {
    releaseMode: "immediate",
    canShowResults: true,
    statusLabel: "Score Available",
    explanation: "Examination score is available immediately upon submission.",
  };
}
