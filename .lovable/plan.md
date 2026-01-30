

## Problem Identified (Two Issues)

### Issue 1: Wrong Field Name
Your senior developer's note is **exactly right**. The VPS returns:
```json
{ "status": "qr", "qr": "data:image/png;base64,..." }
```

But our code looks for `qrCode`:
- **Backend** (line 368): `if (responseData?.qrCode)` - should be `qr`
- **Frontend** (line 368): `qrCode: data.qrCode` - should be `data.qr`

The network logs confirm the VPS **is** returning the QR code successfully, but it's being ignored!

### Issue 2: Database Constraint Violation
The VPS returns `status: "qr"` but the database only allows:
- `connected`
- `disconnected`
- `qr_pending`
- `connecting`

The backend tries to save `status: "qr"` which fails with constraint error.

---

## Solution

### Step 1: Fix the Field Name Mapping

**Backend (`vps-whatsapp-proxy/index.ts`):**
- Line 368: Change `responseData?.qrCode` to `responseData?.qr`

**Frontend (`useWhatsAppSession.ts`):**
- Line 368: Change `data.qrCode` to `data.qr`

### Step 2: Map VPS Status to Database Status

The edge function should map the VPS status values to valid database values:
- VPS `"qr"` → Database `"qr_pending"`
- VPS `"connected"` → Database `"connected"`
- VPS `"disconnected"` → Database `"disconnected"`

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Read `responseData.qr` instead of `responseData.qrCode`, map `"qr"` status to `"qr_pending"` |
| `src/hooks/useWhatsAppSession.ts` | Read `data.qr` instead of `data.qrCode` |

---

## Technical Details

### Backend Changes (Lines ~358-382)
```typescript
// Map VPS status to database-compatible status
const statusMap: Record<string, string> = {
  'qr': 'qr_pending',
  'connected': 'connected',
  'disconnected': 'disconnected',
  'connecting': 'connecting',
};

const updatePayload: Record<string, unknown> = {
  status: statusMap[responseData?.status] || 'connecting',
  phone_number: responseData?.phoneNumber || null,
  ...
};

// Fix: VPS returns "qr", not "qrCode"
if (responseData?.qr) {
  updatePayload.qr_code = responseData.qr;
  updatePayload.qr_expires_at = new Date(Date.now() + 60000).toISOString();
}
```

### Frontend Changes (Line ~368)
```typescript
// Fix: VPS returns "qr", not "qrCode"
setConnectionState(prev => ({
  ...prev,
  qrCode: data.qr || prev.qrCode,  // Changed from data.qrCode
  status: 'connecting',
}));
```

---

## Expected Flow After Fix

1. User clicks "Connect Device"
2. Backend calls `POST /connect` with `{ sessionId: "wa_xxx" }`
3. Frontend polls `status` action
4. VPS returns `{ status: "qr", qr: "data:image/..." }`
5. **Backend** extracts `qr` field and saves to database
6. **Frontend** extracts `qr` field and displays QR code
7. User scans QR
8. VPS returns `{ status: "connected", phoneNumber: "+91..." }`
9. UI shows "Connected"

