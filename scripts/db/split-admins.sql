-- One-off: move site admins out of "User" into their own "Admin" table.
--
-- Run ONCE per database (local and prod), BEFORE `npx prisma db push` with the
-- new schema. The push alone can't do it: it would have to drop the ADMIN value
-- from "UserRole" while admin rows still use it. After this script the database
-- already matches schema.prisma, so the push finds nothing to change.
--
--   docker compose exec -T -e DIRECT_URL="$DIRECT_URL" backend \
--     npx prisma db execute --stdin < scripts/db/split-admins.sql
--
-- Each admin keeps their Supabase login (same UUID), so they sign in on the
-- staff page exactly as before, with the same password and MFA. What they lose
-- is the member side they couldn't use anyway: their friendships and the
-- invitations they sent. Their profile is detached (kept as a plain person if a
-- tree or log still points at it, deleted otherwise).
--
-- All or nothing: any error rolls the whole thing back.

BEGIN;

-- 1. The new table and the recovery-code link to it (as `prisma db push` would make them).
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

ALTER TABLE "RecoveryCode" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "RecoveryCode" ADD COLUMN "adminId" TEXT;
CREATE INDEX "RecoveryCode_adminId_idx" ON "RecoveryCode"("adminId");
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Copy the admins over, MFA included.
INSERT INTO "Admin" ("id", "username", "email", "createdAt", "updatedAt", "twoFactorEnabled", "twoFactorSecret")
SELECT "id", "username", "email", "createdAt", NOW(), "twoFactorEnabled", "twoFactorSecret"
FROM "User" WHERE "role" = 'ADMIN';

UPDATE "RecoveryCode" SET "adminId" = "userId", "userId" = NULL
WHERE "userId" IN (SELECT "id" FROM "Admin");

-- 3. Remove their member side.
CREATE TEMP TABLE admin_profiles ON COMMIT DROP AS
SELECT "profileId" AS id FROM "User" WHERE "role" = 'ADMIN' AND "profileId" IS NOT NULL;

DELETE FROM "Invitation" WHERE "inviterId" IN (SELECT "id" FROM "Admin");
UPDATE "profiles" SET "userId" = NULL WHERE "userId" IN (SELECT "id" FROM "Admin");
DELETE FROM "User" WHERE "role" = 'ADMIN'; -- friendships cascade

-- Their now-unowned profiles: deleted unless something still points at them.
DELETE FROM "profiles" p
WHERE p."id" IN (SELECT id FROM admin_profiles)
  AND NOT EXISTS (SELECT 1 FROM "TreeMember" m WHERE m."profileId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a."profileId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "Tree" t WHERE t."ownerId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "profiles" c WHERE c."mother_id" = p."id" OR c."father_id" = p."id" OR c."spouse_id" = p."id");

-- 4. ADMIN is no longer a user role.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('MODERATOR', 'USER', 'GUEST');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
DROP TYPE "UserRole_old";

COMMIT;
