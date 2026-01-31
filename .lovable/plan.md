

# Fix: Map Participant Count Correctly from VPS Response

## Problem Identified
VPS returns `participants: 112` for groups, but the portal shows "0 members". 

The sync function has this mapping:
```typescript
participant_count: g.participants?.length || g.size || 0,
```

**Issue:** If VPS returns `participants` as a **number** (e.g., `112`), not as an array:
- `g.participants?.length` returns `undefined` (numbers don't have `.length`)
- Falls back to `g.size || 0`, which defaults to `0`

## Solution
Update the mapping to handle both cases:
1. If `participants` is an **array** → use `.length`
2. If `participants` is a **number** → use it directly
3. Also check `size` and `participantsCount` fields as fallbacks

## Changes Required

### File: `supabase/functions/vps-whatsapp-proxy/index.ts`

**Location:** Line 569 (inside the `groupsToUpsert` mapping)

**Current code:**
```typescript
participant_count: g.participants?.length || g.size || 0,
```

**Fixed code:**
```typescript
participant_count: 
  Array.isArray(g.participants) 
    ? g.participants.length 
    : (g.participants || g.participantsCount || g.size || 0),
```

**Logic:**
1. If `g.participants` is an array → use its `.length`
2. If it's a number → use it directly 
3. Check other common field names: `participantsCount`, `size`
4. Default to `0`

---

## Implementation

| Step | Action |
|------|--------|
| 1 | Update participant_count mapping in sync-groups handler |
| 2 | Deploy edge function |
| 3 | Re-sync groups - member counts should populate |

## Expected Result
- After re-sync, groups will show correct participant counts (e.g., "112 members")
- UI will display the member count from VPS accurately

