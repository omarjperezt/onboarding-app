# Chunk 5 Execution Plan — Reconnecting the Journey Timeline

> **Status:** AWAITING APPROVAL — Do not implement until explicitly approved.
> **Date:** 2026-02-24
> **Scope:** Chunk 5B (Ruta Tab) + Chunk 5C (Accesos Tab)

---

## 1. Routing Strategy

### Decision: Separate Next.js Pages with Shared Dashboard Layout

Each bottom nav tab becomes its own route under `/dashboard/`:

```
src/app/dashboard/
├── layout.tsx          ← NEW: shared bottom nav + DevSimulator
├── page.tsx            ← REFACTORED: Inicio tab (header + focus card + quick access)
├── ruta/
│   └── page.tsx        ← NEW: Chunk 5B — full journey timeline
├── accesos/
│   └── page.tsx        ← NEW: Chunk 5C — digital wallet
└── perfil/
    └── page.tsx        ← STUB: placeholder for future Chunk 5D
```

### Why Separate Pages (Not Client-Side Tab State)

| Criterion | Separate Pages (Recommended) | Client-Side Tabs |
|---|---|---|
| **SSR Data Fetching** | Each page fetches only what it needs via Server Components. Ruta doesn't load accessProvisionings; Accesos doesn't load journey steps. | Single monolithic query fetches everything upfront, wasting bandwidth on inactive tabs. |
| **Code Splitting** | JourneyStepCard + ContentBlockRenderer JS only loads on `/ruta`. AccessList JS only loads on `/accesos`. | All tab code ships to client on initial load regardless of active tab. |
| **Deep Linking & PWA** | URLs are shareable and bookmarkable (`/dashboard/ruta`). Browser back button works natively. PWA manifest can link directly to tabs. | URL stays at `/dashboard` — no deep linking, back button doesn't navigate between tabs. |
| **Server Components** | Each `page.tsx` is a Server Component with direct Prisma access. Zero client JS for static content. | Would require lifting all data fetching to a parent and passing down, or using client-side fetching (slower). |
| **Consistency** | Mirrors the admin section pattern (`/admin/layout.tsx` + child pages). | Introduces a different pattern, harder to maintain. |
| **"Modern OS" Feel** | Next.js prefetching + `<Link>` makes tab switches near-instant. Combined with `loading.tsx` skeletons, feels native. | Slightly faster initial tab switch (no network), but no SSR benefits and heavier initial load. |

### Navigation Architecture

The bottom nav bar moves from `page.tsx` to `layout.tsx` as a **Client Component** (needs `usePathname()` for active state detection):

```
dashboard/layout.tsx (Server Component)
├── {children}              ← Tab page content
├── <BottomNav />           ← Client Component (Link + usePathname)
└── <DevSimulator />        ← Client Component (dev-only, fixed position)
```

The `BottomNav` client component:
- Uses `next/link` for `<Link href="/dashboard/ruta">` etc.
- Uses `usePathname()` to determine which tab is active
- Preserves current styling: fixed bottom, safe-area padding, blue active circle
- `prefetch={true}` (default) ensures instant tab switches

---

## 2. Component Reusability

### 2A. JourneyStepCard — Adaptation for "Ruta" View

The existing `JourneyStepCard` (`src/components/journey/journey-step-card.tsx`, 357 lines) is **fully reusable** for the Ruta tab. It already supports:
- Timeline connector (vertical line between steps)
- Status badges (COMPLETED/PENDING/LOCKED)
- Rich content blocks via `ContentBlockRenderer`
- Nudge button for APPROVAL steps
- Hard gate overlay for identity-gated steps
- Legacy fallback for steps without `contentPayload`

**Adaptations needed for "Modern OS" Ruta view:**

1. **No changes to `JourneyStepCard` itself.** The component's visual language (rounded cards, emerald/amber/gray palette, timeline connector) already fits the premium aesthetic.

2. **New wrapper in Ruta page:** The page will render a styled container around the step list with:
   - A page header (title "Tu Ruta", progress summary)
   - Section grouping labels if desired (optional — can be added in a future iteration)
   - Proper spacing (`space-y-0` since cards handle their own `mb-3`)

