

## Plan: Reduce VPS Load to Prevent OOM Crashes

### Problem
The VPS (3.8GB RAM, 512MB Node.js limit) crashes under concurrent request load from two edge functions, causing "Connection reset by peer" errors in campaigns. The VPS developer has added swap + memory limits, but we need to reduce the load from our side too.

### Changes (Safe - No Impact on WhatsApp Connections)

These changes only affect how quickly we send HTTP requests to the VPS. They do NOT touch WhatsApp sessions, authentication, or message format.

---

### 1. Reduce batch concurrency in `process-notification-campaigns`

**File:** `supabase/functions/process-notification-campaigns/index.ts`

- Change `BATCH_SIZE` from `10` to `5` (line 10)
- Add a **minimum 500ms delay** between each send, even when `delay_seconds` is 0. Currently, if `delay_seconds` is 0, messages fire back-to-back with no gap (line 332). We'll add a floor:
  ```
  // Current: only delays if delay_seconds > 0
  // New: always delay at least 500ms between sends
  const delayMs = Math.max(500, (campaign.delay_seconds || 0) * 1000);
  ```
- Add retry logic for "connection reset" errors: if the error message contains "reset" or "ECONNRESET", wait 2 seconds and retry once before marking as failed

### 2. Limit concurrency in `process-whatsapp-queue`

**File:** `supabase/functions/process-whatsapp-queue/index.ts`

- Currently sends up to **50 messages simultaneously** via `Promise.allSettled` (line 123). This is the biggest spike source.
- Replace with **sequential processing** with a 500ms delay between each message
- This is a safe change — messages are still sent in order, just not all at once

### 3. Add connection-reset-specific retry in shared utility

**File:** `supabase/functions/_shared/fetchWithRetry.ts`

- Add a new helper `fetchWithConnectionRetry` that specifically handles "Connection reset by peer" errors with a 2-second backoff and 1 retry
- This is a targeted retry for infrastructure errors only, separate from the general retry logic

---

### Technical Details

**What stays the same:**
- Message format and content sent to VPS
- WhatsApp session IDs and authentication
- Campaign status tracking and dead letter queue logic
- Webhook processing (receipts, callbacks)

**What changes:**
- Speed of sending (slightly slower, but much more reliable)
- Memory pressure on VPS (significantly reduced)

**Expected impact:**
- Campaign delivery time may increase slightly (e.g., 100 groups takes ~50 seconds instead of ~10 seconds)
- Connection reset errors should drop to near-zero
- No more OOM restarts on the VPS

