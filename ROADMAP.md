# System Development Roadmap & Checklist
## Project: Batanes State College Academic Examination & Portal System

> **Agent Instruction:** Use this file as the absolute source of truth for project progress. Before writing code or proposing features, read this file to determine the next task. Update the checkboxes (`[ ]` to `[x]`) as you implement features, and log your completions in the **Progress Ledger** at the bottom.

---

### 📋 EPICS & CARDS CHECKLIST

#### EPIC 1: System Design & Database Setup (Phases 1 & 2)
##### **Card 2: Database Modeling (Prisma Schema)**
- [x] **Task 4:** Implement Table-per-Type (TPT) or optimized polymorphic role structure in Prisma for the `USERS` table, extending roles to `STUDENTS`, `FACULTY`, `CHAIRS`, and `DIRECTORS`.
- [x] **Task 5:** Create relational tables for the Academic Hierarchy (`DEPARTMENTS`, `ACADEMIC_PROGRAMS`, `COURSES`).
- [x] **Task 6a:** Create the Examination Engine tables (`EXAMINATIONS`, `EXAM_TARGETS`, `QUESTION_BANK`).
- [x] **Task 6b:** Set up performance, workflow, and system logs (`STUDENT_EXAMS`, `STUDENT_ANSWERS`, `FACULTY_PORTFOLIOS`, `APPROVAL_WORKFLOWS`, `AUDIT_LOGS`).

---

#### EPIC 2: Central Authentication & Portals (Phase 3)
##### **Card 3: Central Login & Security**
- [x] **Task 7:** Build a polished login UI with unified Batanes State College (BSC) branding.
- [x] **Task 8:** Implement Supabase Auth integrated with the Prisma `USERS` table to verify institutional IDs and credentials.
- [x] **Task 9a:** Add robust server-side and client-side role-based redirection logic to route users dynamically to their respective dashboards upon login.