3. **StepDetailSheet integration:** Each JourneyStepCard's content is already expandable inline. For the Ruta view, tapping a PENDING step card should open the same `StepDetailSheet` for consistency with the Inicio tab's CTA behavior. This means wrapping each PENDING card in a clickable area that triggers the sheet.

### 2B. AccessList — Upgrade for "Accesos" Digital Wallet

The existing `AccessList` (`src/components/journey/access-list.tsx`, 83 lines) renders a basic list. For the "Accesos" tab, we have two options:

**Option A — Enhance AccessList** (Recommended):
- Refactor `AccessList` into individual `AccessCard` components
- Each card is a standalone white card (`rounded-2xl`, shadow) matching the Quick Access grid aesthetic
- Add system-specific icons (e.g., Google icon for Workspace, generic for others)
- Keep the existing status config (PROVISIONED/REQUESTED/REVOKED)
- Add a card header section showing total count and active count

**Option B — New component from scratch:**
- Overkill for MVP. The existing component has the right data interface; it just needs a visual upgrade.

### 2C. Components Extracted from Dashboard → Layout

These move from `dashboard/page.tsx` to the shared layout or become standalone:

| Component | Current Location | New Location | Reason |
|---|---|---|---|
| `BottomNavItem` | Local function in `page.tsx` | `src/components/dashboard/bottom-nav.tsx` (Client Component) | Shared across all tabs, needs `usePathname()` |
| `QuickAccessCard` | Local function in `page.tsx` | Stays in `page.tsx` | Only used on Inicio tab |
| `DevSimulator` | Rendered in `page.tsx` | Rendered in `layout.tsx` | Must persist across tab navigation |

---

## 3. Data Fetching Architecture

### Per-Page Fetching Strategy

Each tab page is a Server Component that makes its own focused Prisma query. This avoids over-fetching and keeps each page's data requirements explicit.

```
/dashboard (Inicio)
  └── getDashboardData()
      ├── user: { fullName, personalEmail, corporateEmail, ssoAuthenticatedAt, position }
      ├── cluster: { name, country }
      ├── journeys[0].steps: (only to compute progressPercentage + find nextPendingStep)
      └── journeys[0].steps[0].templateStep: { title, description, contentPayload, stepType, conditions }

/dashboard/ruta
  └── getRutaData()
      ├── user: { id, fullName, corporateEmail, personalEmail, ssoAuthenticatedAt, position }
      ├── cluster: { name, country }
      └── journeys[0]: {
            status, progressPercentage,
            steps: ALL (with templateStep includes),
            journeyTemplate: { name }
          }

/dashboard/accesos
  └── getAccesosData()
      ├── user: { id, fullName, corporateEmail }
      └── accessProvisionings: ALL (systemName, status, jiraTicketId, createdAt)

/dashboard/perfil (stub)
  └── getPerfilData()
      ├── user: ALL fields
      └── cluster: { name, country }
```

### Shared User Context for Layout

The layout needs `userId` for `DevSimulator`. Two approaches:

**Option A — Fetch in layout** (Recommended):
- `dashboard/layout.tsx` makes a minimal Prisma query: `prisma.user.findFirst({ select: { id: true } })`.
- This is a single small query, cached by Next.js request deduplication within the same render cycle.
- DevSimulator receives `userId` from the layout.

**Option B — Pass via searchParams/cookies:**
- Unnecessary complexity. Server Components in the layout can query Prisma directly.

### Serialization Rules

When passing data from Server Components to Client Components:
- `Date` objects must be serialized to ISO strings (`.toISOString()`)
- `Json` (Prisma JSONB) fields must be cast to their TypeScript types (`as ContentPayload`)
- Use `Prisma.JsonNull` awareness: check for `null` before casting
- `ChecklistState` is `Record<string, boolean>` — safe to pass directly

---

## 4. Step-by-Step Execution Plan

### Phase 0 — Structural Refactor (Shared Layout)

