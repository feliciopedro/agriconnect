-- CreateEnum
CREATE TYPE "PreOrderStatus" AS ENUM ('DEPOSIT_PENDING', 'OPEN', 'MATCHED', 'FULFILLED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "depositCredit" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PreOrder" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "cropType" "CropType" NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "maxPricePerKg" DOUBLE PRECISION NOT NULL,
    "preferredRegion" TEXT,
    "harvestWindowStart" TIMESTAMP(3) NOT NULL,
    "harvestWindowEnd" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "depositAmount" DOUBLE PRECISION NOT NULL,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "paystackReference" TEXT,
    "status" "PreOrderStatus" NOT NULL DEFAULT 'DEPOSIT_PENDING',
    "matchedListingId" TEXT,
    "fulfilledOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_fulfilledOrderId_key" ON "PreOrder"("fulfilledOrderId");

-- CreateIndex
CREATE INDEX "PreOrder_buyerId_idx" ON "PreOrder"("buyerId");

-- CreateIndex
CREATE INDEX "PreOrder_cropType_status_idx" ON "PreOrder"("cropType", "status");

-- CreateIndex
CREATE INDEX "PreOrder_status_idx" ON "PreOrder"("status");

-- CreateIndex
CREATE INDEX "PreOrder_harvestWindowEnd_idx" ON "PreOrder"("harvestWindowEnd");

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_matchedListingId_fkey" FOREIGN KEY ("matchedListingId") REFERENCES "ProduceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_fulfilledOrderId_fkey" FOREIGN KEY ("fulfilledOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
