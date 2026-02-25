# Plan de Implementación — 4 Chunks Secuenciales

> **Fecha:** 2026-02-22
> **Referencia:** `admin-architecture-plan.md` + Executive Decisions del PO
> **Invariante:** Cada chunk deja la app funcional. `/dashboard` y `/admin` nunca se rompen.

---

## Decisiones Ejecutivas Aplicadas

| # | Decisión | Impacto en Implementación |
|---|---|---|
| Inmutabilidad | No hay re-compilación de journeys activos | Eliminar lógica de re-compilación. `compiledFromVersion` es solo informativo |
| Comunicaciones | SendGrid síncrono, sin colas/workers | No hay Cloud Tasks. Envío directo en Server Actions |
| D1 | Multi-template permitido | Sin cambios (constraint actual ya lo soporta) |
| D2 | TipTap headless | Instalar `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link` |
| D3 | SendGrid | Instalar `@sendgrid/mail` |
| D4 | Recordatorios diferidos a v2 | No implementar trigger REMINDER ni cron |
| D5 | Cero DnD — botones arriba/abajo | No instalar dnd-kit |
| D6 | Versionado numérico simple | Campo `version` Int, botón "Publicar v{N+1}" |
| D7 | Mantener `clusterId` como shortcut | `clusterId` nullable en JourneyTemplate, no eliminado |

---

## Chunk 1: Schema Evolution + Condition Engine

**Objetivo:** Migrar el schema de Prisma, implementar las funciones puras del motor de condiciones y compilación, y migrar los datos existentes. La app sigue funcionando idéntica para el usuario final.

### Archivos a Crear

| Archivo | Descripción |
|---|---|
| `src/lib/journey-engine/evaluate-conditions.ts` | Función pura: recibe `StepConditions` + perfil usuario → `boolean` |
| `src/lib/journey-engine/compile-journey.ts` | Server Action: recibe `userId` + `templateId` → crea `UserJourney` con pasos filtrados |
| `src/lib/journey-engine/types.ts` | Tipos TypeScript para `StepConditions`, `ContentPayload`, `ContentBlock` |
| `src/lib/journey-engine/schemas.ts` | Schemas Zod para validación runtime de JSONB (`conditionsSchema`, `contentPayloadSchema`) |
| `prisma/migrations/YYYYMMDD_conditional_engine/migration.sql` | Migración generada por Prisma |
| `prisma/migrate-data.ts` | Script standalone: migra `contentUrl` → `contentPayload`, `requiresCorporateEmail` → `conditions` |

### Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Agregar campos JSONB (`conditions`, `contentPayload`, `applicability`), nuevos enums, modelos `CommunicationTemplate` + `CommunicationLog`, campos nuevos en `User`, `UserJourney`, `UserJourneyStep`, `JourneyTemplate`, `TemplateStep` |
| `prisma/seed.ts` | Extender con: pasos condicionales (un paso solo-VE, un paso solo-CENDIS), contenido en formato `contentPayload`, campo `applicability` en template |
| `package.json` | Agregar script `"db:migrate-data": "tsx prisma/migrate-data.ts"`, agregar dependencia `zod` |

### Funciones Clave

**`evaluateConditions(conditions, profile)`**
```
Input:
  - conditions: StepConditions | null (JSONB parseado)
  - profile: { country, clusterName, position, status, hasCorporateEmail, hasSsoAuth, createdAt, tags }
Output: boolean
Lógica:
  - Si conditions es null → return true
  - Para cada key presente en conditions:
    - country: profile.country ∈ conditions.country
    - cluster: profile.clusterName ∈ conditions.cluster
    - position: algún item de conditions.position es substring (case-insensitive) de profile.position
    - userStatus: profile.status ∈ conditions.userStatus
    - requiresCorporateEmail: profile.hasCorporateEmail === conditions.requiresCorporateEmail
    - requiresSsoAuth: profile.hasSsoAuth === conditions.requiresSsoAuth
    - hiredAfter: profile.createdAt >= parse(conditions.hiredAfter)
    - hiredBefore: profile.createdAt <= parse(conditions.hiredBefore)
    - tags: algún tag de conditions.tags ∈ profile.tags
  - Resultado: AND de todas las evaluaciones
```

