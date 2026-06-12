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
- [ ] **Task 12:** Create the Examination Workflow Tracker UI using semantic status badges (`Draft`, `Pending Chair`, `Pending DI`, `Approved`, `Returned`).

##### **Card 6: Administrative Portals**
- [ ] **Task 13:** Build the Department Chair dashboard (incorporating a Faculty Progress Tracker, Pending Review Queue, and Syllabus/TOS Verification Tool).
- [ ] **Task 14:** Build the Director for Instruction (DI) dashboard (featuring a School-Wide Compliance Map and global System Action Logs).

---

#### EPIC 3: Examination Engine Development (Phase 3)
##### **Card 7: Exam Creation (Faculty Component)**
- [ ] **Task 15:** Build the interactive exam builder wizard for configuration settings (titles, strict time limits, and Table of Specifications (TOS) file attachment uploads).
- [ ] **Task 16:** Develop a comprehensive Question Bank system supporting Multiple Choice, True/False, Identification, and Matching Type questions, with a structural metadata toggle to randomize items.

##### **Card 8: Secure Test-Taking Interface (Student Component)**
- [ ] **Task 17:** Build a distraction-free examination UI featuring a synchronized countdown timer, one-question-at-a-time pagination, and a color-coded question status navigation sidebar.
- [ ] **Task 18:** Implement an automated, low-overhead background save routine that periodically checkpoints `STUDENT_ANSWERS` to prevent data loss.
- [ ] **Task 19:** Implement strict anti-cheating/lock-down measures: Enforce full-screen mode upon initialization, monitor visibility/focus transitions, and trigger immediate auto-submission with logging if the timer expires, if the user leaves full screen, or switches windows (`Alt+Tab`).

##### **Card 9: Auto-Grading & Assessment Logic**
- [ ] **Task 20:** Write optimized database or serverless functions to instantly cross-check objective responses against the `correct_answer` schema in the `QUESTION_BANK`.
- [ ] **Task 21:** Ensure subjective essay answers gracefully retain an un-evaluated state (`Pending Evaluation`) until manually graded by the respective instructor.

---

#### EPIC 4: Workflows, Tracking, & Notifications (Phase 3)
##### **Card 10: Two-Tier Approval State Machine**
- [ ] **Task 22:** Create state-machine operations allowing Department Chairs to submit audit comments and toggle examination states to `Approved` or `Returned`.
- [ ] **Task 23:** Implement the DI "Pass-Through Clearance" optimization—when a Chair marks an exam as approved, it automatically goes live for targeted students unless a global administrative hold is explicitly applied.

##### **Card 11: Real-Time Alerts & Communications**
- [ ] **Task 24:** Implement a unified real-time notification layer (using Supabase Realtime broadcast channels or PostgreSQL listen/notify streams).
- [ ] **Task 25:** Create system event triggers for specific contextual alerts (upcoming exams for students, new review assignments for chairs, approval/return status updates for faculty).

##### **Card 12: Faculty Portfolios & Audit Logs**
- [ ] **Task 26:** Automate asynchronous `FACULTY_PORTFOLIOS` aggregation rules to log submittal frequencies and compliance timelines.
- [ ] **Task 27:** Guarantee all security-critical transactions (authentication events, examination approvals, anti-cheating lockout incidents) log immutably to the `AUDIT_LOGS` table.

---

#### EPIC 5: Testing, Evaluation, & Deployment (Phases 4 & 5)
##### **Card 13: Quality Assurance & System Testing**
- [ ] **Task 28:** Conduct granular functional testing for the examination targeting engine (verifying total isolation of test visibility across student sections).
- [ ] **Task 29:** Execute load and integration tests, focusing specifically on concurrent database write patterns caused by the auto-save worker.

##### **Card 14: Release Engineering & Documentation**
- [ ] **Task 30:** Synthesize technical documentation, environment configuration manifests, and system runtime runbooks.
- [ ] **Task 31:** Configure automated CI/CD deployment pipelines to host the front-end application layer on Vercel and upgrade the Supabase datastore instance to production tiering.

---

## 🪵 PROGRESS LEDGER

| Date | Task ID | Description of Changes / Implementation Details | Status |
| :--- | :--- | :--- | :--- |
| 2026-06-12 | Task 4, 5, 6a, 6b | Initialized Prisma database schema containing polymorphic users, academic hierarchy, examination engine, and workflows. Successful PostgreSQL remote sync. | Completed |
| 2026-06-12 | Task 7, 8, 9a | Implemented BSC-branded high-fidelity login interface with role-based redirection middleware. Set up local cookie-based mock session fallback for offline development. | Completed |
| 2026-06-12 | Task 11 | Created Faculty Portal profile card and compliance portfolio layout powered by actual database relations. | Completed |
| 2026-06-12 | Task 9b, 10 | Implemented Student Portal with academic summary cards (metrics: subjects enrolled, exams completed, average performance) and a dynamically targeted examination feed split into active, upcoming, and completed lists. | Completed |