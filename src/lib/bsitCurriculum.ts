export interface CurriculumItem {
  code: string;
  title: string;
  programCode: "BSIT" | "BSHM" | "BSA" | "BSTM" | "COMMON";
  yearLevel: number; // 1, 2, 3, 4
  semester: number;  // 1, 2
  isTrackElective?: boolean;
  trackName?: string; // "Cyber Security Track" | "Web and Mobile Application Development Track" | "Multimedia Track"
  electiveNumber?: number; // 1, 2, 3, 4
}

export const BSINFOTECH_TRACKS = [
  "Cyber Security Track",
  "Web and Mobile Application Development Track",
  "Multimedia Track",
] as const;

export const BSIT_TRACKS = BSINFOTECH_TRACKS;
export const BSED_MAJORS = ["English", "Science", "Mathematics"] as const;
export const BSIT_INDUSTRIAL_MAJORS = ["ARCHITECTURE TECHNOLOGY", "AUTOMOTIVE TECHNOLOGY", "ELECTRONICS TECHNOLOGY"] as const;

export const BSHM_MAJORS = [] as const;
export const BSA_MAJORS = [] as const;
export const BSTM_MAJORS = [] as const;

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
  { code: "ITD 304", title: "IT Elective 1", programCode: "BSIT", yearLevel: 3, semester: 1 },
  { code: "ITD 305", title: "IT Elective 2", programCode: "BSIT", yearLevel: 3, semester: 1 },
  { code: "ITM 306", title: "Information Assurance and Security 1", programCode: "BSIT", yearLevel: 3, semester: 1 },
  { code: "ITM 309", title: "Quantitative Methods (w/ Modeling and Simulation)", programCode: "BSIT", yearLevel: 3, semester: 1 },

  // --- THIRD YEAR - SECOND SEMESTER ---
  { code: "ITM 307", title: "Social And Professional Issues (Professional Ethics)", programCode: "BSIT", yearLevel: 3, semester: 2 },
  { code: "ITC 308", title: "Application Development and Emerging Technologies", programCode: "BSIT", yearLevel: 3, semester: 2 },
  { code: "ITD 310", title: "IT Elective 3", programCode: "BSIT", yearLevel: 3, semester: 2 },
  { code: "ITD 311", title: "IT Elective 4", programCode: "BSIT", yearLevel: 3, semester: 2 },
  { code: "ITM 312", title: "Information Assurance and Security 2", programCode: "BSIT", yearLevel: 3, semester: 2 },
  { code: "ITM 313", title: "Capstone Project 1", programCode: "BSIT", yearLevel: 3, semester: 2 },

  // --- FOURTH YEAR - FIRST SEMESTER ---
  { code: "ITM 401", title: "Capstone Project 2", programCode: "BSIT", yearLevel: 4, semester: 1 },
  { code: "ITM 402", title: "System Administration and Maintenance", programCode: "BSIT", yearLevel: 4, semester: 1 },
  { code: "ENT 403", title: "Technopreneurship", programCode: "BSIT", yearLevel: 4, semester: 1 },

  // --- FOURTH YEAR - SECOND SEMESTER ---
  { code: "ITM 404", title: "Practicum / OJT / Immersion", programCode: "BSIT", yearLevel: 4, semester: 2 },
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