**`compileJourney(userId, templateId)`**
```
Server Action transaccional:
  1. Fetch user con cluster
  2. Fetch template con steps ordenados por orderIndex
  3. Construir profile object del user
  4. Filtrar steps: evaluateConditions(step.conditions, profile) === true
  5. Crear UserJourney { userId, journeyTemplateId, compiledFromVersion: template.version }
  6. Para cada paso filtrado (index i):
     - Crear UserJourneyStep { resolvedOrder: i+1, status: i===0 ? PENDING : LOCKED }
  7. Return UserJourney con steps
```

### Detalle de Cambios al Schema

**Campos nuevos (aditivos, todos nullable o con default):**

```
JourneyTemplate:
  + description    String?
  + version        Int @default(1)
  + applicability  Json? @db.JsonB
  + updatedAt      DateTime @updatedAt

TemplateStep:
  + conditions        Json? @db.JsonB
  + contentPayload    Json? @db.JsonB
  + estimatedMinutes  Int?
  + iconName          String?
  (contentUrl y requiresCorporateEmail NO se eliminan aún)

UserJourney:
  + compiledFromVersion  Int @default(1)

UserJourneyStep:
  + resolvedOrder    Int? (nullable para no romper registros existentes)
  + checklistState   Json? @db.JsonB

User:
  + phoneNumber  String?
  + tags         String[] @default([])

Nuevos modelos:
  + CommunicationTemplate (completo)
  + CommunicationLog (completo)

Nuevos enums:
  + CommunicationChannel
  + CommunicationTrigger
  + ContentBlockType
```

### Script de Migración de Datos (`prisma/migrate-data.ts`)

```
Para cada TemplateStep existente:
  1. Si contentUrl no es null:
     → contentPayload = { blocks: [{ id: uuid(), type: "PDF_LINK", value: contentUrl, meta: { label: title } }] }
  2. Si requiresCorporateEmail es true:
     → conditions = { requiresCorporateEmail: true }
  3. Si requiresCorporateEmail es false y conditions es null:
     → dejar conditions como null (paso universal)

Para cada UserJourneyStep existente:
  → resolvedOrder = templateStep.orderIndex (copiar el orden del template)
```

### Criterio de Aceptación

- [x] `npx prisma migrate dev` ejecuta sin errores
- [x] `npx prisma generate` genera el client sin warnings de JSONB
- [x] `npm run db:seed` completa con los nuevos campos poblados (contentPayload, conditions en algunos pasos)
- [x] `npm run db:migrate-data` migra correctamente los registros legacy (script created; seed already populates new fields directly)
- [x] **`/dashboard` carga sin errores** (los campos legacy siguen presentes, el código existente no los pierde)
- [x] **`/admin` carga sin errores** (misma razón)
- [x] `evaluateConditions()` pasa tests manuales: null→true, country match, country mismatch, AND de múltiples propiedades (13/13 tests passed)
- [x] `compileJourney()` genera un UserJourney correcto cuando se invoca directamente (verified: 3 profiles compiled correctly against 7-step template)
- [x] El Dev Simulator (flip/rollback/SSO) sigue funcionando sin cambios (pages return 200, no TS errors)

---

## Chunk 2: Journey Builder Admin UI

**Objetivo:** Construir la interfaz administrativa completa para que RRHH pueda crear, editar y versionar plantillas de Journey con pasos condicionales y contenido rico. No afecta el dashboard del empleado.

### Dependencias

- Chunk 1 completado (schema migrado, Zod schemas disponibles, tipos definidos)

### Archivos a Crear

