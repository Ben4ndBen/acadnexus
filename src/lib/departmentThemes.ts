export type DepartmentKey = "htm" | "agri" | "itd" | "ted" | "ict" | "indtech" | "it";

export interface DepartmentTheme {
  key: DepartmentKey;
  shortName: string;
  fullName: string;
  themeLabel: string;
  colors: {
    primary: string;
    primaryDark: string;
    accent: string;
    bgLight: string;
    bgWhite: string;
    textDark: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    headerGradient: string;
    headerBg: string;
    headerText: string;
    bannerGradient: string;
    bannerText: string;
    cardHeaderBg: string;
    activeTabBg: string;
    borderAccent: string;
    ringColor: string;
  };
}

export const DEPARTMENT_THEMES: Record<string, DepartmentTheme> = {
  htm: {
    key: "htm",
    shortName: "HTM",
    fullName: "HTM Department",
    themeLabel: "Yellow and White",
    colors: {
      primary: "#CA8A04",
      primaryDark: "#854D0E",
      accent: "#FEF08A",
      bgLight: "#FEFCE8",
      bgWhite: "#FFFFFF",
      textDark: "#713F12",
      badgeBg: "bg-yellow-100",
      badgeText: "text-yellow-950 font-bold",
      badgeBorder: "border-yellow-400",
      headerGradient: "from-amber-400 via-yellow-500 to-amber-500",
      headerBg: "bg-amber-500",
      headerText: "text-slate-950 font-extrabold",
      bannerGradient: "from-amber-400 via-yellow-500 to-amber-500",
      bannerText: "text-slate-950 font-bold",
      cardHeaderBg: "bg-yellow-50/90 border-yellow-300",
      activeTabBg: "bg-amber-100 border-amber-500 text-amber-950 font-bold shadow-sm",
      borderAccent: "border-amber-400",
      ringColor: "focus:ring-amber-400",
    },
  },
  agri: {
    key: "agri",
    shortName: "Agri",
    fullName: "Agriculture Department",
    themeLabel: "Green and White",
    colors: {
      primary: "#16A34A",
      primaryDark: "#14532D",
      accent: "#BBF7D0",
      bgLight: "#F0FDF4",
      bgWhite: "#FFFFFF",
      textDark: "#14532D",
      badgeBg: "bg-emerald-100",
      badgeText: "text-emerald-900 font-bold",
      badgeBorder: "border-emerald-300",
      headerGradient: "from-emerald-600 via-green-600 to-emerald-700",
      headerBg: "bg-emerald-600",
      headerText: "text-white font-bold",
      bannerGradient: "from-emerald-600 via-green-600 to-emerald-700",
      bannerText: "text-white font-bold",
      cardHeaderBg: "bg-emerald-50/90 border-emerald-200",
      activeTabBg: "bg-emerald-100 border-emerald-600 text-emerald-950 font-bold shadow-sm",
      borderAccent: "border-emerald-500",
      ringColor: "focus:ring-emerald-400",
    },
  },
  itd: {
    key: "itd",
    shortName: "IT",
    fullName: "ITD Department",
    themeLabel: "Pink and White",
    colors: {
      primary: "#DB2777",
      primaryDark: "#831843",
      accent: "#FBCFE8",
      bgLight: "#FDF2F8",
      bgWhite: "#FFFFFF",
      textDark: "#831843",
      badgeBg: "bg-pink-100",
      badgeText: "text-pink-900 font-bold",
      badgeBorder: "border-pink-300",
      headerGradient: "from-pink-600 via-rose-600 to-pink-700",
      headerBg: "bg-pink-600",
      headerText: "text-white font-bold",
      bannerGradient: "from-pink-600 via-rose-600 to-pink-700",
      bannerText: "text-white font-bold",
      cardHeaderBg: "bg-pink-50/90 border-pink-200",
      activeTabBg: "bg-pink-100 border-pink-600 text-pink-950 font-bold shadow-sm",
      borderAccent: "border-pink-500",
      ringColor: "focus:ring-pink-400",
    },
  },
  ted: {
    key: "ted",
    shortName: "TED",
    fullName: "Teacher Education Department (TED)",
    themeLabel: "Blue and White",
    colors: {
      primary: "#2563EB",
      primaryDark: "#1E3A8A",
      accent: "#BFDBFE",
      bgLight: "#EFF6FF",
      bgWhite: "#FFFFFF",
      textDark: "#1E3A8A",
      badgeBg: "bg-blue-100",
      badgeText: "text-blue-900 font-bold",
      badgeBorder: "border-blue-300",
      headerGradient: "from-blue-600 via-indigo-600 to-blue-700",
      headerBg: "bg-blue-600",
      headerText: "text-white font-bold",
      bannerGradient: "from-blue-600 via-indigo-600 to-blue-700",
      bannerText: "text-white font-bold",
      cardHeaderBg: "bg-blue-50/90 border-blue-200",
      activeTabBg: "bg-blue-100 border-blue-600 text-blue-950 font-bold shadow-sm",
      borderAccent: "border-blue-500",
      ringColor: "focus:ring-blue-400",
    },
  },
  ict: {
    key: "ict",
    shortName: "ICT",
    fullName: "ICT Department",
    themeLabel: "Black and White",
    colors: {
      primary: "#18181B",
      primaryDark: "#000000",
      accent: "#E4E4E7",
      bgLight: "#FAFAFA",
      bgWhite: "#FFFFFF",
      textDark: "#09090B",
      badgeBg: "bg-zinc-900",
      badgeText: "text-white font-bold",
      badgeBorder: "border-zinc-800",
      headerGradient: "from-zinc-900 via-black to-zinc-800",
      headerBg: "bg-zinc-900",
      headerText: "text-white font-bold",
      bannerGradient: "from-zinc-900 via-black to-zinc-800",
      bannerText: "text-white font-bold",
      cardHeaderBg: "bg-zinc-100 border-zinc-300",
      activeTabBg: "bg-zinc-200 border-zinc-900 text-zinc-950 font-bold shadow-sm",
      borderAccent: "border-zinc-900",
      ringColor: "focus:ring-zinc-900",
    },
  },
};

