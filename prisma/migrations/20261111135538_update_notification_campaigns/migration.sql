-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('NEW_CATEGORY_ARRIVALS', 'COLLECTION', 'DISCOUNT_SALE');

-- AlterTable
ALTER TABLE "notification_campaigns" ADD COLUMN     "campaignType" "CampaignType" NOT NULL DEFAULT 'NEW_CATEGORY_ARRIVALS',
ADD COLUMN     "category" "Category",
ADD COLUMN     "discountPercent" INTEGER;
