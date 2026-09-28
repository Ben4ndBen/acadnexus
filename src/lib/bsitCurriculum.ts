export interface CurriculumItem {
  code: string;
  title: string;
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

export const BSIT_CURRICULUM: CurriculumItem[] = [
  // --- FIRST YEAR - FIRST SEMESTER ---
  { code: "GE 01", title: "Purposive Communication", yearLevel: 1, semester: 1 },
  { code: "GE 02", title: "Readings in Philippine History", yearLevel: 1, semester: 1 },
  { code: "GE 03", title: "Mathematics in the Modern World", yearLevel: 1, semester: 1 },
  { code: "ITCH", title: "Ivatan Traditions, Culture, And History", yearLevel: 1, semester: 1 },
  { code: "ITC 101", title: "Introduction To Computing", yearLevel: 1, semester: 1 },
  { code: "ITC 102", title: "Computer Programming 1", yearLevel: 1, semester: 1 },
  { code: "NSTP 1", title: "National Service Training Program 1", yearLevel: 1, semester: 1 },
  { code: "PATHFit 11", title: "Movement Competency Training (MCT)", yearLevel: 1, semester: 1 },

  // --- FIRST YEAR - SECOND SEMESTER ---
  { code: "GE 04", title: "Understanding The Self", yearLevel: 1, semester: 2 },
  { code: "CDRM", title: "Climate Change & Disaster Risk Reduction Management", yearLevel: 1, semester: 2 },
  { code: "ITC 103", title: "Computer Programming 2", yearLevel: 1, semester: 2 },
  { code: "ITM 104", title: "Discrete Mathematics", yearLevel: 1, semester: 2 },
  { code: "ITM 105", title: "Introduction To Human Computer Interaction", yearLevel: 1, semester: 2 },
  { code: "ITM 106", title: "Multimedia Systems", yearLevel: 1, semester: 2 },
  { code: "NSTP 2", title: "National Service Training 2", yearLevel: 1, semester: 2 },
  { code: "PATHFit 12", title: "Exercise-Based Fitness Activities", yearLevel: 1, semester: 2 },

  // --- SECOND YEAR - FIRST SEMESTER ---
  { code: "GE 05", title: "Art Appreciation", yearLevel: 2, semester: 1 },
  { code: "GE 06", title: "Ethics", yearLevel: 2, semester: 1 },
  { code: "TECH COMM", title: "Basic Technical Communication", yearLevel: 2, semester: 1 },
  { code: "ITC 201", title: "Data Structures and Algorithms", yearLevel: 2, semester: 1 },
  { code: "ITC 202", title: "Information Management", yearLevel: 2, semester: 1 },
  { code: "ITE 203", title: "Platform Technologies", yearLevel: 2, semester: 1 },
  { code: "ITE 204", title: "Object-Oriented Programming", yearLevel: 2, semester: 1 },
  { code: "PATHFit 13", title: "Individual And Dual Sports Activities", yearLevel: 2, semester: 1 },

  // --- SECOND YEAR - SECOND SEMESTER ---
  { code: "GE 07", title: "Science, Technology, And Society", yearLevel: 2, semester: 2 },
  { code: "GE 08", title: "The Contemporary World", yearLevel: 2, semester: 2 },
  { code: "GE 09", title: "Life And Works of Rizal", yearLevel: 2, semester: 2 },
  { code: "ITM 205", title: "Networking 1", yearLevel: 2, semester: 2 },
  { code: "ITM 206", title: "Advanced Database Systems", yearLevel: 2, semester: 2 },
  { code: "ITE 207", title: "Web Systems and Technologies 1", yearLevel: 2, semester: 2 },
  { code: "ITM 208", title: "Event-Driven Programming", yearLevel: 2, semester: 2 },
  { code: "PATHFit 14", title: "Dance, Sports, Group Exercises, Outdoor and Adventure Activities", yearLevel: 2, semester: 2 },

  // --- THIRD YEAR - FIRST SEMESTER ---
  { code: "ITM 301", title: "Networking 2", yearLevel: 3, semester: 1 },
  { code: "ITM 302", title: "Systems Integration and Architecture", yearLevel: 3, semester: 1 },
  { code: "ITE 303", title: "Web Systems and Technologies 2", yearLevel: 3, semester: 1 },
  { code: "ITD 304", title: "Track Elective 1*", yearLevel: 3, semester: 1, isTrackElective: true, electiveNumber: 1 },
  { code: "ITD 305", title: "Track Elective 2*", yearLevel: 3, semester: 1, isTrackElective: true, electiveNumber: 2 },
  { code: "ITM 306", title: "Information Assurance and Security 1", yearLevel: 3, semester: 1 },
  { code: "ITM 309", title: "Quantitative Methods (w/ Modeling and Simulation)", yearLevel: 3, semester: 1 },

  // --- THIRD YEAR - SECOND SEMESTER ---
  { code: "ITM 307", title: "Social And Professional Issues (Professional Ethics)", yearLevel: 3, semester: 2 },
  { code: "ITC 308", title: "Application Development and Emerging Technologies", yearLevel: 3, semester: 2 },
  { code: "ITD 310", title: "Track Elective 3*", yearLevel: 3, semester: 2, isTrackElective: true, electiveNumber: 3 },
  { code: "ITD 311", title: "Track Elective 4*", yearLevel: 3, semester: 2, isTrackElective: true, electiveNumber: 4 },
  { code: "ITM 312", title: "Information Assurance and Security 2", yearLevel: 3, semester: 2 },
  { code: "ITM 313", title: "Capstone Project 1", yearLevel: 3, semester: 2 },

  // --- FOURTH YEAR - FIRST SEMESTER ---
  { code: "ITM 401", title: "Capstone Project 2", yearLevel: 4, semester: 1 },
  { code: "ITM 402", title: "System Administration and Maintenance", yearLevel: 4, semester: 1 },
  { code: "ENT 403", title: "Technopreneurship", yearLevel: 4, semester: 1 },

  // --- FOURTH YEAR - SECOND SEMESTER ---
  { code: "ITM 404", title: "Practicum / OJT / Immersion", yearLevel: 4, semester: 2 },

  // --- TRACK ELECTIVES (CYBER SECURITY) ---
  { code: "ITD 304-CS", title: "Fundamentals of Cyber Security (Elective 1)", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Cyber Security Track", electiveNumber: 1 },
  { code: "ITD 305-CS", title: "Data And Application Security (Elective 2)", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Cyber Security Track", electiveNumber: 2 },
  { code: "ITD 310-CS", title: "Ethical Hacking and Penetration Testing (Elective 3)", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Cyber Security Track", electiveNumber: 3 },
  { code: "ITD 311-CS", title: "Incident Response and Forensics (Elective 4)", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Cyber Security Track", electiveNumber: 4 },

  // --- TRACK ELECTIVES (WEB AND MOBILE APP DEV) ---
  { code: "ITD 304-WM", title: "Server-Side Development (Elective 1)", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Web and Mobile Application Development Track", electiveNumber: 1 },
  { code: "ITD 305-WM", title: "Mobile App Development (Elective 2)", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Web and Mobile Application Development Track", electiveNumber: 2 },
  { code: "ITD 310-WM", title: "APIs AND Web Services (Elective 3)", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Web and Mobile Application Development Track", electiveNumber: 3 },
  { code: "ITD 311-WM", title: "Project Management (Elective 4)", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Web and Mobile Application Development Track", electiveNumber: 4 },

  // --- TRACK ELECTIVES (MULTIMEDIA) ---
  { code: "ITD 304-MM", title: "Digital Photography (Elective 1)", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Multimedia Track", electiveNumber: 1 },
  { code: "ITD 305-MM", title: "Digital Video Production (Elective 2)", yearLevel: 3, semester: 1, isTrackElective: true, trackName: "Multimedia Track", electiveNumber: 2 },
  { code: "ITD 310-MM", title: "3d Animation and Modeling (Elective 3)", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Multimedia Track", electiveNumber: 3 },
  { code: "ITD 311-MM", title: "Digital Marketing and Media Solutions (Elective 4)", yearLevel: 3, semester: 2, isTrackElective: true, trackName: "Multimedia Track", electiveNumber: 4 },
];
