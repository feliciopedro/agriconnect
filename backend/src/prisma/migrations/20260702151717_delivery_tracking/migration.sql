-- AlterTable
ALTER TABLE "DeliveryRequest" ADD COLUMN     "currentLatitude" DOUBLE PRECISION,
ADD COLUMN     "currentLongitude" DOUBLE PRECISION,
ADD COLUMN     "eta" TIMESTAMP(3),
ADD COLUMN     "routeDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "routeDurationMin" DOUBLE PRECISION;
