#!/usr/bin/env bash
#
# Pre-submission check for Pi Mainnet listing.
#
#   bash scripts/listing-check.sh https://pappad.app
#
# Checks everything a reviewer (or a user) would hit by URL. Read-only.
#
# Run it against the domain you are actually submitting, not the vercel.app
# preview — that distinction is the point of several checks below.

set -uo pipefail
BASE="${1:-}"

if [ -z "$BASE" ]; then
  echo "Usage: bash scripts/listing-check.sh https://your-domain"
  exit 1
fi
BASE="${BASE%/}"

pass=0; fail=0; warn=0
ok()   { echo "  ok    $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL  $1"; fail=$((fail+1)); }
note() { echo "  warn  $1"; warn=$((warn+1)); }

code() { curl -s -o /dev/null -w "%{http_code}" -L --max-time 15 "$1"; }
body() { curl -s -L --max-time 15 "$1"; }

echo ""
echo "LISTING CHECK — $BASE"
echo "────────────────────────────────────────────────────────────────────"
echo ""

# ── Pi platform files ────────────────────────────────────────────────────
echo "Pi platform"
c=$(code "$BASE/validation-key.txt")
[ "$c" = "200" ] && ok "validation-key.txt served" || bad "validation-key.txt returned $c — Developer Portal can't verify the domain"

c=$(code "$BASE/pi.toml")
if [ "$c" = "200" ]; then
  ok "pi.toml served"
else
  note "pi.toml returned $c (only needed if your listing references one)"
fi

# ── Pages a reviewer opens ───────────────────────────────────────────────
echo ""
echo "Required pages"
for path in / /terms /privacy /support /topup /leaderboard /polls; do
  c=$(code "$BASE$path")
  [ "$c" = "200" ] && ok "$path" || bad "$path returned $c"
done

# ── Redirects ────────────────────────────────────────────────────────────
echo ""
echo "Retired routes"
for path in /exchange /wallet/exchange; do
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$BASE$path")
  if [ "$c" = "307" ] || [ "$c" = "308" ]; then
    ok "$path redirects ($c)"
  else
    bad "$path returned $c — expected a redirect to /topup"
  fi
done

# ── Redemption is closed ─────────────────────────────────────────────────
echo ""
echo "Redemption"
c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST -H "Content-Type: application/json" \
  -d '{"direction":"redeem","userId":"probe","amount":5000}' \
  "$BASE/api/payments/exchange")
[ "$c" = "410" ] && ok "redeem returns 410 Gone" || bad "redeem returned $c — expected 410"

# ── Unauthenticated writes are refused ───────────────────────────────────
echo ""
echo "Auth enforcement (these must NOT succeed)"
probe_401() {
  local path="$1" data="$2"
  local c
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    -X POST -H "Content-Type: application/json" -d "$data" "$BASE$path")
  if [ "$c" = "401" ]; then ok "$path rejects anonymous ($c)"
  else bad "$path returned $c without a token — expected 401"; fi
}
probe_401 "/api/streak" '{"userId":"probe"}'
probe_401 "/api/polls/vote" '{"pollOptionId":"probe"}'
probe_401 "/api/predictions/submit" '{"contentId":"p","answer":"a"}'
probe_401 "/api/challenges/submit" '{"answers":[]}'
probe_401 "/api/admin/resolve" '{"userId":"probe","contentId":"c","correctAnswer":"a"}'
probe_401 "/api/account/delete" '{"confirmUsername":"probe"}'

c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST -H "Content-Type: application/json" \
  -H "x-ppa-api-key: definitely-not-a-real-key" \
  -d '{"action":"credit","piUserId":"probe","amount":999999,"idempotencyKey":"probe"}' \
  "$BASE/api/external/ppa")
[ "$c" = "401" ] && ok "/api/external/ppa rejects a bad key (401)" || bad "/api/external/ppa returned $c for a bad key"

# ── Emblem endpoints ─────────────────────────────────────────────────────
echo ""
echo "Emblems"
meta=$(body "$BASE/api/emblem/douyonevenst54/metadata")
if echo "$meta" | grep -q '"soulbound":true'; then
  ok "metadata declares soulbound"
else
  bad "metadata missing soulbound flag"
fi
if echo "$meta" | grep -q '"transferable":false'; then
  ok "metadata declares transferable:false"
else
  bad "metadata missing transferable:false"
fi

# The check that catches a wrong-domain listing: URLs inside the metadata must
# point at the domain being submitted, not at a vercel.app preview.
host="${BASE#https://}"; host="${host#http://}"
if echo "$meta" | grep -q "$host"; then
  ok "metadata URLs use $host"
else
  bad "metadata URLs do NOT use $host — image/external_url point somewhere else"
fi

if echo "$meta" | grep -q 'â€'; then
  bad "metadata has a charset problem (mojibake in the name)"
else
  ok "metadata charset clean"
fi

c=$(code "$BASE/api/emblem/douyonevenst54/image")
[ "$c" = "200" ] && ok "emblem image renders" || bad "emblem image returned $c"

# ── Headers ──────────────────────────────────────────────────────────────
echo ""
echo "Headers"
csp=$(curl -sI -L --max-time 15 "$BASE/" | grep -i "content-security-policy" || true)
if echo "$csp" | grep -q "minepi.com"; then ok "CSP allows Pi Browser framing"
else bad "CSP missing frame-ancestors for minepi.com"; fi
if echo "$csp" | grep -q "pinet.com"; then ok "CSP allows PiNet framing"
else note "CSP missing pinet.com — needed later for PiNet, not for listing"; fi

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo "  $pass passed, $fail failed, $warn warnings"
echo ""
[ "$fail" -gt 0 ] && echo "  Fix the failures before submitting." && echo ""
exit $([ "$fail" -gt 0 ] && echo 1 || echo 0)