- [ ] **0.1** Create `src/components/dashboard/bottom-nav.tsx`
  - Client Component (`"use client"`)
  - Extract `BottomNavItem` from `dashboard/page.tsx`
  - Replace `<button>` with `<Link>` from `next/link`
  - Use `usePathname()` to compute `active` state
  - Path mapping: `/dashboard` → Inicio, `/dashboard/ruta` → Ruta, `/dashboard/accesos` → Accesos, `/dashboard/perfil` → Perfil
  - Preserve all existing styles (fixed bottom, safe-area, blue circle active state)

- [ ] **0.2** Create `src/app/dashboard/layout.tsx`
  - Server Component
  - Minimal Prisma query: fetch `userId` for DevSimulator
  - Render `{children}` + `<BottomNav />` + `<DevSimulator />` (dev-only)
  - Apply shared page background `bg-[#f5f5f7]` and `pb-24` (bottom nav clearance)
  - Apply `max-w-lg mx-auto` mobile viewport constraint

- [ ] **0.3** Refactor `src/app/dashboard/page.tsx`
  - Remove `BottomNavItem` local component (now in `bottom-nav.tsx`)
  - Remove the `<nav>` bottom navigation block (now in `layout.tsx`)
  - Remove `DevSimulator` rendering (now in `layout.tsx`)
  - Remove `pb-24` and `bg-[#f5f5f7]` from root div (now in `layout.tsx`)
  - Remove `max-w-lg` constraint from `<main>` tag if duplicated by layout
  - Keep all Prisma fetching, header, focus card, and quick access grid intact

- [ ] **0.4** Verify Inicio tab works identically after refactor
  - Navigate to `http://localhost:3000/dashboard`
  - Confirm: header, focus card, quick access grid, bottom nav, DevSimulator all render
  - Confirm: "Comenzar Mision" CTA opens StepDetailSheet
  - Confirm: Inicio tab shows as active in bottom nav

### Phase 1 — Chunk 5B: "Ruta" Tab (Journey Timeline)

- [ ] **1.1** Create `src/app/dashboard/ruta/page.tsx`
  - Server Component with `export const dynamic = "force-dynamic"`
  - `getRutaData()`: Prisma query for user + cluster + journeys with all steps + templateSteps
  - Compute: `progressPercentage`, `hasCorporateEmail`, `hardGateActive`, `userVariables`

- [ ] **1.2** Build the Ruta page layout
  - Page header: white section with "Tu Ruta" title, journey template name, progress bar + percentage
  - Steps container: vertical timeline using `JourneyStepCard` for each step
  - Pass all required props per card: `orderIndex`, `title`, `description`, `contentUrl`, `stepType`, `status`, `requiresCorporateEmail`, `completedAt`, `isLast`, `isIdentityStep`, `hardGateActive`, `contentPayload`, `userVariables`, `userJourneyStepId`, `checklistState`, `lastNudgedAt`
  - Empty state if no journey is compiled yet

- [ ] **1.3** Add tap-to-expand for PENDING steps
  - Wrap each PENDING `JourneyStepCard` with a clickable trigger that opens `StepDetailSheet`
  - COMPLETED and LOCKED steps are not expandable (content visible inline for COMPLETED, hidden for LOCKED)
  - This keeps behavioral consistency with the Inicio tab's "Comenzar Mision" pattern

- [ ] **1.4** Verify Ruta tab end-to-end
  - Navigate to `/dashboard/ruta`
  - Confirm: all compiled steps render in correct order
  - Confirm: COMPLETED steps show green timeline, PENDING amber, LOCKED gray
  - Confirm: nudge button appears on identity APPROVAL step
  - Confirm: StepDetailSheet opens on PENDING step tap
  - Confirm: bottom nav shows "Ruta" as active
  - Confirm: tab switching between Inicio ↔ Ruta is instant (prefetch)

### Phase 2 — Chunk 5C: "Accesos" Tab (Digital Wallet)

- [ ] **2.1** Create `src/app/dashboard/accesos/page.tsx`
  - Server Component with `export const dynamic = "force-dynamic"`
  - `getAccesosData()`: Prisma query for user + accessProvisionings
  - Compute: counts by status (provisioned, requested, revoked)

