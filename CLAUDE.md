# Farmatodo Onboarding OS — System Prompt

## Project Vision and Stack

**Goal:** B2B automated onboarding OS for 9,000 employees. UX level: Mercado Libre or Revolut.

**Stack:** Next.js 16 App Router, Prisma v6 (PostgreSQL), Tailwind v4, shadcn/ui, NextAuth v5.

**Rule:** Code and DB strictly in English. UI, Copy and Seeds strictly in Spanish. Corporate Blue: oklch hue ~250 / `#0F4C81`.

---

## Session SOPs (Standard Operating Procedures)

### Session Start Protocol

1. **Sync:** `git pull origin main` (or current branch).
2. **Infrastructure:** `docker start pg-onboarding` (check if running first).
3. **Dev Server:** `npm run dev`.
4. **Context Loading:** Read `tasks/todo.md` for current objectives and `tasks/lessons.md` for past gotchas.

### Session Close Protocol

1. **Teardown:** Stop dev server. Run `docker stop pg-onboarding`.
2. **Documentation:** Update `tasks/todo.md` with progress and `tasks/lessons.md` with any new learnings.
3. **Persistence:** `git add .` → `git commit -m "session-sync: brief description"` → `git push origin main`.

---

## Workflow Rules

- **Plan Node Default:** Enter plan mode for ANY task taking more than 3 steps. Write plan to `tasks/todo.md`. Stop and re-plan if things go sideways.
- **Self-Improvement:** After ANY correction from the user, update `tasks/lessons.md` immediately.
- **Verification Before Done:** Never mark a task complete without proving it works in the browser or via `tsc --noEmit`.

---

## Context Triggers (Read ONLY when applicable)

> **If working on database schema, Prisma, migrations, or core architecture:**
> Read `admin-architecture-plan.md` and `TAD_Farmatodo_Onboarding.md`.

> **If working on UI, UX, styling, or Frontend components:**
> Strict Mobile-first view (`max-w-lg mx-auto`). No vertical scrolling lists on main dashboard.
> Use `bg-[#f5f5f7]` layout structure. Header: `bg-[#0F4C81]` gradient. Focus card overlaps via `-mt-10`.

> **If working on new dashboard tabs or server actions:**
> Dashboard uses separate Next.js pages (`/dashboard/ruta`, `/dashboard/accesos`, `/dashboard/perfil`)
> with shared `dashboard/layout.tsx`. All mutation actions must call
> `revalidatePath("/dashboard", "layout")` to refresh ALL sub-routes.

---

## Staff Engineer Core Rules (Project Invariants)

### Rule 1: Prisma JSONB Null — Use `Prisma.JsonNull`, Never JS `null`
Prisma v6 treats JS `null` as a no-op for JSONB fields — the field silently won't update. When clearing a JSONB field (`conditions`, `contentPayload`, `applicability`), you MUST use `Prisma.JsonNull`. The helper `toJsonField()` in `src/app/actions/template-steps.ts` handles this. When reading JSONB from Prisma, always cast with a fallback: `(field as ContentPayload | null) ?? null` or `(field as ChecklistState) ?? {}`.

### Rule 2: Compiled Journeys Are Immutable — Never Recompile
Once `compileJourney()` creates `UserJourney` + `UserJourneyStep` records, they are frozen. Editing a `TemplateStep` does NOT retroactively update existing user journeys. New template versions only affect future compilations. `compiledFromVersion` is informational only. This is a deliberate architectural decision — not a bug.

### Rule 3: RSC → Client Serialization Boundary Is Strict
When passing data from Server Components to Client Components: Prisma `DateTime` → auto-serialized by Next.js. Prisma `Json` (JSONB) → must be explicitly cast to TypeScript types (`as ContentPayload`, `as ChecklistState`). For string-typed props like `StepDetailSheet.lastNudgedAt`, serialize with `.toISOString()`. Never pass raw `Prisma.JsonValue` to client components without casting.

### Rule 4: Radix UI + TipTap Hydration Guards Are Mandatory
Client components using Radix UI primitives (DropdownMenu, Select, Dialog) MUST include a mounted guard: `const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])` + early `return null`. Without this, SSR produces different IDs than client hydration → React crashes. TipTap's `useEditor` requires `immediatelyRender: false` for the same reason.

### Rule 5: Two-Phase Reorder for Unique-Constrained Indices
`TemplateStep` has `@@unique([journeyTemplateId, orderIndex])`. You cannot swap two steps' `orderIndex` values directly — the unique constraint will reject the intermediate state. The solution: Phase 1 moves all affected steps to negative indices (`-1`, `-2`, ...), Phase 2 moves them to their final positive indices. This is implemented in `reorderSteps()` in `template-steps.ts`. Any new reordering logic must follow this pattern.

---

## Quick Reference

```
URLs:         /dashboard | /dashboard/ruta | /dashboard/accesos | /dashboard/perfil
              /admin | /admin/journeys | /admin/journeys/[id]
Webhook:      POST /api/webhooks/provisioning (Bearer WEBHOOK_SECRET)
DB Container: pg-onboarding (docker start/stop)
GitHub:       https://github.com/omarjperezt/onboarding-app
gh CLI:       /usr/local/Cellar/gh/2.87.3/bin/gh
Env Vars:     DATABASE_URL, WEBHOOK_SECRET, SLACK_WEBHOOK_URL (optional)
shadcn:       card badge progress avatar separator alert button table
              dropdown-menu sheet sonner input textarea select switch
              tabs tooltip dialog label
```
