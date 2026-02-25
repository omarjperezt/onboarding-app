# Arquitectura del Motor de Journeys Condicional y Plataforma Administrativa

> **Autor:** Claude (Staff Engineer) · **Fecha:** 2026-02-22
> **Estado:** BORRADOR — Pendiente de anotación por Product Owner
> **Contexto:** Farmatodo Onboarding OS · 9,000 empleados · VE/CO/AR

---

## Tabla de Contenidos

1. [Diagnóstico del Estado Actual](#1-diagnóstico-del-estado-actual)
2. [Conditional Journey Engine](#2-conditional-journey-engine)
3. [Actualización del Schema de Prisma](#3-actualización-del-schema-de-prisma)
4. [Motor de Comunicaciones](#4-motor-de-comunicaciones)
5. [Estrategia de UI/UX Administrativa: Journey Builder](#5-estrategia-de-uiux-administrativa-journey-builder)
6. [Plan de Migración y Compatibilidad](#6-plan-de-migración-y-compatibilidad)
7. [Riesgos y Decisiones Pendientes](#7-riesgos-y-decisiones-pendientes)

---

## 1. Diagnóstico del Estado Actual

### 1.1 Problema de Escalabilidad Combinatoria

El modelo actual vincula `JourneyTemplate` directamente a un `Cluster` (1:N). Esto implica que para soportar la matriz completa de combinaciones, RRHH necesitaría crear plantillas manuales para cada intersección:

```
3 países × N clusters × M roles = cientos de plantillas
```

**Ejemplo concreto:** Un "Onboarding APV - Operaciones Tienda Venezuela" es una plantilla distinta de "Onboarding APV - Operaciones Tienda Colombia", aunque compartan el 80% de sus pasos. La única diferencia puede ser un paso de regulación local o una plataforma de acceso distinta.

### 1.2 Limitaciones del TemplateStep Actual

- `contentUrl` es un string plano → no permite contenido rico editable por RRHH.
- `description` es texto libre → no soporta interpolación de variables del perfil del usuario.
- `requiresCorporateEmail` es el único predicado condicional → insuficiente para lógica como "solo si el cargo es Gerente" o "solo si el país es AR".
- No existe concepto de **variantes de contenido** por idioma, país o regulación.

### 1.3 Lo que Funciona Bien (y No Debemos Romper)

- **Modelo de ejecución `UserJourney` → `UserJourneyStep`:** La separación template/instancia es sólida.
- **El Flip de Identidad y Hard Gate:** Mecánica central validada que depende del `orderIndex` y `requiresCorporateEmail`.
- **Server Components + Prisma directa:** Pattern de cero-API que funciona para el dashboard.
- **Admin Torre de Control:** KPIs, tabla, drill-down — toda la infraestructura visual está montada.

---

## 2. Conditional Journey Engine

### 2.1 Concepto: "Compile-Time Journey"

En vez de mantener plantillas pre-armadas por cada combinación de país/cluster/rol, adoptamos un modelo de **plantilla base con pasos condicionales**. Cuando un usuario entra al sistema (vía webhook de Jira o creación manual), el motor **compila** su Journey evaluando las condiciones de cada paso contra el perfil del usuario.

```
                    ┌─────────────────────────┐
                    │   JourneyTemplate       │
                    │   "Onboarding General"  │
                    │                         │
                    │   TemplateStep 1 ────── │ ── conditions: null (universal)
                    │   TemplateStep 2 ────── │ ── conditions: { country: ["VE","CO"] }
                    │   TemplateStep 3 ────── │ ── conditions: { country: ["AR"] }
                    │   TemplateStep 4 ────── │ ── conditions: { cluster: "CENDIS" }
                    │   TemplateStep 5 ────── │ ── conditions: null (universal)
                    └─────────────────────────┘
                                │
                    compilar(perfil_usuario)
                                │
                    ┌─────────────────────────┐
                    │   UserJourney           │
                    │   (solo pasos que       │
                    │    matchean el perfil)  │
                    │                         │
                    │   Step 1 (universal)    │
                    │   Step 2 (VE match)     │
                    │   Step 5 (universal)    │
                    └─────────────────────────┘
```

**Ventaja clave:** RRHH mantiene **una sola plantilla** con 15-20 pasos, donde cada paso declara sus condiciones de inclusión. El sistema resuelve qué pasos aplican por usuario.

### 2.2 Modelo de Condiciones

Las condiciones se almacenan como JSONB en `TemplateStep.conditions`. Un paso sin condiciones (null) se incluye para todos los usuarios. Si tiene condiciones, **todas** deben cumplirse (AND lógico entre propiedades, OR dentro de arrays de valores).

#### Esquema de Condiciones

```typescript
// Stored as JSONB in TemplateStep.conditions
interface StepConditions {
  // Geográficas
  country?: Country[];           // OR: usuario en cualquiera de estos países
  cluster?: string[];            // OR: nombre del cluster (match por string)

  // Perfil laboral
  position?: string[];           // OR: match parcial (contains) contra cargo
  userStatus?: UserStatus[];     // OR: solo aplica a usuarios en estos estados

  // Identidad
  requiresCorporateEmail?: boolean; // migrado del campo actual booleano
  requiresSsoAuth?: boolean;        // paso visible solo post-SSO

  // Temporales
  hiredAfter?: string;           // ISO date: solo para empleados contratados después de X fecha
  hiredBefore?: string;          // ISO date: regulación legacy

  // Tags custom (extensibilidad futura)
  tags?: string[];               // match contra tags del usuario o cluster
}
```

#### Semántica de Evaluación

```
Para cada propiedad presente en conditions:
  - Arrays (country, cluster, position, tags): usuario.valor ∈ array → TRUE
  - Booleanos (requiresCorporateEmail): evaluación directa contra perfil
  - Fechas (hiredAfter/Before): comparación temporal

Resultado: AND entre todas las propiedades presentes.
Si conditions es null → paso universal (siempre se incluye).
```

**Ejemplo complejo:** Un paso con `{ country: ["VE", "CO"], cluster: ["CENDIS"], requiresCorporateEmail: true }` significa: "incluir este paso solo para usuarios en Venezuela O Colombia, que pertenezcan al cluster CENDIS, y que ya tengan email corporativo".

### 2.3 Proceso de Compilación

La compilación ocurre en un Server Action transaccional. Se invoca en dos momentos:

1. **Al crear el usuario** (webhook Jira o creación manual desde Admin).
2. **Al re-compilar manualmente** desde la Torre de Control (para cuando RRHH modifica una plantilla y quiere actualizar journeys activos).

```
compileJourney(userId, templateId):
  1. Fetch user profile (country, cluster, position, status, corporateEmail, ssoAuthenticatedAt, createdAt)
  2. Fetch template con todos sus TemplateSteps ordenados por orderIndex
  3. Para cada TemplateStep:
     - Si conditions es null → incluir
     - Si conditions no es null → evaluar contra perfil
       - Si TODAS las condiciones pasan → incluir
       - Si alguna falla → excluir
  4. Crear UserJourney con los pasos filtrados
  5. Asignar orderIndex secuencial al UserJourneyStep (1, 2, 3... sin huecos)
  6. Primer paso → PENDING, resto → LOCKED
  7. Calcular progressPercentage = 0
```

### 2.4 Re-compilación y Versionado

**Problema:** Si RRHH modifica una plantilla que tiene 500 journeys activos, ¿qué pasa con los journeys en curso?

**Estrategia: Re-compilación Selectiva con Preservación de Estado**

- La plantilla tiene un campo `version` (integer, autoincremental).
- Cada `UserJourney` guarda `compiledFromVersion`.
- Cuando RRHH publica una nueva versión, el admin puede:
  - **No hacer nada:** Journeys existentes siguen con su versión. Nuevos usuarios compilan con la nueva.
  - **Re-compilar selectivamente:** El admin escoge un segmento (por cluster, país, o uno-a-uno) y ejecuta re-compilación.
  - **La re-compilación preserva el estado de pasos completados:** Si el paso existía antes y sigue existiendo, mantiene su status COMPLETED. Si un paso nuevo aparece, se inserta como PENDING/LOCKED según posición.

**No implementamos versionado inmutable de plantillas (snapshot per journey).** Razón: para un MVP con 9,000 usuarios y cambios infrecuentes en plantillas, el overhead de snapshots es innecesario. El campo `compiledFromVersion` permite detectar drift sin materializar copias.

### 2.5 Asignación de Plantilla a Usuario

El modelo actual vincula `JourneyTemplate` a `Cluster`. Con el motor condicional, ampliamos esto:

- **`JourneyTemplate` ya no requiere `clusterId` como obligatorio.** Puede ser null (plantilla global) o mantener el FK para filtrado rápido.
- Se introduce un campo JSONB `applicability` en `JourneyTemplate` con la misma estructura de condiciones que los pasos, pero para decidir qué plantilla(s) aplican a un usuario.
- Un usuario puede tener **múltiples journeys activos** (ejemplo: "Onboarding General" + "Capacitación Regulatoria CO"). El constraint `@@unique([userId, journeyTemplateId])` actual ya lo soporta.

**Flujo de asignación automática:**

```
Cuando se crea un usuario:
  1. Evaluar todas las JourneyTemplates activas
  2. Filtrar las que matchean el perfil del usuario (via applicability)
  3. Para cada template que aplica → compilar UserJourney
```

---

## 3. Actualización del Schema de Prisma

### 3.1 Visión General de Cambios

Los cambios se concentran en tres áreas:

1. **Campos JSONB** en `TemplateStep` y `JourneyTemplate` para condiciones y contenido.
2. **Nuevo modelo `CommunicationTemplate`** para el motor de emails/SMS.
3. **Nuevos campos de auditoría y versionado** en modelos existentes.
4. **Nuevo modelo `StepContentBlock`** para contenido rico editable.

### 3.2 Schema Propuesto (Diff Conceptual)

A continuación se detalla cada modelo con los cambios marcados como `// NUEVO` o `// MODIFICADO`:

#### Enums Nuevos

```prisma
enum CommunicationChannel {
  EMAIL
  SMS
  WHATSAPP
  IN_APP
}

enum CommunicationTrigger {
  JOURNEY_ASSIGNED          // Cuando se compila un journey para el usuario
  STEP_UNLOCKED             // Cuando un paso pasa a PENDING
  STEP_COMPLETED            // Cuando un paso se marca COMPLETED
  IDENTITY_FLIP             // Cuando llega el webhook de Jira con el corporateEmail
  SSO_AUTHENTICATED         // Cuando el usuario re-autentica con Google
  JOURNEY_COMPLETED         // Cuando el journey llega a 100%
  REMINDER                  // Cron/scheduled: paso pendiente > N días
  ACCESS_PROVISIONED        // Cuando un acceso cambia a PROVISIONED
  CUSTOM                    // Trigger manual desde admin
}

enum ContentBlockType {
  RICH_TEXT                 // HTML editable por RRHH
  VIDEO_EMBED              // URL de video (YouTube, Vimeo, Loom)
  PDF_LINK                 // Documento descargable
  CHECKLIST                // Lista de verificación interactiva
  FORM_LINK                // URL a formulario externo (Google Forms, Typeform)
}
```

#### JourneyTemplate (Modificado)

```prisma
model JourneyTemplate {
  id            String   @id @default(uuid()) @db.Uuid
  clusterId     String?  @map("cluster_id") @db.Uuid          // MODIFICADO: ahora nullable
  name          String
  description   String?                                        // NUEVO
  isActive      Boolean  @default(true) @map("is_active")
  version       Int      @default(1)                           // NUEVO
  applicability Json?    @db.JsonB                             // NUEVO: condiciones para auto-asignación

  cluster      Cluster?        @relation(fields: [clusterId], references: [id])  // MODIFICADO: opcional
  steps        TemplateStep[]
  userJourneys UserJourney[]
  communications CommunicationTemplate[]                       // NUEVO

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")             // NUEVO

  @@index([clusterId, isActive])
  @@map("journey_templates")
}
```

#### TemplateStep (Modificado)

```prisma
model TemplateStep {
  id                String          @id @default(uuid()) @db.Uuid
  journeyTemplateId String          @map("journey_template_id") @db.Uuid
  orderIndex        Int             @map("order_index")
  title             String
  description       String?
  stepType          StepType        @map("step_type")
  isOptional        Boolean         @default(false) @map("is_optional")

  // ── NUEVOS ──
  conditions        Json?           @db.JsonB      // Condiciones de inclusión (null = universal)
  contentPayload    Json?           @db.JsonB      // Contenido rico estructurado
  estimatedMinutes  Int?            @map("estimated_minutes")  // Duración estimada del paso
  iconName          String?         @map("icon_name")          // Nombre de icono Lucide

  // ── ELIMINADOS (migrados) ──
  // contentUrl         → migrado a contentPayload.blocks[].value
  // requiresCorporateEmail → migrado a conditions.requiresCorporateEmail

  journeyTemplate  JourneyTemplate  @relation(fields: [journeyTemplateId], references: [id], onDelete: Cascade)
  userJourneySteps UserJourneyStep[]

  @@unique([journeyTemplateId, orderIndex])
  @@index([journeyTemplateId])
  @@map("template_steps")
}
```

#### Estructura de `contentPayload` (JSONB)

```typescript
// Almacenado en TemplateStep.contentPayload
interface ContentPayload {
  // Bloques de contenido ordenados, renderizados secuencialmente
  blocks: ContentBlock[];
}

interface ContentBlock {
  id: string;            // UUID para referencia estable
  type: ContentBlockType;

  // Según el type:
  // RICH_TEXT → value es HTML con variables interpolables
  value: string;

  // Metadata adicional por tipo
  meta?: {
    label?: string;         // Título visible del bloque
    thumbnailUrl?: string;  // Preview para VIDEO_EMBED
    fileName?: string;      // Nombre para PDF_LINK
    checklistItems?: string[]; // Items para CHECKLIST
  };
}

// Ejemplo concreto:
{
  "blocks": [
    {
      "id": "b1",
      "type": "RICH_TEXT",
      "value": "<p>Hola <strong>{{user.firstName}}</strong>, bienvenido al equipo de <em>{{user.cluster}}</em>.</p><p>Tu supervisor es {{user.supervisorName}}.</p>"
    },
    {
      "id": "b2",
      "type": "VIDEO_EMBED",
      "value": "https://www.youtube.com/embed/xxxxx",
      "meta": { "label": "Video de bienvenida Farmatodo" }
    },
    {
      "id": "b3",
      "type": "CHECKLIST",
      "value": "",
      "meta": {
        "label": "Confirma que completaste:",
        "checklistItems": [
          "Vi el video completo",
          "Leí el código de conducta",
          "Firmé digitalmente la política de datos"
        ]
      }
    }
  ]
}
```

#### Estructura de `conditions` (JSONB)

```typescript
// Almacenado en TemplateStep.conditions y JourneyTemplate.applicability
// null = aplica a todos
interface StepConditions {
  country?: ("VE" | "CO" | "AR")[];
  cluster?: string[];
  position?: string[];      // match parcial (contains, case-insensitive)
  userStatus?: ("PRE_HIRE" | "ACTIVE" | "SUSPENDED")[];
  requiresCorporateEmail?: boolean;
  requiresSsoAuth?: boolean;
  hiredAfter?: string;      // ISO 8601
  hiredBefore?: string;     // ISO 8601
  tags?: string[];           // match contra user.tags (futuro)
}

// Ejemplo: paso solo para CENDIS en Venezuela
{
  "country": ["VE"],
  "cluster": ["CENDIS"]
}

// Ejemplo: paso solo post-flip para roles gerenciales
{
  "requiresCorporateEmail": true,
  "position": ["Gerente", "Coordinador", "Director"]
}
```

#### UserJourney (Modificado)

```prisma
model UserJourney {
  id                    String        @id @default(uuid()) @db.Uuid
  userId                String        @map("user_id") @db.Uuid
  journeyTemplateId     String        @map("journey_template_id") @db.Uuid
  progressPercentage    Int           @default(0) @map("progress_percentage")
  status                JourneyStatus @default(IN_PROGRESS)
  compiledFromVersion   Int           @default(1) @map("compiled_from_version")  // NUEVO

  user            User              @relation(fields: [userId], references: [id])
  journeyTemplate JourneyTemplate   @relation(fields: [journeyTemplateId], references: [id])
  steps           UserJourneyStep[]

  startedAt   DateTime  @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

  @@unique([userId, journeyTemplateId])
  @@index([userId])
  @@index([status])
  @@map("user_journeys")
}
```

#### UserJourneyStep (Modificado)

```prisma
model UserJourneyStep {
  id               String     @id @default(uuid()) @db.Uuid
  userJourneyId    String     @map("user_journey_id") @db.Uuid
  templateStepId   String     @map("template_step_id") @db.Uuid
  status           StepStatus @default(LOCKED)
  resolvedOrder    Int        @map("resolved_order")                    // NUEVO: orden post-compilación
  checklistState   Json?      @db.JsonB                                 // NUEVO: estado de checklist items

  userJourney  UserJourney  @relation(fields: [userJourneyId], references: [id], onDelete: Cascade)
  templateStep TemplateStep @relation(fields: [templateStepId], references: [id])

  completedAt DateTime? @map("completed_at")

  @@unique([userJourneyId, templateStepId])
  @@index([userJourneyId])
  @@index([status])
  @@map("user_journey_steps")
}
```

#### CommunicationTemplate (Nuevo)

```prisma
model CommunicationTemplate {
  id                  String               @id @default(uuid()) @db.Uuid
  journeyTemplateId   String?              @map("journey_template_id") @db.Uuid
  name                String               // "Email de bienvenida", "Recordatorio paso pendiente"
  channel             CommunicationChannel
  trigger             CommunicationTrigger
  triggerConfig       Json?                @db.JsonB  // Config adicional del trigger (ver abajo)

  // Contenido
  subject             String?              // Asunto (solo EMAIL)
  bodyTemplate        String               @db.Text   // HTML con {{variables}} (EMAIL) o texto plano (SMS)

  // Control
  isActive            Boolean              @default(true) @map("is_active")
  conditions          Json?                @db.JsonB  // Misma estructura de StepConditions

  journeyTemplate     JourneyTemplate?     @relation(fields: [journeyTemplateId], references: [id])
  communicationLogs   CommunicationLog[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([trigger, isActive])
  @@index([journeyTemplateId])
  @@map("communication_templates")
}
```

#### CommunicationLog (Nuevo)

```prisma
model CommunicationLog {
  id                      String   @id @default(uuid()) @db.Uuid
  communicationTemplateId String   @map("communication_template_id") @db.Uuid
  userId                  String   @map("user_id") @db.Uuid
  channel                 CommunicationChannel
  recipientAddress        String   @map("recipient_address")  // email o teléfono
  renderedSubject         String?  @map("rendered_subject")
  status                  String   // "QUEUED", "SENT", "DELIVERED", "FAILED", "BOUNCED"
  externalId              String?  @map("external_id")  // ID de SendGrid/Twilio
  errorMessage            String?  @map("error_message")

  communicationTemplate   CommunicationTemplate @relation(fields: [communicationTemplateId], references: [id])
  user                    User                  @relation(fields: [userId], references: [id])

  sentAt      DateTime? @map("sent_at")
  deliveredAt DateTime? @map("delivered_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@index([communicationTemplateId])
  @@index([status])
  @@map("communication_logs")
}
```

#### User (Modificado)

```prisma
model User {
  id              String     @id @default(uuid()) @db.Uuid
  jiraEmployeeId  String?    @map("jira_employee_id")
  fullName        String     @map("full_name")
  personalEmail   String     @unique @map("personal_email")
  corporateEmail  String?    @unique @map("corporate_email")
  phoneNumber     String?    @map("phone_number")          // NUEVO: para SMS/WhatsApp
  status          UserStatus @default(PRE_HIRE)
  position        String?
  ssoAuthenticatedAt DateTime? @map("sso_authenticated_at")
  tags            String[]   @default([])                   // NUEVO: tags flexibles para conditions matching
  clusterId       String     @map("cluster_id") @db.Uuid

  cluster             Cluster              @relation(fields: [clusterId], references: [id])
  journeys            UserJourney[]
  accessProvisionings AccessProvisioning[]
  sponsoredExternals  ExternalIdentity[]   @relation("SponsorExternals")
  communicationLogs   CommunicationLog[]                    // NUEVO

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([status])
  @@index([clusterId])
  @@index([corporateEmail])
  @@map("users")
}
```

### 3.3 Índices y Performance

Para queries JSONB frecuentes, se deben crear índices GIN en la migración SQL raw:

```sql
-- Índice GIN para búsquedas en conditions de TemplateStep
CREATE INDEX idx_template_steps_conditions ON template_steps USING GIN (conditions jsonb_path_ops);

-- Índice GIN para applicability de JourneyTemplate
CREATE INDEX idx_journey_templates_applicability ON journey_templates USING GIN (applicability jsonb_path_ops);

-- Índice GIN para tags de User
CREATE INDEX idx_users_tags ON users USING GIN (tags);
```

Estos índices permiten queries como `WHERE conditions @> '{"country": ["VE"]}'` sin full table scan.

### 3.4 Estrategia de Migración

La migración se ejecuta en **3 pasos secuenciales** para no romper el sistema en funcionamiento:

1. **Migración aditiva:** Agregar todos los campos nuevos como nullable/con defaults. No eliminar nada.
2. **Migración de datos:** Script que:
   - Copia `contentUrl` al formato `contentPayload.blocks[0]` para cada TemplateStep existente.
   - Copia `requiresCorporateEmail: true` a `conditions: { requiresCorporateEmail: true }`.
   - Genera `resolvedOrder` en UserJourneyStep igualando el `orderIndex` del TemplateStep.
3. **Migración de limpieza (diferida):** Eliminar campos legacy (`contentUrl`, `requiresCorporateEmail`) solo cuando todo el código ya use los nuevos campos. Esto se hace en una sesión posterior.

---

## 4. Motor de Comunicaciones

### 4.1 Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                       │
│  Admin UI: Editor de templates (HTML WYSIWYG + preview)      │
│  Variables: autocompletado de {{user.*}}, {{journey.*}}      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    CAPA DE ORQUESTACIÓN                       │
│  1. Event Listener: detecta triggers (step completado, etc)  │
│  2. Template Resolver: selecciona template(s) que aplican    │
│  3. Condition Evaluator: evalúa conditions del template      │
│  4. Variable Renderer: interpola {{variables}} en body       │
│  5. Channel Router: decide canal (email, SMS, in-app)        │
│  6. Queue: encola en tabla CommunicationLog (status=QUEUED)  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    CAPA DE ENTREGA                            │
│  Worker (Cloud Tasks / Cron):                                │
│  - Lee CommunicationLog con status=QUEUED                    │
│  - Renderiza layout corporativo + body                       │
│  - Envía vía proveedor (SendGrid email, Twilio SMS)          │
│  - Actualiza status a SENT/FAILED                            │
│  - Registra externalId para tracking                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Separación Layout Corporativo vs. Contenido Editable

**Principio fundamental:** RRHH no debería poder romper el layout corporativo del email. Ellos editan **solo el contenido interno**; el envoltorio visual (header con logo, footer legal, colores de marca) es código controlado por ingeniería.

#### Layout Corporativo (Código en el repositorio)

```
src/
  lib/
    communications/
      layouts/
        email-base.tsx        ← Layout React Email (compilable a HTML)
        email-onboarding.tsx  ← Variante para emails de onboarding
        email-reminder.tsx    ← Variante para recordatorios
      render-email.ts         ← Función que combina layout + body
```

El layout es un componente React Email (o HTML template string) que define:
- Header con logo Farmatodo
- Paleta de colores teal/brand
- Footer con textos legales por país (dinámico según `{{user.country}}`)
- Slot `{{{bodyContent}}}` donde se inyecta el HTML de RRHH

#### Contenido Editable (RRHH via Admin UI)

El campo `bodyTemplate` de `CommunicationTemplate` contiene HTML con variables:

```html
<h2>¡Bienvenido/a, {{user.firstName}}!</h2>
<p>
  Tu proceso de onboarding en <strong>{{user.clusterName}}</strong>
  ({{user.countryName}}) ha comenzado.
</p>
<p>
  Ingresa a la plataforma con tu correo <em>{{user.personalEmail}}</em>
  para completar tu primer paso.
</p>
<a href="{{system.dashboardUrl}}"
   style="background-color: #0d9488; color: white; padding: 12px 24px;
          border-radius: 8px; text-decoration: none; display: inline-block;">
  Ir a mi Onboarding
</a>
```

### 4.3 Variables Disponibles para Interpolación

```typescript
interface TemplateVariables {
  user: {
    firstName: string;        // Primer nombre extraído de fullName
    fullName: string;
    personalEmail: string;
    corporateEmail: string | null;
    position: string | null;
    clusterName: string;
    country: string;          // "VE", "CO", "AR"
    countryName: string;      // "Venezuela", "Colombia", "Argentina"
    status: string;
  };
  journey: {
    templateName: string;
    progressPercentage: number;
    currentStepTitle: string | null;    // Título del paso PENDING más próximo
    completedStepsCount: number;
    totalStepsCount: number;
  };
  system: {
    dashboardUrl: string;     // URL base + path al dashboard
    adminUrl: string;
    supportEmail: string;
    currentYear: string;
  };
  // Extensible: se pueden agregar más namespaces sin romper templates existentes
}
```

### 4.4 Renderizado de Variables

El motor de renderizado es un simple reemplazo de strings con sanitización:

```
Proceso:
1. Parsear body buscando patrones {{namespace.key}}
2. Para cada match, buscar en el objeto TemplateVariables
3. Si la variable existe → reemplazar con valor (HTML-escaped para prevenir XSS)
4. Si la variable no existe → dejar el placeholder visible (facilita debug)
5. Inyectar body renderizado en el slot del layout corporativo
6. Output: HTML completo listo para envío
```

**Decisión de diseño:** No usamos un motor de templates complejo (Handlebars, Liquid) en el MVP. Un reemplazo simple de `{{var}}` cubre el 95% de los casos. Si RRHH necesita condicionales en el contenido del email (ej: "si país es VE mostrar X"), eso se resuelve creando dos CommunicationTemplates con conditions distintas, no con lógica dentro del template.

### 4.5 Configuración de Triggers

El campo `triggerConfig` de `CommunicationTemplate` permite parametrizar el trigger:

```typescript
// Para trigger REMINDER:
{
  "delayDays": 3,              // enviar 3 días después de que el paso quedó PENDING
  "maxReminders": 2,           // no enviar más de 2 recordatorios por paso
  "onlyForStepTypes": ["ACTION"] // solo recordar pasos de tipo ACTION
}

// Para trigger STEP_COMPLETED:
{
  "stepOrderIndex": 2          // solo cuando se completa el paso 2 específicamente
}

// Para trigger CUSTOM:
{
  "adminOnly": true            // solo disparable desde la Torre de Control
}
```

### 4.6 Deduplicación y Rate Limiting

Para evitar spam al usuario:

- **Deduplicación:** Antes de encolar, verificar en `CommunicationLog` si ya existe un registro con el mismo `(templateId, userId, canal)` en las últimas 24 horas con status != FAILED.
- **Rate limit por usuario:** Máximo 5 comunicaciones por usuario por día (configurable). Exceso se encola para el día siguiente.
- **Cooldown post-acción:** Tras un evento (ej. step completed), esperar 30 segundos antes de encolar, para consolidar eventos rápidos sucesivos (útil si un webhook marca varios pasos a la vez).

---

## 5. Estrategia de UI/UX Administrativa: Journey Builder

### 5.1 Filosofía de Diseño

El Journey Builder no es un "form builder" genérico. Es un editor especializado para **secuencias lineales de pasos con condiciones**. La metáfora visual es una **lista vertical ordenada** (no un canvas de nodos), porque los journeys de onboarding son inherentemente secuenciales.

**Decisión: No implementar drag & drop en el MVP.**

Razones:
1. Las librerías de DnD en React (dnd-kit, react-beautiful-dnd) agregan complejidad significativa y edge cases con Server Components.
2. Con 10-20 pasos por plantilla, un par de botones "mover arriba/abajo" es suficiente.
3. DnD es un refinamiento de UX para una v2 cuando tengamos feedback real de RRHH.

### 5.2 Estructura de Páginas

```
src/app/admin/
  layout.tsx                          ← Ya existe: nav Admin
  page.tsx                            ← Ya existe: Torre de Control (Dashboard)
  journeys/
    page.tsx                          ← NUEVO: Lista de JourneyTemplates
    [templateId]/
      page.tsx                        ← NUEVO: Editor de Journey (Journey Builder)
      preview/
        page.tsx                      ← NUEVO: Preview del journey compilado
  communications/
    page.tsx                          ← NUEVO: Lista de CommunicationTemplates
    [templateId]/
      page.tsx                        ← NUEVO: Editor de comunicación
```

### 5.3 Journey Builder — Vista de Edición de Template

#### Layout General

```
┌──────────────────────────────────────────────────────────┐
│  ← Volver a Journeys    "Onboarding General"     [Publicar v3] │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ┌─ Información General ───────────────────────────────┐ │
│  │ Nombre: [________________]  Estado: [● Activo]      │ │
│  │ Cluster (opcional): [Dropdown]  País: [Dropdown]    │ │
│  │ Descripción: [________________________]             │ │
│  │ Applicability (JSON): [Expandir editor]             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Pasos del Journey ─────────────────────────────────┐ │
│  │                                                     │ │
│  │  ┌─ Paso 1 ──────────────────────────────────── ↕ ┐ │ │
│  │  │ "Bienvenida y datos personales"    [INFO]     │ │ │
│  │  │ Condiciones: Ninguna (universal)              │ │ │
│  │  │ [Editar] [Duplicar] [Eliminar]                │ │ │
│  │  └───────────────────────────────────────────────┘ │ │
│  │       │ (conector visual)                           │ │
│  │  ┌─ Paso 2 ──────────────────────────────────── ↕ ┐ │ │
│  │  │ "Creación identidad corporativa"  [APPROVAL]  │ │ │
│  │  │ Condiciones: requiresCorporateEmail: false     │ │ │
│  │  │ [Editar] [Duplicar] [Eliminar]                │ │ │
│  │  └───────────────────────────────────────────────┘ │ │
│  │       │                                             │ │
│  │  ┌─ Paso 3 (condicional) ──────────────────── ↕ ┐  │ │
│  │  │ "Regulación sanitaria VE"         [ACTION]  │  │ │
│  │  │ ⚡ Condiciones: country: [VE]                │  │ │
│  │  │ [Editar] [Duplicar] [Eliminar]              │  │ │
│  │  └─────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  [+ Agregar paso]                                   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Preview ───────────────────────────────────────────┐ │
│  │ Simular para perfil:                                │ │
│  │ País: [VE ▼]  Cluster: [CENDIS ▼]  Cargo: [___]   │ │
│  │ [Compilar Preview]                                  │ │
│  │                                                     │ │
│  │ Resultado: 5 de 8 pasos aplican para este perfil    │ │
│  │ ✓ Paso 1: Bienvenida...                            │ │
│  │ ✓ Paso 2: Creación identidad...                    │ │
│  │ ✗ Paso 3: Regulación sanitaria VE (excluido)       │ │
│  │ ✓ Paso 4: ...                                      │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 5.4 Panel de Edición de Paso (Sheet Lateral)

Al hacer clic en "Editar" en un paso, se abre un Sheet (slide-over) con:

```
┌── Editar Paso ──────────────────────────┐
│                                          │
│  Título: [__________________________]    │
│  Tipo:   [INFO ▼] [ACTION ▼] [APPROVAL] │
│  Duración estimada: [__] minutos         │
│  Icono: [Seleccionar ícono Lucide]       │
│  Opcional: [ ] Sí                        │
│                                          │
│  ── Condiciones de Inclusión ──          │
│  País:    [×VE] [×CO] [+]               │
│  Cluster: [×CENDIS] [+]                 │
│  Cargo:   [contiene: "Gerente"] [+]     │
│  Req. email corp: [Toggle]              │
│  Req. SSO: [Toggle]                     │
│                                          │
│  ── Contenido del Paso ──                │
│  Bloque 1: [RICH_TEXT]                   │
│  ┌──────────────────────────────┐        │
│  │ Editor WYSIWYG (TipTap)     │        │
│  │ con toolbar: B I U Link     │        │
│  │ y inserción de {{variables}}│        │
│  └──────────────────────────────┘        │
│  [+ Agregar bloque de contenido]         │
│                                          │
│  [Cancelar]              [Guardar paso]  │
└──────────────────────────────────────────┘
```

### 5.5 Componentes Técnicos Clave

| Componente | Tipo | Responsabilidad |
|---|---|---|
| `JourneyListPage` | Server Component | Lista todas las plantillas con badge de versión y conteo de usuarios |
| `JourneyBuilderPage` | Server Component | Carga la plantilla y sus pasos, renderiza el editor |
| `StepList` | Client Component | Lista ordenada de pasos con reordenamiento (botones arriba/abajo) |
| `StepCard` | Client Component | Card colapsable de un paso con resumen de condiciones |
| `StepEditorSheet` | Client Component | Sheet lateral para edición completa de un paso |
| `ConditionEditor` | Client Component | UI para agregar/quitar condiciones (dropdowns + chips) |
| `ContentBlockEditor` | Client Component | Editor por tipo de bloque (TipTap para RICH_TEXT, input URL para VIDEO) |
| `JourneyPreview` | Client Component | Simulador que compila el journey para un perfil ficticio |
| `VariableInserter` | Client Component | Dropdown que inserta `{{user.firstName}}` etc. en el cursor del editor |

### 5.6 Editor de Contenido Rico: TipTap

Para el editor WYSIWYG de bloques RICH_TEXT, usamos **TipTap** (basado en ProseMirror):

- Open source, headless (se integra con shadcn/ui sin conflictos de estilo).
- Extensión custom para nodos `{{variable}}` que se renderizan como chips no-editables inline.
- Output: HTML limpio (el mismo que se almacena en `contentPayload.blocks[].value`).
- No requiere dependencia pesada tipo CKEditor o Quill.

**Instalación:** `npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link`

### 5.7 Editor de Comunicaciones

Estructura similar al editor de pasos, pero enfocada en:

- Selector de canal (EMAIL, SMS, WHATSAPP, IN_APP)
- Selector de trigger (dropdown con los CommunicationTrigger)
- Configuración del trigger (JSON form dinámico según el trigger seleccionado)
- Editor de asunto (solo para EMAIL, con soporte de {{variables}})
- Editor de body (TipTap para EMAIL, textarea para SMS/WhatsApp con contador de caracteres)
- Preview renderizado en tiempo real (panel derecho que muestra el email con layout corporativo)
- Botón "Enviar email de prueba a mi correo"

### 5.8 Flujo de Guardado

El Journey Builder usa un patrón de **guardado explícito con validación**:

1. **Edición en memoria:** Todos los cambios se acumulan en estado React local.
2. **Validación client-side:** Al hacer clic en "Guardar paso", se valida:
   - Título no vacío
   - Al menos un bloque de contenido si el tipo es INFO
   - JSON de condiciones es válido
3. **Guardado via Server Action:** `saveTemplateStep(templateId, stepData)` — upsert atómico.
4. **Publicación:** "Publicar vN" incrementa `version`, no modifica journeys existentes.
5. **No hay auto-save.** Razón: las plantillas afectan potencialmente miles de usuarios; el guardado debe ser intencional.

### 5.9 Navegación Admin Actualizada

```
Admin Nav (sidebar o tabs):
  - Torre de Control     → /admin           (ya existe)
  - Journeys             → /admin/journeys  (nuevo)
  - Comunicaciones       → /admin/communications (nuevo)
  - Empleados            → (futuro, ya existe como tabla en Torre de Control)
```

---

## 6. Plan de Migración y Compatibilidad

### 6.1 Fases de Implementación

| Fase | Alcance | Dependencias |
|---|---|---|
| **Fase A: Schema + Motor** | Migración Prisma aditiva, función `compileJourney()`, función `evaluateConditions()` | Ninguna |
| **Fase B: Journey Builder UI** | Páginas admin/journeys, StepEditor, ConditionEditor, ContentBlockEditor | Fase A |
| **Fase C: Preview + Compilación** | JourneyPreview, acción de compilar/re-compilar desde admin | Fase A + B |
| **Fase D: Motor de Comunicaciones** | CommunicationTemplate CRUD, editor, renderizado, deduplicación | Fase A |
| **Fase E: Integración Email** | Layout React Email, integración SendGrid, CommunicationLog | Fase D |
| **Fase F: Limpieza Legacy** | Eliminar campos `contentUrl`, `requiresCorporateEmail` del schema | Todo lo anterior |

### 6.2 Compatibilidad con Código Existente

Durante la transición (Fases A-E), el código existente sigue funcionando:

- `dashboard/page.tsx` sigue leyendo `templateStep.description` y `templateStep.contentUrl` → campos aún presentes.
- `journey-step-card.tsx` sigue usando `requiresCorporateEmail` como prop → campo aún presente.
- `simulate-identity-flip.ts` sigue usando `orderIndex === 2` como heurística → funciona porque `TemplateStep.orderIndex` no se elimina.
- Solo cuando la Fase F se ejecute, se refactorizan estos componentes para leer de `contentPayload` y `conditions`.

---

## 7. Riesgos y Decisiones Pendientes

### 7.1 Decisiones que Requieren Input del PO

| # | Decisión | Opciones | Impacto |
|---|---|---|---|
| D1 | ¿Permitir journeys multi-template por usuario? | Sí (actual) vs. Forzar uno solo | Cambia la compilación: ¿qué pasa si dos templates asignan pasos contradictorios? |
| D2 | ¿RRHH edita HTML directamente o solo texto plano con formato básico? | HTML libre vs. Markdown vs. TipTap restringido | Define el nivel del editor WYSIWYG |
| D3 | ¿Cuál es el proveedor de email y SMS para producción? | SendGrid, Resend, Amazon SES / Twilio, MessageBird | Afecta el modelo de CommunicationLog.externalId |
| D4 | ¿Los recordatorios automáticos se implementan en MVP o v2? | MVP (Fase D) vs. Diferido | Si es MVP, necesitamos un cron job desde el día 1 |
| D5 | ¿Implementar DnD para reordenar pasos en v1 o v2? | v1 (dnd-kit) vs. v2 (botones arriba/abajo en v1) | +2-3 días de implementación, riesgo de bugs touch en mobile |
| D6 | ¿Versionado de plantillas con diff visual o solo numérico? | Diff visual vs. Solo número de versión | Diff visual es significativamente más complejo |
| D7 | ¿Mantener el campo `clusterId` en `JourneyTemplate` o eliminarlo completamente? | Mantener como shortcut vs. Eliminar y usar solo `applicability` | Mantener simplifica queries existentes pero introduce dualidad |

### 7.2 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| JSONB conditions se vuelven inmanejables sin validación | Alta | Medio | Implementar validación Zod del schema en el Server Action de guardado |
| TipTap + Server Components: hidratación compleja | Media | Medio | Lazy-load TipTap solo en la ruta del editor, no en el dashboard |
| Re-compilación masiva bloquea la DB | Baja | Alto | Ejecutar en batches de 50 con delay entre batches; usar Cloud Tasks |
| Variables `{{}}` en emails causan XSS | Media | Alto | Escapar HTML en el renderizador de variables, nunca `dangerouslySetInnerHTML` sin sanitizar |
| Prisma v6 no soporta `@db.JsonB` type-safe en queries | Cierta | Bajo | Usar `Prisma.JsonValue` + cast manual con Zod validation |

### 7.3 Fuera de Alcance (Deliberado)

- **A/B testing de journeys:** Demasiado complejo para MVP. Si se necesita, se crea una segunda plantilla manualmente.
- **Branching condicional dentro del journey (if/else entre pasos):** Los journeys son lineales. Las condiciones filtran pasos, no crean bifurcaciones.
- **Editor visual de condiciones tipo "rule builder":** Para el MVP, las condiciones se editan con dropdowns simples. Un visual query builder es v2.
- **Webhooks de salida (notificar a Jira cuando un paso se completa):** Actualmente el flujo es Jira → Onboarding OS, no al revés.
- **Multi-idioma en contenido de pasos:** El contenido se escribe en español. Si se necesita inglés, se crea un paso condicional con `country: ["US"]` (futuro).

---

## Apéndice: Glosario

| Término | Definición |
|---|---|
| **Compilar un Journey** | Evaluar las condiciones de cada TemplateStep contra el perfil de un usuario y generar su UserJourney personalizado |
| **Condición universal** | Un TemplateStep con `conditions: null` — se incluye para todos los usuarios |
| **Paso condicional** | Un TemplateStep con `conditions` no-null — solo se incluye si el perfil del usuario matchea |
| **Flip de Identidad** | Momento en que el sistema inyecta el `corporateEmail` del usuario y fuerza la transición a SSO |
| **Hard Gate** | Bloqueo de pasos posteriores al flip hasta que el usuario re-autentique con Google SSO |
| **contentPayload** | Campo JSONB que almacena contenido rico estructurado (bloques de HTML, video, checklists) |
| **applicability** | Campo JSONB en JourneyTemplate que define qué usuarios deberían recibir esta plantilla automáticamente |
| **compiledFromVersion** | Registro de qué versión de la plantilla se usó para compilar el UserJourney de un usuario |
