#!/bin/bash
# Configure Twilio phone number webhooks for RingMinder
# Run once after purchasing the phone number
# Usage: bash supabase/scripts/configure-twilio-number.sh

set -e

source .env

SUPABASE_URL="https://dsvcvzbcfnldtxqpmhrn.supabase.co"
BASE_URL="${SUPABASE_URL}/functions/v1"

echo "Configuring Twilio phone number ${TWILIO_PHONE_NUMBER}..."

curl -s -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${TWILIO_PHONE_NUMBER_SID}.json" \
  -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}" \
  --data-urlencode "VoiceUrl=${BASE_URL}/voice-inbound" \
  --data-urlencode "VoiceMethod=POST" \
  --data-urlencode "StatusCallback=${BASE_URL}/voice-outbound-status" \
  --data-urlencode "StatusCallbackMethod=POST" \
  | python3 -m json.tool

echo ""
echo "Done."
echo "Inbound webhook: ${BASE_URL}/voice-inbound"
echo "Status callback: ${BASE_URL}/voice-outbound-status"
