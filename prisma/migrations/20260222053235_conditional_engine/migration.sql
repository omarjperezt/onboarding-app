/*
  Warnings:

  - Added the required column `updated_at` to the `journey_templates` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP');

-- CreateEnum
CREATE TYPE "CommunicationTrigger" AS ENUM ('JOURNEY_ASSIGNED', 'STEP_UNLOCKED', 'STEP_COMPLETED', 'IDENTITY_FLIP', 'SSO_AUTHENTICATED', 'JOURNEY_COMPLETED', 'REMINDER', 'ACCESS_PROVISIONED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ContentBlockType" AS ENUM ('RICH_TEXT', 'VIDEO_EMBED', 'PDF_LINK', 'CHECKLIST', 'FORM_LINK');

-- DropForeignKey
ALTER TABLE "journey_templates" DROP CONSTRAINT "journey_templates_cluster_id_fkey";

-- AlterTable
ALTER TABLE "journey_templates" ADD COLUMN     "applicability" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "cluster_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "template_steps" ADD COLUMN     "conditions" JSONB,
ADD COLUMN     "contentPayload" JSONB,
ADD COLUMN     "estimated_minutes" INTEGER,
ADD COLUMN     "icon_name" TEXT;

-- AlterTable
ALTER TABLE "user_journey_steps" ADD COLUMN     "checklistState" JSONB,
ADD COLUMN     "resolved_order" INTEGER;

-- AlterTable
ALTER TABLE "user_journeys" ADD COLUMN     "compiled_from_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "communication_templates" (
    "id" UUID NOT NULL,
    "journey_template_id" UUID,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "trigger" "CommunicationTrigger" NOT NULL,
    "triggerConfig" JSONB,
    "subject" TEXT,
    "body_template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" UUID NOT NULL,
    "communication_template_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "recipient_address" TEXT NOT NULL,
    "rendered_subject" TEXT,
    "status" TEXT NOT NULL,
    "external_id" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communication_templates_trigger_is_active_idx" ON "communication_templates"("trigger", "is_active");

-- CreateIndex
CREATE INDEX "communication_templates_journey_template_id_idx" ON "communication_templates"("journey_template_id");

-- CreateIndex
CREATE INDEX "communication_logs_user_id_idx" ON "communication_logs"("user_id");

-- CreateIndex
CREATE INDEX "communication_logs_communication_template_id_idx" ON "communication_logs"("communication_template_id");

-- CreateIndex
CREATE INDEX "communication_logs_status_idx" ON "communication_logs"("status");

-- AddForeignKey
ALTER TABLE "journey_templates" ADD CONSTRAINT "journey_templates_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_journey_template_id_fkey" FOREIGN KEY ("journey_template_id") REFERENCES "journey_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_communication_template_id_fkey" FOREIGN KEY ("communication_template_id") REFERENCES "communication_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