// --- BSA CURRICULUM ---
export const BSA_CURRICULUM: CurriculumItem[] = [
  // --- FIRST YEAR - FIRST SEMESTER ---
  { code: "GE 01", title: "Purposive Communication", programCode: "BSA", yearLevel: 1, semester: 1 },
  { code: "GE 02", title: "Readings in Philippine History", programCode: "BSA", yearLevel: 1, semester: 1 },
  { code: "GE 03", title: "Mathematics in the Modern World", programCode: "BSA", yearLevel: 1, semester: 1 },
  { code: "AG EXT 1", title: "Principles of Agricultural Extension and Communication", programCode: "BSA", yearLevel: 1, semester: 1 },
  { code: "PATHFit 11", title: "Movement Competency Training (MCT)", programCode: "BSA", yearLevel: 1, semester: 1 },
  { code: "NSTP 1", title: "National Service Training Program 1", programCode: "BSA", yearLevel: 1, semester: 1 },
  { code: "ITCH", title: "Ivatan Traditions, Culture, and History", programCode: "BSA", yearLevel: 1, semester: 1 },
  { code: "AGRI 1", title: "Introduction to Agriculture", programCode: "BSA", yearLevel: 1, semester: 1 },
  { code: "AGRI 4", title: "Organic Chemistry", programCode: "BSA", yearLevel: 1, semester: 1 },

  // --- FIRST YEAR - SECOND SEMESTER ---
  { code: "GE 04", title: "Understanding the Self", programCode: "BSA", yearLevel: 1, semester: 2 },
  { code: "PATHFit 12", title: "Exercise-based Fitness Activities", programCode: "BSA", yearLevel: 1, semester: 2 },
  { code: "NSTP 2", title: "National Service Training Program 2", programCode: "BSA", yearLevel: 1, semester: 2 },
  { code: "CDRM", title: "Climate Change and Disaster Risk Reduction Management", programCode: "BSA", yearLevel: 1, semester: 2 },
  { code: "ANSCI 1", title: "Introduction to Poultry and Swine Production", programCode: "BSA", yearLevel: 1, semester: 2 },
  { code: "SOIL SCI 1", title: "Principles of Soil Science", programCode: "BSA", yearLevel: 1, semester: 2 },
  { code: "CROP SCI 1", title: "Principles of Crop Production", programCode: "BSA", yearLevel: 1, semester: 2 },
  { code: "CROP PROT 1", title: "Principles of Crop Protection", programCode: "BSA", yearLevel: 1, semester: 2 },
  { code: "AGB 2", title: "Introduction to Agriculture Commodity System", programCode: "BSA", yearLevel: 1, semester: 2 },

  // --- SECOND YEAR - FIRST SEMESTER ---
  { code: "GE 05", title: "Art Appreciation", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "GE 06", title: "Ethics", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "TECH COMM", title: "Basic Technical Communication", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "PATHFit 13", title: "Individual and Dual Sports Activities", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "CROP PROT 2", title: "Approaches and Practices in Pest Management", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "CROP SCI 2", title: "Practices of Crop Science and Management", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "ANSCI 2", title: "Introduction to Small and Large Ruminant Production", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "SOIL SCI 2", title: "Soil Fertility, Conservation and Management", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "AGRI 3", title: "Principles of Genetics", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "PRACTICUM", title: "Practicum (Skills Development)", programCode: "BSA", yearLevel: 2, semester: 1 },
  { code: "AGB 7", title: "Agricultural Business Management", programCode: "BSA", yearLevel: 2, semester: 1 },

  // --- SECOND YEAR - SECOND SEMESTER ---
  { code: "GE 07", title: "Science, Technology, and Society", programCode: "BSA", yearLevel: 2, semester: 2 },
  { code: "GE 08", title: "The Contemporary World", programCode: "BSA", yearLevel: 2, semester: 2 },
  { code: "GE 09", title: "Life and Works of Rizal", programCode: "BSA", yearLevel: 2, semester: 2 },
  { code: "PATHFit 14", title: "Dance, Sports, Group Exercises, Outdoor and Adventure Activities", programCode: "BSA", yearLevel: 2, semester: 2 },
  { code: "AGRI 5", title: "General Biochemistry", programCode: "BSA", yearLevel: 2, semester: 2 },
  { code: "AGRI 6", title: "Methods of Agricultural Research", programCode: "BSA", yearLevel: 2, semester: 2 },
  { code: "AGB 1", title: "Principles of Agricultural Entrepreneurship and Enterprise Development", programCode: "BSA", yearLevel: 2, semester: 2 },
  { code: "AG EXT 2", title: "Agricultural Extension Program Planning and Technology Transfer", programCode: "BSA", yearLevel: 2, semester: 2 },

  // --- THIRD YEAR - FIRST SEMESTER ---
  { code: "AGRI 2", title: "Introduction to Organic Agriculture", programCode: "BSA", yearLevel: 3, semester: 1 },
  { code: "ANSCI 3", title: "Slaughter of Animals and Animal Product Processing*", programCode: "BSA", yearLevel: 3, semester: 1 },
  { code: "CROP SCI 3", title: "General Physiology and Toxicology*", programCode: "BSA", yearLevel: 3, semester: 1 },
  { code: "SEM 1", title: "Seminar A", programCode: "BSA", yearLevel: 3, semester: 1 },
  { code: "THESIS 1", title: "Thesis 1 Major Farm Practice (Outline)", programCode: "BSA", yearLevel: 3, semester: 1 },
  { code: "AG EXT 3", title: "Agricultural Extension Monitoring and Evaluation", programCode: "BSA", yearLevel: 3, semester: 1 },

  // --- THIRD YEAR - SECOND SEMESTER ---
  { code: "AGB 3", title: "Introduction to Agricultural Policy and Development", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "AME 2", title: "Introduction to Agriculture Systems", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "SEM 2", title: "Seminar B", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "ANSCI 4", title: "Animal Nutrition**", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "SOIL SCI 3", title: "Soil Survey, Classification and Land Use**", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "AGRI 7", title: "Basic Farm Machineries, Mechanization, and Water Management and SMART Agriculture Technology", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "THESIS 2", title: "Thesis 2 Major Farm Practice (Experimental)", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "AGRI 8", title: "Natural Resource and Environmental Management", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "CROP SCI 4", title: "Plant Propagation and Nursery Management**", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "AME 1", title: "Colloquium", programCode: "BSA", yearLevel: 3, semester: 2 },
  { code: "CROP PROT 3", title: "Principles of Plant Disease Management", programCode: "BSA", yearLevel: 3, semester: 2 },

  // --- FOURTH YEAR - FIRST SEMESTER ---
  { code: "THESIS 3", title: "Thesis 3 (Final Defense & Public Lecture)", programCode: "BSA", yearLevel: 4, semester: 1 },
  { code: "CROP PROT 4", title: "Beneficial Arthropods and Microorganism*", programCode: "BSA", yearLevel: 4, semester: 1 },
  { code: "CROP SCI 5", title: "Post-Harvest Handling and Seed Science", programCode: "BSA", yearLevel: 4, semester: 1 },

  // --- FOURTH YEAR - SECOND SEMESTER ---
  { code: "OJT", title: "On-the-Job Training (240 hours)", programCode: "BSA", yearLevel: 4, semester: 2 },
  { code: "CA", title: "Course Appraisal", programCode: "BSA", yearLevel: 4, semester: 2 },
];

