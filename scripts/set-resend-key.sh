#!/usr/bin/env bash
# Sets the RESEND_API_KEY secret for the local Supabase Edge Function.
#
# Usage:
#   ./scripts/set-resend-key.sh re_your_real_api_key_here
#
# Or pipe it in:
#   echo "re_your_real_api_key_here" | ./scripts/set-resend-key.sh
#
# The key is stored as a local secret, never written to disk or git.
set -euo pipefail

KEY="${1:-}"
if [ -z "$KEY" ]; then
  # Read from stdin if no argument provided
  KEY="$(cat)"
fi

if [ -z "$KEY" ]; then
  echo "Usage: $0 <resend-api-key>"
  echo "   or:  echo \"re_xxxxx\" | $0"
  echo ""
  echo "Get your key from: https://resend.com/keys"
  exit 1
fi

# Strip leading "re_" not needed, just pass it through
echo "Setting RESEND_API_KEY secret locally..."
npx supabase functions secrets set RESEND_API_KEY --env-file <(echo "RESEND_API_KEY=$KEY")
echo ""
echo "Done. The send-email Edge Function will now use this key."
echo "To clear it later: npx supabase functions secrets unset RESEND_API_KEY"