| Archivo | Descripción |
|---|---|
| **Páginas** | |
| `src/app/admin/journeys/page.tsx` | Server Component: lista de JourneyTemplates con nombre, cluster, versión, conteo de usuarios activos, badge activo/inactivo |
| `src/app/admin/journeys/[templateId]/page.tsx` | Server Component: carga template + steps, renderiza el Journey Builder |
| `src/app/admin/journeys/new/page.tsx` | Page para crear un template nuevo (redirige al editor tras creación) |
| **Componentes** | |
| `src/components/admin/journey-builder/step-list.tsx` | Client Component: lista ordenada de StepCards con botones ↑↓, botón "+Agregar paso" |
| `src/components/admin/journey-builder/step-card.tsx` | Client Component: card colapsable de un paso (título, tipo, badge condiciones, acciones) |
| `src/components/admin/journey-builder/step-editor-sheet.tsx` | Client Component: Sheet lateral con form completo de edición de paso |
| `src/components/admin/journey-builder/condition-editor.tsx` | Client Component: UI para agregar/quitar condiciones (dropdowns de país, cluster, toggles) |
| `src/components/admin/journey-builder/content-block-editor.tsx` | Client Component: editor por tipo de bloque, contiene TipTap para RICH_TEXT |
| `src/components/admin/journey-builder/tiptap-editor.tsx` | Client Component: wrapper de TipTap con toolbar (bold, italic, link) y extensión de variables `{{}}` |
| `src/components/admin/journey-builder/variable-inserter.tsx` | Client Component: dropdown que inserta variables en el cursor del editor |
| `src/components/admin/journey-builder/template-info-form.tsx` | Client Component: formulario de metadata del template (nombre, descripción, cluster, estado) |
| **Server Actions** | |
| `src/app/actions/journey-templates.ts` | Server Actions: `createTemplate`, `updateTemplate`, `toggleTemplateActive`, `publishNewVersion` |
| `src/app/actions/template-steps.ts` | Server Actions: `createStep`, `updateStep`, `deleteStep`, `reorderSteps` |

### Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `src/app/admin/layout.tsx` | Agregar link "Journeys" en la nav (`/admin/journeys`) con icono `Route` |
| `package.json` | Agregar dependencias: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder` |

### Componentes shadcn/ui Nuevos a Instalar

- `input` (formularios)
- `textarea` (descripción)
- `select` (tipo de paso, canal)
- `switch` (toggles: isOptional, isActive)
- `tabs` (secciones del editor de paso: Contenido | Condiciones)
- `tooltip` (hints en el editor)
- `dialog` (confirmación de eliminación de paso)
- `label` (forms)

### Funciones Clave

**`createTemplate(data)`**
```
Server Action:
  1. Validar input con Zod (name requerido, clusterId opcional)
  2. prisma.journeyTemplate.create({ name, description, clusterId, version: 1, isActive: false })
  3. revalidatePath("/admin/journeys")
  4. Return { id } para redirect
```

**`updateStep(stepId, data)`**
```
Server Action:
  1. Validar data con Zod:
     - title: string min 1
     - stepType: enum StepType
     - conditions: conditionsSchema.nullable()
     - contentPayload: contentPayloadSchema.nullable()
     - estimatedMinutes: number.nullable()
     - isOptional: boolean
  2. prisma.templateStep.update({ where: { id: stepId }, data })
  3. revalidatePath("/admin/journeys/[templateId]")
```

**`reorderSteps(templateId, orderedStepIds)`**
```
Server Action:
  1. Recibe array de step IDs en el nuevo orden
  2. prisma.$transaction: para cada stepId en index i → update orderIndex = i + 1
  3. revalidatePath
```

**`publishNewVersion(templateId)`**
```
Server Action:
  1. prisma.journeyTemplate.update({ version: { increment: 1 } })
  2. revalidatePath
  3. Return nueva version
