# CLAUDE.md — Farmatodo Onboarding OS

## Visión del Proyecto

Estamos construyendo **Farmatodo Onboarding OS**, una WebApp Mobile-First (PWA) que actúa como orquestador de estados para el ciclo de vida del empleado en Farmatodo (9000 usuarios en Venezuela, Colombia y Argentina). El sistema **no es el Source of Truth de identidad** (eso es AD/Google Workspace); es la capa de experiencia que reacciona a eventos vía webhooks de Jira ITSM. Su mecánica central es el "Flip de Identidad": el empleado inicia con su correo personal (Magic Link), y cuando TI crea su cuenta @farmatodo.com, el sistema fuerza la transición a SSO corporativo como zanahoria para adoptar la identidad requerida por la SuperApp interna.

## Arquitectura y Stack Técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Server Components para queries directos a DB |
| UI | TailwindCSS v4 + shadcn/ui | Farmatodo corporate blue theme (oklch hue ~250, two-tone blue palette) |
| Rich Text | TipTap v3 (`@tiptap/react`, `starter-kit`, `extension-link`, `extension-placeholder`) | Headless editor for RICH_TEXT content blocks |
| Base de Datos | PostgreSQL | Modelo relacional normalizado con 10 modelos y 9 enums |
| ORM | Prisma v6 | v7 descartada por breaking changes (requiere driver adapters) |
| Auth | NextAuth.js v5 (beta) | Magic Links (correo personal) + Google Provider (SSO corporativo post-flip) |
| Validation | Zod v4 | Runtime validation of JSONB fields (conditions, contentPayload) |
| Integraciones | Webhooks HTTP POST desde Jira ITSM | `api/webhooks/provisioning/` (active, Bearer auth) + `api/webhooks/jira/` (prepared) |
| Infra objetivo | Google Cloud Run + Cloud SQL + Cloud Tasks | Serverless, escala a 0 |

### Decisiones Técnicas Importantes

- **Prisma v6, no v7:** Prisma 7 eliminó `datasource.url` del schema y requiere `adapter` o `accelerateUrl` en el constructor del client. Se mantuvo v6 por simplicidad del MVP.
- **`export const dynamic = "force-dynamic"`** en dashboard, admin, y journey pages porque consultan la DB en runtime.
- **Seed excluido del tsconfig:** `prisma/seed.ts` está en `tsconfig.json > exclude` para que no interfiera con el build de Next.js.
- **Campo `ssoAuthenticatedAt`** en modelo User: registra cuándo el usuario completó la re-autenticación con Google SSO (nullable DateTime). Controla la lógica del Hard Gate.

### Decisiones Arquitectónicas Estratégicas (Sesión 3)

- **Compile-Time Journey Engine:** Templates with JSONB `conditions` on each `TemplateStep` are evaluated against a `UserProfile` at compile-time to produce personalized `UserJourney` records. Once compiled, journeys are immutable — new template versions only apply to new users. `compiledFromVersion` is informational only.
- **JSONB Content Blocks:** `TemplateStep.contentPayload` stores a `{ blocks: ContentBlock[] }` structure supporting RICH_TEXT, VIDEO_EMBED, PDF_LINK, CHECKLIST, and FORM_LINK. Validated at runtime with Zod schemas (`src/lib/journey-engine/schemas.ts`).
- **Language Boundary Rule:** All codebase (variables, functions, types, file names, comments, markdown) is in **English**. All user-facing UI text (buttons, labels, placeholders, tooltips, toasts) is in **Spanish**.
- **Two-Step Reorder Transactions:** `TemplateStep` has a `@@unique([journeyTemplateId, orderIndex])` constraint. Reordering uses a two-phase transaction: first move all steps to negative indices, then to final positive indices, avoiding unique constraint collisions.
- **Nullable JSON in Prisma:** When setting JSONB fields to `null`, must use `Prisma.JsonNull` (not JS `null`). Helper function `toJsonField()` in `template-steps.ts` handles this.
- **Radix Hydration Fix:** Client components using Radix UI (DropdownMenu, Select, etc.) need a mounted guard (`useState(false)` + `useEffect`) to prevent SSR ID mismatch. Applied in `admin-filters.tsx`.
- **Executive Decisions:** D1=multi-template allowed, D2=TipTap headless, D3=SendGrid (sync, no queues), D4=reminders deferred to v2, D5=zero DnD (order buttons ↑↓), D6=numeric versioning only, D7=keep `clusterId` as shortcut on JourneyTemplate.

