#!/bin/sh
# Local test data: one confirmed login that owns a family tree 100 generations
# deep. Each generation is one couple with CHILDREN children (default 1, a
# straight line); the last child carries the line on, the others are leaves
# with no spouse or children. For checking how the tree page copes with a very
# deep (and, with CHILDREN=100, very wide) tree. LOCAL SUPABASE ONLY (`make local`), never the cloud DB.
#
# Usage:
#   ./scripts/db/seed-100-generations.sh
#   EMAIL=deep@example.com PASSWORD=... GENERATIONS=50 ./scripts/db/seed-100-generations.sh
#   EMAIL=wide@example.com CHILDREN=100 ./scripts/db/seed-100-generations.sh   (~10,000 people)
#
# The rows match what the app itself makes: User + profile like
# AuthService.createUser, the tree like TreeService.createTree, and the
# couples and children like addSpouseNode / addChildNode (HOLDER members).
# Stops if the email already has a login; `supabase db reset` + `make local`
# starts over from an empty database.
set -e
cd "$(dirname "$0")/../.."

EMAIL="${EMAIL:-demo-100@example.com}"
PASSWORD="${PASSWORD:-Test1234!}"
GENERATIONS="${GENERATIONS:-100}"
CHILDREN="${CHILDREN:-1}"
DB_CONTAINER=supabase_db_transpeed

STATUS_ENV=$(supabase status -o env 2>/dev/null) || {
  echo "[seed] local Supabase isn't running; start it with make local" >&2
  exit 1
}
status_value() { echo "$STATUS_ENV" | grep -E "^$1=" | head -1 | cut -d= -f2- | tr -d '"'; }
API_URL=$(status_value API_URL)
# The admin API takes the legacy service-role JWT as a bearer token.
SERVICE_KEY=$(status_value SERVICE_ROLE_KEY)
case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "[seed] $API_URL is not a local Supabase; refusing" >&2; exit 1 ;;
esac

echo "[seed] creating login $EMAIL..."
RESPONSE=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")
USER_ID=$(echo "$RESPONSE" | sed -n 's/^{"id":"\([0-9a-f-]*\)".*/\1/p')
if [ -z "$USER_ID" ]; then
  echo "[seed] Supabase refused the login: $RESPONSE" >&2
  exit 1
fi

echo "[seed] building a $GENERATIONS-generation tree, $CHILDREN child(ren) per couple..."
docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q \
  -v uid="$USER_ID" -v email="$EMAIL" -v gens="$GENERATIONS" -v kids="$CHILDREN" <<'SQL'
-- psql variables don't reach inside DO bodies; settings do.
SELECT set_config('seed.uid', :'uid', false),
       set_config('seed.email', :'email', false),
       set_config('seed.gens', :'gens', false),
       set_config('seed.kids', :'kids', false);

DO $$
DECLARE
  uid     text := current_setting('seed.uid');
  email   text := current_setting('seed.email');
  gens    int  := current_setting('seed.gens')::int;
  kids    int  := current_setting('seed.kids')::int;
  title   text := current_setting('seed.gens') || ' Generations'
                  || CASE WHEN current_setting('seed.kids')::int > 1
                          THEN ' x ' || current_setting('seed.kids') || ' Children' ELSE '' END;
  men     text[] := ARRAY['Adam','Benjamin','Charles','Daniel','Edward','Francis','George','Henry','Isaac','James'];
  women   text[] := ARRAY['Alice','Beatrice','Clara','Diana','Eleanor','Florence','Grace','Helen','Iris','Julia'];
  me      int;
  tree_id int;
  root_tm int;
  person  int;
  spouse  int;
  child   int;
  born    date;
BEGIN
  -- The account, as AuthService.createUser makes it.
  INSERT INTO profiles ("firstName", "lastName", "userId", "updatedAt")
    VALUES ('Test', 'Hundred', uid, now()) RETURNING id INTO me;
  INSERT INTO "User" (id, email, username, "profileId", "updatedAt")
    VALUES (uid, email, split_part(email, '@', 1), me, now());

  -- Generation 1 is the tree's root (TreeService.createTree).
  born := make_date(2000 - (gens - 1) * 20, 1, 1);
  INSERT INTO profiles ("firstName", "lastName", gender, "birthDate", bio, "updatedAt")
    VALUES (men[1], 'Hundred', 'MALE', born, 'Generation 1 of ' || gens, now())
    RETURNING id INTO person;
  INSERT INTO "TreeMember" ("profileId", role) VALUES (person, 'HOLDER') RETURNING id INTO root_tm;
  INSERT INTO "Tree" (slug, name, code, description, "ownerId", "rootId", "updatedAt")
    VALUES ('hundred-generations-' || substr(md5(uid), 1, 6), title,
            upper(substr(md5(uid), 7, 6)),
            'Test tree: ' || gens || ' generations deep, ' || kids || ' child(ren) per couple.',
            me, root_tm, now())
    RETURNING id INTO tree_id;
  UPDATE "TreeMember" SET "treeId" = tree_id WHERE id = root_tm;
  INSERT INTO "TreeMember" ("profileId", "treeId", role) VALUES (me, tree_id, 'ADMIN');
  INSERT INTO "AuditLog" ("treeId", "profileId", action, details)
    VALUES (tree_id, me, 'CREATE_TREE', 'Created tree "' || title || '"');

  FOR g IN 1 .. gens - 1 LOOP
    -- A wife for this generation's man (addSpouseNode)...
    INSERT INTO profiles ("firstName", "lastName", gender, "birthDate", bio, spouse_id, "updatedAt")
      VALUES (women[1 + g % 10], 'Spouse ' || g, 'FEMALE', born + 730, 'Married into generation ' || g, person, now())
      RETURNING id INTO spouse;
    UPDATE profiles SET spouse_id = spouse WHERE id = person;
    INSERT INTO "TreeMember" ("profileId", "treeId", role) VALUES (spouse, tree_id, 'HOLDER');

    -- ...and their children, the next generation (addChildNode). The last
    -- one is a son who carries the line on; the others alternate daughter/son.
    born := born + interval '20 years';
    FOR c IN 1 .. kids LOOP
      INSERT INTO profiles ("firstName", "lastName", gender, "birthDate", bio, father_id, mother_id, "updatedAt")
        VALUES (CASE WHEN c = kids OR c % 2 = 0 THEN men[1 + (g + c) % 10] ELSE women[1 + (g + c) % 10] END,
                'Hundred',
                CASE WHEN c = kids OR c % 2 = 0 THEN 'MALE' ELSE 'FEMALE' END,
                born + (c - kids) * 3,
                'Generation ' || (g + 1) || ' of ' || gens || ', child ' || c || ' of ' || kids,
                person, spouse, now())
        RETURNING id INTO child;
      INSERT INTO "TreeMember" ("profileId", "treeId", role) VALUES (child, tree_id, 'HOLDER');
    END LOOP;
    person := child;
  END LOOP;

  RAISE NOTICE 'tree % with % people', tree_id, (SELECT count(*) FROM "TreeMember" WHERE "treeId" = tree_id AND role = 'HOLDER');
END $$;
SQL

echo "[seed] done. Log in at https://localhost:8443 as $EMAIL / $PASSWORD"
