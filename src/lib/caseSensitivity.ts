export type CaseSensitivityRule =
  | "NONE"
  | "UPPERCASE"
  | "LOWERCASE"
  | "FIRST_LETTER_UPPERCASE";

export const CASE_RULE_LABELS: Record<CaseSensitivityRule, string> = {
  NONE: "No Case Requirement (Accept Any Capitalization)",
  UPPERCASE: "UPPERCASE (Entire answer in capital letters)",
  LOWERCASE: "lowercase (Entire answer in small letters)",
  FIRST_LETTER_UPPERCASE: "First Letter Uppercase (e.g., Manila)",
};

export const CASE_RULE_SHORT_LABELS: Record<CaseSensitivityRule, string> = {
  NONE: "Any Case",
  UPPERCASE: "UPPERCASE",
  LOWERCASE: "lowercase",
  FIRST_LETTER_UPPERCASE: "First Letter Uppercase",
};

/**
 * Recognizes a letter-case requirement from an instructor's written instruction or prompt text.
 * Returns "NONE" when no specific letter-case requirement is stated.
 */
export function detectCaseRuleFromText(text?: string | null): CaseSensitivityRule {
  if (!text || typeof text !== "string") return "NONE";
  const normalized = text.trim();
  if (!normalized) return "NONE";

  // Ignore if explicitly stating case-insensitive / regardless of case
  if (/\b(case[-\s]?insensitive|regardless\s+of\s+(letter\s+)?case|any\s+case)\b/i.test(normalized)) {
    return "NONE";
  }

  // 1. Check for "First Letter Uppercase" / "Capitalize the first letter" / "Title Case"
  if (
    /\b(first[-\s]+letter(s)?\s+(must\s+be\s+|should\s+be\s+|in\s+|is\s+|only\s+)?(uppercase|upper\s+case|capital(ized)?))\b/i.test(normalized) ||
    /\b(capitalize(d)?\s+(the\s+)?first\s+letter(s)?)\b/i.test(normalized) ||
    /\b(initial\s+letter(s)?\s+(must\s+be\s+|should\s+be\s+|in\s+|is\s+)?(uppercase|upper\s+case|capital(ized)?))\b/i.test(normalized) ||
    /\b(first\s+letter\s+uppercase|first-letter\s+uppercase|title\s+case|proper\s+case)\b/i.test(normalized)
  ) {
    return "FIRST_LETTER_UPPERCASE";
  }

  // 2. Check for "UPPERCASE" / "ALL CAPS" / "CAPITAL LETTERS"
  if (
    /\b(uppercase|upper\s+case|all\s+caps|all-caps|capital\s+letters|all\s+capital|block\s+letters|big\s+letters)\b/i.test(normalized) &&
    !/\b(not\s+(in\s+)?uppercase|do\s+not\s+use\s+uppercase)\b/i.test(normalized)
  ) {
    return "UPPERCASE";
  }

  // 3. Check for "lowercase" / "small letters"
  if (
    /\b(lowercase|lower\s+case|small\s+letters|all\s+small)\b/i.test(normalized) &&
    !/\b(not\s+(in\s+)?lowercase|do\s+not\s+use\s+lowercase)\b/i.test(normalized)
  ) {
    return "LOWERCASE";
  }

  return "NONE";
}

/**
 * Resolves the effective CaseSensitivityRule for an Identification or Essay question.
 * Returns "NONE" for other question types or when the instructor did not specify a case requirement.
 */
export function resolveQuestionCaseRule(params: {
  questionType: string;
  explicitQuestionRule?: string | null;
  explicitTestTypeRule?: string | null;
  questionInstructionText?: string | null;
  questionPromptText?: string | null;
  testTypeInstructionText?: string | null;
}): CaseSensitivityRule {
  const {
    questionType,
    explicitQuestionRule,
    explicitTestTypeRule,
    questionInstructionText,
    questionPromptText,
    testTypeInstructionText,
  } = params;

  if (questionType !== "Identification" && questionType !== "Essay") {
    return "NONE";
  }

  const validRules: CaseSensitivityRule[] = ["UPPERCASE", "LOWERCASE", "FIRST_LETTER_UPPERCASE"];

  if (explicitQuestionRule && validRules.includes(explicitQuestionRule as CaseSensitivityRule)) {
    return explicitQuestionRule as CaseSensitivityRule;
  }

  if (explicitTestTypeRule && validRules.includes(explicitTestTypeRule as CaseSensitivityRule)) {
    return explicitTestTypeRule as CaseSensitivityRule;
  }

  const fromQInst = detectCaseRuleFromText(questionInstructionText);
  if (fromQInst !== "NONE") return fromQInst;

  const fromTypeInst = detectCaseRuleFromText(testTypeInstructionText);
  if (fromTypeInst !== "NONE") return fromTypeInst;

  const fromPrompt = detectCaseRuleFromText(questionPromptText);
  if (fromPrompt !== "NONE") return fromPrompt;

  return "NONE";
}

/**
 * Evaluates whether a student's response follows the specified letter-case rule.
 */
