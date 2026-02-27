

# Fix: Compute Campaign Analytics from Actual Calls Data

## Problem

The campaign counters stored in `voice_campaigns` are inflated due to duplicate webhook processing before the fixes were applied. For example, `calls_completed: 4` when only 2 calls exist, and `calls_no_answer: 3` when only 1 call had that outcome.

The UI blindly displays these stored counters, leading to impossible numbers like "4/2 completed" and "200% progress".

## Solution

Compute analytics cards and progress bar from the actual `mergedCalls` array (which comes from `voice_campaign_calls` rows) instead of from the stored campaign counters. This makes the UI self-correcting regardless of counter bugs.

## Changes

### 1. `src/pages/calling/CallingCampaignDetail.tsx`

Add a `computedStats` memo that counts outcomes from `mergedCalls`:

```typescript
const computedStats = useMemo(() => {
  const completed = mergedCalls.filter(c => 
    ["completed","no-answer","busy","failed"].includes(c.status)
  ).length;
  const confirmed = mergedCalls.filter(c => c.outcome === "confirmed").length;
  const rescheduled = mergedCalls.filter(c => c.outcome === "rescheduled").length;
  const notInterested = mergedCalls.filter(c => 
    ["not_interested","angry"].includes(c.outcome || "")
  ).length;
  const noAnswer = mergedCalls.filter(c => 
    ["no_response","no_answer"].includes(c.outcome || "")
  ).length;
  const failed = mergedCalls.filter(c => c.status === "failed").length;
  const totalCost = mergedCalls.reduce((s, c) => s + (c.total_cost || 0), 0);
  return { completed, confirmed, rescheduled, notInterested, noAnswer, failed, totalCost };
}, [mergedCalls]);
```

Pass `computedStats` to `CampaignAnalyticsCards` and `CampaignProgressBar` instead of campaign counters.

### 2. `src/pages/calling/components/CampaignAnalyticsCards.tsx`

Update the props interface to accept computed stats alongside the campaign (for `total_contacts` and other campaign-level fields). Use computed values for all counters.

### 3. Progress Bar

Pass `computedStats.completed` and `currentCampaign.total_contacts` to the progress bar instead of `currentCampaign.calls_completed`.

### 4. Fix existing data (one-time)

Run a SQL update to correct the stored counters for this specific campaign so they match reality. This ensures any other views or exports also show correct data.

## Result

- "Calls Completed" will show 2/2 (correct)
- Progress will show 100%
- "No Answer" will show 1
- "Confirmed" will show 1
- Total cost will show sum of actual call costs
