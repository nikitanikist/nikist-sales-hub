

# Create `whatsapp-status-webhook` Edge Function

Your VPS developer has set up a webhook that fires when WhatsApp connects. We need to create a new edge function to receive it and update the database.

## What it does

When the VPS detects a WhatsApp session connects, it sends a webhook with the session ID, status, and phone number. This edge function will:

1. Receive the payload from the VPS
2. Find the matching session in the database (matching by the VPS session ID stored in `session_data`)
3. Update the session status to `connected`, set the phone number, and update timestamps
4. Trigger the auto-migration logic we already built (migrate old disconnected sessions with the same phone number to the new one)

## Important detail

The VPS sends a `sessionId` like `wa_a545e2c1-...` which is stored inside the `session_data` JSONB column as `vps_session_id` -- it is NOT the database UUID `id`. So the lookup must filter by `session_data->>'vps_session_id'`.

## Changes

### 1. New file: `supabase/functions/whatsapp-status-webhook/index.ts`

- Receives POST with `{ sessionId, status, phoneNumber, timestamp }`
- Authenticates via `WEBHOOK_SECRET_KEY` header (optional, for security) or open like other VPS webhooks
- Finds the session row where `session_data->>'vps_session_id' = sessionId`
- Updates `status`, `phone_number`, `last_active_at`, `connected_at` (if connected)
- If status is `connected` and phone number is present, runs the same auto-migration logic (calls `migrate_whatsapp_session` RPC for any old disconnected sessions with the same phone number in the same org)

### 2. Update `supabase/config.toml`

- Add `[functions.whatsapp-status-webhook]` with `verify_jwt = false` (VPS calls this, no JWT)

### Technical details

- Uses `session_data->>vps_session_id` filter via `.filter('session_data->>vps_session_id', 'eq', sessionId)` on the Supabase client
- CORS headers included for consistency
- No JWT verification (VPS is the caller)
- Logs the webhook payload and migration results for debugging

