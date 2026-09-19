ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

REVOKE ALL ON SCHEMA "public" FROM PUBLIC;

REVOKE ALL ON SCHEMA "public" FROM "anon";

REVOKE ALL ON SCHEMA "public" FROM "authenticated";

REVOKE ALL ON SCHEMA "public" FROM "pg_database_owner";

REVOKE ALL ON SCHEMA "public" FROM "service_role";

COMMENT ON SCHEMA "public" IS NULL;

CREATE SEQUENCE "public"."AuditLog_id_seq" AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE "public"."Invitation_id_seq" AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE "public"."TreeMember_id_seq" AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE "public"."Tree_id_seq" AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE "public"."events_id_seq" AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE "public"."profiles_id_seq" AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE;

CREATE TABLE "public"."AuditLog" (
  "id"        integer                        NOT NULL DEFAULT nextval('public."AuditLog_id_seq"'::regclass),
  "treeId"    integer                        NOT NULL,
  "userId"    text                           NOT NULL,
  "profileId" integer                        NOT NULL,
  "action"    text                           NOT NULL,
  "details"   text,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."Invitation" (
  "id"           integer                        NOT NULL DEFAULT nextval('public."Invitation_id_seq"'::regclass),
  "inviterId"    text                           NOT NULL,
  "inviteeEmail" text                           NOT NULL,
  "treeId"       integer                        NOT NULL,
  "createdAt"    timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    timestamp(3) without time zone NOT NULL,
  "respondedAt"  timestamp(3) without time zone,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."TreeMember" (
  "id"        integer                        NOT NULL DEFAULT nextval('public."TreeMember_id_seq"'::regclass),
  "profileId" integer,
  "treeId"    integer,
  "joinedAt"  timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkId"    integer,
  CONSTRAINT "TreeMember_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."Tree" (
  "id"          integer                        NOT NULL DEFAULT nextval('public."Tree_id_seq"'::regclass),
  "name"        text                           NOT NULL,
  "code"        text,
  "description" text,
  "ownerId"     integer                        NOT NULL,
  "createdAt"   timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   timestamp(3) without time zone NOT NULL,
  "isPublic"    boolean                        NOT NULL DEFAULT false,
  "rootId"      integer                        NOT NULL,
  CONSTRAINT "Tree_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."User" (
  "id"        text                           NOT NULL,
  "username"  text                           NOT NULL,
  "email"     text                           NOT NULL,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  "profileId" integer,
  CONSTRAINT "User_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."_prisma_migrations" (
  "id"                  character varying(36)    NOT NULL,
  "checksum"            character varying(64)    NOT NULL,
  "finished_at"         timestamp with time zone,
  "migration_name"      character varying(255)   NOT NULL,
  "logs"                text,
  "rolled_back_at"      timestamp with time zone,
  "started_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "applied_steps_count" integer                  NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."events" (
  "id"          integer                        NOT NULL DEFAULT nextval('public.events_id_seq'::regclass),
  "profileId"   integer                        NOT NULL,
  "eventType"   text                           NOT NULL,
  "description" text,
  "eventDate"   timestamp(3) without time zone,
  "location"    text,
  "createdAt"   timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "events_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."profiles" (
  "id"        integer                        NOT NULL DEFAULT nextval('public.profiles_id_seq'::regclass),
  "firstName" text                           NOT NULL,
  "lastName"  text,
  "gender"    text,
  "birthDate" date,
  "deathDate" date,
  "bio"       text,
  "photoUrl"  text,
  "verified"  boolean                        NOT NULL DEFAULT false,
  "mother_id" integer,
  "father_id" integer,
  "spouse_id" integer,
  "userId"    text,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER SEQUENCE "public"."AuditLog_id_seq" OWNED BY "public"."AuditLog"."id";

ALTER SEQUENCE "public"."Invitation_id_seq" OWNED BY "public"."Invitation"."id";

ALTER SEQUENCE "public"."Tree_id_seq" OWNED BY "public"."Tree"."id";

ALTER SEQUENCE "public"."TreeMember_id_seq" OWNED BY "public"."TreeMember"."id";

ALTER SEQUENCE "public"."events_id_seq" OWNED BY "public"."events"."id";

ALTER SEQUENCE "public"."profiles_id_seq" OWNED BY "public"."profiles"."id";

CREATE TYPE "public"."Role" AS ENUM (
  'ADMIN',
  'MODERATOR',
  'MEMBER',
  'JOINER',
  'HOLDER'
);

ALTER TABLE "public"."Invitation"
  ADD COLUMN "role" public."Role" NOT NULL DEFAULT 'JOINER'::public."Role";

ALTER TABLE "public"."TreeMember"
  ADD COLUMN "role" public."Role" NOT NULL;

CREATE TYPE "public"."Status" AS ENUM (
  'EMPTY',
  'PENDING',
  'ACCEPTED',
  'REJECTED'
);

ALTER TABLE "public"."Invitation"
  ADD COLUMN "invite" public."Status" NOT NULL DEFAULT 'PENDING'::public."Status";

ALTER TABLE "public"."TreeMember"
  ADD COLUMN "claim" public."Status" NOT NULL DEFAULT 'EMPTY'::public."Status";

ALTER TABLE "public"."AuditLog"
  ADD CONSTRAINT "AuditLog_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."Tree"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Invitation"
  ADD CONSTRAINT "Invitation_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."Tree"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Tree"
  ADD CONSTRAINT "Tree_rootId_fkey" FOREIGN KEY ("rootId") REFERENCES public."TreeMember"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."TreeMember"
  ADD CONSTRAINT "TreeMember_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES public."TreeMember"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."TreeMember"
  ADD CONSTRAINT "TreeMember_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."Tree"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."Invitation"
  ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."AuditLog"
  ADD CONSTRAINT "AuditLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."Tree"
  ADD CONSTRAINT "Tree_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."TreeMember"
  ADD CONSTRAINT "TreeMember_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."User"
  ADD CONSTRAINT "User_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_father_id_fkey" FOREIGN KEY (father_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_mother_id_fkey" FOREIGN KEY (mother_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_spouse_id_fkey" FOREIGN KEY (spouse_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX "AuditLog_treeId_createdAt_idx" ON public."AuditLog" USING btree ("treeId", "createdAt");

CREATE UNIQUE INDEX "Invitation_inviteeEmail_treeId_key" ON public."Invitation" USING btree ("inviteeEmail", "treeId");

CREATE UNIQUE INDEX "TreeMember_linkId_key" ON public."TreeMember" USING btree ("linkId");

CREATE UNIQUE INDEX "TreeMember_profileId_treeId_key" ON public."TreeMember" USING btree ("profileId", "treeId");

CREATE UNIQUE INDEX "Tree_code_key" ON public."Tree" USING btree (code);

CREATE UNIQUE INDEX "Tree_name_key" ON public."Tree" USING btree (name);

CREATE UNIQUE INDEX "Tree_rootId_key" ON public."Tree" USING btree ("rootId");

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);

CREATE UNIQUE INDEX "User_profileId_key" ON public."User" USING btree ("profileId");

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);

CREATE UNIQUE INDEX profiles_spouse_id_key ON public.profiles USING btree (spouse_id);

CREATE UNIQUE INDEX "profiles_userId_key" ON public.profiles USING btree ("userId");

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."AuditLog";

REVOKE ALL ON SCHEMA "public" FROM "postgres";

GRANT CREATE, USAGE ON SCHEMA "public" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."AuditLog_id_seq" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."Invitation_id_seq" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."TreeMember_id_seq" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."Tree_id_seq" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."events_id_seq" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."profiles_id_seq" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."AuditLog" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."Invitation" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."Tree" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."TreeMember" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."User" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."_prisma_migrations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT USAGE ON TYPE "public"."Role" TO "postgres";

GRANT USAGE ON TYPE "public"."Status" TO "postgres";

