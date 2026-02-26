

# Fix: Bolna Batch Scheduling — Increase Time Buffer to 2.5 Minutes

## Problem
The Bolna API returned: `"Scheduled time should be atleast 2 minutes in the future"`. Our current code adds only 30 seconds (`Date.now() + 30000`), which is insufficient.

## Fix (1 file, 1 line)

**`supabase/functions/start-voice-campaign/index.ts`** (line 122):

```text
// Before:
const scheduleTime = campaign.scheduled_at || new Date(Date.now() + 30000).toISOString();

// After:
const scheduleTime = campaign.scheduled_at || new Date(Date.now() + 150000).toISOString();
```

This sets the buffer to 150 seconds (2 minutes 30 seconds), giving a comfortable margin above Bolna's 2-minute minimum.

## After deploying
You can retry the failed campaign from the campaign detail page — it should auto-start this time.

