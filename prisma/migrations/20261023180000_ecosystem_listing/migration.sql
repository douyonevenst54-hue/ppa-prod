-- Directory entries for the Pi ecosystem browser.
--
-- Separate from PPAApp on purpose. A PPAApp holds an apiKey that
-- /api/external/ppa accepts to credit PPA; a listing holds a name and a link.
-- Sharing a table would mean approving a directory submission could issue a
-- minting key, which is the fault just closed in the registry route.

CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

CREATE TABLE "EcosystemListing" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "slug"          TEXT NOT NULL,
    "tagline"       TEXT NOT NULL,
    "url"           TEXT NOT NULL,
    "logoUrl"       TEXT,
    "category"      TEXT NOT NULL DEFAULT 'OTHER',
    "status"        "ListingStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" TEXT,
    "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt"    TIMESTAMP(3),
    "reviewedBy"    TEXT,
    "reviewNote"    TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcosystemListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EcosystemListing_slug_key" ON "EcosystemListing"("slug");
CREATE INDEX "EcosystemListing_status_category_idx" ON "EcosystemListing"("status", "category");
CREATE INDEX "EcosystemListing_status_name_idx" ON "EcosystemListing"("status", "name");

-- ON DELETE SET NULL: deleting an account must not delete the listings it
-- submitted. The entry stays, and simply no longer names a submitter.
ALTER TABLE "EcosystemListing"
    ADD CONSTRAINT "EcosystemListing_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
