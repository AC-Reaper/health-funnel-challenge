#!/usr/bin/env bash
#
# seed-demo.sh — produce two demo sessions and print their sessionIds.
#
# Brief deliverable §五-1c ("提供一个已支付的测试 sessionId"). Drives the REAL
# public API end-to-end (create → 6 steps → submit → /pay) with a cookie
# jar, so the seeded rows are byte-identical to a genuine funnel run. Uses
# the secret-free mock POST /api/v1/pay (ADR-018), so it needs NO
# PAYMENT_WEBHOOK_SECRET. Reviewers can paste either printed sessionId into:
#
#     GET /api/v1/results/by-session?sessionId=<id>
#
# and diff the paid (full) vs free (teaser) JSON.
#
# The sessions are created with a marker User-Agent ($DEMO_UA below) so that
# `GET /api/v1/results/by-session` will read them (ADR-019): that endpoint
# only returns demo-seeded sessions, never a real visitor's session by id.
#
# Usage:
#   BASE=http://localhost:3000 scripts/seed-demo.sh
#   BASE=https://<your-app>.vercel.app scripts/seed-demo.sh
#
# Requires: curl, jq. (uuidgen optional — falls back to a random key.)
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"

# Must match DEMO_SEED_USER_AGENT in lib/session.ts (ADR-019).
DEMO_UA="health-funnel-demo-seed/1.0"

command -v curl >/dev/null || { echo "error: curl is required" >&2; exit 1; }
command -v jq   >/dev/null || { echo "error: jq is required"   >&2; exit 1; }

gen_key() {
  if command -v uuidgen >/dev/null; then uuidgen
  else printf 'seed-%s-%s' "$RANDOM" "$RANDOM"; fi
}

# Walk a single session through the funnel. $1 = cookie-jar path.
# Echoes the session UUID on stdout.
run_funnel() {
  local jar="$1"
  # Marker UA so the session is readable via GET /results/by-session (ADR-019).
  curl -fsS -c "$jar" -b "$jar" -X POST "$BASE/api/v1/sessions" \
    -H "Content-Type: application/json" -H "User-Agent: $DEMO_UA" -d '{}' >/dev/null

  local steps=(
    'gender|{"gender":"female"}'
    'main_goal|{"mainGoal":"lose_weight"}'
    'age|{"ageYears":29}'
    'height|{"heightCm":168}'
    'weight|{"weightKg":80,"targetWeightKg":70}'
    'activity|{"activityLevel":"moderate"}'
  )
  local entry step payload
  for entry in "${steps[@]}"; do
    step="${entry%%|*}"
    payload="${entry#*|}"
    curl -fsS -b "$jar" -X PATCH "$BASE/api/v1/sessions/me/steps/$step" \
      -H "Content-Type: application/json" -d "$payload" >/dev/null
  done

  curl -fsS -b "$jar" -X POST "$BASE/api/v1/sessions/me/submit" \
    -H "Content-Type: application/json" -d '{}' >/dev/null

  curl -fsS -b "$jar" "$BASE/api/v1/sessions/me" | jq -r .sessionId
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Seeding demo sessions against $BASE ..." >&2

# 1. Paid session: walk the funnel, then grant via the secret-free mock /pay.
PAID_SID="$(run_funnel "$tmp/paid.jar")"
PAY_RES="$(curl -fsS -b "$tmp/paid.jar" -X POST "$BASE/api/v1/pay" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(gen_key)" -d '{}')"
PAYMENT_ID="$(echo "$PAY_RES" | jq -r .paymentId)"
ENTITLEMENT="$(echo "$PAY_RES" | jq -r .entitlementStatus)"

# 2. Free session: walk the funnel, leave it unpaid (teaser).
FREE_SID="$(run_funnel "$tmp/free.jar")"

# 3. Self-verify the promised contrast through the demo read (fail-fast):
#    paid must be "full", free must be "teaser". This proves the deliverable
#    rather than just printing IDs that might not differ on a broken env.
PAID_KIND="$(curl -fsS "$BASE/api/v1/results/by-session?sessionId=$PAID_SID" | jq -r .kind)"
FREE_KIND="$(curl -fsS "$BASE/api/v1/results/by-session?sessionId=$FREE_SID" | jq -r .kind)"
if [ "$PAID_KIND" != "full" ] || [ "$FREE_KIND" != "teaser" ]; then
  echo "error: contrast check failed — paid kind='$PAID_KIND' (want full), free kind='$FREE_KIND' (want teaser)" >&2
  exit 1
fi

echo >&2
echo "Verified: paid → full, free → teaser. Paste either id into the demo read:" >&2
echo
echo "PAID (full):   $PAID_SID   paymentId=$PAYMENT_ID  entitlementStatus=$ENTITLEMENT"
echo "  $BASE/api/v1/results/by-session?sessionId=$PAID_SID"
echo
echo "FREE (teaser): $FREE_SID"
echo "  $BASE/api/v1/results/by-session?sessionId=$FREE_SID"
