

# Enable Multiple WhatsApp Account Connections

## Summary

The system architecture already supports multiple WhatsApp sessions with role designation:
- **Community Creation**: Uses `organizations.community_session_id` (the dropdown you mentioned)
- **Message Sending**: Uses the session that owns each group (`whatsapp_groups.session_id`)

The only fix needed is the UI, which incorrectly hides the "Connect Device" button after the first connection.

---

## Current UI Problem

In `WhatsAppConnection.tsx` lines 247-286:

```text
if (hasConnectedSession) {
  → Show Sync/Disconnect for first session only
} else {
  → Show Connect Device button
}
```

This prevents adding a second WhatsApp account.

---

## Proposed UI Layout

```text
┌─ WhatsApp Connections ──────────────────────────────────┐
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ● 919289630962                                      │ │
│ │   Last active: Feb 1, 2026                          │ │
│ │                     [Sync Groups] [Disconnect]      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ● 918765432100                                      │ │
│ │   Last active: Feb 1, 2026                          │ │
│ │                     [Sync Groups] [Disconnect]      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [ + Connect Another WhatsApp ]  ← Always visible        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Changes

### File: `src/pages/settings/WhatsAppConnection.tsx`

| Change | Description |
|--------|-------------|
| Always show connect button | Remove conditional that hides button when a session exists |
| List all connected sessions | Replace single-session display with `.map()` over all `connectedSessions` |
| Per-session actions | Each session card gets its own Sync Groups + Disconnect buttons |
| Rename button | "Connect Another WhatsApp" to clarify multi-account support |
| Session History section | Only show disconnected sessions (not active ones duplicated) |

### Code Changes

**Lines 232-286** - Replace the single-session status display with:

1. **Connected Sessions List**: Loop through all `connectedSessions` with individual cards
2. **Add WhatsApp Button**: Always visible below the list
3. **Filter Session History**: Only show sessions that are NOT connected

---

## WhatsApp Groups Enhancement (Optional)

Currently groups are displayed without indicating which account owns them. Consider adding the session phone number to each group row for clarity when multiple accounts are connected.

---

## No Database Changes Required

The `whatsapp_sessions` table already supports multiple sessions per organization. The "Community Creation Settings" dropdown already lists all connected sessions, confirming the architecture is in place.

---

## Files to Modify

| File | Purpose |
|------|---------|
| `src/pages/settings/WhatsAppConnection.tsx` | Restructure UI to display all connected sessions with individual controls |