### Decisiones Arquitectónicas — Provisioning & Nudge (Sesión 5)

- **DRY Identity Flip Logic:** The core transaction logic (assign corporate email, complete APPROVAL step, unlock LOCKED steps, recalculate progress, provision Google Workspace, dispatch omnichannel notifications) is extracted into `src/lib/journey-engine/process-identity-flip.ts`. Both the dev simulator (`simulate-identity-flip.ts`) and the provisioning webhook (`api/webhooks/provisioning/route.ts`) call this shared function. This eliminates duplication and ensures behavioral consistency.
- **Provisioning Webhook API:** `POST /api/webhooks/provisioning` accepts `{ userId, corporateEmail }` with Bearer token authentication against `WEBHOOK_SECRET` env var. Designed for Jira ITSM automation: when IT creates the Google Workspace account, Jira sends a webhook that triggers the full identity flip flow. Validates payload with Zod.
- **DB-Backed 4-Hour Nudge Cooldown:** `UserJourneyStep.lastNudgedAt` (nullable DateTime) tracks when the employee last sent a "nudge" notification to IT. The server action `send-it-nudge.ts` enforces a strict 4-hour cooldown at the database level — if `lastNudgedAt` is within the last 4 hours, the action rejects the request. The client UI mirrors this: the button shows "TI Notificado (espera 4h)" with a disabled state when on cooldown. This prevents notification spam while giving employees a legitimate escalation path.
- **Slack Integration:** Nudge notifications are sent as structured Block Kit messages to a Slack Incoming Webhook (`SLACK_WEBHOOK_URL` env var). In development, if the env var is not set, the action logs to console instead of failing. The Slack payload includes employee name, cluster, and pending step title.
- **Mock Omnichannel Dispatchers:** `process-identity-flip.ts` includes `console.log`-based mock dispatchers for Email, SMS, and WhatsApp notifications. These serve as integration points for future production implementations (SendGrid, Twilio, WhatsApp Business API).

### Decisiones Arquitectónicas — "Modern OS" UI Paradigm (Sesión 6)

- **"Modern OS" Mobile-First Layout:** VP-approved high-fidelity design. The employee app completely abandoned the long vertical scrolling list pattern. The new paradigm is a mobile-native "OS" feel with distinct screen zones: immersive header, focus card, quick-access grid, and tab-based navigation.
- **Strictly Mobile-First Viewport:** Even on desktop, the employee app renders inside a constrained mobile viewport (`max-w-lg mx-auto`). The design is optimized for 375–430px widths. Page background is `bg-[#f5f5f7]` (soft gray).
- **Deep Corporate Blue Header (`bg-[#0F4C81]`):** Full-width header block with gradient (`from-[#124e82] to-[#0b3d6e]`). Contains app branding, user avatar (initials + green online dot), identity-pending amber pill badge, large bold white greeting, and a custom progress bar (emerald-to-teal gradient on translucent white track). The header has generous padding (`pt-6 pb-16`) to allow card overlap.
- **"Next Action" Overlapping Focus Card:** A white card (`rounded-2xl`, deep box-shadow) that negatively margins upward (`-mt-10 relative z-20`) to visually overlap the blue header. Displays ONLY the first `PENDING` step from the user's journey: step order label ("Día N:"), title, description, and a full-width deep blue CTA button ("Comenzar Misión →"). Uses raw `div` instead of shadcn Card to avoid default `gap-6 py-6 border` fighting the layout.
- **Quick Access Grid (2x2):** Four structural placeholder cards: "Mi Equipo", "Credenciales" (with green status dot), "Wiki", "Soporte TI". Each card has a colored icon background (`rounded-2xl`, 48px), bold label, and gray subtitle. These are UI placeholders for future functionality.
- **Fixed Bottom Navigation Bar:** 4 tabs: Inicio (active), Ruta, Accesos, Perfil. Active tab has a filled blue circle (`bg-[#0F4C81]`) behind the white icon + bold blue label. Inactive tabs are gray. Includes iOS safe-area padding via `pb-[max(0.75rem,env(safe-area-inset-bottom))]`.
- **Layout themeColor updated:** `layout.tsx` viewport `themeColor` changed from `#0d9488` (teal) to `#0F4C81` (deep blue) to match new header.
- **PAUSED: Slack Webhook Integration Tests & IT Nudge Console Simulations.** These features are built and functional but testing/validation is paused. Will resume in a future session.

