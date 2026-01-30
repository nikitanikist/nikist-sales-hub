

# Fix "Send Message Now" - Wrong Session ID Being Sent

## Problem

The error "Missing required fields: sessionId, phone, message" occurs because:

1. The frontend sends the **VPS session ID** (`wa_43df529e-...`) to the edge function
2. The edge function expects the **local database UUID** (`43df529e-...`) and does its own VPS ID lookup
3. When it tries to look up `wa_43df529e-...` in the database, it fails (invalid UUID format)
4. The fallback uses the malformed ID, causing the VPS API to reject it

---

## Root Cause

```typescript
// Current code in useWorkshopNotification.ts (line 392)
sessionId: vpsSessionId,  // ← WRONG: Sending "wa_43df529e-..."
```

But the edge function expects:
```typescript
// In vps-whatsapp-proxy/index.ts (line 243)
localSessionIdForDb = sessionId;  // Expects local UUID like "43df529e-..."
vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);  // Then looks up VPS ID
```

---

## Solution

Send the **local database session ID** (the `sessionId` parameter from the original function call), not the VPS session ID that we looked up.

---

## File to Modify

| File | Change |
|------|--------|
| `src/hooks/useWorkshopNotification.ts` | Send `sessionId` (local UUID) instead of `vpsSessionId` |

---

## Technical Change

**Current code:**
```typescript
const sessionData = session.session_data as { vps_session_id?: string };
const vpsSessionId = sessionData.vps_session_id;

if (!vpsSessionId) {
  throw new Error('WhatsApp session is not properly configured');
}

const { data, error } = await supabase.functions.invoke('vps-whatsapp-proxy', {
  body: {
    action: 'send',
    sessionId: vpsSessionId,  // ← WRONG
    groupId: group.group_jid,
    message: content,
  },
});
```

**Fixed code:**
```typescript
// Remove the VPS session ID lookup - the edge function does this internally
// Just verify the session exists
const sessionData = session.session_data as { vps_session_id?: string };
if (!sessionData?.vps_session_id) {
  throw new Error('WhatsApp session is not properly configured');
}

const { data, error } = await supabase.functions.invoke('vps-whatsapp-proxy', {
  body: {
    action: 'send',
    sessionId: sessionId,  // ← CORRECT: Send local DB UUID
    groupId: group.group_jid,
    message: content,
  },
});
```

---

## Data Flow After Fix

```
Frontend                    Edge Function                    VPS
   │                              │                            │
   │  sessionId: "43df529e-..."   │                            │
   │ ──────────────────────────>  │                            │
   │                              │                            │
   │                        Look up in DB:                     │
   │                        session_data.vps_session_id        │
   │                        = "wa_43df529e-..."                │
   │                              │                            │
   │                              │  sessionId: "wa_43df529e-..."
   │                              │ ──────────────────────────> │
   │                              │                            │
   │                              │  { success: true }         │
   │  <──────────────────────────────────────────────────────  │
```

---

## Testing

1. Go to Operations → Workshop Notification
2. Click View on "Test workshop"
3. Click "Send Message Now"
4. Select a template
5. Click "Send Now"
6. Verify message appears in WhatsApp group

