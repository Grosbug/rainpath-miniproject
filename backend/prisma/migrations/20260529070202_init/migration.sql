-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "graph" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "NodeTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PatientRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "currentNodeId" TEXT,
    "history" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PatientRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientRun_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Workflow_deletedAt_idx" ON "Workflow"("deletedAt");

-- CreateIndex
CREATE INDEX "NodeTemplate_deletedAt_idx" ON "NodeTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "PatientProfile_deletedAt_idx" ON "PatientProfile"("deletedAt");

-- CreateIndex
CREATE INDEX "PatientRun_deletedAt_idx" ON "PatientRun"("deletedAt");

-- CreateIndex
CREATE INDEX "PatientRun_workflowId_idx" ON "PatientRun"("workflowId");

-- CreateIndex
CREATE INDEX "PatientRun_patientId_idx" ON "PatientRun"("patientId");