## Estado Actual

### Sesión 1 — Fundación

1. **TAD y ERD:** Documento de arquitectura técnica (`TAD_Farmatodo_Onboarding.md`) con el diagrama entidad-relación completo en Mermaid.

2. **`prisma/schema.prisma`** — Modelo base inicial con relaciones e índices.

3. **`prisma/seed.ts`** — Mock data realista (6 usuarios, 3 clusters, 1 template con 4 pasos).

4. **UI del Dashboard del Empleado** (`src/app/dashboard/page.tsx`):
   - Server Component, header sticky, card de bienvenida, banner de identidad pendiente, barra de progreso, timeline de pasos, lista de accesos.

### Sesión 2 — Flip de Identidad + Torre de Control

5. **Dev Simulator** (`src/components/dev/dev-simulator.tsx`): Panel flotante dev-only con 3 acciones transaccionales.

6. **Hard Gate de Autenticación** (en `journey-step-card.tsx`): Overlay obligatorio post-flip, pre-SSO.

7. **Torre de Control** (`src/app/admin/page.tsx`): 4 KPIs, filtros, tabla de empleados.

8. **Panel Lateral Drill-down** (`employee-detail-sheet.tsx`): Sheet con progreso, accesos, acciones mock.

### Sesión 3 — Conditional Journey Engine + Journey Builder (Chunks 1 & 2)

9. **Chunk 1: Schema Evolution + Condition Engine** (100% complete):
   - Schema expanded: 10 models, 9 enums. Added JSONB fields (`conditions`, `contentPayload`, `applicability`), `CommunicationTemplate`, `CommunicationLog`, `version`/`compiledFromVersion`, `phoneNumber`/`tags` on User.
   - `src/lib/journey-engine/` — Pure functions: `evaluateConditions()` (AND between properties, OR within arrays), `compileJourney()` / `compileAllJourneysForUser()` (transactional Server Actions).
   - Types (`types.ts`): `StepConditions`, `UserProfile`, `ContentBlock`, `ContentPayload`.
   - Zod schemas (`schemas.ts`): `stepConditionsSchema`, `contentPayloadSchema`.
   - Seed rewritten with 7 conditional steps (2 universal, 5 conditional by country/cluster/requiresCorporateEmail).
   - Migration script `prisma/migrate-data.ts` for legacy data.

10. **Chunk 2: Journey Builder Admin UI** (100% complete):
    - **Pages:** `/admin/journeys` (template list), `/admin/journeys/new` (creation form), `/admin/journeys/[templateId]` (builder with breadcrumb, info form, step list).
    - **Server Actions:** `journey-templates.ts` (`createTemplate`, `updateTemplate`, `toggleTemplateActive`, `publishNewVersion`), `template-steps.ts` (`createStep`, `updateStep`, `deleteStep`, `reorderSteps`).
    - **Journey Builder Components** (`src/components/admin/journey-builder/`):
      - `tiptap-editor.tsx` — TipTap with bold/italic/link/lists toolbar
      - `variable-inserter.tsx` — Dropdown for `{{user.fullName}}`, `{{org.clusterName}}`, etc.
      - `content-block-editor.tsx` — Multi-block editor (5 block types)
      - `condition-editor.tsx` — Country/cluster badge toggles, tags, boolean switches
      - `step-card.tsx` — Card with type badge, condition count, reorder/edit/delete
      - `step-list.tsx` — Ordered list with add/reorder/delete (confirmation dialog)
      - `step-editor-sheet.tsx` — Sheet with 3 tabs: General, Contenido, Condiciones
      - `template-info-form.tsx` — Name, description, cluster, active toggle, publish version
    - Admin nav updated: 3 links (Torre de Control, Journeys, Vista Empleado).

### Sesión 4 — Chunk 3: Compilation Integration + Rich Dashboard (100% complete)

11. **Content Rendering Pipeline:**
    - `ContentBlockRenderer` — Client component with DOMPurify (isomorphic-dompurify) for XSS-safe RICH_TEXT rendering, plus VIDEO_EMBED (iframe 16:9), PDF_LINK, FORM_LINK, CHECKLIST block types.
    - `StepChecklist` — Interactive checklist with optimistic UI and server-side persistence via `updateChecklist` action writing to `UserJourneyStep.checklistState` JSONB.
    - Variable interpolation: `{{user.firstName}}`, `{{user.clusterName}}`, etc. replaced at render time.

