-- CreateEnum
CREATE TYPE "CreationSource" AS ENUM ('WEB', 'USSD', 'SMS');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" "CreationSource" NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "ProduceListing" ADD COLUMN     "source" "CreationSource" NOT NULL DEFAULT 'WEB';
