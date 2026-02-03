
# Convert Workshop Participants to Webhook-Based Architecture

## Current State

The system currently uses a **hybrid approach** that is inefficient:

| Component | Current Behavior |
|-----------|-----------------|
| **30-second polling** | `useWorkshopParticipants` fetches live VPS data via `get-participants` every 30 seconds |
| **Webhooks** | VPS sends join/leave events to `workshop_group_members` table (working!) |
| **Realtime** | Already enabled on `workshop_group_members` table |
| **Stats calculation** | Uses live VPS data for "In Group", ignores database |

### Problem
- VPS API gets hit every 30 seconds per open workshop page
- Database already has accurate membership data from webhooks
- Redundant polling causes unnecessary server load

---

## New Architecture

```text
+------------------+       webhook        +----------------------+
|   WhatsApp VPS   | ------------------> | workshop_group_members|
+------------------+    (join/leave)      +----------------------+
                                                    |
                                         Supabase Realtime
                                                    |
                                                    v
+------------------+      no polling      +----------------------+
|   WorkshopDetail | <------------------ | useWorkshopParticipants|
+------------------+    (instant update)  +----------------------+
                             ^
                             |
                    Manual "Sync" button
                    (on-demand VPS fetch)
```

**Key changes:**
1. Remove 30-second polling interval
2. Calculate stats from database (active members) instead of live VPS
3. Keep realtime subscription for instant UI updates
4. Add "Sync Members" button to backfill/refresh from VPS on-demand

---

## Implementation Plan

### 1. Add "Sync Members" Action to VPS Proxy

**File:** `supabase/functions/vps-whatsapp-proxy/index.ts`

Add a new `sync-members` action that:
- Fetches current participants from VPS
- Upserts all members to `workshop_group_members` with status `active`
- Marks members NOT in VPS response as `left`
- Returns sync statistics

### 2. Refactor `useWorkshopParticipants` Hook

**File:** `src/hooks/useWorkshopParticipants.ts`

Changes:
- Remove `refetchInterval: 30000` (line 278)
- Add database-based active member query
- Calculate "In Group" by counting `workshop_group_members` where `status = 'active'`
- Keep realtime subscription (already present)
- Only call VPS API when user clicks "Sync"
- Add `syncMembers` mutation function

### 3. Update Workshop Detail Page

**File:** `src/pages/WorkshopDetail.tsx`

Changes:
- Rename "Refresh" button to "Sync Members"
- Wire button to new sync mutation (calls VPS and updates DB)
- Show sync status (last synced timestamp from DB)
- Add loading state during sync

---

## Technical Details

### New VPS Proxy Action: `sync-members`

```typescript
case 'sync-members': {
  // 1. Fetch current participants from VPS
  // 2. Upsert all as 'active' in workshop_group_members
  // 3. Mark missing members as 'left'
  // 4. Return { synced: number, marked_left: number }
}
```

### Updated Hook Data Flow

```text
Query on page load:
1. Fetch registered leads from lead_assignments
2. Fetch active members from workshop_group_members (database)
3. Fetch left members from workshop_group_members (database)
4. Compare: inGroup = leads WHERE phone IN active_members
5. Compare: missing = leads WHERE phone NOT IN active_members

No VPS call on page load!
```

### Sync Button Flow

```text
User clicks "Sync Members"
        |
        v
Call vps-whatsapp-proxy (action: sync-members)
        |
        v
Proxy fetches VPS participants
        |
        v  
Upsert to workshop_group_members
        |
        v
Realtime triggers query invalidation
        |
        v
UI updates automatically
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add `sync-members` action (~50 lines) |
| `src/hooks/useWorkshopParticipants.ts` | Remove polling, add DB query, add sync mutation (~80 lines changed) |
| `src/pages/WorkshopDetail.tsx` | Update refresh button to sync, show last synced from DB (~10 lines) |

---

## Benefits

| Metric | Before | After |
|--------|--------|-------|
| VPS API calls per page | Every 30 seconds | Only on manual sync |
| Data source | Live VPS | Database (webhook-populated) |
| Update latency | 0-30 seconds | Instant (realtime) |
| Server load | High | Minimal |

---

## Migration Note

On first use, users should click "Sync Members" once to backfill existing group members from VPS into the database. After that, webhooks will keep the data current automatically.
