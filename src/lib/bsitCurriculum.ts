export interface CurriculumItem {
  code: string;
  title: string;
  programCode: "BSIT" | "BSHM" | "COMMON";
  yearLevel: number; // 1, 2, 3, 4
  semester: number;  // 1, 2
  isTrackElective?: boolean;
  trackName?: string; // "Cyber Security Track" | "Web and Mobile Application Development Track" | "Multimedia Track"
  electiveNumber?: number; // 1, 2, 3, 4
}

export const BSIT_TRACKS = [
  "Cyber Security Track",
  "Web and Mobile Application Development Track",
  "Multimedia Track",
] as const;

export const BSHM_MAJORS = [
  "Culinary Arts Major",
  "Hotel & Lodging Operations Major",
  "General BSHM",
] as const;

// --- BSIT CURRICULUM ---
export const BSIT_CURRICULUM: CurriculumItem[] = [
  // --- FIRST YEAR - FIRST SEMESTER ---
  { code: "GE 01", title: "Purposive Communication", programCode: "BSIT", yearLevel: 1, semester: 1 },
  { code: "GE 02", title: "Readings in Philippine History", programCode: "BSIT", yearLevel: 1, semester: 1 },
  { code: "GE 03", title: "Mathematics in the Modern World", programCode: "BSIT", yearLevel: 1, semester: 1 },
  { code: "ITCH", title: "Ivatan Traditions, Culture, And History", programCode: "BSIT", yearLevel: 1, semester: 1 },
  { code: "ITC 101", title: "Introduction To Computing", programCode: "BSIT", yearLevel: 1, semester: 1 },
  { code: "ITC 102", title: "Computer Programming 1", programCode: "BSIT", yearLevel: 1, semester: 1 },
  { code: "NSTP 1", title: "National Service Training Program 1", programCode: "BSIT", yearLevel: 1, semester: 1 },
  { code: "PATHFit 11", title: "Movement Competency Training (MCT)", programCode: "BSIT", yearLevel: 1, semester: 1 },

  // --- FIRST YEAR - SECOND SEMESTER ---
  { code: "GE 04", title: "Understanding The Self", programCode: "BSIT", yearLevel: 1, semester: 2 },
  { code: "CDRM", title: "Climate Change & Disaster Risk Reduction Management", programCode: "BSIT", yearLevel: 1, semester: 2 },
  { code: "ITC 103", title: "Computer Programming 2", programCode: "BSIT", yearLevel: 1, semester: 2 },
  { code: "ITM 104", title: "Discrete Mathematics", programCode: "BSIT", yearLevel: 1, semester: 2 },
  { code: "ITM 105", title: "Introduction To Human Computer Interaction", programCode: "BSIT", yearLevel: 1, semester: 2 },
  { code: "ITM 106", title: "Multimedia Systems", programCode: "BSIT", yearLevel: 1, semester: 2 },
  { code: "NSTP 2", title: "National Service Training 2", programCode: "BSIT", yearLevel: 1, semester: 2 },
  { code: "PATHFit 12", title: "Exercise-Based Fitness Activities", programCode: "BSIT", yearLevel: 1, semester: 2 },

  // --- SECOND YEAR - FIRST SEMESTER ---
  { code: "GE 05", title: "Art Appreciation", programCode: "BSIT", yearLevel: 2, semester: 1 },
  { code: "GE 06", title: "Ethics", programCode: "BSIT", yearLevel: 2, semester: 1 },
  { code: "TECH COMM", title: "Basic Technical Communication", programCode: "BSIT", yearLevel: 2, semester: 1 },
  { code: "ITC 201", title: "Data Structures and Algorithms", programCode: "BSIT", yearLevel: 2, semester: 1 },
  { code: "ITC 202", title: "Information Management", programCode: "BSIT", yearLevel: 2, semester: 1 },
  { code: "ITE 203", title: "Platform Technologies", programCode: "BSIT", yearLevel: 2, semester: 1 },
  { code: "ITE 204", title: "Object-Oriented Programming", programCode: "BSIT", yearLevel: 2, semester: 1 },
  { code: "PATHFit 13", title: "Individual And Dual Sports Activities", programCode: "BSIT", yearLevel: 2, semester: 1 },

  // --- SECOND YEAR - SECOND SEMESTER ---
  { code: "GE 07", title: "Science, Technology, And Society", programCode: "BSIT", yearLevel: 2, semester: 2 },
  { code: "GE 08", title: "The Contemporary World", programCode: "BSIT", yearLevel: 2, semester: 2 },
  { code: "GE 09", title: "Life And Works of Rizal", programCode: "BSIT", yearLevel: 2, semester: 2 },
  { code: "ITM 205", title: "Networking 1", programCode: "BSIT", yearLevel: 2, semester: 2 },
  { code: "ITM 206", title: "Advanced Database Systems", programCode: "BSIT", yearLevel: 2, semester: 2 },
  { code: "ITE 207", title: "Web Systems and Technologies 1", programCode: "BSIT", yearLevel: 2, semester: 2 },
  { code: "ITM 208", title: "Event-Driven Programming", programCode: "BSIT", yearLevel: 2, semester: 2 },
  { code: "PATHFit 14", title: "Dance, Sports, Group Exercises, Outdoor and Adventure Activities", programCode: "BSIT", yearLevel: 2, semester: 2 },

  // --- THIRD YEAR - FIRST SEMESTER ---
  { code: "ITM 301", title: "Networking 2", programCode: "BSIT", yearLevel: 3, semester: 1 },
  { code: "ITM 302", title: "Systems Integration and Architecture", programCode: "BSIT", yearLevel: 3, semester: 1 },
  { code: "ITE 303", title: "Web Systems and Technologies 2", programCode: "BSIT", yearLevel: 3, semester: 1 },
  { code: "ITD 304", title: "Track Elective 1*", programCode: "BSIT", yearLevel: 3, semester: 1, isTrackElective: true, electiveNumber: 1 },
  { code: "ITD 305", title: "Track Elective 2*", programCode: "BSIT", yearLevel: 3, semester: 1, isTrackElective: true, electiveNumber: 2 },
  { code: "ITM 306", title: "Information Assurance and Security 1", programCode: "BSIT", yearLevel: 3, semester: 1 },
  { code: "ITM 309", title: "Quantitative Methods (w/ Modeling and Simulation)", programCode: "BSIT", yearLevel: 3, semester: 1 },

  // --- THIRD YEAR - SECOND SEMESTER ---
  { code: "ITM 307", title: "Social And Professional Issues (Professional Ethics)", programCode: "BSIT", yearLevel: 3, semester: 2 },
  { code: "ITC 308", title: "Application Development and Emerging Technologies", programCode: "BSIT", yearLevel: 3, semester: 2 },
  { code: "ITD 310", title: "Track Elective 3*", programCode: "BSIT", yearLevel: 3, semester: 2, isTrackElective: true, electiveNumber: 3 },
  { code: "ITD 311", title: "Track Elective 4*", programCode: "BSIT", yearLevel: 3, semester: 2, isTrackElective: true, electiveNumber: 4 },
  { code: "ITM 312", title: "Information Assurance and Security 2", programCode: "BSIT", yearLevel: 3, semester: 2 },
  { code: "ITM 313", title: "Capstone Project 1", programCode: "BSIT", yearLevel: 3, semester: 2 },

  // --- FOURTH YEAR - FIRST SEMESTER ---
  { code: "ITM 401", title: "Capstone Project 2", programCode: "BSIT", yearLevel: 4, semester: 1 },
  { code: "ITM 402", title: "System Administration and Maintenance", programCode: "BSIT", yearLevel: 4, semester: 1 },
  { code: "ENT 403", title: "Technopreneurship", programCode: "BSIT", yearLevel: 4, semester: 1 },

  // --- FOURTH YEAR - SECOND SEMESTER ---
  { code: "ITM 404", title: "Practicum / OJT / Immersion", programCode: "BSIT", yearLevel: 4, semester: 2 },

  // --- TRACK ELECTIVES (CYBER SECURITY) ---
  { code: "ITD 304-CS", title: "Fundamentals of Cyber Security (Elective 1)", programCode: "BSIT", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Cyber Security Track", electiveNumber: 1 },
  { code: "ITD 305-CS", title: "Data And Application Security (Elective 2)", programCode: "BSIT", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Cyber Security Track", electiveNumber: 2 },
  { code: "ITD 310-CS", title: "Ethical Hacking and Penetration Testing (Elective 3)", programCode: "BSIT", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Cyber Security Track", electiveNumber: 3 },
  { code: "ITD 311-CS", title: "Incident Response and Forensics (Elective 4)", programCode: "BSIT", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Cyber Security Track", electiveNumber: 4 },

  // --- TRACK ELECTIVES (WEB AND MOBILE APP DEV) ---
  { code: "ITD 304-WM", title: "Server-Side Development (Elective 1)", programCode: "BSIT", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Web and Mobile Application Development Track", electiveNumber: 1 },
  { code: "ITD 305-WM", title: "Mobile App Development (Elective 2)", programCode: "BSIT", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Web and Mobile Application Development Track", electiveNumber: 2 },
  { code: "ITD 310-WM", title: "APIs AND Web Services (Elective 3)", programCode: "BSIT", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Web and Mobile Application Development Track", electiveNumber: 3 },
  { code: "ITD 311-WM", title: "Project Management (Elective 4)", programCode: "BSIT", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Web and Mobile Application Development Track", electiveNumber: 4 },

  // --- TRACK ELECTIVES (MULTIMEDIA) ---
  { code: "ITD 304-MM", title: "Digital Photography (Elective 1)", programCode: "BSIT", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Multimedia Track", electiveNumber: 1 },
  { code: "ITD 305-MM", title: "Digital Video Production (Elective 2)", programCode: "BSIT", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Multimedia Track", electiveNumber: 2 },
  { code: "ITD 310-MM", title: "3d Animation and Modeling (Elective 3)", programCode: "BSIT", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Multimedia Track", electiveNumber: 3 },
  { code: "ITD 311-MM", title: "Digital Marketing and Media Solutions (Elective 4)", programCode: "BSIT", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Multimedia Track", electiveNumber: 4 },
];

// --- BSHM CURRICULUM ---
export const BSHM_CURRICULUM: CurriculumItem[] = [
  // --- FIRST YEAR - FIRST SEMESTER ---
  { code: "GE 01", title: "Purposive Communication", programCode: "BSHM", yearLevel: 1, semester: 1 },
  { code: "GE 02", title: "Readings in Philippine History", programCode: "BSHM", yearLevel: 1, semester: 1 },
  { code: "GE 03", title: "Mathematics in the Modern World", programCode: "BSHM", yearLevel: 1, semester: 1 },
  { code: "THC 1", title: "Macro Perspective of Tourism and Hospitality", programCode: "BSHM", yearLevel: 1, semester: 1 },
  { code: "THC 2", title: "Risk Management as Applied to Safety, Security and Sanitation", programCode: "BSHM", yearLevel: 1, semester: 1 },
  { code: "PATHFit 11", title: "Movement Competency Training (MCT)", programCode: "BSHM", yearLevel: 1, semester: 1 },
  { code: "ITCH", title: "Ivatan Traditions, Culture and History", programCode: "BSHM", yearLevel: 1, semester: 1 },
  { code: "NSTP 1", title: "National Service Training Program 1", programCode: "BSHM", yearLevel: 1, semester: 1 },

  // --- FIRST YEAR - SECOND SEMESTER ---
  { code: "THC 3", title: "Quality Service Management in Tourism and Hospitality", programCode: "BSHM", yearLevel: 1, semester: 2 },
  { code: "THC 4", title: "Philippine Culture, Tourism and Geography", programCode: "BSHM", yearLevel: 1, semester: 2 },
  { code: "THC 5", title: "Micro Perspective of Tourism and Hospitality", programCode: "BSHM", yearLevel: 1, semester: 2 },
  { code: "HPC 1", title: "Kitchen Essentials and Basic Food Preparation", programCode: "BSHM", yearLevel: 1, semester: 2 },
  { code: "HPC 2", title: "Fundamentals in Lodging Operations", programCode: "BSHM", yearLevel: 1, semester: 2 },
  { code: "GE 04", title: "Understanding the Self", programCode: "BSHM", yearLevel: 1, semester: 2 },
  { code: "CDRM", title: "Climate Change and Disaster Risk Reduction Management", programCode: "BSHM", yearLevel: 1, semester: 2 },
  { code: "PATHFit 12", title: "Exercise-based Fitness Activities", programCode: "BSHM", yearLevel: 1, semester: 2 },
  { code: "NSTP 2", title: "National Service Training Program 2", programCode: "BSHM", yearLevel: 1, semester: 2 },

  // --- SECOND YEAR - FIRST SEMESTER ---
  { code: "HPC 3", title: "Applied Business Tools and Technologies (PMS)", programCode: "BSHM", yearLevel: 2, semester: 1 },
  { code: "HPC 4", title: "Supply Chain Management in Hospitality Industry", programCode: "BSHM", yearLevel: 2, semester: 1 },
  { code: "HPC 5", title: "Foreign Language 1", programCode: "BSHM", yearLevel: 2, semester: 1 },
  { code: "TECH COMM", title: "Basic Technical Communication", programCode: "BSHM", yearLevel: 2, semester: 1 },
  { code: "GE 05", title: "Art Appreciation", programCode: "BSHM", yearLevel: 2, semester: 1 },
  { code: "GE 06", title: "Ethics", programCode: "BSHM", yearLevel: 2, semester: 1 },
  { code: "PATHFit 13", title: "Individual and Dual Sports Activities", programCode: "BSHM", yearLevel: 2, semester: 1 },

  // --- SECOND YEAR - SECOND SEMESTER ---
  { code: "GE 07", title: "Science, Technology and Society", programCode: "BSHM", yearLevel: 2, semester: 2 },
  { code: "GE 08", title: "The Contemporary World", programCode: "BSHM", yearLevel: 2, semester: 2 },
  { code: "HPC 6", title: "Fundamentals in Food Service Operations", programCode: "BSHM", yearLevel: 2, semester: 2 },
  { code: "HPC 7", title: "Introduction to MICE", programCode: "BSHM", yearLevel: 2, semester: 2 },
  { code: "HPC 8", title: "Foreign Language 2", programCode: "BSHM", yearLevel: 2, semester: 2 },
  { code: "HMPE 1", title: "Cost Control", programCode: "BSHM", yearLevel: 2, semester: 2 },
  { code: "GE 09", title: "Life and Works of Rizal", programCode: "BSHM", yearLevel: 2, semester: 2 },
  { code: "PATHFit 14", title: "Dance, Sports, Group Exercises, Outdoor and Adventure Activities", programCode: "BSHM", yearLevel: 2, semester: 2 },

  // --- THIRD YEAR - FIRST SEMESTER ---
  { code: "HMPE 2", title: "Bread and Pastry Production", programCode: "BSHM", yearLevel: 3, semester: 1 },
  { code: "HMPE 3", title: "Menu design & Revenue Management", programCode: "BSHM", yearLevel: 3, semester: 1 },
  { code: "BME 1", title: "Operations Management in Tourism and Hospitality Industry", programCode: "BSHM", yearLevel: 3, semester: 1 },
  { code: "THC 6", title: "Professional Development and Applied Ethics", programCode: "BSHM", yearLevel: 3, semester: 1 },
  { code: "THC 7", title: "Tourism and Hospitality Marketing", programCode: "BSHM", yearLevel: 3, semester: 1 },

  // --- THIRD YEAR - SECOND SEMESTER ---
  { code: "BME 2", title: "Strategic Management and Total Quality Management in Tourism and Hospitality", programCode: "BSHM", yearLevel: 3, semester: 2 },
  { code: "THC 8", title: "Legal Aspects in Tourism and Hospitality", programCode: "BSHM", yearLevel: 3, semester: 2 },
  { code: "THC 9", title: "Multicultural Diversity in Workplace for the Tourism Professional", programCode: "BSHM", yearLevel: 3, semester: 2 },
  { code: "THC 10", title: "Entrepreneurship in Tourism and Hospitality", programCode: "BSHM", yearLevel: 3, semester: 2 },
  { code: "HPC 9", title: "Ergonomics and Facilities Planning for the Hospitality Industry", programCode: "BSHM", yearLevel: 3, semester: 2 },
  { code: "HMPE 4", title: "Catering Management", programCode: "BSHM", yearLevel: 3, semester: 2 },

  // --- FOURTH YEAR - FIRST SEMESTER ---
  { code: "HPC 10", title: "Research in Hospitality", programCode: "BSHM", yearLevel: 4, semester: 1 },
  { code: "HMPE 5", title: "Bar and Beverage Management w/ lab", programCode: "BSHM", yearLevel: 4, semester: 1 },
  { code: "HMPE 6", title: "Front Office Operation", programCode: "BSHM", yearLevel: 4, semester: 1 },

  // --- FOURTH YEAR - SECOND SEMESTER ---
  { code: "Prac", title: "Practicum (min. of 600 hours)", programCode: "BSHM", yearLevel: 4, semester: 2 },
];

export const ALL_CURRICULUMS = [...BSIT_CURRICULUM, ...BSHM_CURRICULUM];

/** Gets curriculum items for a given program code & year level */
export function getCurriculumForProgram(programCode: string, yearLevel: number): CurriculumItem[] {
  const codeUpper = programCode.toUpperCase();
  let targetProgram: "BSIT" | "BSHM" | null = null;

  if (codeUpper === "BSIT" || codeUpper.includes("INFORMATION TECHNOLOGY")) {
    targetProgram = "BSIT";
  } else if (codeUpper === "BSHM" || codeUpper.includes("HOSPITALITY")) {
    targetProgram = "BSHM";
  }

  if (!targetProgram) return [];

  return ALL_CURRICULUMS.filter(
    (item) => item.programCode === targetProgram && item.yearLevel === yearLevel
  );
}
