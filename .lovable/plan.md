
# Add "Retry" Button for Draft/Failed Calling Campaigns

## Problem
When a campaign stays in "draft" status (e.g., because of the Bolna integration bug we just fixed), there's no way to retry it. The only option is to create a new broadcast from scratch.

## Solution
Add a "Retry" button on both the campaign list and the campaign detail page for campaigns with status "draft" or "failed". Clicking it re-invokes the `start-voice-campaign` edge function with the existing campaign ID.

## Changes

### 1. Campaign List Page (`src/pages/calling/CallingCampaigns.tsx`)
- Add a retry button (RefreshCw icon) in the Actions column for campaigns with status "draft" or "failed"
- On click, invoke `start-voice-campaign` with the campaign's ID, then refetch the list
- Show loading state on the button while retrying

### 2. Campaign Detail Page (`src/pages/calling/CallingCampaignDetail.tsx`)
- Add a "Retry Campaign" button (alongside the existing "Stop Campaign" button area) when status is "draft" or "failed"
- Same logic: invoke `start-voice-campaign`, then refetch campaign and calls data
- Show loading spinner during the retry

### 3. No backend changes needed
The `start-voice-campaign` edge function already accepts a `campaign_id` and re-reads the campaign data. It will work correctly for retrying a draft campaign now that the integration query bug is fixed.

## Technical Details

**Campaign List — Actions column addition:**
```
{(c.status === "draft" || c.status === "failed") && (
  <Button variant="ghost" size="sm" onClick={(e) => handleRetry(e, c.id)}>
    <RefreshCw className="h-3.5 w-3.5" />
  </Button>
)}
```

**Campaign Detail — header area addition:**
```
{(currentCampaign.status === "draft" || currentCampaign.status === "failed") && (
  <Button size="sm" onClick={handleRetry}>
    <RefreshCw className="h-4 w-4 mr-2" />
    Retry Campaign
  </Button>
)}
```

Both handlers call `supabase.functions.invoke("start-voice-campaign", { body: { campaign_id } })` and show success/error toasts.
