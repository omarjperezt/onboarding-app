# Developer Lessons and Gotchas

## Prisma v6

- **JSONB null requires `Prisma.JsonNull`:** JS `null` is a silent no-op. Use `toJsonField()` helper in `template-steps.ts`. Always test that JSONB fields actually clear when set to null.
- **Prisma v7 is incompatible:** Requires `adapter` or `accelerateUrl` in constructor. Breaks `new PrismaClient()`. Stay on v6.
- **Seed excluded from tsconfig:** `prisma/seed.ts` is in `tsconfig.json > exclude` to avoid build interference.
- **`prisma migrate reset`** requires `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var when run by AI agents.

## Next.js / React

- **`force-dynamic` on all DB pages:** Dashboard, admin, and journey pages need `export const dynamic = "force-dynamic"` since they query Prisma at runtime.
- **Radix UI hydration mismatch:** Client components using Radix primitives (DropdownMenu, Select, Dialog) need a mounted guard (`useState(false)` + `useEffect(() => setMounted(true), [])` + early return). Applied in `admin-filters.tsx`.
- **TipTap SSR:** `useEditor` needs `immediatelyRender: false` to prevent hydration detection error.
- **`next/dynamic` with `ssr: false` is NOT allowed in Server Components** (Next.js 16).
- **revalidatePath for sub-routes:** Use `revalidatePath("/dashboard", "layout")` — NOT `revalidatePath("/dashboard")`. The latter only revalidates the exact path, not child routes like `/dashboard/ruta`.
- **Date serialization RSC → Client:** Next.js auto-serializes Date objects across the RSC boundary. For string-typed props (like `StepDetailSheet.lastNudgedAt`), use `.toISOString()`.

## JSONB / Content Pipeline

- **ContentPayload casting:** Prisma returns `Json` type. Must cast to `ContentPayload` at the Server Component level: `(step.templateStep.contentPayload as ContentPayload | null) ?? null`.
- **ChecklistState casting:** Same pattern: `(step.checklistState as ChecklistState) ?? {}`.
- **requiresCorporateEmail dual source:** Check `conditions.requiresCorporateEmail` first, fall back to `templateStep.requiresCorporateEmail` direct field.

## UI / Styling

- **shadcn Card fights custom layouts:** The default `gap-6 py-6 border` on shadcn Card conflicts with pixel-perfect layouts. Use raw `div` with explicit padding/shadow for the focus card.
- **Sonner toast:** Hardcoded light theme (no `next-themes` dependency). `import { Toaster } from "@/components/ui/sonner"`.
- **Node v25 module issues:** Can cause resolution problems with some npm packages.

## Architecture

- **Compiled journeys are immutable:** Once `compileJourney()` creates UserJourney + UserJourneyStep records, they are never recompiled. Template edits only affect future compilations.
- **Two-phase reorder:** `TemplateStep` has `@@unique([journeyTemplateId, orderIndex])`. Reorder must use negative indices first, then positive, to avoid unique constraint collisions.
- **DRY identity flip:** Core logic in `process-identity-flip.ts`. Both dev simulator and provisioning webhook call this. Never duplicate flip logic.
- **Step ordering:** Always use `resolvedOrder` (compiled) with fallback to `templateStep.orderIndex`.