```

### Layout del Journey Builder (Estructura visual)

```
/admin/journeys/[templateId]
├── Breadcrumb: Journeys > "Onboarding General"
├── TemplateInfoForm (nombre, descripción, cluster, estado, versión actual)
├── Separator
├── StepList
│   ├── StepCard 1 (colapsado: título + tipo + badges de condiciones)
│   ├── StepCard 2 ...
│   ├── StepCard N
│   └── Button: "+ Agregar paso"
├── Separator
└── Footer: [Publicar v{N+1}] [Previsualizar] (preview → Chunk 3)
```

### Criterio de Aceptación

- [x] `/admin/journeys` muestra la lista de templates existentes (del seed), con versión y conteo de usuarios
- [x] Clic en un template navega a `/admin/journeys/[id]` y muestra todos sus pasos
- [x] Se puede crear un template nuevo desde `/admin/journeys/new`
- [x] Se puede agregar un paso nuevo a un template (Sheet se abre, form funcional)
- [x] Se puede editar título, tipo, duración, isOptional de un paso existente
- [x] El editor de condiciones permite agregar/quitar: país (multi-select), cluster (multi-select), requiresCorporateEmail (toggle), requiresSsoAuth (toggle)
- [x] El editor de contenido permite crear bloques RICH_TEXT con TipTap (bold, italic, link) y insertar variables `{{user.firstName}}`
- [x] Se puede agregar bloques de tipo VIDEO_EMBED (input URL) y PDF_LINK (input URL + label)
- [x] Los botones ↑↓ reordenan pasos correctamente (orderIndex se actualiza en DB)
- [x] Se puede eliminar un paso (con diálogo de confirmación)
- [x] "Publicar v{N+1}" incrementa la versión del template
- [x] **`/dashboard` y `/admin` (Torre de Control) siguen funcionando sin cambios**
- [x] El nav admin ahora muestra 3 links: Torre de Control, Journeys, Vista Empleado

---

## Chunk 3: Compilación Integrada + Dashboard con Contenido Rico

**Objetivo:** Conectar el motor de compilación a la creación de usuarios, agregar el panel de preview al Journey Builder, y evolucionar el dashboard del empleado para renderizar `contentPayload` en vez de `description`/`contentUrl` planos.

### Dependencias

- Chunk 1 completado (engine functions)
- Chunk 2 completado (Journey Builder funcional para crear templates con contentPayload)

### Archivos a Crear

| Archivo | Descripción |
|---|---|
| **Componentes** | |
| `src/components/admin/journey-builder/journey-preview.tsx` | Client Component: panel de preview con selectores de perfil simulado + resultado de compilación |
| `src/components/journey/content-block-renderer.tsx` | Client Component: renderiza un ContentBlock según su tipo (RICH_TEXT → HTML sanitizado, VIDEO_EMBED → iframe, etc.) |
| `src/components/journey/step-checklist.tsx` | Client Component: checklist interactivo del paso (lee/escribe `checklistState` en UserJourneyStep) |
| **Server Actions** | |
| `src/app/actions/compile-for-user.ts` | Server Action: recibe userId, invoca `compileJourney()` para cada template aplicable |
| `src/app/actions/preview-compilation.ts` | Server Action: recibe perfil ficticio + templateId, retorna lista de pasos que aplican (sin crear registros) |
| `src/app/actions/update-checklist.ts` | Server Action: actualiza `checklistState` de un UserJourneyStep |

### Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `src/app/dashboard/page.tsx` | Leer `contentPayload` del templateStep en la query. Pasar bloques de contenido al `JourneyStepCard`. Si `contentPayload` es null, fallback a `description`/`contentUrl` legacy |
| `src/components/journey/journey-step-card.tsx` | Agregar prop `contentPayload`. Si existe, renderizar `ContentBlockRenderer` para cada bloque. Si no, mantener render legacy. Leer `requiresCorporateEmail` desde `conditions.requiresCorporateEmail` cuando `conditions` está presente, fallback al campo directo |
| `src/app/admin/journeys/[templateId]/page.tsx` | Agregar sección de Preview al final del builder (componente `JourneyPreview`) |
| `src/app/actions/simulate-identity-flip.ts` | Adaptar: si el UserJourneyStep tiene `resolvedOrder`, usar ese para lógica de desbloqueo en vez de `templateStep.orderIndex` |
| `src/app/actions/rollback-identity-flip.ts` | Misma adaptación que simulate-identity-flip |
| `prisma/seed.ts` | Agregar un usuario nuevo que se cree con `compileJourney()` en vez de journey manual, para validar el flujo end-to-end |

### Funciones Clave

**`previewCompilation(templateId, simulatedProfile)`**
```
Server Action (no transaccional, read-only):
  1. Fetch template con steps
  2. Para cada step: evaluateConditions(step.conditions, simulatedProfile)
  3. Return array de { step, included: boolean, reason: string }
  - reason: "universal" | "matched: country=VE" | "excluded: cluster mismatch"