12. **Dashboard Evolution:**
    - `dashboard/page.tsx` reads `contentPayload` from each `templateStep`, passes it to `JourneyStepCard` along with `userVariables` and `checklistState`.
    - Legacy fallback: if `contentPayload` is null, renders plain `description` + `contentUrl` as before.
    - Steps ordered by `resolvedOrder` (compiled order) with fallback to `templateStep.orderIndex`.
    - `requiresCorporateEmail` read from `conditions.requiresCorporateEmail` with fallback to direct field.

13. **Compilation Server Actions:**
    - `compile-for-user.ts` — Compiles all applicable active templates for a user (skips existing journeys).
    - `preview-compilation.ts` — Read-only preview: evaluates each step against a simulated profile, returns HR-friendly inclusion/exclusion reasons.
    - `update-checklist.ts` — Persists checklist toggle state per step.

14. **Journey Preview (Admin Builder):**
    - `JourneyPreview` component in a right-side Sheet (slide-over), triggered by "Simular Vista de Empleado" button at the top of the builder page.
    - Profile simulator with country/cluster/status/cargo/toggles. HR-friendly Spanish copy (no technical JSON output).

15. **Seed updated:** Added Sofía Martínez — PRE_HIRE CENDIS VE whose journey is compiled via `evaluateConditions()` engine (2 of 7 steps matched).

16. **Simulation actions refactored:** `simulate-identity-flip.ts` and `rollback-identity-flip.ts` now use `resolvedOrder` for step ordering with fallback to `templateStep.orderIndex`.

### Sesión 5 — UX/Branding Refactor + Provisioning API + Nudge UI

17. **UX Refactor:** Journey Preview moved from inline to Sheet. All copy rewritten to HR-friendly Spanish. Technical output like `requiresCorporateEmail=true` replaced with human-readable explanations.

18. **Global Branding:** Theme migrated from teal (oklch hue ~170) to Farmatodo corporate two-tone blue (oklch hue ~250). All CSS variables updated: primary, secondary, muted, accent, border, ring, charts, sidebar. Both light and dark modes.

19. **TipTap SSR Fix:** Added `immediatelyRender: false` to `useEditor` config to prevent hydration mismatch error.

20. **DRY Identity Flip:** Core transaction logic extracted to `src/lib/journey-engine/process-identity-flip.ts`. Shared by dev simulator and webhook. Includes mock Email/SMS/WhatsApp dispatchers.

21. **Provisioning Webhook API:** `POST /api/webhooks/provisioning` — Bearer token auth, Zod-validated payload `{ userId, corporateEmail }`, calls `processIdentityFlip`.

22. **Employee Nudge System:**
    - Schema: `lastNudgedAt DateTime?` on `UserJourneyStep` (migration: `nudge_cooldown`).
    - Server Action: `send-it-nudge.ts` with strict 4h DB-backed cooldown, Slack Block Kit POST, console fallback.
    - UI: BellRing button on APPROVAL+PENDING identity step. Disabled with "TI Notificado (espera 4h)" when on cooldown. Loading + toast feedback.

23. **Documentation:** `webhook-testing-guide.md` (Spanish) — Slack app setup, curl commands, REST Client snippets.

### Sesión 6 — "Modern OS" Dashboard Refactor

24. **Dashboard UI/UX Overhaul** (`src/app/dashboard/page.tsx`) — COMPLETED:
    - Completely abandoned the long vertical scrolling list design (no more JourneyStepCard timeline, no AccessList, no InfoRow grid on the main dashboard).
    - New layout: Deep blue header (`bg-[#0F4C81]`) → overlapping "Next Action" focus card (`-mt-10`) → 2x2 Quick Access grid → fixed bottom nav.
    - Header shows: FARMATODO OS branding, user avatar (initials + green dot), amber identity-pending pill, bold greeting, custom progress bar.
    - Focus card shows ONLY the first PENDING step with "Día N:" prefix, description, and "Comenzar Misión →" CTA.
    - Quick access grid: Mi Equipo, Credenciales, Wiki, Soporte TI (structural placeholders).
    - Fixed bottom nav: Inicio (active, filled blue circle), Ruta, Accesos, Perfil.
    - `layout.tsx` themeColor updated from `#0d9488` to `#0F4C81`.
    - All Prisma data fetching logic preserved intact. DevSimulator preserved.

25. **PAUSED:** Slack Webhook integration tests and IT Nudge console simulations. These features are built and functional but testing is deferred to a future session.

