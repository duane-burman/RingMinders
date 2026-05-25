#!/bin/bash
# Test IVR Edge Functions by simulating Twilio POST requests
# Usage: bash supabase/scripts/test-ivr.sh

set -e
source .env

BASE_URL="https://dsvcvzbcfnldtxqpmhrn.supabase.co/functions/v1"
PASS=0
FAIL=0

test_function() {
  local name=$1
  local url=$2
  local data=$3
  local expect=$4

  response=$(curl -s -X POST "${url}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "${data}" \
    -w "\n%{http_code}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" != "200" ]; then
    echo "FAIL [$name] HTTP $http_code"
    echo "  Response: ${body:0:200}"
    FAIL=$((FAIL + 1))
    return
  fi

  if ! echo "$body" | python3 -c "import sys; import xml.etree.ElementTree as ET; ET.parse(sys.stdin)" 2>/dev/null; then
    echo "FAIL [$name] Invalid XML response"
    echo "  Response: ${body:0:200}"
    FAIL=$((FAIL + 1))
    return
  fi

  if [ -n "$expect" ] && ! echo "$body" | grep -q "$expect"; then
    echo "FAIL [$name] Expected '$expect' not found in response"
    echo "  Response: ${body:0:300}"
    FAIL=$((FAIL + 1))
    return
  fi

  echo "PASS [$name]"
  PASS=$((PASS + 1))
}

echo "=== RingMinder IVR Function Tests ==="
echo ""

# Test 1: voice-inbound — unknown caller
test_function "voice-inbound: unknown caller" \
  "${BASE_URL}/voice-inbound" \
  "From=%2B19999999999&CallSid=CAtest123&Direction=inbound" \
  "voice-lookup-number"

# Test 2: voice-inbound — known caller (Duane Burkholder)
test_function "voice-inbound: known caller" \
  "${BASE_URL}/voice-inbound" \
  "From=%2B18036464094&CallSid=CAtest123&Direction=inbound" \
  "voice-verify-pin"

# Test 3: voice-lookup-number — number not in system
test_function "voice-lookup-number: unknown number" \
  "${BASE_URL}/voice-lookup-number" \
  "Digits=9999999999&CallSid=CAtest123" \
  "No account was found"

# Test 4: voice-main-menu — press 1 (create)
test_function "voice-main-menu: press 1 (create)" \
  "${BASE_URL}/voice-main-menu?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "Digits=1&CallSid=CAtest123" \
  "voice-enter-datetime"

# Test 5: voice-main-menu — press 2 (upcoming)
test_function "voice-main-menu: press 2 (upcoming)" \
  "${BASE_URL}/voice-main-menu?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "Digits=2&CallSid=CAtest123" \
  "voice-review-upcoming"

# Test 6: voice-main-menu — press 3 (missed)
test_function "voice-main-menu: press 3 (missed)" \
  "${BASE_URL}/voice-main-menu?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "Digits=3&CallSid=CAtest123" \
  "voice-review-missed"

# Test 7: voice-main-menu — invalid input
test_function "voice-main-menu: invalid input" \
  "${BASE_URL}/voice-main-menu?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "Digits=9&CallSid=CAtest123" \
  "not a valid option"

# Test 8: voice-enter-datetime — prompt (hybrid speech+DTMF gather)
test_function "voice-enter-datetime: prompt" \
  "${BASE_URL}/voice-enter-datetime?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "CallSid=CAtest123" \
  "input=\"dtmf speech\""

# Test 9: voice-parse-datetime — valid input, 3-part format (June 15 at 2:00, year inferred)
test_function "voice-parse-datetime: valid input (3-part, year inferred)" \
  "${BASE_URL}/voice-parse-datetime?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "Digits=6*15*200&CallSid=CAtest123" \
  "voice-confirm-datetime"

# Test 10: voice-parse-datetime — invalid (wrong number of parts)
test_function "voice-parse-datetime: invalid format" \
  "${BASE_URL}/voice-parse-datetime?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "Digits=6*15&CallSid=CAtest123" \
  "voice-enter-datetime"

# Test 16: voice-parse-datetime — speech path (SpeechResult bypasses AM/PM, goes to voice-datetime-confirmed)
test_function "voice-parse-datetime: speech path" \
  "${BASE_URL}/voice-parse-datetime?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "SpeechResult=June+fifteenth+at+nine+thirty+a.m.&CallSid=CAtest123" \
  "voice-datetime-confirmed"

# Test 17: voice-parse-datetime — speech path with unparseable input routes back to entry
test_function "voice-parse-datetime: speech path bad input" \
  "${BASE_URL}/voice-parse-datetime?userId=test&userName=Test&callerNumber=%2B19999999999" \
  "SpeechResult=blah+blah+blah&CallSid=CAtest123" \
  "voice-enter-datetime"

# Test 11: voice-datetime-confirmed — pound (confirm)
test_function "voice-datetime-confirmed: pound confirms" \
  "${BASE_URL}/voice-datetime-confirmed?userId=test&userName=Test&callerNumber=%2B19999999999&scheduledAt=2027-06-15T14%3A00%3A00Z" \
  "Digits=%23&CallSid=CAtest123" \
  "voice-choose-callback"

# Test 12: voice-datetime-confirmed — star (re-enter)
test_function "voice-datetime-confirmed: star re-enters" \
  "${BASE_URL}/voice-datetime-confirmed?userId=test&userName=Test&callerNumber=%2B19999999999&scheduledAt=2027-06-15T14%3A00%3A00Z" \
  "Digits=*&CallSid=CAtest123" \
  "voice-enter-datetime"

# Test 13: voice-choose-callback — press 1 (use caller number)
test_function "voice-choose-callback: use caller number" \
  "${BASE_URL}/voice-choose-callback?userId=test&userName=Test&callerNumber=%2B19999999999&scheduledAt=2027-06-15T14%3A00%3A00Z" \
  "Digits=1&CallSid=CAtest123" \
  "voice-record-message"

# Test 14: voice-choose-callback — press 2 (enter different number)
test_function "voice-choose-callback: enter different number" \
  "${BASE_URL}/voice-choose-callback?userId=test&userName=Test&callerNumber=%2B19999999999&scheduledAt=2027-06-15T14%3A00%3A00Z" \
  "Digits=2&CallSid=CAtest123" \
  "voice-callback-selected"

# Test 15: voice-outbound-greeting — no keypress (voicemail path)
test_function "voice-outbound-greeting: no reminder_id" \
  "${BASE_URL}/voice-outbound-greeting?reminder_id=00000000-0000-0000-0000-000000000000" \
  "CallSid=CAtest123&CallStatus=in-progress" \
  "Hangup"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
