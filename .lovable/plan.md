
# Fix: UI Not Updating After Successful Sync

## Root Cause Analysis

The sync successfully wrote **284 active members** to the database, but the UI still shows only **23 "In Group"** because the query isn't being properly refetched after the mutation completes.

### Evidence

| What we verified | Result |
|-----------------|--------|
| Database active members | 284 (correct) |
| Organization ID matches user | Yes (both `00000000-0000-0000-0000-000000000001`) |
| RLS policies | Correctly configured for organization access |
| Network logs | Only `lead_assignments` queries visible, no `workshop_group_members` |
| Toast message | Shows "Synced 284 members" |

### The Bug

The query invalidation in `onSuccess` uses the correct query key, but there are two issues:

1. **`staleTime: 60000` prevents immediate refetch**: While `invalidateQueries` should override this, React Query may be serving stale data if the query was recently executed.

2. **No explicit `refetchType`**: The invalidation doesn't force a network request - it only marks data as stale.

3. **Missing refetch after mutation**: The mutation's `onSuccess` should explicitly trigger a refetch, not just invalidate.

---

## Solution

### 1. Force Immediate Refetch After Sync

In the mutation's `onSuccess`, use `refetchQueries` instead of just `invalidateQueries` to ensure immediate data refresh:

```typescript
onSuccess: (data) => {
  // Force immediate refetch from database
  queryClient.refetchQueries({ 
    queryKey: ['workshop-participants', workshopId, sessionId, groupJid] 
  });
  toast.success(`Synced ${data.synced} members...`);
},
```

### 2. Reduce staleTime for Faster Updates

Change `staleTime` from 60 seconds to 10 seconds to ensure data refreshes more frequently:

```typescript
staleTime: 10000, // 10 seconds
```

### 3. Add Manual Refetch Function (Safety Net)

Export a `refetch` function from the hook so the UI can manually trigger a refresh if needed:

```typescript
return {
  ...query,
  syncMembers: syncMutation.mutate,
  isSyncing: syncMutation.isPending,
  refetch: query.refetch, // Add this
};
```

---

## Implementation Changes

### File: `src/hooks/useWorkshopParticipants.ts`

| Line | Change |
|------|--------|
| 137-141 | Replace `invalidateQueries` with `refetchQueries` in `onSuccess` |
| 293 | Change `staleTime` from `60000` to `10000` |
| 296-300 | Add `refetch` to return object |

### Code Changes

```text
// Line 137-141: onSuccess handler
onSuccess: (data) => {
  // Force immediate refetch from database (not just invalidate)
  queryClient.refetchQueries({ 
    queryKey: ['workshop-participants', workshopId, sessionId, groupJid] 
  });
  toast.success(`Synced ${data.synced} members${data.marked_left > 0 ? `, ${data.marked_left} marked as left` : ''}`);
},

// Line 293: staleTime
staleTime: 10000, // 10 seconds (was 60000)

// Line 296-300: return object
return {
  ...query,
  syncMembers: syncMutation.mutate,
  isSyncing: syncMutation.isPending,
  refetch: query.refetch,
};
```

---

## Expected Behavior After Fix

1. User clicks "Sync Members"
2. Edge function fetches 284 members from VPS and writes to database
3. Mutation's `onSuccess` calls `refetchQueries` (not just invalidateQueries)
4. React Query immediately re-executes the query (network request)
5. Fresh data (284 active members) returned from database
6. UI updates to show correct counts:
   - Total in Group: ~284
   - In Group: ~231 (registered leads who are in the group)
   - Missing: ~263 (494 registered - 231 in group)
   - Unregistered: ~53 (284 in group - 231 registered)

---

## Why This Fixes the Issue

| Problem | Solution |
|---------|----------|
| `invalidateQueries` only marks cache stale | `refetchQueries` forces immediate network request |
| 60-second staleTime too long | Reduced to 10 seconds for faster updates |
| No way to manually refresh | Added `refetch` function export |

---

## Files to Modify

| File | Lines Changed |
|------|--------------|
| `src/hooks/useWorkshopParticipants.ts` | ~6 lines total |
