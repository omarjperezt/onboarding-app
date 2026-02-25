-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PRE_HIRE', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Country" AS ENUM ('VE', 'CO', 'AR');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('INFO', 'ACTION', 'APPROVAL');

-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('LOCKED', 'PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('REQUESTED', 'PROVISIONED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ExternalStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateTable
CREATE TABLE "clusters" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "jira_employee_id" TEXT,
    "full_name" TEXT NOT NULL,
    "personal_email" TEXT NOT NULL,
    "corporate_email" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PRE_HIRE',
    "position" TEXT,
    "cluster_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identities" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sponsor_id" UUID NOT NULL,
    "expiration_date" DATE NOT NULL,
    "status" "ExternalStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_templates" (
    "id" UUID NOT NULL,
    "cluster_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_steps" (
    "id" UUID NOT NULL,
    "journey_template_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content_url" TEXT,
    "step_type" "StepType" NOT NULL,
    "requires_corporate_email" BOOLEAN NOT NULL DEFAULT false,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "template_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_journeys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "journey_template_id" UUID NOT NULL,
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "status" "JourneyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "user_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_journey_steps" (
    "id" UUID NOT NULL,
    "user_journey_id" UUID NOT NULL,
    "template_step_id" UUID NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'LOCKED',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "user_journey_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_provisionings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "system_name" TEXT NOT NULL,
    "status" "AccessStatus" NOT NULL DEFAULT 'REQUESTED',
    "access_credentials" TEXT,
    "jira_ticket_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_provisionings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clusters_name_country_key" ON "clusters"("name", "country");

-- CreateIndex
CREATE UNIQUE INDEX "users_personal_email_key" ON "users"("personal_email");

-- CreateIndex
CREATE UNIQUE INDEX "users_corporate_email_key" ON "users"("corporate_email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_cluster_id_idx" ON "users"("cluster_id");

-- CreateIndex
CREATE INDEX "users_corporate_email_idx" ON "users"("corporate_email");

-- CreateIndex
CREATE INDEX "external_identities_sponsor_id_idx" ON "external_identities"("sponsor_id");

-- CreateIndex
CREATE INDEX "external_identities_status_expiration_date_idx" ON "external_identities"("status", "expiration_date");

-- CreateIndex
CREATE INDEX "journey_templates_cluster_id_is_active_idx" ON "journey_templates"("cluster_id", "is_active");

-- CreateIndex
CREATE INDEX "template_steps_journey_template_id_idx" ON "template_steps"("journey_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_steps_journey_template_id_order_index_key" ON "template_steps"("journey_template_id", "order_index");

-- CreateIndex
CREATE INDEX "user_journeys_user_id_idx" ON "user_journeys"("user_id");

-- CreateIndex
CREATE INDEX "user_journeys_status_idx" ON "user_journeys"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_journeys_user_id_journey_template_id_key" ON "user_journeys"("user_id", "journey_template_id");

-- CreateIndex
CREATE INDEX "user_journey_steps_user_journey_id_idx" ON "user_journey_steps"("user_journey_id");

-- CreateIndex
CREATE INDEX "user_journey_steps_status_idx" ON "user_journey_steps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_journey_steps_user_journey_id_template_step_id_key" ON "user_journey_steps"("user_journey_id", "template_step_id");

-- CreateIndex
CREATE INDEX "access_provisionings_user_id_idx" ON "access_provisionings"("user_id");

-- CreateIndex
CREATE INDEX "access_provisionings_status_idx" ON "access_provisionings"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_templates" ADD CONSTRAINT "journey_templates_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_steps" ADD CONSTRAINT "template_steps_journey_template_id_fkey" FOREIGN KEY ("journey_template_id") REFERENCES "journey_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_journeys" ADD CONSTRAINT "user_journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_journeys" ADD CONSTRAINT "user_journeys_journey_template_id_fkey" FOREIGN KEY ("journey_template_id") REFERENCES "journey_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_journey_steps" ADD CONSTRAINT "user_journey_steps_user_journey_id_fkey" FOREIGN KEY ("user_journey_id") REFERENCES "user_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_journey_steps" ADD CONSTRAINT "user_journey_steps_template_step_id_fkey" FOREIGN KEY ("template_step_id") REFERENCES "template_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_provisionings" ADD CONSTRAINT "access_provisionings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
