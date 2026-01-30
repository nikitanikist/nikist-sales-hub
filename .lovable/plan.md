

## Root Cause Identified

Your VPS does **not** have a separate `/qr` endpoint. According to your VPS documentation:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| POST | `/connect` | Create session (needs `{"sessionId": "xxx"}`) |
| GET | `/status/:sessionId` | Get session status **& QR code** |
| POST | `/send` | Send message |

The current code is calling `/qr/{sessionId}` which returns 404 because that endpoint does not exist. The QR code is returned **inside** the `/status/:sessionId` response.

---

## What needs to change

### 1. Remove the `qr` action from the backend function
The `qr` action is invalid because the VPS doesn't have a `/qr` endpoint. We should remove it and rely solely on the `status` endpoint which returns both status and QR code.

### 2. Update the frontend to only poll `/status`
Instead of calling `qr` separately, the frontend should:
- Call `status` which returns `{ status: "...", qrCode: "..." }`
- Extract the QR code from the status response

### 3. Fix the `sync-groups` endpoint (if needed)
Your VPS may not have `/groups/sync/:sessionId`. If group sync is needed, we should confirm the correct endpoint or remove that feature.

---

## Files to modify

### Backend: `supabase/functions/vps-whatsapp-proxy/index.ts`
- Remove the `case 'qr'` branch entirely
- Update `case 'status'` to also return `qrCode` from VPS response

### Frontend: `src/hooks/useWhatsAppSession.ts`
- Remove the `fetchQRCode` function (it calls the non-existent `/qr` endpoint)
- Update `checkStatus` to extract and set the QR code from the status response

---

## Expected flow after fix

1. User clicks **Connect Device**
2. Backend calls `POST /connect` with `{ sessionId: "wa_xxx" }`
3. Frontend starts polling `status` action
4. Backend calls `GET /status/wa_xxx`
5. VPS returns `{ status: "qr_pending", qrCode: "data:image/..." }`
6. Frontend displays the QR code
7. User scans QR
8. VPS returns `{ status: "connected", phoneNumber: "+91..." }`
9. UI shows "Connected"

---

## Technical summary

| Current (broken) | Fixed |
|------------------|-------|
| `action: qr` → `GET /qr/{id}` → 404 | Removed |
| `action: status` → no QR extraction | `action: status` → extract `qrCode` from response |
| `fetchQRCode()` calls `qr` action | `checkStatus()` handles QR display |

