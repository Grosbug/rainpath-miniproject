-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN "isValid" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Workflow_updatedAt_idx" ON "Workflow"("updatedAt");