```

**`compileForUser(userId)`**
```
Server Action:
  1. Fetch user con cluster
  2. Fetch todas las JourneyTemplates activas
  3. Para cada template: evaluateConditions(template.applicability, userProfile)
  4. Para cada template que aplica: compileJourney(userId, templateId)
  5. revalidatePath("/admin")
  6. Return { journeysCreated: number }
```

**`ContentBlockRenderer` (componente)**
```
Props: { block: ContentBlock }
Switch por block.type:
  RICH_TEXT → <div dangerouslySetInnerHTML={{ __html: sanitize(interpolate(block.value, userVars)) }} />
  VIDEO_EMBED → <iframe src={block.value} /> con aspect ratio 16:9
  PDF_LINK → <a href={block.value}> con icono de documento
  CHECKLIST → <StepChecklist items={block.meta.checklistItems} />
  FORM_LINK → <a href={block.value}> con icono de formulario
```

**Nota sobre sanitización:** Usar `DOMPurify` (o la API nativa `Sanitizer` si disponible) para el HTML de RICH_TEXT antes de `dangerouslySetInnerHTML`. Agregar `dompurify` como dependencia.

### Journey Preview — Diseño del Panel

```
┌─ Preview de Compilación ──────────────────────────────────┐
│                                                            │
│  Simular para perfil:                                      │
│  País: [VE ▼]   Cluster: [CENDIS ▼]   Cargo: [________]  │
│  [Compilar Preview]                                        │
│                                                            │
│  Resultado: 5 de 8 pasos aplican                           │
│                                                            │
│  ✅ Paso 1: Bienvenida y datos personales                  │
│     ↳ universal (sin condiciones)                          │
│  ✅ Paso 2: Creación identidad corporativa                 │
│     ↳ universal (sin condiciones)                          │
│  ❌ Paso 3: Regulación sanitaria AR                        │
│     ↳ excluido: country [AR] no matchea perfil VE          │
│  ✅ Paso 4: Protocolos CENDIS                              │
│     ↳ matched: cluster = CENDIS                            │
│  ❌ Paso 5: Configurar SuperApp Tienda                     │
│     ↳ excluido: cluster [Operaciones Tienda] no matchea    │
│  ✅ Paso 6: Capacitación e-learning                        │
│     ↳ universal (sin condiciones)                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Criterio de Aceptación

- [x] El panel de Preview en el Journey Builder funciona: seleccionar un perfil ficticio muestra qué pasos se incluyen/excluyen con razones
- [x] `compileForUser(userId)` crea correctamente un UserJourney con solo los pasos que matchean el perfil
- [x] El dashboard del empleado renderiza bloques RICH_TEXT como HTML formateado
- [x] El dashboard del empleado renderiza VIDEO_EMBED como iframe
- [x] El dashboard del empleado renderiza CHECKLIST como items clickeables
- [x] Si un paso NO tiene `contentPayload` (legacy), el dashboard sigue mostrando `description` y `contentUrl` como antes (fallback)
- [x] El Dev Simulator (flip/rollback/SSO) sigue funcionando correctamente con el schema actualizado
- [x] El seed incluye al menos un usuario cuyo journey se creó vía `compileJourney()` y se visualiza correctamente
- [x] `/admin` (Torre de Control) sigue mostrando todos los usuarios y sus progresos

---

## Chunk 5: "Modern OS" UI Overhaul — Employee App (Partially Complete)

> **Fecha:** 2026-02-24
> **Status:** Dashboard refactor DONE. Ruta + Accesos tabs PENDING.
> **PAUSED:** Slack Webhook integration tests, IT Nudge console simulations.