##### **Card 4: Student Portal**
- [x] **Task 9b:** Build the student header dashboard and core metrics/academic summary cards (enrolled subjects, average examination performance).
- [x] **Task 10:** Create the **Dynamic Examination Feed** targeting logic (only fetch/display exams matching the student's exact program, year level, section, and enrolled courses).

##### **Card 5: Faculty Portal**
- [x] **Task 11:** Build the Profile and Information Management section.
- [x] **Task 12:** Create the Examination Workflow Tracker UI using semantic status badges (`Draft`, `Pending Chair`, `Pending DI`, `Approved`, `Returned`).

##### **Card 6: Administrative Portals**
- [x] **Task 13:** Build the Department Chair dashboard (incorporating a Faculty Progress Tracker, Pending Review Queue, and Syllabus/TOS Verification Tool).
- [x] **Task 14:** Build the Director for Instruction (DI) dashboard (featuring a School-Wide Compliance Map and global System Action Logs).

---

#### EPIC 3: Examination Engine Development (Phase 3)
##### **Card 7: Exam Creation (Faculty Component)**
- [x] **Task 15:** Build the interactive exam builder wizard for configuration settings (titles, strict time limits, and Table of Specifications (TOS) file attachment uploads).
- [x] **Task 16:** Develop a comprehensive Question Bank system supporting Multiple Choice, True/False, Identification, and Matching Type questions, with a structural metadata toggle to randomize items.

##### **Card 8: Secure Test-Taking Interface (Student Component)**
- [x] **Task 17:** Build a distraction-free examination UI featuring a synchronized countdown timer, one-question-at-a-time pagination, and a color-coded question status navigation sidebar.
- [x] **Task 18:** Implement an automated, low-overhead background save routine that periodically checkpoints `STUDENT_ANSWERS` to prevent data loss.
- [x] **Task 19:** Implement strict anti-cheating/lock-down measures: Enforce full-screen mode upon initialization, monitor visibility/focus transitions, and trigger immediate auto-submission with logging if the timer expires, if the user leaves full screen, or switches windows (`Alt+Tab`).

##### **Card 9: Auto-Grading & Assessment Logic**
- [ ] **Task 20:** Write optimized database or serverless functions to instantly cross-check objective responses against the `correct_answer` schema in the `QUESTION_BANK`.
- [ ] **Task 21:** Ensure subjective essay answers gracefully retain an un-evaluated state (`Pending Evaluation`) until manually graded by the respective instructor.

---

#### EPIC 4: Workflows, Tracking, & Notifications (Phase 3)
##### **Card 10: Two-Tier Approval State Machine**
- [x] **Task 22:** Create state-machine operations allowing Department Chairs to submit audit comments and toggle examination states to `Approved` or `Returned`.
- [x] **Task 23:** Implement the DI "Pass-Through Clearance" optimization—when a Chair marks an exam as approved, it automatically goes live for targeted students unless a global administrative hold is explicitly applied.

##### **Card 11: Real-Time Alerts & Communications**
- [x] **Task 24:** Implement a unified real-time notification layer (using Supabase Realtime broadcast channels or PostgreSQL listen/notify streams).
- [x] **Task 25:** Create system event triggers for specific contextual alerts (upcoming exams for students, new review assignments for chairs, approval/return status updates for faculty).

##### **Card 12: Faculty Portfolios & Audit Logs**
- [ ] **Task 26:** Automate asynchronous `FACULTY_PORTFOLIOS` aggregation rules to log submittal frequencies and compliance timelines.
- [ ] **Task 27:** Guarantee all security-critical transactions (authentication events, examination approvals, anti-cheating lockout incidents) log immutably to the `AUDIT_LOGS` table.

---

#### EPIC 5: Midterm Safeguards, Restrictions & Test Banking (Phase 3.5)
##### **Card 13: Core Structural Credentials**
- [ ] **Task 28:** Create a deterministic username generation engine for faculty using the formula: 2 first letters + 1 middle name letter + 2 or 3 last name letters (e.g., `miAgCa`), requiring a password update immediately after signing up.
- [ ] **Task 29:** Implement a secure account configuration dashboard that captures institutional emails and profile images for faculty dashboard identity cards.

##### **Card 14: Connectivity Safeguards & Clocks**
- [x] **Task 30:** Implement a continuous, item-by-item auto-saving routine that captures student inputs per question to prevent data loss.
- [x] **Task 31:** Build a connection-loss state lock that stops the clock, saves remaining time, and allows students to safely take the exam again after a forced exit or device shutdown without resetting their progress.
- [x] **Task 32:** Configure individualized duration logic that grants a student their full fixed exam duration upon starting, even if they log in right before the global testing window deadline.

##### **Card 15: Exam Security & Content Add-ons**
- [ ] **Task 33:** Program focus-exit tracking scripts that notify instructors of attempted exits or tab-switches, executing automatic time or score penalties for live exams.
- [ ] **Task 34:** Upgrade the questionnaire building system to allow rich-text attachments, enabling faculty to embed images and mathematical equations directly into test items.

##### **Card 16: Workflow Gatekeepers & Metrics**
- [ ] **Task 35:** Deploy a strict validation rule that requires a pre-completed TOS file to be uploaded before a faculty member can proceed to the examination review stage.
- [ ] **Task 36:** Build institutional compliance trackers to log administrative metrics, specifically auditing the turnaround time taken to approve an exam and the total frequency of revision returns.

##### **Card 17: Signatures & Holds**
- [ ] **Task 37:** Implement permanent frontend visual markers reading `“Digitally Signed by —”` that affix onto the examination data footprint once verified by the Chairperson and Director for Instruction.
- [ ] **Task 38:** Enforce a validation rule on the Director’s portal that mandates the inclusion of written remarks explaining the hold status before an exam can be placed on "Hold".

##### **Card 18: Grading Matrix Rules**
- [ ] **Task 39:** Program the scoring engine to automatically reveal objective scores to students on screen immediately after final submission.
- [ ] **Task 40:** Design the master Grading Sheet view to display exact student scores, incorporating a security rule that permanently disables the data entry rows once the institutional grading submission timeline closes.

##### **Card 19: Course-Based Test Banking**
- [ ] **Task 41:** Restructure the Question Bank repository to store and categorize question content per course, topic, and year level for rapid filtering.
- [ ] **Task 42:** Establish an archival system that securely stores historical exam content, allowing faculty members to modify and reuse previous test assets for the next school year if they handle the same course.

---

#### EPIC 6: User Onboarding, Scheduling Overrides & Live Feeds (Phase 3.6)
##### **Card 20: Public Registration Portal**
- [x] **Task 43:** Build a secure, branded registration sign-up screen that allows students to register via their unique ID numbers and handles role-based onboarding.
- [x] **Task 44:** Re-engineer review panels to allow the Department Chairperson to leave itemized comments and granular feedback per specific question number.

##### **Card 21: Calendar Configuration Overrides**
- [ ] **Task 45:** Fix calendar interface responsiveness so that clicking "schedule" on an already scheduled exam displays the saved date and time instead of rendering blank.
- [ ] **Task 46:** Create an override engine that allows faculty to view approved and scheduled exams, with tools to change dates, hours, and testing windows to correct misclicks or conflicts.
- [ ] **Task 47:** Develop an administrative override trigger that allows instructors to handle individual requests to reset access for students who completely missed the testing window.

##### **Card 22: Live Monitoring Status Tabs**
- [ ] **Task 48:** Restructure the Faculty Feed with organized navigation tabs separating exams by operational status: Drafts/Pending, Scheduled, Ongoing Live, and Finished.
- [ ] **Task 49:** Create a real-time examinee monitoring roster within the Ongoing Live tab, allowing instructors to click an exam to see who is currently taking the test and who has already finished taking it.

##### **Card 23: Optimized Student Layout**
- [ ] **Task 50:** Implement a sticky, non-scrolling left-hand sidebar navigation on the student dashboard layout to maximize user convenience.
- [ ] **Task 51:** Populate the student sidebar with dedicated, consolidated widget blocks for missed exams, upcoming exams, and evaluation/continuous performance trends to eliminate vertical scrolling.

---

#### EPIC 7: Testing, Evaluation, & Deployment (Phases 4 & 5)
##### **Card 24: Quality Assurance & System Testing**
- [ ] **Task 52:** Conduct granular functional testing for the examination targeting engine (verifying total isolation of test visibility across student sections).
- [ ] **Task 53:** Execute load and integration tests, focusing specifically on concurrent database write patterns caused by the auto-save worker.

##### **Card 25: Release Engineering & Documentation**
- [ ] **Task 54:** Synthesize technical documentation, environment configuration manifests, and system runtime runbooks.
- [ ] **Task 55:** Configure automated CI/CD deployment pipelines to host the front-end application layer on Vercel and upgrade the Supabase datastore instance to production tiering.

---

## 🪵 PROGRESS LEDGER

| Date | Task ID | Description of Changes / Implementation Details | Status |
| :--- | :--- | :--- | :--- |
| 2026-06-12 | Task 4, 5, 6a, 6b | Initialized Prisma database schema containing polymorphic users, academic hierarchy, examination engine, and workflows. Successful PostgreSQL remote sync. | Completed |
| 2026-06-12 | Task 7, 8, 9a | Implemented BSC-branded high-fidelity login interface with role-based redirection middleware. Set up local cookie-based mock session fallback for offline development. | Completed |
| 2026-06-12 | Task 11 | Created Faculty Portal profile card and compliance portfolio layout powered by actual database relations. | Completed |
| 2026-06-12 | Task 9b, 10 | Implemented Student Portal with academic summary cards (metrics: subjects enrolled, exams completed, average performance) and a dynamically targeted examination feed split into active, upcoming, and completed lists. | Completed |
| 2026-06-12 | Task 11, 12 | Built Faculty Portal Profile and Information Management form and implemented the Examination Workflow Tracker with interactive transitions, status badges, timelines, and review comments. | Completed |
| 2026-06-12 | Task 13, 14 | Built Department Chair and Director for Instruction (DI) dashboards featuring Faculty Progress Tracker, Review Queues, Syllabus/TOS Verification Tool, Compliance Map, and System Action Logs. | Completed |
| 2026-06-12 | Task 15, 16 | Implemented interactive Exam Creator Wizard (Step 1 Configuration with TOS Upload) and Question Bank Builder (Step 2 MCQ/TF/ID/Matching, Step 3 Preview & Submit) under `/exams/[id]/builder`. | Completed |
| 2026-06-12 | Task 17, 18, 19 | Built Secure Test-Taking Interface including Entry Gate, Fullscreen/Focus lockdown (3 attempts warning system), background auto-save checkpoints, and objective auto-grading. | Completed |
| 2026-06-29 | Task 22, 23 | Implemented Chair approval/return toggles with comments, and Director's Pass-Through Clearance optimization with global and individual administrative holds. | Completed |
| 2026-07-01 | Task 24, 25 | Implemented floating notification bell component with Supabase Realtime and polling fallback, and deployed Postgres triggers for student, faculty, and chair alerts. | Completed |
| 2026-07-04 | Task 43, 44 | Integrated secure, real-time client & server validations on the student registration portal and re-engineered the department chair review queue with per-question toggles and granular feedback metrics. | Completed |
| 2026-07-04 | Task 30, 31, 32 | Implemented continuous item-by-item exam auto-saving, debounced free-text saves, database timer state lock heartbeat loop (every 10 seconds), resilient exam resume logic, and individualized duration tracking. | Completed |