export function evaluateAnswerCaseCompliance(
  response: string,
  rule: CaseSensitivityRule,
  expectedAnswer?: string
): { compliant: boolean; explanation: string | null } {
  if (rule === "NONE") {
    return { compliant: true, explanation: null };
  }

  const trimmed = (response || "").trim();
  if (!trimmed) {
    return { compliant: false, explanation: null };
  }

  const letters = trimmed.match(/[a-zA-Z]/g) || [];
  if (letters.length === 0) {
    // Purely numeric or symbol answer has no letter case to violate
    return { compliant: true, explanation: null };
  }

  if (rule === "UPPERCASE") {
    const isAllUpper = trimmed === trimmed.toUpperCase();
    if (!isAllUpper) {
      return {
        compliant: false,
        explanation:
          "Your answer did not follow the required letter-case instruction (UPPERCASE: the entire answer must be written in capital letters, e.g., \"MANILA\"). Zero points were awarded.",
      };
    }
    return { compliant: true, explanation: null };
  }

  if (rule === "LOWERCASE") {
    const isAllLower = trimmed === trimmed.toLowerCase();
    if (!isAllLower) {
      return {
        compliant: false,
        explanation:
          "Your answer did not follow the required letter-case instruction (lowercase: the entire answer must be written in small letters, e.g., \"manila\"). Zero points were awarded.",
      };
    }
    return { compliant: true, explanation: null };
  }

  if (rule === "FIRST_LETTER_UPPERCASE") {
    // Extract alphabetic words from the student's answer
    const alphaWords = trimmed.match(/[a-zA-Z]+/g) || [];
    if (alphaWords.length === 0) {
      return { compliant: true, explanation: null };
    }

    const firstWord: string = alphaWords[0] || "";
    const firstCharIsUpper = /^[A-Z]/.test(firstWord);

    // Every word must have lowercase letters after its first letter (so "MANILA" or "mAnIlA" is rejected)
    const expectedAlphaWords = (expectedAnswer || "").trim().match(/[a-zA-Z]+/g) || [];

    const allWordsProperTail = alphaWords.every((w, idx) => {
      if (w.length <= 1) return true;
      // Allow an acronym only if the instructor's expected answer explicitly had that exact all-caps word
      const expWord = expectedAlphaWords[idx];
      if (expWord && expWord.length > 1 && expWord === expWord.toUpperCase() && w === expWord) {
        return true;
      }
      return w.slice(1) === w.slice(1).toLowerCase();
    });

    const isSingleWordProper =
      alphaWords.length === 1
        ? firstCharIsUpper && (firstWord.length === 1 || firstWord.slice(1) === firstWord.slice(1).toLowerCase())
        : firstCharIsUpper && allWordsProperTail;

    if (!isSingleWordProper) {
      return {
        compliant: false,
        explanation:
          "Your answer did not follow the required letter-case instruction (First Letter Uppercase: the first letter must be capitalized and remaining letters in lowercase format, e.g., \"Manila\" instead of \"MANILA\" or \"manila\"). Zero points were awarded.",
      };
    }

    return { compliant: true, explanation: null };
  }

  return { compliant: true, explanation: null };
}

/**
 * Grades an Identification question applying content matching and any instructor-specified letter-case requirement.
 */
export function gradeIdentificationQuestion(params: {
  submittedResponse: string;
  correctAnswer: string;
  points: number;
  caseRule: CaseSensitivityRule;
}): {
  isCorrect: boolean;
  pointsAwarded: number;
  contentMatches: boolean;
  caseViolation: boolean;
  caseExplanation: string | null;
} {
  const { submittedResponse, correctAnswer, points, caseRule } = params;
  const trimmedResponse = (submittedResponse || "").trim();
  const trimmedCorrect = (correctAnswer || "").trim();

  if (!trimmedResponse) {
    return {
      isCorrect: false,
      pointsAwarded: 0,
      contentMatches: false,
      caseViolation: false,
      caseExplanation: null,
    };
  }

  const contentMatches =
    trimmedCorrect !== "" && trimmedResponse.toLowerCase() === trimmedCorrect.toLowerCase();

  // B. If the instructor does NOT specify a letter-case requirement, accept regardless of capitalization
  if (caseRule === "NONE") {
    return {
      isCorrect: contentMatches,
      pointsAwarded: contentMatches ? points : 0,
      contentMatches,
      caseViolation: false,
      caseExplanation: null,
    };
  }

  // A. Instructor specified a letter-case requirement
  const compliance = evaluateAnswerCaseCompliance(trimmedResponse, caseRule, trimmedCorrect);

  if (contentMatches && compliance.compliant) {
    return {
      isCorrect: true,
      pointsAwarded: points,
      contentMatches: true,
      caseViolation: false,
      caseExplanation: null,
    };
  }

  if (contentMatches && !compliance.compliant) {
    // Answer is otherwise correct, but violates required capitalization -> award 0 points
    return {
      isCorrect: false,
      pointsAwarded: 0,
      contentMatches: true,
      caseViolation: true,
      caseExplanation: compliance.explanation,
    };
  }

  return {
    isCorrect: false,
    pointsAwarded: 0,
    contentMatches: false,
    caseViolation: !compliance.compliant,
    caseExplanation: !compliance.compliant ? compliance.explanation : null,
  };
}
