
## What’s happening (step-by-step diagnosis)

### 1) The “non‑2xx status code” message is coming from the client library (not React)
- When your app calls the backend function via `supabase.functions.invoke(...)`, **any non‑2xx HTTP response becomes a `FunctionsHttpError`**.
- By default, the UI only shows the generic message:
  - “Edge Function returned a non‑2xx status code”
- The actual, more useful JSON error body **is being returned by the backend**, but your frontend currently throws early and doesn’t reliably read that body on errors.

### 2) The backend function is successfully reaching your VPS, but the VPS rejects the API key
From your network request and backend logs, the backend function returns:
```json
{"error":"Unauthorized","upstream":"vps","status":401, ...}
```
This is key: it means
- The backend function is running
- It can reach `http://72.61.251.65:3000`
- The VPS is responding
- But **the VPS is responding 401**, which almost always means **API key mismatch** (wrong key, extra whitespace/quotes, or VPS expects auth in a different place)

### 3) There is also a structural bug that will break sessions/groups even after auth is fixed
Your backend function currently tries to write `session_id` and `created_by` into `whatsapp_sessions`, but those columns do not exist in the database schema.
So even when VPS auth is fixed, session persistence + group sync will still fail silently.

---

## Goals of the fix (complete + robust)

1) Make the UI show the real error from the VPS (not the generic “non‑2xx”).
2) Add a “Test VPS Connection” button so you can verify the VPS URL/API key from inside the app.
3) Fix the database/schema mismatch by storing the VPS session id in an existing column (`session_data` JSONB) and using the existing `whatsapp_sessions.id` UUID consistently.
4) Provide step-by-step guidance to update the backend secrets so the VPS stops returning 401.

---

## Plan (implementation steps)

### Phase A — Make the UI show the real upstream error (fix the “non‑2xx” confusion)
**Files**
- `src/hooks/useWhatsAppSession.ts`
- `src/hooks/useWhatsAppGroups.ts`
- `src/components/workshops/WorkshopWhatsAppTab.tsx`

**What we’ll do**
- When `supabase.functions.invoke(...)` returns `{ error, response }`:
  - If `error` exists and `response` exists, we will:
    1) `await response.text()` (or `await response.json()` safely)
    2) parse the backend JSON error payload (like `{ upstream: "vps", status: 401, hint: ... }`)
    3) show a targeted toast:
       - “VPS Authentication Failed (401)”
       - plus the backend hint/suggestion
- Result: instead of “Edge function returned a non‑2xx…”, you’ll see the exact reason (and the exact upstream code).

**Why this matters**
- It turns this from guessing into a clear action: “your VPS rejected the API key”.

---

### Phase B — Add an in-app “Test VPS Connection” action
**Files**
- `src/pages/settings/WhatsAppConnection.tsx`
- `src/hooks/useWhatsAppSession.ts` (or a small helper hook)

**What we’ll add**
- A button: **“Test VPS Connection”**
- It will call the backend function with `{ action: "health", organizationId }`
- It will display:
  - success (200) or failure (401/404/500)
  - and the backend-provided hint

**Outcome**
- You can confirm “is the app using the correct VPS URL/key?” without touching logs.

---

### Phase C — Fix the WhatsApp session persistence + ID mapping (currently mismatched)
**Problem we’re fixing**
- The backend function currently tries to write columns that don’t exist (`session_id`, `created_by`) and uses `onConflict: session_id`.
- Your actual table `whatsapp_sessions` has:
  - `id` (uuid)
  - `session_data` (jsonb)
  - `status`, `qr_code`, etc.
- Your `whatsapp_groups.session_id` is a UUID, so it should point to `whatsapp_sessions.id`.

**Solution (no schema change required)**
We will store the VPS “sessionId” inside `whatsapp_sessions.session_data` as JSON, e.g.
```json
{ "vps_session_id": "wa_<uuid>" }
```

**Backend function changes**
- `supabase/functions/vps-whatsapp-proxy/index.ts`

**Concrete behavior**
1) **connect**
   - Create `localSessionId = crypto.randomUUID()` (UUID)
   - Create `vpsSessionId = "wa_" + localSessionId` (string safe for VPS)
   - Call VPS `/connect` using `vpsSessionId`
   - Insert a `whatsapp_sessions` row:
     - `id: localSessionId`
     - `organization_id`
     - `status: "connecting"`
     - `session_data: { vps_session_id: vpsSessionId }`
   - Return `{ sessionId: localSessionId }` to the frontend (frontend will only store local UUID)

2) **qr / status / disconnect / sync-groups / send**
   - Treat incoming `sessionId` as the **local UUID**
   - Lookup `whatsapp_sessions.session_data->vps_session_id`
   - Call VPS endpoints using the VPS session id
   - Update DB rows using `.eq("id", localSessionId)` (not `session_id`)

**Frontend changes**
- `useWhatsAppSession` polling will use the local UUID session id (which matches DB schema)
- `syncGroups`, `send`, `disconnect` will also pass the local UUID, and the backend function will translate it to VPS session id.

**Why this matters**
- After VPS auth is fixed, your WhatsApp connection will actually persist and group sync will have a valid session reference.

---

### Phase D — “Complete fix” requires correcting the backend secrets (guided)
Based on current evidence, the VPS is returning 401, so we must ensure the backend secrets match exactly what your VPS expects.

**We will provide in-app guidance steps**
- Open your backend panel
- Navigate to Secrets/Environment variables
- Set:
  - `WHATSAPP_VPS_URL` to your VPS base URL (no quotes, no trailing spaces)
  - `WHATSAPP_VPS_API_KEY` to the exact API key (no quotes, no trailing spaces)

**Important detail**
- A very common cause is accidentally saving the value with quotes like:
  - `"nikist-whatsapp-2024-secure-key"`
  instead of:
  - `nikist-whatsapp-2024-secure-key`

---

## Verification checklist (end-to-end)
After implementation:
1) In **Settings → WhatsApp Connection**, click **Test VPS Connection**
   - Expect: 200 OK
2) Click **Connect Device**
   - Expect: QR appears
3) Scan QR on phone
   - Expect: status becomes Connected
4) Click **Sync Groups**
   - Expect: groups appear in “WhatsApp Groups”
5) In a workshop, send a test message to a linked group
   - Expect: “Message sent successfully”

---

## Notes / Risk handling
- If “Test VPS Connection” still returns 401 after you update the secret, then the VPS itself is not configured to accept that key or expects auth in a different mechanism (query param/body/basic auth). In that case, we’ll adapt the backend function to match the VPS’ exact expected auth format (but we need the VPS implementation details or a working curl from a machine that can reach it).

---

## Files involved
- Backend function:
  - `supabase/functions/vps-whatsapp-proxy/index.ts`
- Frontend:
  - `src/hooks/useWhatsAppSession.ts`
  - `src/hooks/useWhatsAppGroups.ts`
  - `src/components/workshops/WorkshopWhatsAppTab.tsx`
  - `src/pages/settings/WhatsAppConnection.tsx`
