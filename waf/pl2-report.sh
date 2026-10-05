#!/bin/sh
# Paranoia-level-2 rollout helper (see DETECTION_PARANOIA in
# docker-compose-security.yml). Lists requests that were ALLOWED (blocking is
# still level 1) but matched level-2 rules: the false positives to look at
# before turning BLOCKING_PARANOIA up to 2. Requests already blocked at
# level 1 (real attacks, test-waf.sh) are left out.
#
#   ./waf/pl2-report.sh            # last 24h, both WAFs
#   ./waf/pl2-report.sh 72h        # longer window
#
# Run on the machine where the WAF containers run (solsys in production).
SINCE=${1:-24h}
for waf in waf-backend waf-frontend; do
	c=$(docker ps --format '{{.Names}}' | grep -- "-$waf-1$" | head -1)
	[ -z "$c" ] && continue
	echo "== $waf (last $SINCE)"
	docker logs --since "$SINCE" "$c" 2>/dev/null | python3 -c '
import sys, json, collections
hits = collections.Counter()
for line in sys.stdin:
    if not line.startswith("{"):
        continue
    try:
        t = json.loads(line)["transaction"]
    except Exception:
        continue
    if t.get("response", {}).get("http_code") == 403:
        continue  # blocked anyway at level 1
    for m in t.get("messages", []):
        d = m.get("details", {})
        if "paranoia-level/2" in d.get("tags", []):
            uri = t["request"]["uri"].split("?")[0][:60]
            hits[(d.get("ruleId"), m.get("message", "")[:55], t["request"]["method"], uri, d.get("data", "")[:60])] += 1
if not hits:
    print("  no false-positive candidates: safe to raise BLOCKING_PARANOIA to 2 for this WAF")
for (rid, msg, method, uri, data), n in hits.most_common(30):
    print(f"  rule {rid} x{n}: {msg} | {method} {uri} | {data}")
'
done
