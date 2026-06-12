<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# Agent Instructions & State File

## 🤖 ROLE & SYSTEM PROTOCOLS
You are an advanced full-stack software development agent tasked with building the **Batanes State College Academic Examination & Portal System**. Your architecture stack is explicitly fixed to: Next.js (App Router), TypeScript, Prisma ORM, PostgreSQL, and Supabase (Auth & Realtime).

## 🎯 MANDATORY WORKFLOW
Before every code modification, generation, or structural architectural shift, you **MUST** read, evaluate, and adhere to the project tracking documents:
1. **`ROADMAP.md`**: The absolute checklist source of truth for features and project scope.
2. **`README.md`**: The engineering entry point containing environment settings, architecture, and developer onboarding steps.
3. **Current Project Structure**: Observe your local workspace environment layout to understand existing configurations.

---

## 🔍 AUTOMATIC PROJECT SCANNING PROTOCOL (MANDATORY STARTUP TASK)
**Every time a new session starts, or when explicitly commanded to check progress, you must perform the following steps immediately:**

1. **Perform a Directory Scan:** Inspect the codebase, specifically checking:
   - `prisma/schema.prisma` (to see which tables and fields are already defined).
   - `src/` directory (to check for existing UI components, app routes, layouts, and logic).
   - Package manifests (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`).
2. **Cross-Reference & Sync:** Match your findings against the tasks listed in `ROADMAP.md`.
3. **Auto-Update Checkboxes:** If you find a feature or database model that has already been successfully implemented or has an initial working setup, update its checkbox from `[ ]` to `[x]` in `ROADMAP.md`.
4. **Log to Progress Ledger:** Append a new entry to the **Progress Ledger** table at the bottom of `ROADMAP.md` detailing what you discovered during the scan.
5. **Propose Next Steps:** Present a concise strategy to the user for implementing the very next sequential pending task.

---

## 💾 POST-IMPLEMENTATION & DOCUMENTATION PROTOCOL (COMMIT & README RULES)
**Every time you complete a task, fix a bug, or update a feature, you must execute this protocol before ending your turn:**

1. **Update `ROADMAP.md`**: Mark the task as complete (`[x]`) and log it down in the Progress Ledger with the format: `[Task ID] Short description of what changed`.
2. **Update `README.md`**: If your code introduced new environment variables (`.env`), new packages/dependencies, database schema updates (`npx prisma migrate`), or new folder structures under `src/`, you **MUST** document it immediately in the `README.md`. Keep it friendly for the next developer or agent.
3. **Generate Git Commit Message:** Provide the user with a clean, semantic Git command that they can run to save your changes. Use the **Conventional Commits** format:
   - `feat(scope): ...` for new features.
   - `fix(scope): ...` for bug fixes.
   - `docs(scope): ...` for documentation modifications (like README/ROADMAP).
   
   *Example output format for the user:*
   ```bash
   git add .
   git commit -m "feat(database): implement TPT user inheritance and update schema"