

# Workshop Detail Page with WhatsApp Group Membership Tracking

## Overview

This feature creates a dedicated Workshop Detail page that compares registered leads against actual WhatsApp group participants, enabling you to identify and reach out to people who registered but haven't joined the group yet.

---

## What You'll Get

| Metric | Description |
|--------|-------------|
| **Total Registered** | People who registered for this workshop (from database) |
| **In WhatsApp Group** | People who actually joined the linked group (from VPS - real-time) |
| **Missing** | People to send "Please join the group" reminders |
| **Join Rate** | Percentage of registered users who joined |

**Key Actions:**
- Download CSV of missing members
- Real-time auto-refresh every 30 seconds
- Manual refresh button for instant updates

---

## User Flow

```text
Workshops Page
    │
    └── Click workshop row → Instead of expanding, navigates to...
    │
    ▼
Workshop Detail Page (/workshops/:workshopId)
    ├── Back button → Return to workshops list
    ├── Workshop Header (Name, Date, Status, Edit button)
    ├── Stats Cards (4 cards in a row)
    │   ├── Total Registered: 500
    │   ├── In WhatsApp Group: 300 ← Real-time
    │   ├── Missing: 200
    │   └── Join Rate: 60%
    ├── Progress Bar showing join rate visually
    ├── Tabs
    │   ├── "Missing Members" tab
    │   │   ├── Table: Name | Phone | Email | Registered Date
    │   │   └── Download CSV button
    │   ├── "Call Statistics" tab (existing expanded row content)
    │   └── "WhatsApp" tab (existing WhatsApp settings)
    └── Last synced: X seconds ago (auto-updates)
```

---

## How Phone Matching Works

The VPS returns participants in this format:
```json
{
  "participants": [
    { "phone": "918130797444", "isAdmin": false },
    { "phone": "919431117351", "isAdmin": false }
  ]
}
```

**Matching Logic:**
1. Normalize database phone: `"+91 98188 61043"` → `9818861043` (last 10 digits)
2. Normalize VPS phone: `918130797444` → `8130797444` (last 10 digits)
3. If match → person is in group
4. If no match → person is "missing"

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/WorkshopDetail.tsx` | Main workshop detail page with stats, tabs, and member table |
| `src/hooks/useWorkshopParticipants.ts` | Hook for fetching group participants from VPS with polling |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add new route `/workshops/:workshopId` |
| `src/pages/Workshops.tsx` | Change row click to navigate instead of expand; add "View" button |
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add `get-participants` action |

---

## Implementation Details

### 1. VPS Proxy Enhancement

Add new action `get-participants`:

```typescript
case 'get-participants': {
  if (!sessionId || !groupJid) {
    return errorResponse('Session ID and Group JID required');
  }
  
  vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
  if (!vpsSessionIdForVps) {
    vpsSessionIdForVps = sessionId;
  }
  
  vpsEndpoint = `/groups/${vpsSessionIdForVps}/${encodeURIComponent(groupJid)}/participants`;
  vpsMethod = 'GET';
  break;
}
```

### 2. New Hook: useWorkshopParticipants

```typescript
// Fetches participants from VPS and compares with registered leads
export function useWorkshopParticipants(workshopId: string) {
  // 1. Fetch workshop with linked WhatsApp group
  // 2. Fetch registered leads for this workshop
  // 3. Call VPS to get current group participants
  // 4. Compare phone numbers (last 10 digits)
  // 5. Return { registered, inGroup, missing, joinRate }
  // 6. Auto-refresh every 30 seconds using refetchInterval
}
```

### 3. Workshop Detail Page Structure

The page will have:
- Header with workshop title, date, status badge, and back button
- 4 stat cards in a responsive grid
- Progress bar showing join rate
- Tabs for "Missing Members", "Call Statistics", "WhatsApp"
- Missing members table with search, sort, and CSV download

### 4. Real-time Polling

```typescript
const { data, isLoading, refetch } = useQuery({
  queryKey: ['workshop-participants', workshopId],
  queryFn: fetchParticipants,
  refetchInterval: 30000, // 30 seconds
  enabled: !!workshopId && !!groupJid,
});
```

### 5. CSV Download

```typescript
function downloadMissingMembersCSV(members) {
  const headers = ['Name', 'Phone', 'Email', 'Registered Date'];
  const rows = members.map(m => [
    m.contact_name,
    m.phone,
    m.email,
    formatDate(m.created_at)
  ]);
  
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  // Trigger download
}
```

---

## Important Edge Cases

| Scenario | Handling |
|----------|----------|
| Workshop has no linked WhatsApp group | Show message: "No WhatsApp group linked to this workshop" with link to settings |
| WhatsApp session disconnected | Show error with reconnect button |
| Lead has no phone number | Skip during comparison (can't match) |
| VPS returns error | Show error toast, allow manual retry |

---

## UI Preview

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Workshops                                    [Edit] [⋮]  │
│                                                                      │
│  Crypto Wealth Masterclass (Sh1) <> 4TH February                    │
│  📅 Feb 4, 2026 • 7:00 PM IST    [Confirmed]                        │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │    500     │  │    300     │  │    200     │  │    60%     │    │
│  │ Registered │  │  In Group  │  │  Missing   │  │ Join Rate  │    │
│  │            │  │  ↻ Live    │  │            │  │            │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
│                                                                      │
│  ████████████████████░░░░░░░░░░  60% joined group                   │
│  Last synced: 5 seconds ago                    [🔄 Refresh Now]     │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  [Missing Members]  [Call Statistics]  [WhatsApp]                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Missing Members (200)                                    [📥 CSV]  │
│  ────────────────────────────────────────────────────────────────── │
│  🔍 Search by name or phone...                                      │
│  ────────────────────────────────────────────────────────────────── │
│  Name              Phone            Email              Registered   │
│  ────────────────────────────────────────────────────────────────── │
│  John Doe          +91 98765...     john@example.com   Feb 3, 2026  │
│  Jane Smith        +91 87654...     jane@example.com   Feb 2, 2026  │
│  ...                                                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Notes

### Database Relationships
- `workshops.whatsapp_group_id` → `whatsapp_groups.id` (linked group)
- `workshops.whatsapp_session_id` → `whatsapp_sessions.id` (session for API calls)
- `lead_assignments.workshop_id` → `workshops.id` (registered leads)
- `lead_assignments.lead_id` → `leads.id` (lead details with phone)

### VPS Response Format (Confirmed)
```json
{
  "success": true,
  "groupName": "Crypto Insider Club",
  "groupJid": "120363386014269039@g.us",
  "totalParticipants": 1048,
  "participants": [
    { "id": "...", "phone": "918130797444", "isAdmin": false, "isSuperAdmin": false }
  ]
}
```

### Phone Normalization Function
```typescript
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}
```

---

## Summary

| Component | Description |
|-----------|-------------|
| **New Route** | `/workshops/:workshopId` → Workshop Detail page |
| **VPS Action** | `get-participants` to fetch group members |
| **Real-time** | 30-second polling for live updates |
| **Download** | CSV export of missing members |
| **Navigation** | Click workshop row → Navigate to detail page |

