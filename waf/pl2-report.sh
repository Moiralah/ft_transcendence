#!/bin/sh
# Paranoia-level-2 false-positive finder. Lists requests that matched level-2
# rules but NO level-1 rule: with BLOCKING_PARANOIA=2 (since 2026-10-06) these
# were blocked only because of level 2, so they're where false positives show
# up (bots and scanners also appear here; judge by the request). Requests that
# also matched level-1 rules (real attacks, test-waf.sh) are left out.
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
    msgs = t.get("messages", [])
    rule_msgs = [m for m in msgs if any(tag.startswith("paranoia-level/") for tag in m.get("details", {}).get("tags", []))]
    if t.get("response", {}).get("http_code") == 403:
        # Since BLOCKING_PARANOIA=2: also show requests blocked ONLY because of
        # level-2 rules (no level-1 rule matched), i.e. possible false positives.
        if any("paranoia-level/1" in m["details"]["tags"] for m in rule_msgs):
            continue  # a level-1 rule matched too: a real attack
    for m in msgs:
        d = m.get("details", {})
        if "paranoia-level/2" in d.get("tags", []):
            uri = t["request"]["uri"].split("?")[0][:60]
            hits[(d.get("ruleId"), m.get("message", "")[:55], t["request"]["method"], uri, d.get("data", "")[:60])] += 1
if not hits:
    print("  nothing blocked by level 2 alone")
for (rid, msg, method, uri, data), n in hits.most_common(30):
    print(f"  rule {rid} x{n}: {msg} | {method} {uri} | {data}")
'
done