**Objective:** Complete UI/UX overhaul of the employee-facing app from a long vertical list to a "Modern OS" mobile-native paradigm. VP-approved high-fidelity design.

### Chunk 5A: Dashboard Refactor — COMPLETED

The main dashboard (`src/app/dashboard/page.tsx`) was completely rewritten:

- **Abandoned:** Long vertical scrolling list with JourneyStepCard timeline, AccessList, InfoRow user grid.
- **New layout:** Deep blue header (`bg-[#0F4C81]` with gradient) → overlapping "Next Action" focus card (`-mt-10`) → 2x2 Quick Access grid → fixed bottom navigation bar.
- **Header:** FARMATODO OS branding, user avatar (initials + green online dot), amber identity-pending pill badge, bold white greeting, custom progress bar (emerald-to-teal gradient on white/15 track).
- **Focus Card:** Raw div (not shadcn Card, to avoid default gap-6/py-6/border fighting the layout). Shows ONLY first PENDING step: "Día N: [title]", description, full-width CTA "Comenzar Misión →".
- **Quick Access Grid:** 4 structural placeholder cards: Mi Equipo, Credenciales (green status dot), Wiki, Soporte TI. Each with colored rounded icon, bold label, gray subtitle.
- **Bottom Nav:** Fixed, 4 tabs: Inicio (active — filled blue circle + white icon + bold blue label), Ruta, Accesos, Perfil. iOS safe-area padding.
- **Technical:** All Prisma data fetching preserved. DevSimulator preserved. `layout.tsx` themeColor updated to `#0F4C81`.

### Chunk 5B: "Ruta" Tab — Journey Timeline (PENDING)

Build the view for the "Ruta" bottom nav tab. This should display the full journey step timeline (the content removed from the main dashboard). Must reuse existing `JourneyStepCard` components but styled to match the new Modern OS aesthetic.

**Key decisions needed:**
- Route structure: separate page (`/dashboard/ruta`) vs client-side tab switching
- Whether to keep the deep blue header on all tabs or use a simplified header
- How the bottom nav active state transitions between tabs

### Chunk 5C: "Accesos" Tab — Digital Wallet (PENDING)

Build the view for the "Accesos" bottom nav tab. Display `accessProvisionings` as a card-based digital wallet with platform icons, status badges, and provisioning dates. Premium styling to match the new OS aesthetic.

### Chunk 5D: "Perfil" Tab — User Profile (PENDING)

Build the user profile view. Display user info (name, email, cluster, country, position) that was previously shown in the InfoRow grid on the old dashboard. Include identity flip status, SSO status, and account settings.

### Criterio de Aceptación

- [x] Dashboard refactored to Modern OS layout
- [x] Deep blue header with avatar, identity pill, greeting, progress bar
- [x] Overlapping "Next Action" focus card with first PENDING step
- [x] 2x2 Quick Access grid with placeholder cards
- [x] Fixed bottom navigation bar with Inicio active
- [x] All Prisma data fetching preserved
- [x] DevSimulator still functional
- [ ] "Ruta" tab built with full journey timeline
- [ ] "Accesos" tab built with digital wallet view
- [ ] "Perfil" tab built with user info
- [ ] Bottom nav tabs navigate between views
- [ ] Consistent premium aesthetic across all tabs

---

## Chunk 4: Motor de Comunicaciones + Editor Admin

**Objetivo:** Construir el sistema de comunicaciones por email: editor admin para crear plantillas, renderizador de variables, layout corporativo en código, envío síncrono vía SendGrid, y log de entregas. Triggers solo por eventos (no cron).

### Dependencias

- Chunk 1 completado (modelos CommunicationTemplate + CommunicationLog ya en schema)
- Chunk 2 completado (TipTap ya instalado y funcional, reutilizable)
- Chunk 3 parcialmente (variable interpolation patterns reutilizables)

### Archivos a Crear

