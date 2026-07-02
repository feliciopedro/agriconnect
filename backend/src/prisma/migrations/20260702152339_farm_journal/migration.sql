-- AlterTable
ALTER TABLE "ProduceListing" ADD COLUMN     "plantingLogId" TEXT;

-- CreateTable
CREATE TABLE "PlantingLog" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "cropType" "CropType" NOT NULL,
    "acreage" DOUBLE PRECISION NOT NULL,
    "plantingDate" TIMESTAMP(3) NOT NULL,
    "expectedHarvestDate" TIMESTAMP(3) NOT NULL,
    "actualHarvestDate" TIMESTAMP(3),
    "actualYieldKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantingInput" (
    "id" TEXT NOT NULL,
    "plantingLogId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantingInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantingLog_farmerId_idx" ON "PlantingLog"("farmerId");

-- CreateIndex
CREATE INDEX "PlantingLog_cropType_idx" ON "PlantingLog"("cropType");

-- CreateIndex
CREATE INDEX "PlantingInput_plantingLogId_idx" ON "PlantingInput"("plantingLogId");

-- CreateIndex
CREATE INDEX "ProduceListing_plantingLogId_idx" ON "ProduceListing"("plantingLogId");

-- AddForeignKey
ALTER TABLE "ProduceListing" ADD CONSTRAINT "ProduceListing_plantingLogId_fkey" FOREIGN KEY ("plantingLogId") REFERENCES "PlantingLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingLog" ADD CONSTRAINT "PlantingLog_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingInput" ADD CONSTRAINT "PlantingInput_plantingLogId_fkey" FOREIGN KEY ("plantingLogId") REFERENCES "PlantingLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
