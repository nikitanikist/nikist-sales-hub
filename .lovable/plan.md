

# Fix WhatsApp "Send Message Now" - Session Configuration Error

## Problem

When clicking "Send Now", the error "WhatsApp session is not properly configured" appears because of a property name mismatch in the code.

---

## Root Cause

The session data is stored in the database as:
```json
{"vps_session_id": "wa_43df529e-63b0-4255-9372-6a10b1b3733c"}
```

But the code in `useWorkshopNotification.ts` is looking for a different property name:
```typescript
// Current code (WRONG)
const sessionData = session.session_data as { sessionId?: string };
const vpsSessionId = sessionData.sessionId;  // ← Looking for "sessionId"
```

Since the database uses `vps_session_id` but the code looks for `sessionId`, the value is always `undefined` and the error is thrown.

---

## Solution

Update the type definition to match the actual database structure:

| File | Change |
|------|--------|
| `src/hooks/useWorkshopNotification.ts` | Fix property name from `sessionId` to `vps_session_id` |

---

## Technical Change

**Current code (lines 381-382):**
```typescript
const sessionData = session.session_data as { sessionId?: string };
const vpsSessionId = sessionData.sessionId;
```

**Fixed code:**
```typescript
const sessionData = session.session_data as { vps_session_id?: string };
const vpsSessionId = sessionData.vps_session_id;
```

---

## Expected Result

After this fix:
- Clicking "Send Now" will correctly retrieve the VPS session ID
- The message will be sent to the WhatsApp group successfully
- The success toast "Message sent successfully" will appear

---

## Testing Steps

1. Go to Operations → Workshop Notification
2. Click View on "Test workshop"
3. Select a template in "Send Message Now" dialog
4. Click "Send Now"
5. Verify the message appears in the WhatsApp group

---

## Estimated Time

2 minutes to implement

