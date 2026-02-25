import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function uuid() {
  return crypto.randomUUID();
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─────────────────────────────────────────
  // 1. Clusters
  // ─────────────────────────────────────────
  const clusterOpVE = await prisma.cluster.upsert({
    where: { name_country: { name: "Operaciones Tienda", country: "VE" } },
    update: {},
    create: { name: "Operaciones Tienda", country: "VE" },
  });

  const clusterCendisVE = await prisma.cluster.upsert({
    where: { name_country: { name: "CENDIS", country: "VE" } },
    update: {},
    create: { name: "CENDIS", country: "VE" },
  });

  const clusterCorpCO = await prisma.cluster.upsert({
    where: { name_country: { name: "Corporativo", country: "CO" } },
    update: {},
    create: { name: "Corporativo", country: "CO" },
  });

  console.log("✅ Clusters creados:", clusterOpVE.name, clusterCendisVE.name, clusterCorpCO.name);

  // ─────────────────────────────────────────
  // 2. Journey Template with conditional steps and contentPayload
  // ─────────────────────────────────────────
  const journeyTemplate = await prisma.journeyTemplate.create({
    data: {
      clusterId: clusterOpVE.id,
      name: "Onboarding General Farmatodo",
      description: "Plantilla base de onboarding con pasos condicionales por país y cluster",
      isActive: true,
      version: 1,
      applicability: null, // Universal template
      steps: {
        create: [
          {
            orderIndex: 1,
            title: "Bienvenida y datos personales",
            description:
              "Confirma tus datos personales y acepta las políticas de la compañía. Revisa el video introductorio sobre la cultura Farmatodo.",
            contentUrl: "https://farmatodo.com/onboarding/bienvenida",
            stepType: "INFO",
            requiresCorporateEmail: false,
            isOptional: false,
            conditions: null, // Universal step
            contentPayload: {
              blocks: [
                {
                  id: uuid(),
                  type: "RICH_TEXT",
                  value:
                    "<p>¡Hola <strong>{{user.firstName}}</strong>! Bienvenido/a al equipo de <em>{{user.clusterName}}</em> en {{user.countryName}}.</p><p>En este primer paso, confirma tus datos personales y acepta las políticas de la compañía.</p>",
                },
                {
                  id: uuid(),
                  type: "VIDEO_EMBED",
                  value: "https://www.youtube.com/embed/dQw4w9WgXcQ",
                  meta: { label: "Video de bienvenida Farmatodo" },
                },
                {
                  id: uuid(),
                  type: "CHECKLIST",
                  value: "",
                  meta: {
                    label: "Confirma que completaste:",
                    checklistItems: [
                      "Vi el video de bienvenida completo",
                      "Leí el código de conducta",
                      "Acepté la política de protección de datos",
                    ],
                  },
                },
              ],
            },
            estimatedMinutes: 15,
            iconName: "HandHeart",
          },
          {
            orderIndex: 2,
            title: "Creación de identidad corporativa (Cloud Identity)",
            description:
              "El equipo de TI está creando tu cuenta @farmatodo.com en Google Workspace. Una vez lista, deberás iniciar sesión con tu correo corporativo para continuar.",
            contentUrl: null,
            stepType: "APPROVAL",
            requiresCorporateEmail: false,
            isOptional: false,
            conditions: null, // Universal step
            contentPayload: {
              blocks: [
                {
                  id: uuid(),
                  type: "RICH_TEXT",
                  value:
                    "<p>El equipo de TI está creando tu cuenta <strong>@farmatodo.com</strong> en Google Workspace.</p><p>Este paso se completa automáticamente cuando el ticket de Jira ITSM notifica la creación de tu cuenta.</p>",
                },
              ],
            },
            estimatedMinutes: null,
            iconName: "ShieldCheck",
          },
          {
            orderIndex: 3,
            title: "Configurar acceso a SuperApp Operativa",
            description:
              "Descarga la SuperApp de Farmatodo e inicia sesión con tu cuenta corporativa.",
            contentUrl: "https://farmatodo.com/superapp/setup",
            stepType: "ACTION",
            requiresCorporateEmail: true,
            isOptional: false,
            conditions: {
              requiresCorporateEmail: true,
              cluster: ["Operaciones Tienda"],
            },
            contentPayload: {
              blocks: [
                {
                  id: uuid(),
                  type: "RICH_TEXT",
                  value:
                    "<p>Descarga la SuperApp de Farmatodo desde tu tienda de aplicaciones e inicia sesión con tu cuenta corporativa <strong>{{user.corporateEmail}}</strong>.</p>",
                },
                {
                  id: uuid(),
                  type: "PDF_LINK",
                  value: "https://farmatodo.com/superapp/manual.pdf",
                  meta: { label: "Manual de la SuperApp", fileName: "manual-superapp.pdf" },
                },
              ],
            },
            estimatedMinutes: 20,
            iconName: "Smartphone",
          },
          {
            orderIndex: 4,
            title: "Capacitación en prevención de pérdidas",
            description:
              "Completa el módulo de e-learning sobre prevención de pérdidas y seguridad en tienda. Duración estimada: 45 minutos.",
            contentUrl: "https://farmatodo.com/elearning/prevencion",
            stepType: "ACTION",
            requiresCorporateEmail: true,
            isOptional: false,
            conditions: {
              requiresCorporateEmail: true,
              cluster: ["Operaciones Tienda", "CENDIS"],
            },
            contentPayload: {
              blocks: [
                {
                  id: uuid(),
                  type: "RICH_TEXT",
                  value:
                    "<p>Completa el módulo de e-learning sobre prevención de pérdidas y seguridad. Este curso es obligatorio para todos los empleados de operaciones.</p>",
                },
                {
                  id: uuid(),
                  type: "FORM_LINK",
                  value: "https://farmatodo.com/elearning/prevencion",
                  meta: { label: "Ir al módulo de e-learning" },
                },
              ],
            },
            estimatedMinutes: 45,
            iconName: "GraduationCap",
          },
          {
            orderIndex: 5,
            title: "Regulación sanitaria Venezuela",
            description:
              "Módulo obligatorio de regulación sanitaria SENCAMER para empleados en Venezuela.",
            contentUrl: "https://farmatodo.com/elearning/sencamer",
            stepType: "ACTION",
            requiresCorporateEmail: true,
            isOptional: false,
            conditions: {
              country: ["VE"],
              requiresCorporateEmail: true,
            },
            contentPayload: {
              blocks: [
                {
                  id: uuid(),
                  type: "RICH_TEXT",
                  value:
                    "<p>Completa la capacitación sobre regulación sanitaria SENCAMER. Este módulo es obligatorio para todos los empleados en Venezuela.</p>",
                },
              ],
            },
            estimatedMinutes: 30,
            iconName: "FileCheck",
          },
          {
            orderIndex: 6,
            title: "Normativa laboral Colombia",
            description:
              "Módulo obligatorio de normativa laboral colombiana y riesgos profesionales.",
            contentUrl: "https://farmatodo.com/elearning/normativa-co",
            stepType: "ACTION",
            requiresCorporateEmail: true,
            isOptional: false,
            conditions: {
              country: ["CO"],
              requiresCorporateEmail: true,
            },
            contentPayload: {
              blocks: [
                {
                  id: uuid(),
                  type: "RICH_TEXT",
                  value:
                    "<p>Completa la capacitación sobre normativa laboral colombiana y riesgos profesionales (ARL). Este módulo es obligatorio para todos los empleados en Colombia.</p>",
                },
              ],
            },
            estimatedMinutes: 30,
            iconName: "Scale",
          },
          {
            orderIndex: 7,
            title: "Protocolos de almacén CENDIS",
            description:
              "Capacitación en protocolos de seguridad y operación de almacenes CENDIS.",
            contentUrl: null,
            stepType: "ACTION",
            requiresCorporateEmail: true,
            isOptional: false,
            conditions: {
              cluster: ["CENDIS"],
              requiresCorporateEmail: true,
            },
            contentPayload: {
              blocks: [
                {
                  id: uuid(),
                  type: "RICH_TEXT",
                  value:
                    "<p>Completa la capacitación en protocolos de seguridad y operación de almacenes CENDIS. Incluye manejo de montacargas, zonas frías y protocolos de despacho.</p>",
                },
                {
                  id: uuid(),
                  type: "CHECKLIST",
                  value: "",
                  meta: {
                    label: "Confirma que completaste:",
                    checklistItems: [
                      "Capacitación en manejo de montacargas",
                      "Protocolo de zonas frías",
                      "Procedimiento de despacho",
                    ],
                  },
                },
              ],
            },
            estimatedMinutes: 60,
            iconName: "Warehouse",
          },
        ],
      },
    },
    include: {
      steps: { orderBy: { orderIndex: "asc" } },
    },
  });

  console.log(
    `✅ Journey Template: "${journeyTemplate.name}" con ${journeyTemplate.steps.length} pasos (${journeyTemplate.steps.filter((s) => s.conditions !== null).length} condicionales)`
  );

  // ─────────────────────────────────────────
  // 3. Users + Journeys (manually compiled for demo data)
  // ─────────────────────────────────────────

  // Helper: get steps that match a profile manually for seed
  const stepsForOpTiendaVE = journeyTemplate.steps.filter(
    (s) => s.orderIndex <= 5 && s.orderIndex !== 6 && s.orderIndex !== 7
  );
  // Steps 1,2,3,4,5 (not 6=CO only, not 7=CENDIS only)

  const stepsForCendisVE = journeyTemplate.steps.filter(
    (s) => s.orderIndex !== 3 && s.orderIndex !== 6
  );
  // Steps 1,2,4,5,7 (not 3=Operaciones Tienda only, not 6=CO only)

  const stepsForCorpCO = journeyTemplate.steps.filter(
    (s) => s.orderIndex <= 2 || s.orderIndex === 6
  );
  // Steps 1,2,6 (only universal + CO-specific; no cluster-specific steps)

  // ── Josmar (PRE_HIRE, Operaciones Tienda VE, ~20% = 1/5 steps) ──
  const userJosmar = await prisma.user.create({
    data: {
      jiraEmployeeId: "ITSM-2024-00847",
      fullName: "Josmar Rodríguez",
      personalEmail: "josmar.rodriguez@gmail.com",
      corporateEmail: null,
      status: "PRE_HIRE",
      position: "Auxiliar de Punto de Venta (APV)",
      clusterId: clusterOpVE.id,
    },
  });

  await prisma.userJourney.create({
    data: {
      userId: userJosmar.id,
      journeyTemplateId: journeyTemplate.id,
      progressPercentage: 20,
      status: "IN_PROGRESS",
      compiledFromVersion: 1,
      steps: {
        create: stepsForOpTiendaVE.map((step, i) => ({
          templateStepId: step.id,
          resolvedOrder: i + 1,
          status: i === 0 ? ("COMPLETED" as const) : i === 1 ? ("PENDING" as const) : ("LOCKED" as const),
          completedAt: i === 0 ? new Date("2024-11-15T10:30:00Z") : null,
        })),
      },
    },
  });

  await prisma.accessProvisioning.createMany({
    data: [
      { userId: userJosmar.id, systemName: "Google Workspace", status: "REQUESTED", jiraTicketId: "ITSM-2024-00848" },
      { userId: userJosmar.id, systemName: "SuperApp Operativa", status: "REQUESTED", jiraTicketId: "ITSM-2024-00849" },
      { userId: userJosmar.id, systemName: "SIM (Inventario)", status: "PROVISIONED", accessCredentials: "Acceso habilitado con correo corporativo", jiraTicketId: "ITSM-2024-00850" },
    ],
  });

  console.log(`✅ Usuario creado: ${userJosmar.fullName} (${userJosmar.status}) — 20% journey (Operaciones Tienda VE)`);

  // ── María (ACTIVE, Operaciones Tienda VE, 80% = 4/5 steps) ──
  const userMaria = await prisma.user.create({
    data: {
      jiraEmployeeId: "ITSM-2024-00832",
      fullName: "María Fernanda López",
      personalEmail: "mariaflopez@hotmail.com",
      corporateEmail: "maria.lopez@farmatodo.com",
      status: "ACTIVE",
      position: "Coordinadora de Tienda",
      ssoAuthenticatedAt: new Date("2024-11-04T09:00:00Z"),
      clusterId: clusterOpVE.id,
    },
  });

  await prisma.userJourney.create({
    data: {
      userId: userMaria.id,
      journeyTemplateId: journeyTemplate.id,
      progressPercentage: 80,
      status: "IN_PROGRESS",
      compiledFromVersion: 1,
      steps: {
        create: stepsForOpTiendaVE.map((step, i) => ({
          templateStepId: step.id,
          resolvedOrder: i + 1,
          status: i < 4 ? ("COMPLETED" as const) : ("PENDING" as const),
          completedAt:
            i === 0
              ? new Date("2024-11-01T09:00:00Z")
              : i === 1
                ? new Date("2024-11-03T14:20:00Z")
                : i === 2
                  ? new Date("2024-11-05T11:00:00Z")
                  : i === 3
                    ? new Date("2024-11-07T16:00:00Z")
                    : null,
        })),
      },
    },
  });

  console.log(`✅ Usuario creado: ${userMaria.fullName} (${userMaria.status}) — 80% journey`);

  // ── External Identity ──
  await prisma.externalIdentity.create({
    data: {
      fullName: "Carlos Mendoza",
      email: "carlos.mendoza@consultora-ext.com",
      sponsorId: userMaria.id,
      expirationDate: new Date("2025-01-20"),
      status: "ACTIVE",
    },
  });

  console.log("✅ External Identity creada (Carlos Mendoza → sponsor: María)");

  // ── Andrea (PRE_HIRE, CENDIS VE, 0%) ──
  const userAndrea = await prisma.user.create({
    data: {
      jiraEmployeeId: "ITSM-2024-00860",
      fullName: "Andrea Gutiérrez",
      personalEmail: "andrea.gutierrez@gmail.com",
      corporateEmail: null,
      status: "PRE_HIRE",
      position: "Analista de Logística",
      clusterId: clusterCendisVE.id,
    },
  });

  await prisma.userJourney.create({
    data: {
      userId: userAndrea.id,
      journeyTemplateId: journeyTemplate.id,
      progressPercentage: 0,
      status: "IN_PROGRESS",
      compiledFromVersion: 1,
      steps: {
        create: stepsForCendisVE.map((step, i) => ({
          templateStepId: step.id,
          resolvedOrder: i + 1,
          status: i === 0 ? ("PENDING" as const) : ("LOCKED" as const),
          completedAt: null,
        })),
      },
    },
  });

  console.log(`✅ Usuario creado: ${userAndrea.fullName} (PRE_HIRE) — 0% journey (CENDIS VE)`);

  // ── Luis (ACTIVE, Corporativo CO, 100%) ──
  const userLuis = await prisma.user.create({
    data: {
      jiraEmployeeId: "ITSM-2024-00815",
      fullName: "Luis Alejandro Moreno",
      personalEmail: "luis.moreno@outlook.com",
      corporateEmail: "luis.moreno@farmatodo.com",
      status: "ACTIVE",
      position: "Gerente de Proyectos TI",
      ssoAuthenticatedAt: new Date("2024-10-20T08:00:00Z"),
      clusterId: clusterCorpCO.id,
    },
  });

  await prisma.userJourney.create({
    data: {
      userId: userLuis.id,
      journeyTemplateId: journeyTemplate.id,
      progressPercentage: 100,
      status: "COMPLETED",
      compiledFromVersion: 1,
      completedAt: new Date("2024-10-28T16:00:00Z"),
      steps: {
        create: stepsForCorpCO.map((step, i) => ({
          templateStepId: step.id,
          resolvedOrder: i + 1,
          status: "COMPLETED" as const,
          completedAt: new Date("2024-10-28T16:00:00Z"),
        })),
      },
    },
  });

  await prisma.accessProvisioning.createMany({
    data: [
      { userId: userLuis.id, systemName: "Google Workspace", status: "PROVISIONED", jiraTicketId: "ITSM-2024-00816" },
      { userId: userLuis.id, systemName: "Jira Service Management", status: "PROVISIONED", jiraTicketId: "ITSM-2024-00817" },
    ],
  });

  console.log(`✅ Usuario creado: ${userLuis.fullName} (ACTIVE) — 100% journey (Corporativo CO)`);

  // ── Valentina (ACTIVE, Operaciones Tienda VE, 40% = 2/5, post-flip pre-SSO) ──
  const userValentina = await prisma.user.create({
    data: {
      jiraEmployeeId: "ITSM-2024-00870",
      fullName: "Valentina Herrera",
      personalEmail: "vale.herrera@gmail.com",
      corporateEmail: "valentina.herrera@farmatodo.com",
      status: "ACTIVE",
      position: "Auxiliar de Punto de Venta (APV)",
      clusterId: clusterOpVE.id,
    },
  });

  await prisma.userJourney.create({
    data: {
      userId: userValentina.id,
      journeyTemplateId: journeyTemplate.id,
      progressPercentage: 40,
      status: "IN_PROGRESS",
      compiledFromVersion: 1,
      steps: {
        create: stepsForOpTiendaVE.map((step, i) => ({
          templateStepId: step.id,
          resolvedOrder: i + 1,
          status:
            i < 2
              ? ("COMPLETED" as const)
              : ("PENDING" as const),
          completedAt:
            i === 0
              ? new Date("2024-11-20T09:00:00Z")
              : i === 1
                ? new Date("2024-11-22T11:30:00Z")
                : null,
        })),
      },
    },
  });

  await prisma.accessProvisioning.createMany({
    data: [
      { userId: userValentina.id, systemName: "Google Workspace", status: "PROVISIONED", jiraTicketId: "ITSM-2024-00871" },
      { userId: userValentina.id, systemName: "SuperApp Operativa", status: "REQUESTED", jiraTicketId: "ITSM-2024-00872" },
    ],
  });

  console.log(`✅ Usuario creado: ${userValentina.fullName} (ACTIVE) — 40% journey (post-flip, pre-SSO)`);

  // ── Diego (SUSPENDED, CENDIS VE, ~40% = 2/5 steps) ──
  const userDiego = await prisma.user.create({
    data: {
      jiraEmployeeId: "ITSM-2024-00790",
      fullName: "Diego Ramírez",
      personalEmail: "diego.ramirez@yahoo.com",
      corporateEmail: "diego.ramirez@farmatodo.com",
      status: "SUSPENDED",
      position: "Operador de Almacén",
      ssoAuthenticatedAt: new Date("2024-09-15T10:00:00Z"),
      clusterId: clusterCendisVE.id,
    },
  });

  await prisma.userJourney.create({
    data: {
      userId: userDiego.id,
      journeyTemplateId: journeyTemplate.id,
      progressPercentage: 40,
      status: "IN_PROGRESS",
      compiledFromVersion: 1,
      steps: {
        create: stepsForCendisVE.map((step, i) => ({
          templateStepId: step.id,
          resolvedOrder: i + 1,
          status:
            i < 2
              ? ("COMPLETED" as const)
              : ("PENDING" as const),
          completedAt:
            i === 0
              ? new Date("2024-09-10T09:00:00Z")
              : i === 1
                ? new Date("2024-09-12T14:00:00Z")
                : null,
        })),
      },
    },
  });

  await prisma.accessProvisioning.createMany({
    data: [
      { userId: userDiego.id, systemName: "Google Workspace", status: "REVOKED", jiraTicketId: "ITSM-2024-00791" },
      { userId: userDiego.id, systemName: "SIM (Inventario)", status: "REVOKED", jiraTicketId: "ITSM-2024-00792" },
    ],
  });

  console.log(`✅ Usuario creado: ${userDiego.fullName} (SUSPENDED) — 40% journey (CENDIS VE)`);

  // ─────────────────────────────────────────
  // 4. Compiled Journey User (via engine logic)
  //    Validates end-to-end: evaluateConditions + journey creation
  // ─────────────────────────────────────────

  const userSofia = await prisma.user.create({
    data: {
      jiraEmployeeId: "ITSM-2025-00010",
      fullName: "Sofía Martínez",
      personalEmail: "sofia.martinez@gmail.com",
      corporateEmail: null,
      status: "PRE_HIRE",
      position: "Analista de Inventario",
      clusterId: clusterCendisVE.id,
      tags: ["nuevo-ingreso"],
    },
  });

  // Inline compile journey logic (same as compileJourney server action)
  // We cannot import the server action directly in seed context
  const { evaluateConditions } = await import(
    "../src/lib/journey-engine/evaluate-conditions"
  );

  const profile = {
    country: clusterCendisVE.country,
    clusterName: clusterCendisVE.name,
    position: userSofia.position,
    status: userSofia.status,
    hasCorporateEmail: !!userSofia.corporateEmail,
    hasSsoAuth: !!userSofia.ssoAuthenticatedAt,
    createdAt: userSofia.createdAt,
    tags: userSofia.tags,
  };

  const matchingSteps = journeyTemplate.steps.filter((step) =>
    evaluateConditions(step.conditions, profile)
  );

  const compiledJourney = await prisma.userJourney.create({
    data: {
      userId: userSofia.id,
      journeyTemplateId: journeyTemplate.id,
      compiledFromVersion: journeyTemplate.version,
      progressPercentage: 0,
      status: "IN_PROGRESS",
      steps: {
        create: matchingSteps.map((step, index) => ({
          templateStepId: step.id,
          status: index === 0 ? ("PENDING" as const) : ("LOCKED" as const),
          resolvedOrder: index + 1,
        })),
      },
    },
    include: {
      steps: { orderBy: { resolvedOrder: "asc" } },
    },
  });

  console.log(
    `✅ Usuario creado: ${userSofia.fullName} (PRE_HIRE) — journey compilado con ${compiledJourney.steps.length} pasos de ${journeyTemplate.steps.length} (CENDIS VE, via compileJourney)`
  );

  console.log("\n🎉 Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
