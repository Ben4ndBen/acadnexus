# AcadNexus — Batanes State College Portal

AcadNexus is a secure, role-based academic portal designed for Batanes State College (BSC). It handles student examinations, syllabus alignment, compliance workflows, and institutional performance monitoring.

---

## 🚀 Key Features

1. **Official BSC Branding:** Premium login page utilizing the institutional gold, royal blue, and emerald green theme. Features an inline custom SVG college seal (showcasing Ivatan hills, the lighthouse, and sea waves) and a high-fidelity Batanes landscape banner illustration.
2. **Prisma 7 & Postgres Schema:** Fully synchronized database layout mapping the `USERS` inheritance table to student, faculty, department chair, and director profile tables.
3. **Supabase Auth Integration:** Client and server-side authentication flows. Derives a synthetic email (`${id}@acadnexus.bsc.edu.ph`) to authenticate users seamlessly while storing credentials in the local database.
4. **Role-Based Access Control (RBAC):** Middleware route protection that automatically directs users to their respective portals based on their account type (`Student`, `Faculty`, `Chair`, `Director`) and prevents unauthorized access to other dashboards.
5. **Local Mock Auth Fallback:** A built-in safety net. If `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is not defined in `.env`, the system automatically shifts to a cookie-based mock session using the local database. This enables immediate testing of login pages, dashboards, and redirects offline.
6. **Student Portal Dashboard (Card 4: Tasks 9b, 10):** A tailored academic workspace showing live student metrics (Enrolled Subjects, Exams Completed, and Average Performance). Integrates a **Dynamic Examination Feed** that targets and displays exams filtered specifically for the student's program, year level, section, and course calendar, divided into Live, Upcoming, and Completed sections.
7. **Faculty Profile & Information Management (Task 11):** Interactive Settings tab in the Faculty Portal enabling instructors to update their personal profile info (First/Last name), which is instantly written to the database and logged in the system audits.
8. **Examination Workflow Tracker (Task 12):** Comprehensive dashboard component that groups, filters, and displays the status of all examinations created by the faculty. Utilizes semantic status badges (`Draft`, `Pending Chair`, `Pending DI`, `Approved`, `Returned`), highlights Chair/DI comments for returned exams, displays a step-by-step progress timeline, and enables interactive state transitions (e.g. submit draft, reset returned).
9. **Department Chair Portal (Task 13):** Dynamic multi-tab portal for verifying drafted syllabi and test layouts. Includes an interactive Faculty Progress Tracker (monitoring compliance rates), a Pending Review Queue (for approving or returning exams with feedback comments), and a Syllabus/TOS Verification Checklist tool.
10. **Director for Instruction Portal (Task 14):** Institutional dashboard with a School-Wide Compliance Map tracking department-level compliance metrics, a final-round clearing queue for approving pending examinations, and a searchable Global System Action Log pulling audit events directly from the database.
11. **Real-Time Live Sync & Contrast Tuning:** Configured routes with `force-dynamic` to completely bypass caching for real-time live database updates via Prisma, and tuned color contrast schemas (`text-slate-800` fields) across all dashboard forms and search bars for accessibility.
12. **Interactive Exam Builder Wizard (Task 15):** A multi-step configuration wizard for faculty supporting custom examination titles, course mappings, strict duration timers, item order randomization toggles, and Table of Specifications (TOS) document uploads.
13. **Comprehensive Question Bank (Task 16):** Modular questionnaire builder that handles Multiple Choice, True/False, Identification, and Matching Type questions. Enables dynamic reordering, points configuration, correct answer references, and a high-fidelity printable exam paper preview sheet.
14. **Secure Test-Taking Interface (Card 8: Tasks 17, 18, 19):** Distraction-free examination workspace that hides default navbars/footers. Features a synchronized countdown timer, one-question-at-a-time pagination, and a collapsible color-coded question status grid. Enforces strict anti-cheating window focus and fullscreen monitors (gives up to 2 warnings before auto-submitting under `Cheating_Lockout` and creating audit logs). Implements a low-overhead background auto-save routine checking dirty answer states every 15 seconds. Includes objective question auto-grading.

---

## 🛠️ Architecture & Key Files

```
├── prisma/
│   ├── schema.prisma     # Main Prisma schema defining USERS and profiles
│   └── seed.js           # Database seeding script to set up mock accounts with status variations
├── src/
│   ├── middleware.ts     # Next.js route protection & session refresh logic
│   ├── lib/
│   │   ├── db.ts         # Prisma Client (uses @prisma/adapter-pg for Prisma 7)
│   │   └── supabase/
│   │       ├── client.ts # Supabase client-side browser client helper
│   │       └── server.ts # Supabase server-side client helper (uses Next 16 async cookies)
│   ├── app/
│   │   ├── page.tsx      # BSC-branded login interface (Server Component)
│   │   ├── actions/
│   │   │   ├── auth.ts   # Server Actions (loginAction, logoutAction)
│   │   │   ├── faculty.ts # Server Actions (profile info, exam status, exam/question creation & deletion)
│   │   │   ├── chair.ts  # Server Actions (reviewExamByChair, verifySyllabusAndTOS)
│   │   │   ├── director.ts # Server Actions (reviewExamByDirector)
│   │   │   └── student.ts  # Server Actions (exam state, saves, submission, warning logs)
│   │   ├── components/
│   │   │   ├── LoginForm.tsx    # Handles validation states & input UI (Client Component)
│   │   │   ├── LogoutButton.tsx # Client-side Sign Out handler
│   │   │   ├── FacultyDashboardClient.tsx  # Multi-tab faculty portal (Client Component)
│   │   │   ├── ChairDashboardClient.tsx    # Multi-tab chair portal (Client Component)
│   │   │   ├── DirectorDashboardClient.tsx # Multi-tab director portal (Client Component)
│   │   │   ├── ExamBuilderWizard.tsx       # 3-step interactive exam creator (Client Component)
│   │   │   └── TakeExamClient.tsx          # Distraction-free exam student component (Client Component)
│   │   └── dashboard/    # Portals for each individual role
│   │       ├── student/
│   │       │   ├── page.tsx
│   │       │   └── exam/[examId]/page.tsx # Student secure exam taker route
│   │       ├── faculty/
│   │       │   ├── page.tsx
│   │       │   └── exams/[id]/builder/page.tsx # Interactive Exam Builder route
│   │       ├── chair/
│   │       └── director/
└── public/
    └── bsc-banner.png    # Custom generated landscape branding asset
