
# Fix: Sync Members Missing Organization ID

## Root Cause Analysis

I found the exact reason why your data went from 250+ members to only 28:

### What Happened

| Step | What Occurred |
|------|--------------|
| 1 | You clicked "Sync Members" button |
| 2 | VPS returned **284 participants** correctly (logged: `VPS returned 284 participants`) |
| 3 | Database **rejected all 284 records** with error: `new row violates row-level security policy for table "workshop_group_members"` |
| 4 | Only **28 members** remain in database (these came from webhooks, which work correctly) |

### The Bug

The `sync-members` code creates records without the required `organization_id` field:

```text
Current upsert data:
{
  group_jid: "120363423158005005@g.us",
  phone_number: "9873686969",
  full_phone: "919873686969",
  status: "active",
  joined_at: "2026-02-03T18:00:00Z",
  left_at: null,
  updated_at: "2026-02-03T20:11:47Z"
  // ❌ organization_id is MISSING!
}
```

The database requires `organization_id` (NOT NULL), and RLS policies check the user belongs to that organization. Without it, all inserts fail.

### Why Webhooks Work

The webhook correctly looks up the organization ID from the WhatsApp session and includes it in the database write. The sync action does not.

---

## The Fix

### 1. Update Hook to Accept Organization ID

Add `organizationId` parameter to `useWorkshopParticipants` and pass it to the sync mutation.

**File:** `src/hooks/useWorkshopParticipants.ts`

```typescript
// Before (line 71):
export function useWorkshopParticipants(
  workshopId: string,
  sessionId: string | null,
  groupJid: string | null,
  enabled: boolean = true
)

// After:
export function useWorkshopParticipants(
  workshopId: string,
  sessionId: string | null,
  groupJid: string | null,
  organizationId: string | null,  // NEW
  enabled: boolean = true
)
```

Pass `organizationId` in the sync mutation body.

### 2. Update WorkshopDetail to Pass Organization ID

**File:** `src/pages/WorkshopDetail.tsx`

```typescript
// Before:
useWorkshopParticipants(
  workshopId || '',
  sessionId,
  groupJid,
  !!groupJid
);

// After:
useWorkshopParticipants(
  workshopId || '',
  sessionId,
  groupJid,
  currentOrganization?.id || null,  // NEW
  !!groupJid
);
```

### 3. Update Edge Function to Use Organization ID

**File:** `supabase/functions/vps-whatsapp-proxy/index.ts`

Add `organizationId` to the request interface and include it in the upsert:

```typescript
// In membersToUpsert (line 498-512):
{
  group_jid: groupJid,
  phone_number: normalizedPhone,
  full_phone: fullPhone,
  status: 'active',
  joined_at: existing?.joined_at || now,
  left_at: null,
  updated_at: now,
  organization_id: organizationId,  // NEW - fixes the RLS violation
}
```

---

## After the Fix

When you click "Sync Members":

```text
1. VPS returns 284 participants ✓
2. Edge function includes organization_id in each record ✓
3. RLS policy passes (user belongs to organization) ✓
4. All 284 members upserted successfully ✓
5. Realtime triggers UI update ✓
6. Dashboard shows correct counts ✓
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useWorkshopParticipants.ts` | Add `organizationId` parameter and pass to mutation |
| `src/pages/WorkshopDetail.tsx` | Pass `currentOrganization?.id` to hook |
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add `organizationId` to request interface and include in upsert |

---

## Recovery Steps

After deploying the fix:

1. Click "Sync Members" button again
2. This time all 284 participants will be saved correctly
3. Dashboard will show accurate counts (250+ in group)

The data is not lost - it's still in the VPS. We just need to successfully sync it to the database.
