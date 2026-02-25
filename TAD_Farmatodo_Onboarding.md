# Documento de Arquitectura Técnica (TAD) - Farmatodo Onboarding & Identity OS

## 1. Visión General del Sistema
El sistema será una WebApp (Mobile-First / PWA) impulsada por eventos, diseñada para gestionar el ciclo de vida del empleado (Onboarding, Gestión de Accesos, Offboarding y Externos) para los 3 países de la operación de Farmatodo (Venezuela, Colombia, Argentina). Actuará como un orquestador que reacciona a los cambios de estado en Jira ITSM y guía al usuario final a través de una experiencia fluida, desde su correo personal hasta la adopción total de su identidad corporativa (Google Cloud Identity).

## 2. Stack Tecnológico (Optimizado para MVP y Escala en GCP)
* **Framework Fullstack:** Next.js 14+ (App Router) con TypeScript. Permite Server-Side Rendering, API Routes nativas y la creación de la PWA.
* **UI/UX:** TailwindCSS + shadcn/ui (para componentes accesibles, rápidos de implementar y de clase mundial).
* **Base de Datos:** PostgreSQL alojado en Google Cloud SQL.
* **ORM:** Prisma (Excelente para tipado estricto con TypeScript e ideal para code-generation con IAs).
* **Autenticación:** NextAuth.js (Auth.js) soportando Login por Magic Link (email personal) y SSO (Google Provider corporativo).
* **Infraestructura de Despliegue:** Google Cloud Run (Serverless, escala a 0, maneja picos de tráfico de tiendas de forma transparente).
* **Background Jobs:** Google Cloud Tasks (para reintentar webhooks fallidos, lógica pesada o envíos de SMS/Emails vía SendGrid sin bloquear la UI).

## 3. Arquitectura de Integración y Flujo de Datos (Arquitectura Orientada a Eventos)

Dado que dependemos de Jira ITSM (expuesto a internet), implementaremos un patrón de **Webhook Catcher**:

1. **Ingreso (Trigger):** Jira ITSM emite un Webhook HTTP POST a nuestro endpoint protegido (`/api/webhooks/jira`) cuando un ticket de "Nuevo Ingreso" cambia a estado "Aprobado" o "En Proceso".
2. **Procesamiento (Backend):** Next.js valida la firma criptográfica (HMAC/Token) de Jira. Si es válida, extrae el payload (Nombre, Apellido, Email Personal, Cargo, Cluster, País).
3. **Creación de Estado (DB):** Se crea el registro del usuario en PostgreSQL en estado `PRE_HIRE`, se le asigna su `Journey` basado en el Cluster (ej. Operaciones Tienda - VE) y se disparan las tareas en segundo plano.
4. **Notificación (Cloud Tasks):** Se encola el envío del correo de bienvenida inicial y el SMS/WhatsApp de aviso.
5. **El "Flip" de Identidad:** El empleado entra con su correo personal (Paso 1 del Journey). Cuando el ticket de TI en Jira se cierra (indicando que el Cloud Identity fue creado), Jira envía otro webhook. Nuestro sistema actualiza el registro, inyecta el `email_corp`, y el siguiente paso del Journey obliga al usuario a iniciar sesión con el SSO de Google para continuar, habilitando así su acceso a la SuperApp operativa.

## 4. Diagrama Entidad-Relación (ERD)

Este modelo relacional está normalizado para soportar la jerarquía organizacional y la flexibilidad de plantillas de RRHH, evitando la sobreingeniería pero garantizando integridad.

```mermaid
erDiagram
    %% Core Identity
    USER {
        uuid id PK
        string jira_employee_id "Ticket o ID de referencia"
        string full_name
        string personal_email "Para acceso inicial"
        string corporate_email "Nullable hasta el Flip de identidad"
        string status "PRE_HIRE, ACTIVE, SUSPENDED"
        uuid cluster_id FK
        datetime created_at
    }

    EXTERNAL_IDENTITY {
        uuid id PK
        string full_name
        string email
        uuid sponsor_id FK "Usuario Farmatodo responsable"
        date expiration_date "Renovación cada 65 días"
        string status "ACTIVE, EXPIRED"
    }

    CLUSTER {
        uuid id PK
        string name "Ej: CENDIS, Tienda, Corporativo"
        string country "VE, CO, AR"
    }

    %% Journey & Onboarding Engine
    JOURNEY_TEMPLATE {
        uuid id PK
        uuid cluster_id FK
        string name "Ej: Onboarding APV Venezuela"
        boolean is_active
    }

    TEMPLATE_STEP {
        uuid id PK
        uuid journey_template_id FK
        int order_index
        string title "Ej: Configurar Cloud Identity"
        string content_url "Link a video/PDF"
        string step_type "INFO, ACTION, APPROVAL"
        boolean requires_corporate_email
        boolean is_optional
    }

    %% User Execution State
    USER_JOURNEY {
        uuid id PK
        uuid user_id FK
        uuid journey_template_id FK
        int progress_percentage
        string status "IN_PROGRESS, COMPLETED"
    }

    USER_JOURNEY_STEP {
        uuid id PK
        uuid user_journey_id FK
        uuid template_step_id FK
        string status "LOCKED, PENDING, COMPLETED"
        datetime completed_at
    }

    %% Access Management (Zanahoria y Garrote)
    ACCESS_PROVISIONING {
        uuid id PK
        uuid user_id FK
        string system_name "SuperApp, SIM, VPN, Jira"
        string status "REQUESTED, PROVISIONED, REVOKED"
        string access_credentials "Detalle o link de acceso"
        string jira_ticket_id "Para trazar el SLA"
    }

    %% Relaciones
    CLUSTER ||--o{ USER : "tiene"
    CLUSTER ||--o{ JOURNEY_TEMPLATE : "define"
    USER ||--o{ USER_JOURNEY : "ejecuta"
    USER ||--o{ ACCESS_PROVISIONING : "solicita"
    USER ||--o{ EXTERNAL_IDENTITY : "es_sponsor_de"
    JOURNEY_TEMPLATE ||--|{ TEMPLATE_STEP : "contiene"
    USER_JOURNEY ||--|{ USER_JOURNEY_STEP : "trackea"
    TEMPLATE_STEP ||--o{ USER_JOURNEY_STEP : "instancia"