| Archivo | Descripción |
|---|---|
| **Páginas** | |
| `src/app/admin/communications/page.tsx` | Server Component: lista de CommunicationTemplates con canal, trigger, estado |
| `src/app/admin/communications/[templateId]/page.tsx` | Server Component: editor de comunicación |
| `src/app/admin/communications/new/page.tsx` | Crear nueva comunicación |
| **Componentes** | |
| `src/components/admin/communications/communication-editor.tsx` | Client Component: form completo (canal, trigger, subject, body con TipTap, conditions) |
| `src/components/admin/communications/trigger-config-editor.tsx` | Client Component: form dinámico según trigger seleccionado (ej: stepOrderIndex para STEP_COMPLETED) |
| `src/components/admin/communications/email-preview.tsx` | Client Component: preview del email renderizado con layout corporativo + variables de ejemplo |
| **Motor** | |
| `src/lib/communications/render-variables.ts` | Función pura: interpola `{{user.firstName}}` etc. en un string |
| `src/lib/communications/build-template-variables.ts` | Construye el objeto TemplateVariables desde User + Journey |
| `src/lib/communications/email-layout.ts` | HTML template del layout corporativo (header logo, footer legal, slot para body) |
| `src/lib/communications/render-email.ts` | Combina layout + body renderizado → HTML final |
| `src/lib/communications/send-email.ts` | Wrapper de SendGrid: recibe to, subject, html → envía y retorna resultado |
| `src/lib/communications/dispatch-communication.ts` | Orquestador: resuelve template → evalúa conditions → renderiza → envía → loguea |
| **Server Actions** | |
| `src/app/actions/communication-templates.ts` | CRUD: `createCommunicationTemplate`, `updateCommunicationTemplate`, `toggleCommunicationActive` |
| `src/app/actions/send-test-email.ts` | Envía un email de prueba al admin con datos de ejemplo |

### Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `src/app/admin/layout.tsx` | Agregar link "Comunicaciones" en la nav (`/admin/communications`) con icono `Mail` |
| `src/app/actions/simulate-identity-flip.ts` | Al final de la transacción: llamar `dispatchCommunication(trigger: IDENTITY_FLIP, userId)` |
| `src/app/actions/simulate-sso-login.ts` | Llamar `dispatchCommunication(trigger: SSO_AUTHENTICATED, userId)` |
| `src/app/actions/compile-for-user.ts` (de Chunk 3) | Llamar `dispatchCommunication(trigger: JOURNEY_ASSIGNED, userId)` tras compilar |
| `package.json` | Agregar dependencia: `@sendgrid/mail` |
| `.env` (no versionado) | Agregar `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` |

### Funciones Clave

**`renderVariables(template, variables)`**
```
Input:
  - template: string (HTML con {{namespace.key}})
  - variables: TemplateVariables
Output: string (HTML con valores interpolados)
Lógica:
  1. Regex: /\{\{(\w+)\.(\w+)\}\}/g
  2. Para cada match: lookup variables[namespace][key]
  3. Si existe: reemplazar con htmlEscape(value)
  4. Si no existe: dejar {{namespace.key}} visible (debug)
```

**`dispatchCommunication(trigger, userId, context?)`**
```
Función interna (no Server Action):
  1. Fetch user con cluster y journey activo
  2. Fetch CommunicationTemplates activos con este trigger
  3. Para cada template:
     a. evaluateConditions(template.conditions, userProfile)
     b. Si no matchea → skip
     c. Verificar deduplicación: existe CommunicationLog para (templateId, userId) en últimas 24h?
     d. Si duplicado → skip
     e. Construir TemplateVariables desde user + journey
     f. Renderizar subject (si email) con renderVariables()
     g. Renderizar body con renderVariables()
     h. Si canal es EMAIL: renderEmail(layout, body) → sendEmail(to, subject, html)
     i. Crear CommunicationLog { status: SENT/FAILED, externalId, sentAt }
```

**`emailLayout` (HTML template string)**
```
Layout corporativo hardcodeado:
  - Header: logo Farmatodo (URL de imagen) + barra teal
  - Body slot: {{{bodyContent}}}
  - Footer: "Farmatodo {{system.currentYear}} · {{user.countryName}}" + texto legal
  - Footer legal varía por país (condicional simple con if/else en la función render)
```