// --- BSTM CURRICULUM ---
export const BSTM_CURRICULUM: CurriculumItem[] = [
  // --- FIRST YEAR - FIRST SEMESTER ---
  { code: "GE 01", title: "Purposive Communication", programCode: "BSTM", yearLevel: 1, semester: 1 },
  { code: "GE 02", title: "Readings in Philippine History", programCode: "BSTM", yearLevel: 1, semester: 1 },
  { code: "GE 03", title: "Mathematics in the Modern World", programCode: "BSTM", yearLevel: 1, semester: 1 },
  { code: "THC 1", title: "Macro Perspective of Tourism and Hospitality", programCode: "BSTM", yearLevel: 1, semester: 1 },
  { code: "THC 2", title: "Risk Management as Applied to Safety, Security and Sanitation", programCode: "BSTM", yearLevel: 1, semester: 1 },
  { code: "ITCH", title: "Ivatan Traditions, Culture and History", programCode: "BSTM", yearLevel: 1, semester: 1 },
  { code: "PATHFit 11", title: "Movement Competency Training (MCT)", programCode: "BSTM", yearLevel: 1, semester: 1 },
  { code: "NSTP 1", title: "National Service Training Program 1", programCode: "BSTM", yearLevel: 1, semester: 1 },

  // --- FIRST YEAR - SECOND SEMESTER ---
  { code: "TPC 1", title: "Global Tourism, Geography and Culture", programCode: "BSTM", yearLevel: 1, semester: 2 },
  { code: "THC 3", title: "Tourism and Hospitality Service Quality Management", programCode: "BSTM", yearLevel: 1, semester: 2 },
  { code: "THC 4", title: "Philippine Tourism, Geography and Culture", programCode: "BSTM", yearLevel: 1, semester: 2 },
  { code: "TPC 2", title: "Tour & Travel Management", programCode: "BSTM", yearLevel: 1, semester: 2 },
  { code: "GE 04", title: "Understanding the Self", programCode: "BSTM", yearLevel: 1, semester: 2 },
  { code: "PATHFit 12", title: "Exercise-based Fitness Activities", programCode: "BSTM", yearLevel: 1, semester: 2 },
  { code: "CDRM", title: "Climate Change and Disaster Risk Reduction Management", programCode: "BSTM", yearLevel: 1, semester: 2 },
  { code: "NSTP 2", title: "National Service Training Program 2", programCode: "BSTM", yearLevel: 1, semester: 2 },

  // --- SECOND YEAR - FIRST SEMESTER ---
  { code: "TECH COMM", title: "Basic Technical Communication", programCode: "BSTM", yearLevel: 2, semester: 1 },
  { code: "TPC 3", title: "Applied Business Tools and Technologies (GDS) with Lab", programCode: "BSTM", yearLevel: 2, semester: 1 },
  { code: "TPC 4", title: "Sustainable Tourism", programCode: "BSTM", yearLevel: 2, semester: 1 },
  { code: "THC 5", title: "Micro Perspective of Tourism and Hospitality", programCode: "BSTM", yearLevel: 2, semester: 1 },
  { code: "TPE 1", title: "Tour Guiding", programCode: "BSTM", yearLevel: 2, semester: 1 },
  { code: "GE 05", title: "Art Appreciation", programCode: "BSTM", yearLevel: 2, semester: 1 },
  { code: "GE 06", title: "Ethics", programCode: "BSTM", yearLevel: 2, semester: 1 },
  { code: "PATHFit 13", title: "Individual and Dual Sports", programCode: "BSTM", yearLevel: 2, semester: 1 },

  // --- SECOND YEAR - SECOND SEMESTER ---
  { code: "GE 07", title: "Science, Technology and Society", programCode: "BSTM", yearLevel: 2, semester: 2 },
  { code: "GE 08", title: "The Contemporary World", programCode: "BSTM", yearLevel: 2, semester: 2 },
  { code: "GE 09", title: "Life and Works of Rizal", programCode: "BSTM", yearLevel: 2, semester: 2 },
  { code: "TPC 5", title: "Tourism Policy Planning and Development", programCode: "BSTM", yearLevel: 2, semester: 2 },
  { code: "TPE 2", title: "Cruise Tourism", programCode: "BSTM", yearLevel: 2, semester: 2 },
  { code: "THC 6", title: "Professional Development and Applied Ethics", programCode: "BSTM", yearLevel: 2, semester: 2 },
  { code: "TPC 7", title: "Foreign Language 1", programCode: "BSTM", yearLevel: 2, semester: 2 },
  { code: "PATHFit 14", title: "Dance, Sports, Group Exercises, Outdoor and Adventure Activities", programCode: "BSTM", yearLevel: 2, semester: 2 },

  // --- THIRD YEAR - FIRST SEMESTER ---
  { code: "TPC 8", title: "Foreign Language 2", programCode: "BSTM", yearLevel: 3, semester: 1 },
  { code: "TPC 9", title: "Research in Tourism 1", programCode: "BSTM", yearLevel: 3, semester: 1 },
  { code: "BME 1", title: "Operations Management in Tourism and Hospitality Industry", programCode: "BSTM", yearLevel: 3, semester: 1 },
  { code: "THC 7", title: "Tourism and Hospitality Marketing", programCode: "BSTM", yearLevel: 3, semester: 1 },
  { code: "TPE 3", title: "Agri Tourism", programCode: "BSTM", yearLevel: 3, semester: 1 },
  { code: "ITRM 1", title: "Ivatan Geography and History", programCode: "BSTM", yearLevel: 3, semester: 1 },

  // --- THIRD YEAR - SECOND SEMESTER ---
  { code: "THC 8", title: "Legal Aspects in Tourism and Hospitality", programCode: "BSTM", yearLevel: 3, semester: 2 },
  { code: "BME 2", title: "Strategic Management in Tourism and Hospitality Industry", programCode: "BSTM", yearLevel: 3, semester: 2 },
  { code: "TPC 9A", title: "Research in Tourism 2", programCode: "BSTM", yearLevel: 3, semester: 2 },
  { code: "THC 9", title: "Multicultural Diversity in Workplace for the Tourism Professional", programCode: "BSTM", yearLevel: 3, semester: 2 },
  { code: "THC 10", title: "Entrepreneurship in Tourism and Hospitality", programCode: "BSTM", yearLevel: 3, semester: 2 },
  { code: "TPC 10", title: "Transportation Management (Covers Air, Land and Sea)", programCode: "BSTM", yearLevel: 3, semester: 2 },

  // --- FOURTH YEAR - FIRST SEMESTER ---
  { code: "TPE 4", title: "Ecotourism Management", programCode: "BSTM", yearLevel: 4, semester: 1 },
  { code: "TPC 6", title: "Introduction to Meetings, Incentives, Conferences and Events Management as Applied to Tourism", programCode: "BSTM", yearLevel: 4, semester: 1 },
  { code: "TPE 5", title: "Travel Writing and Photography", programCode: "BSTM", yearLevel: 4, semester: 1 },
  { code: "ITRM 2", title: "Ivatan Tradition and Culture", programCode: "BSTM", yearLevel: 4, semester: 1 },

  // --- FOURTH YEAR - SECOND SEMESTER ---
  { code: "OJT", title: "Tourism Practicum (min. of 600 hours)", programCode: "BSTM", yearLevel: 4, semester: 2 },
];

