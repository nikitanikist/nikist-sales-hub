
## Problem Diagnosis

The "VPS Endpoint Not Found (404)" error occurs because:

1. **Session insert is failing silently** - When you click "Connect Device", the backend tries to insert a session row, but it fails with:
   ```
   null value in column "phone_number" of relation "whatsapp_sessions" violates not-null constraint
   ```

2. **The VPS session ID mapping is lost** - Without a stored session row, the next calls (qr, status) can't look up the VPS session ID mapping

3. **Wrong session ID sent to VPS** - The fallback uses the raw UUID (`370f17da-2522-46e0-968c-2d3c37145e17`) instead of the VPS-formatted ID (`wa_370f17da-2522-46e0-968c-2d3c37145e17`)

4. **VPS returns 404** - The VPS doesn't recognize the session ID format, so it returns "Cannot GET /qr/..."

---

## Solution

### Step 1: Make `phone_number` nullable in the database
The phone number is only known AFTER the user scans the QR and connects. It should be nullable initially.

**Database migration:**
```sql
ALTER TABLE public.whatsapp_sessions 
ALTER COLUMN phone_number DROP NOT NULL;
```

### Step 2: Add a placeholder or explicit null for phone_number on insert (in edge function)
Update the edge function to explicitly handle the nullable field:
- On `connect`: Insert with `phone_number: null`
- On `status` (when connected): Update with the actual phone number from VPS

---

## Files to modify

1. **Database migration** - Make `phone_number` nullable
2. **`supabase/functions/vps-whatsapp-proxy/index.ts`** - Ensure explicit null for phone_number on insert

---

## Expected result after fix

1. Click "Connect Device"
2. Session row is successfully inserted with `phone_number: null` and `session_data: { vps_session_id: "wa_xxx" }`
3. QR code endpoint is called with correct VPS session ID: `/qr/wa_xxx`
4. VPS returns QR code
5. Dialog shows QR code for scanning
6. After scan, status updates with actual phone number
