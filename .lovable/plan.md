

# Improve Dynamic Links Dialog - WhatsApp Session Selection

## Problem Summary

The current Create Link dialog shows all WhatsApp groups from all connected accounts at once. You can't:
- Choose which WhatsApp number's groups to see
- Sync groups on demand from the dialog
- Know which account a group belongs to

---

## Proposed User Flow

```text
┌─ Create Dynamic Link ───────────────────────────────────────┐
│                                                              │
│ Link Slug                                                    │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ whatsapp-group                                           ││
│ └──────────────────────────────────────────────────────────┘│
│ nikist-sales-hub.lovable.app/link/whatsapp-group            │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Destination Type                                             │
│   [Custom URL]  [WhatsApp Group ✓]                          │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Step 1: Select WhatsApp Account                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 🟢 919289630962                                      ▼   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Step 2: Select Group from this Account          [Sync Now]   │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 🔍 Search groups...                                      ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ ✓ Has invite link (can be used for redirection)          ││
│ │   🟢 Crypto Masterclass <> 1st February          230     ││
│ │   🟢 test amit                                   1       ││
│ │   🟢 Malasi amit workshop                        1       ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ ⚠ No invite link (sync to fetch)                         ││
│ │   ⚪ Python Career Blueprint - 29th June          45     ││
│ │   ⚪ Ethical Hacking - 14th August               120     ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│                                  [Cancel] [Create Link]      │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Changes

### File: `src/components/operations/CreateLinkDialog.tsx`

#### Current Issues
1. Uses `useWhatsAppGroups()` which fetches all groups without session context
2. No session selector dropdown
3. No sync button for selected session

#### Changes Required

| Change | Description |
|--------|-------------|
| Add session selector | Dropdown with connected WhatsApp accounts (phone numbers) |
| Pass session context to groups | Filter groups by selected `session_id` |
| Add Sync button | Next to session dropdown to refresh groups for that account |
| Improve group list UI | Clear separation between groups with/without invite links |
| Show "No account" state | If no WhatsApp accounts are connected, show helpful message |

#### New Component Structure

```text
CreateLinkDialog
├── Slug Input (unchanged)
├── Destination Type Toggle (unchanged)
├── [If WhatsApp selected]
│   ├── Session Selector Dropdown
│   │   └── List of connected sessions with phone numbers
│   ├── Sync Button (triggers syncGroups for selected session)
│   └── Groups List (filtered by selected session)
│       ├── Groups with invite links (selectable)
│       └── Groups without invite links (disabled + tooltip)
└── Footer Actions (unchanged)
```

---

## Data Flow

### Current
```text
useWhatsAppGroups() → Returns ALL groups from ALL connected sessions
```

### Proposed
```text
useWhatsAppSession() → Get list of connected sessions
                           ↓
User selects session → Filter groups by session_id
                           ↓
useWhatsAppGroups().syncGroups(sessionId) → Sync specific session
```

The `useWhatsAppGroups` hook already supports filtering by session - we just need to use it properly.

---

## UI Improvements

| Current | Improved |
|---------|----------|
| Shows all groups mixed together | Grouped by WhatsApp account |
| No way to sync from dialog | "Sync Now" button per account |
| Unclear which groups can be used | Clear separation: with/without invite links |
| Groups without invite link can be clicked (confusing) | Disabled with explanation tooltip |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/operations/CreateLinkDialog.tsx` | Add session selector, sync button, improve group list |

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No WhatsApp accounts connected | Show message: "Connect a WhatsApp account first in Settings" |
| Session has no groups | Show "No groups found. Click Sync to fetch." |
| Groups without invite links | Show as disabled with tooltip explaining why |
| Only one session connected | Auto-select it, but still show dropdown for clarity |