### Componentes shadcn/ui instalados

card, badge, progress, avatar, separator, alert, button, table, dropdown-menu, sheet, sonner, input, textarea, select, switch, tabs, tooltip, dialog, label

### Estructura de directorios

```
src/
├── app/
│   ├── layout.tsx                  # Root layout (PWA meta, lang="es", Toaster)
│   ├── page.tsx                    # Redirect → /dashboard
│   ├── globals.css                 # Tema Farmatodo corporate blue (oklch hue ~250)
│   ├── dashboard/
│   │   ├── layout.tsx              # Shared layout: bg, pb-24, BottomNav, DevSimulator
│   │   ├── page.tsx                # Inicio tab — header + focus card + quick access
│   │   ├── ruta/page.tsx           # Ruta tab — full journey timeline with JourneyStepCard
│   │   ├── accesos/page.tsx        # Accesos tab — digital wallet with AccessCard grid
│   │   └── perfil/page.tsx         # Perfil tab — user info stub + "Cerrar Sesión" placeholder
│   ├── admin/
│   │   ├── layout.tsx              # Layout admin con nav (Torre de Control, Journeys, Vista Empleado)
│   │   ├── page.tsx                # Torre de Control (Server Component)
│   │   └── journeys/
│   │       ├── page.tsx            # Lista de plantillas de journey
│   │       ├── new/
│   │       │   ├── page.tsx        # Crear nueva plantilla
│   │       │   └── new-template-form.tsx
│   │       └── [templateId]/
│   │           └── page.tsx        # Journey Builder (detalle + pasos)
│   ├── actions/
│   │   ├── simulate-identity-flip.ts  # Calls processIdentityFlip (DRY)
│   │   ├── simulate-sso-login.ts
│   │   ├── rollback-identity-flip.ts
│   │   ├── send-it-nudge.ts          # Slack nudge with 4h DB cooldown
│   │   ├── compile-for-user.ts        # Compile all applicable journeys
│   │   ├── preview-compilation.ts     # Read-only preview for admin builder
│   │   ├── update-checklist.ts        # Persist checklist state
│   │   ├── journey-templates.ts       # CRUD templates
│   │   └── template-steps.ts         # CRUD steps + reorder
│   └── api/
│       ├── webhooks/
│       │   ├── provisioning/route.ts  # POST: Bearer auth + processIdentityFlip
│       │   └── jira/                  # (prepared)
│       └── auth/                      # (prepared)
├── components/
│   ├── ui/                         # shadcn/ui base components (18 installed)
│   ├── dashboard/
│   │   └── bottom-nav.tsx            # Client Component: Link + usePathname() bottom nav
│   ├── journey/
│   │   ├── journey-step-card.tsx       # Rich content + nudge button
│   │   ├── content-block-renderer.tsx # RICH_TEXT/VIDEO/PDF/CHECKLIST/FORM
│   │   ├── step-detail-sheet.tsx      # Bottom sheet for step detail (custom trigger via children)
│   │   ├── step-checklist.tsx         # Interactive checklist with persistence
│   │   └── access-list.tsx            # AccessCard + AccessCardGrid (digital wallet cards)
│   ├── admin/
│   │   ├── admin-filters.tsx       # Mounted guard for Radix hydration
│   │   ├── admin-employee-table.tsx
│   │   ├── employee-detail-sheet.tsx
│   │   └── journey-builder/
│   │       ├── tiptap-editor.tsx
│   │       ├── variable-inserter.tsx
│   │       ├── content-block-editor.tsx
│   │       ├── condition-editor.tsx
│   │       ├── step-card.tsx
│   │       ├── step-list.tsx
│   │       ├── step-editor-sheet.tsx
│   │       └── template-info-form.tsx
│   └── dev/
│       └── dev-simulator.tsx
├── lib/
│   ├── prisma.ts                   # Singleton PrismaClient
│   ├── utils.ts                    # cn() helper
│   └── journey-engine/
│       ├── types.ts                    # StepConditions, UserProfile, ContentBlock, ContentPayload
│       ├── schemas.ts                  # Zod validation schemas
│       ├── evaluate-conditions.ts      # Pure function: conditions × profile → boolean
│       ├── compile-journey.ts          # Server Actions: compile user journeys
│       └── process-identity-flip.ts   # DRY core logic for identity flip (shared by simulator + webhook)
└── types/                          # (preparado)
```

