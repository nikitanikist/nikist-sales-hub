
# WhatsApp Membership Webhook Implementation

## Overview

Now that your VPS is sending real-time join/leave webhooks, I'll build the CRM-side infrastructure to receive these events and update the UI instantly when someone joins or leaves a WhatsApp group.

---

## What Will Change

| Component | Change |
|-----------|--------|
| **New Database Table** | `workshop_group_members` - Stores membership state with join/leave timestamps |
| **New Edge Function** | `whatsapp-membership-webhook` - Receives VPS webhooks and updates database |
| **Updated UI** | New "Left Group" stat card and tab showing who left after joining |
| **Realtime Updates** | Instant UI refresh when someone joins/leaves (no polling needed) |

---

## User Flow After Implementation

```text
Someone JOINS group
    ↓
VPS sends webhook → CRM edge function → Database insert (status: 'active')
    ↓
Supabase Realtime broadcasts → UI updates instantly
    ↓
"In WhatsApp Group" count increases

Someone LEAVES group
    ↓
VPS sends webhook → CRM edge function → Database update (status: 'left')
    ↓
Supabase Realtime broadcasts → UI updates instantly
    ↓
"In WhatsApp Group" decreases, "Left Group" count increases
```

---

## Updated Stats Cards

```text
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│    500     │  │    300     │  │    150     │  │     50     │  │    60%     │
│ Registered │  │  In Group  │  │  Missing   │  │    Left    │  │ Join Rate  │
│            │  │   (Live)   │  │            │  │   (New!)   │  │            │
└────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/whatsapp-membership-webhook/index.ts` | Receive VPS join/leave webhooks |

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/WorkshopDetail.tsx` | Add "Left Group" stat card and tab |
| `src/hooks/useWorkshopParticipants.ts` | Use database for membership state + realtime subscription |

---

## Database Changes

### New Table: `workshop_group_members`

Stores the membership history for each group:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Organization this belongs to |
| `group_id` | UUID | FK to `whatsapp_groups.id` |
| `group_jid` | TEXT | WhatsApp group JID (for direct lookup) |
| `phone_number` | TEXT | Normalized 10-digit phone |
| `full_phone` | TEXT | Full phone from VPS (e.g., 919818861043) |
| `status` | TEXT | 'active' or 'left' |
| `joined_at` | TIMESTAMPTZ | When they first joined |
| `left_at` | TIMESTAMPTZ | When they left (null if still active) |
| `is_admin` | BOOLEAN | Whether they're a group admin |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |

**Unique constraint:** One record per group + phone combination.

**RLS Policy:** Organization members can read members for their org's groups.

**Realtime:** Enabled for instant UI updates.

---

## Edge Function: `whatsapp-membership-webhook`

This function receives webhooks from the VPS:

**Input (from VPS):**
```json
{
  "event": "join",
  "sessionId": "wa_fd5cd67a-3dc7-44ce-b611-2c3b5cbbf333",
  "groupJid": "120363423158005005@g.us",
  "participant": {
    "phone": "919818861043",
    "id": "173087265951971@lid"
  },
  "timestamp": "2026-02-03T17:30:00Z"
}
```

**Logic:**
1. Validate the webhook (API key check)
2. Look up session to get organization_id
3. Look up or create group record in `whatsapp_groups`
4. On **join**: Upsert member with `status: 'active'`, `left_at: null`
5. On **leave**: Update member with `status: 'left'`, `left_at: timestamp`
6. Return success

---

## Hook Updates: `useWorkshopParticipants`

The hook will be updated to:

1. **Initial load**: Query `workshop_group_members` for current state
2. **Sync on first load**: If table is empty for this group, fetch from VPS and populate
3. **Realtime subscription**: Subscribe to changes on `workshop_group_members`
4. **Calculate stats**: 
   - `inGroup` = members with `status: 'active'`
   - `leftGroup` = members with `status: 'left'`
   - Compare against registered leads for `missing`

---

## UI Updates: `WorkshopDetail.tsx`

### New Stat Card: "Left Group"

Shows count of people who joined but then left.

### New Tab: "Left Group"

Shows table of members who left with:
- Name (matched from leads if registered)
- Phone
- Joined Date
- Left Date
- CSV Download

### Updated Tab Structure

```text
[Missing (150)] [Left Group (50)] [In Group (300)] [Call Statistics] [WhatsApp]
```

---

## Security Considerations

### Webhook Authentication

The VPS should include an API key header that matches the `WHATSAPP_VPS_API_KEY` secret:

```typescript
// In webhook edge function
const apiKey = req.headers.get('X-API-Key');
const expectedKey = Deno.env.get('WHATSAPP_VPS_API_KEY');

if (apiKey !== expectedKey) {
  return new Response('Unauthorized', { status: 401 });
}
```

### RLS Policies

Members can only see group membership for their own organization's groups.

---

## Implementation Order

1. **Database migration**: Create `workshop_group_members` table with RLS and realtime
2. **Edge function**: Create `whatsapp-membership-webhook` to receive VPS events
3. **Update hook**: Modify `useWorkshopParticipants` to use database + realtime
4. **Update UI**: Add "Left Group" card and tab to `WorkshopDetail.tsx`
5. **Deploy and test**: Verify webhook receives events and UI updates in real-time

---

## Testing Plan

Once implemented:
1. Open the workshop detail page
2. Have someone join the WhatsApp group
3. Watch the "In WhatsApp Group" count increase instantly
4. Have someone leave the group
5. Watch "In WhatsApp Group" decrease and "Left Group" increase
6. Check the "Left Group" tab shows who left and when

---

## VPS Developer Note

Your VPS should include authentication when calling the webhook:

```typescript
// When sending webhook to CRM
const response = await fetch(
  'https://swnpxkovxhinxzprxviz.supabase.co/functions/v1/whatsapp-membership-webhook',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.CRM_API_KEY // Should match WHATSAPP_VPS_API_KEY
    },
    body: JSON.stringify({
      event: 'join', // or 'leave'
      sessionId: 'wa_xxx',
      groupJid: '120363xxx@g.us',
      participant: { phone: '919818861043', id: '...' },
      timestamp: new Date().toISOString()
    })
  }
);
```
