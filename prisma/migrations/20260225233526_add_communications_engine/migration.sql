-- CreateEnum
CREATE TYPE "TriggerEvent" AS ENUM ('JOURNEY_ASSIGNED', 'IDENTITY_FLIP', 'SSO_AUTHENTICATED', 'MANUAL_TEST');

-- DropForeignKey (must happen before column drops)
ALTER TABLE "communication_logs" DROP CONSTRAINT "communication_logs_communication_template_id_fkey";
ALTER TABLE "communication_templates" DROP CONSTRAINT "communication_templates_journey_template_id_fkey";

-- DropIndex
DROP INDEX "communication_logs_communication_template_id_idx";
DROP INDEX "communication_templates_journey_template_id_idx";

-- Drop columns that depend on old CommunicationChannel enum BEFORE altering it
ALTER TABLE "communication_logs" DROP COLUMN "channel";

-- AlterEnum (now safe — no other columns reference CommunicationChannel)
CREATE TYPE "CommunicationChannel_new" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');
ALTER TABLE "communication_templates" ALTER COLUMN "channel" TYPE "CommunicationChannel_new" USING ("channel"::text::"CommunicationChannel_new");
ALTER TYPE "CommunicationChannel" RENAME TO "CommunicationChannel_old";
ALTER TYPE "CommunicationChannel_new" RENAME TO "CommunicationChannel";
DROP TYPE "public"."CommunicationChannel_old";

-- AlterTable communication_logs (remaining columns)
ALTER TABLE "communication_logs" DROP COLUMN "communication_template_id",
DROP COLUMN "created_at",
DROP COLUMN "delivered_at",
DROP COLUMN "error_message",
DROP COLUMN "external_id",
DROP COLUMN "recipient_address",
DROP COLUMN "rendered_subject",
ADD COLUMN     "template_id" UUID NOT NULL,
ADD COLUMN     "trigger" "TriggerEvent" NOT NULL,
ALTER COLUMN "sent_at" SET NOT NULL,
ALTER COLUMN "sent_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable communication_templates
ALTER TABLE "communication_templates" DROP COLUMN "body_template",
DROP COLUMN "journey_template_id",
DROP COLUMN "triggerConfig",
ADD COLUMN     "body_content" TEXT NOT NULL,
DROP COLUMN "trigger",
ADD COLUMN     "trigger" "TriggerEvent" NOT NULL,
ALTER COLUMN "conditions" SET NOT NULL,
ALTER COLUMN "conditions" SET DEFAULT '{}';

-- DropEnum
DROP TYPE "CommunicationTrigger";

-- CreateIndex
CREATE INDEX "communication_logs_template_id_idx" ON "communication_logs"("template_id");
CREATE UNIQUE INDEX "communication_logs_user_id_template_id_key" ON "communication_logs"("user_id", "template_id");
CREATE INDEX "communication_templates_trigger_is_active_idx" ON "communication_templates"("trigger", "is_active");

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "communication_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