```

---

## 🗃️ Database Schema Overview

The `User` model uses an inheritance-like structure mapping to specific profiles:

* **User (`USERS`):** Core credentials containing `institutional_id`, `password_hash`, `role` (enum: `Student`, `Faculty`, `Chair`, `Director`), and `supabase_uid`.
* **Student (`STUDENTS`):** Relates to `User`, containing fields for name, year level, section, and program.
* **Faculty (`FACULTY`):** Relates to `User`, containing fields for name, department, exams created, and portfolios.
* **Chair (`CHAIRS`):** Relates to `User`, containing department assignment (1-to-1) and review approvals.
* **Director (`DIRECTORS`):** Relates to `User` for institution-wide final approvals and statistics.

---

## ⚙️ Environment Variables (`.env`)

```ini
# Transaction-mode connection string (used by Next.js runtime connection pool)
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/postgres?pgbouncer=true"

# Session-mode connection string (used by Prisma migrate/db push)
DIRECT_URL="postgresql://<user>:<password>@<host>:<port>/postgres"

# Supabase Auth connection parameters
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="" # Add your Anon/Publishable key here for production auth
```

---

## 💻 Local Setup & Seeding

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Generate Prisma Client
Since Prisma 7 requires explicit driver adapter support, the generator is configured to work with pg. Run:
```bash
npx prisma generate
```

### 3. Sync & Seed Database
Synchronize the schema with your remote database and run the seeder:
```bash
npx prisma db push
node prisma/seed.js
```

### 4. Start Development Server
```bash
pnpm dev
```

---

## 🔑 Test Credentials (Password: `password123`)

| Role | Institutional ID | Expected Destination | Description |
| :--- | :--- | :--- | :--- |
| **Student** | `STUDENT-001` | `/dashboard/student` | Janice Delfin — BSCS Year 4 Section A |
| **Faculty** | `FACULTY-001` | `/dashboard/faculty` | Mark Abad — Department of Computer Studies |
| **Chair** | `CHAIR-001` | `/dashboard/chair` | Department of Computer Studies Chair |
| **Director** | `DIRECTOR-001` | `/dashboard/director` | Office of the Director |
