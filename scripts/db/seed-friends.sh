#!/bin/sh
# Local test data: one confirmed login with FRIENDS accepted friends (default
# 100). The friends are the made-up users from seed-users.sh, which this runs
# first (it skips the ones already there). Half the friendships were "sent" by
# this user and half "received", so both sides of FriendService.getFriends
# are covered. LOCAL SUPABASE ONLY (`make up`).
#
# Usage:
#   ./scripts/db/seed-friends.sh
#   EMAIL=social@example.com FRIENDS=30 ./scripts/db/seed-friends.sh
#
# Safe to re-run: an existing login is reused and existing friendships kept.
set -e
cd "$(dirname "$0")/../.."

EMAIL="${EMAIL:-demo-friends@example.com}"
PASSWORD="${PASSWORD:-Test1234!}"
FRIENDS="${FRIENDS:-100}"
DB_CONTAINER=supabase_db_transpeed

COUNT="$FRIENDS" PASSWORD="$PASSWORD" ./scripts/db/seed-users.sh

STATUS_ENV=$(supabase status -o env 2>/dev/null)
status_value() { echo "$STATUS_ENV" | grep -E "^$1=" | head -1 | cut -d= -f2- | tr -d '"'; }
API_URL=$(status_value API_URL)
# The admin API takes the legacy service-role JWT as a bearer token.
SERVICE_KEY=$(status_value SERVICE_ROLE_KEY)

echo "[seed] creating login $EMAIL..."
RESPONSE=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")
USER_ID=$(echo "$RESPONSE" | sed -n 's/^{"id":"\([0-9a-f-]*\)".*/\1/p')
if [ -z "$USER_ID" ]; then
  case "$RESPONSE" in
    *email_exists*|*already*) echo "[seed] $EMAIL already has a login; reusing it" ;;
    *) echo "[seed] Supabase refused the login: $RESPONSE" >&2; exit 1 ;;
  esac
fi

echo "[seed] adding $FRIENDS friends..."
docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -1 \
  -v uid="$USER_ID" -v email="$EMAIL" -v friends="$FRIENDS" <<'SQL'
-- The account, as AuthService.createUser makes it (only when it's new).
WITH p AS (
  INSERT INTO profiles ("firstName", "lastName", bio, "userId", "updatedAt")
  SELECT 'Demo', 'Friends', 'Test account with lots of friends.', :'uid', now()
  WHERE :'uid' <> '' RETURNING id
)
INSERT INTO "User" (id, email, username, "profileId", "updatedAt")
SELECT :'uid', :'email', split_part(:'email', '@', 1), p.id, now() FROM p;

-- seed-users.sh people are the first.last@example.com accounts (demo
-- accounts have a hyphen, so they never match). Alternate who "sent" the
-- request; skip pairs that are already linked either way round.
WITH me AS (SELECT id FROM "User" WHERE email = :'email'),
friends AS (
  SELECT u.id, row_number() OVER (ORDER BY u."createdAt", u.email) AS n
  FROM "User" u
  WHERE u.email ~ '^[a-z]+\.[a-z]+[0-9]*@example\.com$'
  ORDER BY u."createdAt", u.email
  LIMIT :friends
)
INSERT INTO "Friendship" ("requesterId", "addresseeId", status, "createdAt", "respondedAt")
SELECT CASE WHEN f.n % 2 = 0 THEN me.id ELSE f.id END,
       CASE WHEN f.n % 2 = 0 THEN f.id ELSE me.id END,
       'ACCEPTED', now() - f.n * interval '1 day', now() - f.n * interval '1 day' + interval '1 hour'
FROM friends f, me
WHERE NOT EXISTS (
  SELECT 1 FROM "Friendship" x
  WHERE (x."requesterId" = me.id AND x."addresseeId" = f.id)
     OR (x."requesterId" = f.id AND x."addresseeId" = me.id)
);

SELECT count(*) AS friends FROM "Friendship" x, "User" me
WHERE me.email = :'email' AND x.status = 'ACCEPTED'
  AND (x."requesterId" = me.id OR x."addresseeId" = me.id);
SQL

echo "[seed] done. Log in at https://localhost:8443 as $EMAIL / $PASSWORD"
