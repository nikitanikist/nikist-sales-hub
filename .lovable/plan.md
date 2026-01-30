
Goal
- Fix the persistent “Edge function returned 401 … { "error": "Unauthorized" }” when clicking “Connect Device” in Settings → Integrations → WhatsApp.

What we know (from deep inspection)
1) The request is reaching the backend function:
   - Logs show: “Proxying POST request to http://72.61.251.65:3000/connect”.
2) Authentication to the app/backend is NOT the blocker:
   - The proxy log line only happens after the function passes its Bearer-token validation and organization membership check.
3) Therefore the 401 is coming from the VPS server itself (the thing at http://72.61.251.65:3000):
   - The proxy returns the VPS HTTP status directly (`status: vpsResponse.status`), so when the client sees 401, the VPS returned 401.
   - This matches your observation: opening the VPS URL in a browser shows “unauthorized” (expected if it’s protected by an API key).

Root cause (most likely)
- The VPS is rejecting our request because it is not receiving the API key in the format it expects OR the configured `WHATSAPP_VPS_API_KEY` value is not the correct key for that VPS.

Important clarification (non-bug)
- Seeing “Unauthorized” when you open the VPS URL directly in a browser is normal, because you’re not sending the secret API key from the browser URL bar.

Implementation plan (fix it properly and make it diagnosable)
Phase A — Make the proxy “tell us exactly where the 401 comes from”
1) Update `supabase/functions/vps-whatsapp-proxy/index.ts` to:
   - Log VPS response status for connect attempts (never log secrets).
   - Return richer error payloads to the UI on non-2xx:
     - include `upstream: "vps"`,
     - include `status`,
     - include a safe snippet of the upstream body (text, truncated), and
     - include a clear hint when status=401: “VPS rejected credentials; check VPS API key / auth header format.”
   - Parse upstream response safely:
     - Read as text first.
     - Attempt JSON.parse.
     - If parsing fails, still return the raw text (this avoids “JSON parse” crashes and helps debugging).

Why: right now the UI only sees `{error:"Unauthorized"}` and we can’t distinguish “wrong header name” vs “wrong key” vs “wrong endpoint”.

Phase B — Fix likely VPS auth header mismatch (robust compatibility)
2) Update `supabase/functions/vps-whatsapp-proxy/index.ts` to send multiple common API-key header formats to maximize compatibility, for example:
   - `X-API-Key: <key>` (current)
   - `Authorization: Bearer <key>`
   - `Authorization: <key>`
   - `apikey: <key>`
   (We’ll keep `Content-Type: application/json`.)
   Implementation detail:
   - Try one header strategy; if VPS returns 401, automatically retry with the next header strategy (small bounded retry, e.g. max 3–4 attempts).
   - If any attempt succeeds (2xx), proceed normally.
   - If all fail, return a structured 401 with “VPS auth failed after retries”.

Why: we don’t control the VPS, so the proxy should adapt to common conventions rather than assuming one header name.

3) Fix URL joining to avoid subtle path errors:
   - Replace string concatenation `${VPS_URL}${vpsEndpoint}` with `new URL(vpsEndpoint, VPS_URL).toString()`.
   - This prevents issues with trailing slashes (e.g. `...3000//connect`).

Phase C — Keep the queue sender consistent (so messages won’t fail later)
4) Apply the same VPS auth header strategy + safe response parsing to:
   - `supabase/functions/process-whatsapp-queue/index.ts`
   So scheduled/automated messages won’t hit the same 401 later.

Phase D — Improve the UI error message so you immediately know what to do
5) Update frontend error handling in `src/hooks/useWhatsAppSession.ts`:
   - If the backend function returns `upstream: "vps"` and `status: 401`, show a targeted toast like:
     - “VPS rejected the API key (401). Please verify the VPS API key configured in Lovable Cloud secrets.”
   - Keep the raw error available in console for debugging.

Phase E — Verification (end-to-end)
6) Test from the app:
   - Settings → Integrations → WhatsApp → Connect Device
   - Confirm:
     - backend logs show which header strategy succeeded,
     - connect returns 200 and provides a `sessionId`,
     - QR request returns QR data,
     - status polling flips to connected after scanning.

If it still returns 401 after these changes
- That would strongly indicate the configured `WHATSAPP_VPS_API_KEY` value does not match what the VPS expects (wrong key or key rotated).
- Next step would be to update the `WHATSAPP_VPS_API_KEY` secret to the correct value (you would provide it; we cannot infer it).
- I’ll also add a small “Test VPS auth” action (non-destructive) in the proxy (e.g. GET `/health` or GET `/`) to validate credentials without starting a session, if your VPS supports it; otherwise we’ll just keep the detailed connect error.

Files that will change (implementation)
- supabase/functions/vps-whatsapp-proxy/index.ts
- supabase/functions/process-whatsapp-queue/index.ts
- src/hooks/useWhatsAppSession.ts (better error messaging)

Expected outcome
- “Connect Device” no longer fails with a blind 401. Either it connects successfully, or it gives a precise, actionable explanation (and automatically handles the most common VPS auth header formats).

Notes (security)
- No secrets will be logged.
- The proxy will continue to validate the user and organization membership before calling the VPS.