export const ALL_CURRICULUMS = [...BSIT_CURRICULUM, ...BSHM_CURRICULUM, ...BSA_CURRICULUM, ...BSTM_CURRICULUM];

/** Gets curriculum items for a given program code & year level */
export function getCurriculumForProgram(programCode: string, yearLevel: number): CurriculumItem[] {
  const codeUpper = programCode.toUpperCase();
  let targetProgram: "BSIT" | "BSHM" | "BSA" | "BSTM" | null = null;

  if (
    codeUpper === "BSINFOTECH" ||
    codeUpper === "BS INFO TECH" ||
    codeUpper.includes("INFORMATION TECHNOLOGY") ||
    codeUpper.includes("INFOTECH")
  ) {
    targetProgram = "BSIT";
  } else if (codeUpper === "BSHM" || (codeUpper.includes("HOSPITALITY") && !codeUpper.includes("TOURISM"))) {
    targetProgram = "BSHM";
  } else if (codeUpper === "BSA" || codeUpper.includes("AGRICULTURE")) {
    targetProgram = "BSA";
  } else if (codeUpper === "BSTM" || codeUpper.includes("TOURISM")) {
    targetProgram = "BSTM";
  }

  if (!targetProgram) return [];

  return ALL_CURRICULUMS.filter(
    (item) => item.programCode === targetProgram && item.yearLevel === yearLevel
  );
}

