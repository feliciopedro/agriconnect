-- AlterTable
ALTER TABLE "DeliveryRequest" ADD COLUMN     "carpoolSplitCost" DOUBLE PRECISION,
ADD COLUMN     "isCarpool" BOOLEAN NOT NULL DEFAULT false;
