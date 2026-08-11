-- Add Product.slug as a required unique column. Hand-edited: the column is
-- added nullable first, backfilled from the (already unique) reference, then
-- made NOT NULL so existing rows survive the migration.
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;
UPDATE "Product" SET "slug" = lower("reference") WHERE "slug" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
