

# Fix VPS Send Message - Wrong Field Name for Recipient

## Problem

The VPS `/send` endpoint rejects the request with:
```json
{"error":"Missing required fields: sessionId, phone, message"}
```

The Edge Function is sending `groupId` but the VPS API expects `phone` for the recipient field.

---

## Root Cause

```text
Edge Function sends:             VPS expects:
{                                {
  "sessionId": "wa_...",           "sessionId": "wa_...",
  "groupId": "120363...@g.us",     "phone": "120363...@g.us",  ← Different field name!
  "message": "Hello"               "message": "Hello"
}                                }
```

The VPS uses `phone` for BOTH individual chats and group chats. The group JID (e.g., `120363417177523752@g.us`) should be passed as the `phone` field.

---

## Solution

Update the Edge Function to send `phone` instead of `groupId` when calling the VPS `/send` endpoint.

---

## File to Modify

| File | Change |
|------|--------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Change `groupId` to `phone` in the send action (line ~254-258) |

---

## Technical Change

**Current code (lines 253-259):**
```typescript
vpsBody = {
  sessionId: vpsSessionIdForVps,
  groupId,           // ← Wrong field name
  message,
  ...(mediaUrl && { mediaUrl }),
  ...(mediaType && { mediaType }),
};
```

**Fixed code:**
```typescript
vpsBody = {
  sessionId: vpsSessionIdForVps,
  phone: groupId,    // ← VPS expects "phone" field for recipient (works for groups too)
  message,
  ...(mediaUrl && { mediaUrl }),
  ...(mediaType && { mediaType }),
};
```

---

## Data Flow After Fix

```text
Frontend                         Edge Function                       VPS
   │                                    │                              │
   │  groupId: "120363...@g.us"         │                              │
   │ ─────────────────────────────────> │                              │
   │                                    │                              │
   │                              Maps groupId to phone:               │
   │                              { phone: "120363...@g.us" }          │
   │                                    │                              │
   │                                    │  POST /send                  │
   │                                    │  { sessionId, phone, message }
   │                                    │ ────────────────────────────> │
   │                                    │                              │
   │                                    │  { success: true }           │
   │  <─────────────────────────────────────────────────────────────── │
```

---

## Expected Result

After this fix:
- The VPS receives the correctly named `phone` field
- Messages are sent successfully to WhatsApp groups
- Success toast "Message sent successfully" appears

---

## Testing Steps

1. Go to Operations → Workshop Notification
2. Click View on "Test workshop"
3. Click "Send Message Now"
4. Select a template
5. Click "Send Now"
6. Verify the message appears in the WhatsApp group