- [ ] **2.2** Build the Accesos page layout
  - Page header: "Tus Accesos" title, summary pills showing count by status (e.g., "3 Activos", "1 Pendiente")
  - Card grid: each `AccessProvisioning` as a standalone card
  - Card design: white `rounded-2xl` card, system icon (left), system name (bold), status badge (right), Jira ticket link (if present), provisioned date
  - Status styling: PROVISIONED = emerald dot + "Activo", REQUESTED = amber dot + "Pendiente", REVOKED = red dot + "Revocado"
  - Empty state: friendly message if no access provisionings exist

- [ ] **2.3** Refactor `access-list.tsx` → `access-card.tsx`
  - Rename and restructure to render individual cards instead of a flat list
  - Keep existing `AccessItem` interface and status config
  - New visual: each card is a standalone elevated element matching the Quick Access grid aesthetic
  - Export both `AccessCard` (single) and `AccessCardGrid` (container) components

- [ ] **2.4** Verify Accesos tab end-to-end
  - Navigate to `/dashboard/accesos`
  - Confirm: all access provisionings render with correct status
  - Confirm: Jira ticket IDs display where present
  - Confirm: empty state renders gracefully
  - Confirm: bottom nav shows "Accesos" as active

### Phase 3 — Perfil Stub + Final Polish

- [ ] **3.1** Create `src/app/dashboard/perfil/page.tsx`
  - Minimal stub: user name, email, cluster, country, status badge
  - "Cerrar Sesion" button placeholder (non-functional until auth is wired)
  - This is a structural placeholder — full implementation deferred to Chunk 5D

- [ ] **3.2** Cross-tab navigation smoke test
  - Verify all 4 tabs navigate correctly and show active state
  - Verify DevSimulator persists across tab switches
  - Verify identity flip simulation from DevSimulator triggers revalidation on all tabs
  - Verify no hydration errors in browser console

- [ ] **3.3** Commit and push
  - Commit message: `feat: chunk 5 — ruta, accesos, perfil tabs with shared dashboard layout`

---

## 5. File Change Summary

| File | Action | Description |
|---|---|---|
| `src/components/dashboard/bottom-nav.tsx` | CREATE | Client Component: Link-based bottom nav with usePathname |
| `src/app/dashboard/layout.tsx` | CREATE | Shared layout: children + BottomNav + DevSimulator |
| `src/app/dashboard/page.tsx` | MODIFY | Remove nav, DevSimulator, extract shared styles to layout |
| `src/app/dashboard/ruta/page.tsx` | CREATE | Full journey timeline with JourneyStepCard |
| `src/app/dashboard/accesos/page.tsx` | CREATE | Digital wallet with AccessCard grid |
| `src/app/dashboard/perfil/page.tsx` | CREATE | Minimal user profile stub |
| `src/components/journey/access-list.tsx` | MODIFY → RENAME | Refactor to card-based AccessCard + AccessCardGrid |
| `src/components/journey/step-detail-sheet.tsx` | NO CHANGE | Reused as-is on Ruta tab |
| `src/components/journey/journey-step-card.tsx` | NO CHANGE | Reused as-is on Ruta tab |
| `CLAUDE.md` | UPDATE | Reflect Chunk 5 planning/implementation status |

---

## 6. Risk Assessment

| Risk | Mitigation |
|---|---|
| Layout refactor breaks existing Inicio tab | Phase 0.4 is a dedicated verification step before proceeding |
| DevSimulator `revalidatePath("/dashboard")` doesn't revalidate sub-routes | Test explicitly. If needed, revalidate `/dashboard/ruta` and `/dashboard/accesos` in server actions too |
| Bottom nav `usePathname()` causes full page re-render | `BottomNav` is an isolated Client Component; layout itself stays Server Component. Only the nav re-renders on navigation. |
| JSONB serialization errors when passing to client components | Established pattern from Inicio tab (cast `as ContentPayload`, serialize Dates to ISO strings). Apply same pattern. |
| Prefetch causes unnecessary DB queries on initial load | Next.js prefetches lazily (on hover/viewport). Acceptable for 4 lightweight pages. |
