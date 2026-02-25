# Farmatodo Onboarding OS — Project Status & TODO

## Completed Work

### Foundation (Sessions 1-2)
- [x] TAD + ERD (`TAD_Farmatodo_Onboarding.md`)
- [x] Prisma schema: 10 models, 9 enums, JSONB fields
- [x] Seed: 7 users, 3 clusters, 7 conditional template steps
- [x] Dev Simulator: 3 transactional actions (flip, SSO, rollback)
- [x] Hard Gate: overlay post-flip, pre-SSO re-auth
- [x] Admin Torre de Control: 4 KPIs, filters, employee table, drill-down sheet

### Chunk 1 — Schema Evolution + Condition Engine
- [x] `evaluateConditions()` — AND between properties, OR within arrays
- [x] `compileJourney()` / `compileAllJourneysForUser()` — transactional
- [x] Types, Zod schemas, migration script

### Chunk 2 — Journey Builder Admin UI
- [x] `/admin/journeys` — template list, create, builder (steps + content + conditions)
- [x] TipTap editor, variable inserter, content block editor, condition editor
- [x] Server actions: CRUD templates + steps, two-phase reorder

### Chunk 3 — Compilation Integration + Rich Dashboard
- [x] `ContentBlockRenderer` — 5 block types (RICH_TEXT, VIDEO, PDF, CHECKLIST, FORM)
- [x] `StepChecklist` — interactive with DB persistence
- [x] Variable interpolation (`{{user.firstName}}`, etc.)
- [x] Journey preview (admin builder) with profile simulator

### UX/Branding + Provisioning + Nudge (Session 5)
- [x] Theme: teal → corporate blue (oklch hue ~250, `#0F4C81`)
- [x] DRY Identity Flip: `process-identity-flip.ts` shared by simulator + webhook
- [x] Provisioning Webhook: `POST /api/webhooks/provisioning` (Bearer auth, Zod)
- [x] Nudge: 4h DB-backed cooldown, Slack Block Kit, console fallback

### Chunk 5 — Modern OS Tab Navigation (Session 6-7)
- [x] "Modern OS" layout: immersive header, focus card, quick access grid
- [x] Interactive CTA: `StepDetailSheet` (bottom sheet, rich content)
- [x] Shared `dashboard/layout.tsx` with `BottomNav` (Link + usePathname)
- [x] `/dashboard/ruta` — full journey timeline with tap-to-expand
- [x] `/dashboard/accesos` — digital wallet (AccessCard grid, status pills)
- [x] `/dashboard/perfil` — user profile stub

### PAUSED
- [ ] Slack Webhook integration tests
- [ ] IT Nudge console simulations

---

## Next Priorities

### 1. Chunk 4 — Communications Engine (SendGrid)
Per `implementation-steps.md`:
- [ ] Admin CRUD pages for `CommunicationTemplate` (`/admin/communications`)
- [ ] TipTap-based email body editor with variable insertion
- [ ] Email preview with corporate layout
- [ ] `dispatchCommunication()` orchestrator with deduplication
- [ ] SendGrid integration (`@sendgrid/mail`)
- [ ] Trigger wiring: JOURNEY_ASSIGNED, IDENTITY_FLIP, SSO_AUTHENTICATED

### 2. Auth Integration
- [ ] Configure NextAuth.js v5 — Magic Links (personal email) + Google Provider (SSO)
- [ ] Wire "Cerrar Sesion" on Perfil tab
- [ ] Replace hardcoded `josmar.rodriguez@gmail.com` queries with session user

### 3. Production Readiness
- [ ] Google Cloud Run + Cloud SQL deployment
- [ ] Real Jira ITSM webhook integration (`/api/webhooks/jira`)
- [ ] Replace mock omnichannel dispatchers with SendGrid/Twilio/WhatsApp

---

## Key Reference Files
- Architecture: `TAD_Farmatodo_Onboarding.md`, `admin-architecture-plan.md`
- Implementation plan: `implementation-steps.md`
- Chunk 5 plan: `chunk-5-execution-plan.md`
- Webhook testing: `webhook-testing-guide.md`
- Schema: `prisma/schema.prisma` (10 models, 9 enums)
- Seed: `prisma/seed.ts` (7 users, 7 template steps)

## Env Vars
- `DATABASE_URL` — PostgreSQL connection string
- `WEBHOOK_SECRET` — Bearer token for provisioning webhook
- `SLACK_WEBHOOK_URL` — Slack Incoming Webhook (optional in dev)

## GitHub
- Repo: `https://github.com/omarjperezt/onboarding-app`
- Git identity: `Omar Perez <omarj.perezt@farmatodo.com>`
- gh CLI: `/usr/local/Cellar/gh/2.87.3/bin/gh`