/**
 * Automatically determines the expected year level (1, 2, 3, or 4) for a course/subject
 * based on official curriculum data or course code conventions.
 */
export function getExpectedYearLevelForCourse(courseCode: string, courseTitle?: string): number | null {
  if (!courseCode) return null;
  const cleanCode = courseCode.trim().toUpperCase();
  const cleanNoSpaces = cleanCode.replace(/\s+/g, "");

  // 1. Check exact or normalized course code match in official curriculum database
  const found = ALL_CURRICULUMS.find(
    (item) => item.code.replace(/\s+/g, "").toUpperCase() === cleanNoSpaces
  );
  if (found) return found.yearLevel;

  // 2. Check title match if code match wasn't found
  if (courseTitle) {
    const cleanTitle = courseTitle.trim().toLowerCase();
    const foundTitle = ALL_CURRICULUMS.find(
      (item) => item.title.trim().toLowerCase() === cleanTitle
    );
    if (foundTitle) return foundTitle.yearLevel;
  }

  // 3. Fallback: Parse 3-4 digit course code convention (e.g. ITM 402 -> Year 4, ITM 203 -> Year 2)
  const numbersMatch = cleanCode.match(/\d{3,4}/);
  if (numbersMatch) {
    const num = parseInt(numbersMatch[0], 10);
    if (num >= 400 && num < 500) return 4;
    if (num >= 300 && num < 400) return 3;
    if (num >= 200 && num < 300) return 2;
    if (num >= 100 && num < 200) return 1;

    const firstDigit = parseInt(numbersMatch[0][0], 10);
    if (firstDigit >= 1 && firstDigit <= 4) return firstDigit;
  }

  return null;
}

