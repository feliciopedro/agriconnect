/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UssdSession` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UssdSession` table. All the data in the column will be lost.
  - Added the required column `currentMenu` to the `UssdSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastActivityAt` to the `UssdSession` table without a default value. This is not possible if the table is not empty.
  - Made the column `tempData` on table `UssdSession` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "UssdMessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastUssdActivity" TIMESTAMP(3),
ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "ussdPin" TEXT,
ADD COLUMN     "ussdPinSetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UssdSession" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "currentMenu" TEXT NOT NULL,
ADD COLUMN     "endReason" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "inputHistory" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "menuStack" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "tempData" SET NOT NULL,
ALTER COLUMN "tempData" SET DEFAULT '{}';

-- CreateTable
CREATE TABLE "UssdAuditLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "menu" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "userInput" TEXT,
    "systemResponse" TEXT NOT NULL,
    "action" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UssdAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UssdShortMessage" (
    "id" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggerAction" TEXT NOT NULL,
    "status" "UssdMessageStatus" NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UssdShortMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UssdAuditLog_phone_timestamp_idx" ON "UssdAuditLog"("phone", "timestamp");

-- CreateIndex
CREATE INDEX "UssdAuditLog_action_idx" ON "UssdAuditLog"("action");

-- CreateIndex
CREATE INDEX "UssdShortMessage_status_createdAt_idx" ON "UssdShortMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UssdSession_phone_isActive_idx" ON "UssdSession"("phone", "isActive");

-- AddForeignKey
ALTER TABLE "UssdSession" ADD CONSTRAINT "UssdSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
