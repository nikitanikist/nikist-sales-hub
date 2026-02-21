

# Webinar Message Analytics + Smart Status Button

## Two Features

### 1. Analytics Page for Each Sent Message

Add a "View Analytics" button next to each sent message checkpoint. Clicking it navigates to a **dedicated analytics page** (not a popup) showing delivery stats for that message.

**The challenge:** The `scheduled_webinar_messages` table currently has no analytics columns (`delivered_count`, `read_count`, `reaction_count`, `message_id`). The existing webhook system (read receipts, reactions) only tracks `notification_campaign_groups` -- not webinar messages.

**Database changes needed:**
- Add columns to `scheduled_webinar_messages`: `message_id` (text), `delivered_count` (int, default 0), `read_count` (int, default 0), `reaction_count` (int, default 0)
- The `process-webinar-queue` edge function must store the VPS `messageId` after sending (so webhooks can match it later)
- The existing read-receipt and reaction webhooks must be updated to also check `scheduled_webinar_messages` when no match is found in `notification_campaign_groups`

**New page: `/webinar/message/:messageId`**
- Reuses the same stat card layout from the WhatsApp Campaign Detail page
- Shows: Group name, Members, Sent status, Delivered (not yet read), Read, Reactions
- Message preview card on the right
- "Last updated" timestamp with auto-refresh

### 2. Smart Status Button (SequenceProgressButton Fix)

The "Run" button currently queries the **workshop** messages table (`scheduled_whatsapp_messages`) instead of the **webinar** messages table (`scheduled_webinar_messages`). This is why it always shows "Run" even after messages are sent.

**Fix:** The `SequenceProgressButton` component imports `useWorkshopMessages` which queries the wrong table. For webinar usage, it needs to query `scheduled_webinar_messages` instead. Options:
- Pass pre-fetched messages from the parent (the webinar page already has them)
- Or make the button accept a custom messages hook

The parent `WebinarNotification.tsx` page will pass each webinar's messages to the button so it shows the correct state: "1/2 sent", "2/2 sent" (Completed), etc.

---

## Technical Plan

### Step 1: Database Migration
```sql
ALTER TABLE scheduled_webinar_messages
  ADD COLUMN message_id text,
  ADD COLUMN delivered_count integer DEFAULT 0,
  ADD COLUMN read_count integer DEFAULT 0,
  ADD COLUMN reaction_count integer DEFAULT 0;
```

### Step 2: Update `process-webinar-queue` Edge Function
After a successful send, store the `messageId` from the VPS response:
```typescript
const messageId = responseData?.messageId || responseData?.key?.id || null;
await supabase
  .from('scheduled_webinar_messages')
  .update({ status: 'sent', sent_at: now, message_id: messageId })
  .eq('id', msg.id);
```

### Step 3: Update Webhook Edge Functions
Modify `whatsapp-read-receipt-webhook` and `whatsapp-reaction-webhook` to also check `scheduled_webinar_messages` when no match in `notification_campaign_groups`. This enables delivery/read/reaction tracking for webinar messages.

### Step 4: Fix SequenceProgressButton for Webinars
In `WebinarNotification.tsx`, fetch messages per webinar and pass them to `SequenceProgressButton` via the `messages` prop (which it already supports). This bypasses the workshop hook entirely.

Create a small helper component `WebinarSequenceButton` that:
1. Calls `useWebinarMessages(webinarId)` 
2. Maps the webinar message format to the `ScheduledMessage` type
3. Passes them to `SequenceProgressButton` via the `messages` prop

### Step 5: New Analytics Page
- **Route:** `/webinar/message/:messageId`
- **File:** `src/pages/webinar/WebinarMessageAnalytics.tsx`
- Fetches the `scheduled_webinar_messages` record by ID
- Displays stat cards (Audience/Members, Sent, Delivered Not Yet Read, Read, Reactions) using the same design as `CampaignDetail.tsx`
- Shows the message content in a WhatsApp preview card
- Auto-refreshes every 30 seconds
- Back button to return to the webinar notification page

### Step 6: Add "View Analytics" Button to Message Checkpoints
In the `WebinarDetailSheet`, next to each "Sent" checkpoint, add a small chart/analytics icon button that navigates to the analytics page for that message.

### Files Modified
1. `supabase/functions/process-webinar-queue/index.ts` -- store messageId
2. `supabase/functions/whatsapp-read-receipt-webhook/index.ts` -- check webinar messages
3. `supabase/functions/whatsapp-reaction-webhook/index.ts` -- check webinar messages  
4. `src/pages/webinar/WebinarNotification.tsx` -- pass messages to SequenceProgressButton
5. `src/pages/webinar/WebinarDetailSheet.tsx` -- add analytics button per checkpoint
6. `src/App.tsx` -- add route for analytics page

### Files Created
1. `src/pages/webinar/WebinarMessageAnalytics.tsx` -- analytics page