// Aliases for backwards compatibility
DEPARTMENT_THEMES.indtech = DEPARTMENT_THEMES.itd;
DEPARTMENT_THEMES.it = DEPARTMENT_THEMES.itd;

/**
 * Resolves department key from any identifier (department name, code, chair ID, program code).
 */
export function getDepartmentKey(identifier?: string | null): DepartmentKey {
  if (!identifier) return "ict";
  const str = identifier.trim().toLowerCase();

  if (
    str.includes("htm") ||
    str.includes("hospitality") ||
    str.includes("tourism") ||
    str.includes("bshm") ||
    str.includes("bstm")
  ) {
    return "htm";
  }

  if (
    str.includes("agri") ||
    str.includes("agriculture") ||
    str.includes("bsa")
  ) {
    return "agri";
  }

  if (
    str.includes("ted") ||
    str.includes("teacher education") ||
    str.includes("education") ||
    str.includes("beed") ||
    str.includes("bsed")
  ) {
    return "ted";
  }

  if (
    str.includes("ict") ||
    str.includes("bsinfotech") ||
    str.includes("information technology") ||
    str === "chair_ict" ||
    str === "faculty-ict" ||
    str === "faculty-001"
  ) {
    return "ict";
  }

  if (
    str.includes("industrial") ||
    str.includes("itd") ||
    str.includes("indtech") ||
    str.includes("bsindtech") ||
    str === "bsit" ||
    str === "it" ||
    str.includes("it department") ||
    str.includes("itd department") ||
    str === "chair_indtech" ||
    str === "chair_itd" ||
    str === "chair_it" ||
    str === "faculty-indtech" ||
    str === "faculty-itd" ||
    str === "faculty-it"
  ) {
    return "itd";
  }

  return "ict";
}

/**
 * Resolves full department theme object.
 */
export function getDepartmentTheme(identifier?: string | null): DepartmentTheme {
  const key = getDepartmentKey(identifier);
  return DEPARTMENT_THEMES[key] || DEPARTMENT_THEMES.ict;
}

/**
 * List of all department portal themes.
 */
export const ALL_DEPARTMENT_THEMES = [
  DEPARTMENT_THEMES.htm,
  DEPARTMENT_THEMES.agri,
  DEPARTMENT_THEMES.itd,
  DEPARTMENT_THEMES.ted,
  DEPARTMENT_THEMES.ict,
];
