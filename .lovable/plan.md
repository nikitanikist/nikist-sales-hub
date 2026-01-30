

# Fix: Workshop Notification Registration Count Discrepancy

## Problem Summary

You're seeing **18 registrations** on the Workshop Notification page but **250 registrations** on the All Workshops page for the same "Crypto Wealth Masterclass SH" (Jan 31) workshop.

## Root Cause

The two pages use different methods to count registrations:

| Page | Method | Result |
|------|--------|--------|
| All Workshops | Database function (`get_workshop_metrics`) | ✅ Correct (250) |
| Workshop Notification | Client-side counting after fetching rows | ❌ Incomplete (18) |

The Workshop Notification page fetches `lead_assignments` rows and counts them in JavaScript:

```typescript
const { data: countData } = await supabase
  .from('lead_assignments')
  .select('workshop_id')
  .in('workshop_id', workshopIds);
```

**The issue**: Your database has **12,416 total lead_assignments**, but Supabase has a **default limit of 1000 rows**. Only the first 1000 rows are returned, and when counting per workshop, most workshops get incomplete counts.

## Solution

Reuse the existing `get_workshop_metrics` database function (or call a simpler count-only RPC) instead of client-side counting.

### Implementation Steps

**1. Update `useWorkshopNotification.ts`**

Replace the client-side counting with a database aggregation approach:

```typescript
// Current (broken) approach - lines 86-98:
const { data: countData } = await supabase
  .from('lead_assignments')
  .select('workshop_id')
  .in('workshop_id', workshopIds);

// Fix: Use get_workshop_metrics RPC instead
const { data: metricsData } = await supabase.rpc('get_workshop_metrics');

// Create lookup map
const countMap = (metricsData || []).reduce((acc, m) => {
  acc[m.workshop_id] = Number(m.registration_count) || 0;
  return acc;
}, {});
```

**2. Files to Modify**

| File | Change |
|------|--------|
| `src/hooks/useWorkshopNotification.ts` | Replace client-side `lead_assignments` query with `get_workshop_metrics` RPC call |

### Technical Details

The fix replaces lines 83-103 in `useWorkshopNotification.ts`:

**Before (client-side counting - hits 1000 row limit):**
```typescript
// Fetch registration counts
const workshopIds = workshopsData.map(w => w.id);

const { data: countData, error: countError } = await supabase
  .from('lead_assignments')
  .select('workshop_id')
  .in('workshop_id', workshopIds);

if (countError) throw countError;

// Count per workshop
const countMap: Record<string, number> = {};
(countData || []).forEach(la => {
  if (la.workshop_id) {
    countMap[la.workshop_id] = (countMap[la.workshop_id] || 0) + 1;
  }
});
```

**After (database aggregation - no row limit issues):**
```typescript
// Fetch registration counts using database aggregation
const { data: metricsData, error: metricsError } = await supabase
  .rpc('get_workshop_metrics');

if (metricsError) {
  console.error('Error fetching workshop metrics:', metricsError);
}

// Create lookup map from metrics
const countMap: Record<string, number> = {};
(metricsData || []).forEach(m => {
  countMap[m.workshop_id] = Number(m.registration_count) || 0;
});
```

### Why This Works

The `get_workshop_metrics` function performs the count inside PostgreSQL:
```sql
(SELECT COUNT(*) FROM lead_assignments la WHERE la.workshop_id = w.id)
```

This runs entirely in the database with no row limits, ensuring accurate counts regardless of how many total lead assignments exist.

### Real-time Updates

The Workshop Notification page already has real-time subscriptions for workshops. After this fix, registration counts will update correctly whenever the query is invalidated.

## Testing Checklist

After implementation:

- [ ] Navigate to Workshop Notification page
- [ ] Verify "Crypto Wealth Masterclass SH (Jan 31)" shows 250 registrations
- [ ] Compare with All Workshops page - counts should match
- [ ] Test with other workshops to ensure consistency

