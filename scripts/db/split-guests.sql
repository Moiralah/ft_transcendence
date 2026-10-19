-- One-off: move "Try as guest" visitors out of "User" into their own "Guest"
-- table, and the guest on/off switch into "SiteSettings".
--
-- Run ONCE per database (local and prod), AFTER split-admins.sql and BEFORE
-- `npx prisma db push` / deploying the backend that has the Guest table. Same
-- reason as for admins: the push can't drop GUEST from "UserRole" while guest
-- rows still use it. Afterwards the database already matches schema.prisma.
--
--   docker compose exec -T -e DIRECT_URL="$DIRECT_URL" backend \
--     npx prisma db execute --stdin < scripts/db/split-guests.sql
--
-- Guests in the middle of a visit keep their session and demo tree (same id,
-- same profile). guest@example.com, the old shared guest account that served
-- as the on/off switch, becomes SiteSettings.guestAccess (on unless it was
-- suspended); its row is turned into an expired guest, so the backend's idle
-- sweep removes it and anything it still owns within a minute.
--
-- All or nothing: any error rolls the whole thing back.

BEGIN;

-- 1. The new tables (as `prisma db push` would make them).
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" INTEGER NOT NULL,
    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Guest_tag_key" ON "Guest"("tag");
CREATE UNIQUE INDEX "Guest_profileId_key" ON "Guest"("profileId");
CREATE INDEX "Guest_lastSeenAt_idx" ON "Guest"("lastSeenAt");
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "guestAccess" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- 2. The switch: guest access stays as it was.
INSERT INTO "SiteSettings" ("id", "guestAccess")
SELECT 1, NOT COALESCE((SELECT "suspended" FROM "User" WHERE "email" = 'guest@example.com'), false);

-- 3. Copy the guests over. The switch account comes along as already expired,
-- so the idle sweep deletes it the normal way (trees, memberships, profile).
INSERT INTO "Guest" ("id", "tag", "createdAt", "lastSeenAt", "profileId")
SELECT "id", "username", "createdAt",
       CASE WHEN "email" = 'guest@example.com' THEN TIMESTAMP '2000-01-01' ELSE "updatedAt" END,
       "profileId"
FROM "User" WHERE "role" = 'GUEST' AND "profileId" IS NOT NULL;

-- 4. Remove their User rows (friendships and recovery codes cascade). The
-- profiles stay, now owned through "Guest"; profiles.userId keeps the same id.
DELETE FROM "Invitation" WHERE "inviterId" IN (SELECT "id" FROM "User" WHERE "role" = 'GUEST');
DELETE FROM "User" WHERE "role" = 'GUEST';

-- 5. GUEST is no longer a user role.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('MODERATOR', 'USER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
DROP TYPE "UserRole_old";

COMMIT;
