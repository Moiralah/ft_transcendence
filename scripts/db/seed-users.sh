#!/bin/sh
# Local test data: COUNT confirmed logins (default 100), each with a User row
# and a filled-in profile (name, gender, birth date, bio), like
# AuthService.createUser plus a profile edit. The first is always Sierra James;
# the rest get made-up names from a fixed seed, so every run makes the same
# people. Emails are first.last@example.com (a number is added on a clash),
# all with the same password. LOCAL SUPABASE ONLY (`make local`).
#
# Usage:
#   ./scripts/db/seed-users.sh
#   COUNT=20 PASSWORD=... ./scripts/db/seed-users.sh
#
# Safe to re-run: emails that already have a login are skipped.
set -e
cd "$(dirname "$0")/../.."

COUNT="${COUNT:-100}"
PASSWORD="${PASSWORD:-Test1234!}"
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

# One line per person: email|first|last|gender|birth date|bio
PEOPLE=$(awk -v count="$COUNT" 'BEGIN {
  split("Sierra Olivia Emma Ava Sophia Mia Chloe Grace Hannah Zoe Nadia Aisha Mei Priya Siti Farah Lily Ruby Isla Maya", women, " ")
  split("Liam Noah Ethan Lucas Mason Daniel Ryan Adam Jason Kevin Arjun Wei Hafiz Amir Ravi Marcus Owen Leo Samuel Isaac", men, " ")
  split("James Tan Lim Lee Wong Chan Ng Ong Teo Goh Kumar Singh Rahman Ismail Abdullah Smith Brown Wilson Taylor Martin Garcia Nguyen Kim Park Fernandez", lasts, " ")
  split("Loves hiking on weekends.|Coffee first, then everything else.|Amateur photographer.|Keeps the family recipes alive.|Learning to play the guitar.|Into board games and puzzles.|Runs a small bakery.|Travels whenever possible.|Works in software.|Collects old family photos.", bios, "|")
  srand(42)
  for (i = 1; i <= count; i++) {
    if (i == 1) { first = "Sierra"; last = "James"; gender = "FEMALE"; dob = "1989-08-02" }
    else {
      gender = rand() < 0.5 ? "FEMALE" : "MALE"
      first = gender == "FEMALE" ? women[1 + int(rand() * 20)] : men[1 + int(rand() * 20)]
      last = lasts[1 + int(rand() * 25)]
      dob = sprintf("%04d-%02d-%02d", 1950 + int(rand() * 56), 1 + int(rand() * 12), 1 + int(rand() * 28))
    }
    local = tolower(first "." last)
    if (used[local]++) local = local used[local]
    print local "@example.com|" first "|" last "|" gender "|" dob "|" bios[1 + (i - 1) % 10]
  }
}')

SQL_FILE=$(mktemp)
trap 'rm -f "$SQL_FILE"' EXIT
made=0; skipped=0
echo "[seed] creating $COUNT logins..."
while IFS='|' read -r email first last gender dob bio; do
  response=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")
  id=$(echo "$response" | sed -n 's/^{"id":"\([0-9a-f-]*\)".*/\1/p')
  if [ -z "$id" ]; then
    case "$response" in
      *email_exists*|*already*) skipped=$((skipped + 1)); continue ;;
      *) echo "[seed] Supabase refused $email: $response" >&2; exit 1 ;;
    esac
  fi
  # The account, as AuthService.createUser makes it, with the profile filled in.
  cat >> "$SQL_FILE" <<SQL
WITH p AS (
  INSERT INTO profiles ("firstName", "lastName", gender, "birthDate", bio, "userId", "updatedAt")
  VALUES ('$first', '$last', '$gender', '$dob', '$bio', '$id', now()) RETURNING id
)
INSERT INTO "User" (id, email, username, "profileId", "updatedAt")
SELECT '$id', '$email', split_part('$email', '@', 1), p.id, now() FROM p;
SQL
  made=$((made + 1))
done <<EOF
$PEOPLE
EOF

if [ "$made" -gt 0 ]; then
  docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -1 < "$SQL_FILE"
fi
echo "[seed] done: $made made, $skipped already there. Password for all: $PASSWORD"
echo "[seed] e.g. log in at https://localhost:8443 as sierra.james@example.com"
