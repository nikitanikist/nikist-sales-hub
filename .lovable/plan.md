
# Fix: Add Cron Job for WhatsApp Message Queue Processing

## The Problem

Your scheduled WhatsApp message at 12:01 AM IST is still `pending` because **nothing is triggering the `process-whatsapp-queue` function**.

Currently:
- The `process-whatsapp-queue` edge function exists and is correct
- But no cron job calls it
- So pending messages in `scheduled_whatsapp_messages` are never processed

## The Solution

Add a new cron job that calls `process-whatsapp-queue` every minute.

## Implementation

### Step 1: Create the cron job via SQL

Run this SQL to add the missing cron job:

```sql
SELECT cron.schedule(
  'process-workshop-whatsapp-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://swnpxkovxhinxzprxviz.supabase.co/functions/v1/process-whatsapp-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3bnB4a292eGhpbnh6cHJ4dml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwOTk5NTAsImV4cCI6MjA3NzY3NTk1MH0.W34Qfks60H-ZWmCud50JdGCP2T5zbOyyqG78r68ssw8"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

This will:
- Create a new cron job named `process-workshop-whatsapp-queue`
- Run every minute (`* * * * *`)
- Call the `process-whatsapp-queue` edge function
- Process any pending messages where `scheduled_for <= now()`

### Step 2: Manually trigger to send your pending message now

After the cron job is created, we can also manually invoke the function to immediately send your pending 12:01 AM message (since it's already past due).

## After Fix

| Cron Job | Function Called | Purpose |
|----------|-----------------|---------|
| `process-whatsapp-reminders` | `process-due-reminders` | Call appointment reminders for closers |
| `process-workshop-whatsapp-queue` (NEW) | `process-whatsapp-queue` | Workshop notification messages to WhatsApp groups |

## Verification

Once implemented:
1. The cron job will run every minute
2. Your pending message (12:01 AM IST) will be picked up immediately
3. Future scheduled messages will process automatically
4. Check `scheduled_whatsapp_messages` table - status should change from `pending` to `sent`