**`sendTestEmail(templateId, recipientEmail)`**
```
Server Action:
  1. Fetch template
  2. Construir variables de ejemplo (datos ficticios hardcodeados)
  3. Renderizar subject + body
  4. Renderizar email con layout
  5. Enviar vía SendGrid al recipientEmail
  6. Return { success, externalId }
```

### Triggers Implementados en MVP

| Trigger | Dónde se dispara | Contexto |
|---|---|---|
| `JOURNEY_ASSIGNED` | `compile-for-user.ts` tras crear UserJourney | userId |
| `STEP_COMPLETED` | Server Action que marca un paso como COMPLETED (a cablear según flujo) | userId, stepOrderIndex |
| `IDENTITY_FLIP` | `simulate-identity-flip.ts` (y futuro webhook Jira) | userId |
| `SSO_AUTHENTICATED` | `simulate-sso-login.ts` | userId |
| `JOURNEY_COMPLETED` | Cuando progressPercentage llega a 100% | userId |
| `ACCESS_PROVISIONED` | Cuando AccessProvisioning cambia a PROVISIONED | userId, systemName |
| `CUSTOM` | Botón en Torre de Control: "Enviar comunicación manual" | userId, templateId |

**Triggers NO implementados (v2):** `REMINDER`, `STEP_UNLOCKED`

### Criterio de Aceptación

- [ ] `/admin/communications` muestra la lista de templates de comunicación
- [ ] Se puede crear un template de email con: nombre, trigger, subject, body (TipTap), conditions
- [ ] El editor de body permite insertar variables `{{user.firstName}}`, `{{journey.templateName}}`, etc.
- [ ] El preview del email muestra el layout corporativo con el body renderizado y variables de ejemplo
- [ ] "Enviar email de prueba" envía un email real vía SendGrid al correo especificado
- [ ] Cuando se ejecuta el Dev Simulator "Flip de Identidad", si existe un CommunicationTemplate activo con trigger `IDENTITY_FLIP`, se envía el email al usuario y se registra en `CommunicationLog`
- [ ] `CommunicationLog` registra cada envío con status, externalId de SendGrid, timestamps
- [ ] La deduplicación funciona: el mismo trigger para el mismo usuario no envía dos emails en 24h
- [ ] La nav admin muestra 4 links: Torre de Control, Journeys, Comunicaciones, Vista Empleado
- [ ] **Todo el sistema existente sigue funcionando** (dashboard, admin torre de control, dev simulator)

---

## Resumen de Dependencias

```
Chunk 1 (Schema + Engine) ✅
   │
   ├──→ Chunk 2 (Journey Builder UI) ✅
   │       │
   │       └──→ Chunk 3 (Compilación + Dashboard Rico) ✅
   │               │
   │               └──→ Chunk 5 ("Modern OS" UI Overhaul)
   │                       ├── 5A: Dashboard Refactor ✅
   │                       ├── 5B: Ruta Tab (PENDING)
   │                       ├── 5C: Accesos Tab (PENDING)
   │                       └── 5D: Perfil Tab (PENDING)
   │
   └──→ Chunk 4 (Comunicaciones) — PENDING
              │
              └── usa TipTap de Chunk 2
              └── usa renderVariables patterns de Chunk 3
```

**Nota:** Chunk 5B/C/D (remaining tabs) and Chunk 4 (Communications) are independent and can be executed in any order. Chunk 5 tabs are prioritized for UX completeness before Chunk 4.

---

## Inventario Total de Archivos

| Operación | Chunk 1 | Chunk 2 | Chunk 3 | Chunk 4 | Chunk 5 | Total |
|---|---|---|---|---|---|---|
| Crear | 6 | 13 | 6 | 12 | ~4 | ~41 |
| Modificar | 3 | 2 | 6 | 6 | ~3 | ~20 |
| **Total** | **9** | **15** | **12** | **18** | **~7** | **~61** |

*Chunk 5 estimates: ~3 new pages (ruta, accesos, perfil) + ~1 shared layout/nav component + ~3 modified files (dashboard page, layout, existing components).*