## Operaciones de Entorno

### Levantar el entorno (inicio de sesión)

```bash
# 1. Iniciar PostgreSQL
docker start pg-onboarding

# 2. Verificar que la DB está corriendo
docker ps --filter name=pg-onboarding

# 3. Levantar el servidor de desarrollo
npm run dev
# → http://localhost:3000/dashboard (Inicio tab)
# → http://localhost:3000/dashboard/ruta (Ruta tab — journey timeline)
# → http://localhost:3000/dashboard/accesos (Accesos tab — digital wallet)
# → http://localhost:3000/dashboard/perfil (Perfil tab — user profile)
# → http://localhost:3000/admin (torre de control)
# → http://localhost:3000/admin/journeys (journey builder)
```

### Apagar el entorno (fin de sesión)

```bash
# 1. Detener el servidor de desarrollo (Ctrl+C o kill del proceso)
# 2. Detener PostgreSQL
docker stop pg-onboarding
```

### Reset completo de la DB (si es necesario)

```bash
# Requiere confirmación del usuario por ser destructivo
npx prisma migrate reset --force
# Esto borra datos, re-aplica migraciones y ejecuta el seed
```

### Setup desde cero (primera vez)

```bash
docker run -d --name pg-onboarding -e POSTGRES_PASSWORD=password -e POSTGRES_DB=onboarding -p 5432:5432 postgres:16
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## Próximos Pasos (To-Do)

**Completed through Chunk 3 + Provisioning API + Nudge UI + UX/Branding Refactor + "Modern OS" Dashboard Refactor + Interactive CTA + Chunk 5 (all 4 tabs).**

**PAUSED:** Slack Webhook integration tests, IT Nudge console simulations.

### Session 7 — GitHub Setup + Interactive CTA + Chunk 5 (Complete)

26. **GitHub Remote:** Repository pushed to `https://github.com/omarjperezt/onboarding-app`. Git identity set to `Omar Perez <omarj.perezt@farmatodo.com>`. GitHub CLI (`gh`) installed and authenticated via SSO.

27. **Interactive CTA — StepDetailSheet** (`src/components/journey/step-detail-sheet.tsx`): "Comenzar Misión →" button on the Inicio focus card now opens a bottom Sheet (92vh, rounded-t-3xl) displaying the full step content via `ContentBlockRenderer`. Extended with optional `children` prop for custom triggers (used by Ruta tab tap-to-expand).

28. **Chunk 5 — Modern OS Tab Navigation (100% complete):**
    - **Phase 0 — Structural Refactor:** `dashboard/layout.tsx` (shared bg, padding, BottomNav, DevSimulator). `BottomNav` Client Component (`src/components/dashboard/bottom-nav.tsx`) with `Link` + `usePathname()`. All server actions updated to `revalidatePath("/dashboard", "layout")` for sub-route revalidation.
    - **Phase 1 — Ruta Tab** (`/dashboard/ruta`): Full journey timeline with `JourneyStepCard` for all steps. PENDING steps wrapped in `StepDetailSheet` for tap-to-expand. Page header with journey name + progress bar.
    - **Phase 2 — Accesos Tab** (`/dashboard/accesos`): Digital wallet with `AccessCard` + `AccessCardGrid` components. System-specific icons, colored status dots (emerald/amber/red), Jira ticket subtitles, summary pills in header.
    - **Phase 3 — Perfil Tab** (`/dashboard/perfil`): User profile stub with avatar, name, status badge, email/cluster/country info cards, disabled "Cerrar Sesión" placeholder.
    - **Architecture:** Separate Next.js pages with per-page focused Prisma queries. DevSimulator persists across all tabs. Zero hydration errors.

**Immediate next priorities (in order):**

1. **Chunk 4 — Communications Engine with SendGrid + admin editor.** Per `implementation-steps.md`, Chunk 4 includes:
   - Admin pages for CommunicationTemplate CRUD (`/admin/communications`)
   - TipTap-based email body editor with variable insertion
   - Email preview with corporate layout
   - `dispatchCommunication()` orchestrator with deduplication
   - SendGrid integration (`@sendgrid/mail`)
   - Trigger wiring: JOURNEY_ASSIGNED, IDENTITY_FLIP, SSO_AUTHENTICATED, etc.

2. **Auth Integration:** Configure NextAuth.js v5 — Magic Links (personal email) + Google Provider (SSO post-flip). Wire "Cerrar Sesión" on Perfil tab.
