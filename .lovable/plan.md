
# Media Not Sending with Scheduled Messages - Root Cause Analysis

## Overview

I've traced the entire message flow from template creation → message scheduling → cron processing → VPS sending and found **THREE distinct gaps** causing media to not be sent with messages.

---

## The Complete Message Flow

```
Template (with media_url)
    ↓
Scheduling (runMessagingMutation) 
    ↓ COPIES media_url to scheduled_whatsapp_messages (✅ WORKING)
    ↓ BUT does NOT copy media_type (❌ GAP #1)
    ↓
scheduled_whatsapp_messages table
    ↓ media_url = "https://..." ✅
    ↓ media_type = NULL ❌
    ↓
process-whatsapp-queue (cron job)
    ↓ Reads media_url and media_type ✅
    ↓ Passes to VPS as: { mediaUrl, mediaType } (❌ GAP #2: VPS may expect different format)
    ↓
VPS WhatsApp Service
    ↓ UNKNOWN: Does VPS actually support media sending?
```

---

## Gap #1: Missing `media_type` in Scheduling

**Location:** `src/hooks/useWorkshopNotification.ts` (Lines 369-378)

**Current Code:**
```typescript
messagesToCreate.push({
  organization_id: currentOrganization.id,
  group_id: groupId,
  workshop_id: workshopId,
  message_type: typeKey,
  message_content: processedContent,
  media_url: step.template?.media_url || null,  // ✅ Media URL is copied
  // ❌ media_type is MISSING!
  scheduled_for: scheduledForUTC.toISOString(),
  status: 'pending' as const,
});
```

**Problem:** The `scheduled_whatsapp_messages` table has a `media_type` column that is never populated. Looking at the database query results:

| id | media_url | media_type |
|----|-----------|------------|
| 0f50691a... | https://...png | **NULL** |

**Fix Required:** Detect the media type from the URL and include it:
```typescript
// Helper function to detect media type from URL
function getMediaTypeFromUrl(url: string | null): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.includes('video')) return 'video';
  if (lower.endsWith('.pdf')) return 'document';
  if (lower.match(/\.(jpg|jpeg|png|webp|gif)$/)) return 'image';
  return 'image'; // Default to image
}

// In messagesToCreate:
messagesToCreate.push({
  // ... other fields
  media_url: step.template?.media_url || null,
  media_type: getMediaTypeFromUrl(step.template?.media_url),  // ADD THIS
  // ...
});
```

---

## Gap #2: VPS API Format Unknown

**Location:** `supabase/functions/process-whatsapp-queue/index.ts` (Lines 140-146)

**Current Code:**
```typescript
const vpsBody = JSON.stringify({
  sessionId: vpsSessionId,
  phone: group.group_jid,
  message: msg.message_content,
  ...(msg.media_url && { mediaUrl: msg.media_url }),
  ...(msg.media_type && { mediaType: msg.media_type }),
});
```

**Questions:**
1. Does the VPS Baileys service at `http://72.61.251.65:3000/send` actually support media sending?
2. What field names does it expect? (`mediaUrl` vs `media` vs `attachment`?)
3. Does it expect a direct URL or base64-encoded data?

**From Memory Context:**
> The VPS /send endpoint requires the recipient identifier to be passed in a field named 'phone'.

This confirms `phone` field usage but doesn't mention media field names.

---

## Gap #3: Send Message Now Also Missing Media Type

**Location:** `src/hooks/useWorkshopNotification.ts` (Lines 481-488) - `sendMessageNowMutation`

**Current Code:**
```typescript
const { data, error } = await supabase.functions.invoke('vps-whatsapp-proxy', {
  body: {
    action: 'send',
    sessionId: sessionId,
    groupId: group.group_jid,
    message: content,
    ...(mediaUrl && { mediaUrl }),
    // ❌ mediaType is MISSING!
  },
});
```

**Fix Required:**
```typescript
// Detect media type from URL
const detectedMediaType = mediaUrl 
  ? (mediaUrl.toLowerCase().includes('.mp4') ? 'video' 
    : mediaUrl.toLowerCase().includes('.pdf') ? 'document' 
    : 'image')
  : undefined;

const { data, error } = await supabase.functions.invoke('vps-whatsapp-proxy', {
  body: {
    action: 'send',
    sessionId: sessionId,
    groupId: group.group_jid,
    message: content,
    ...(mediaUrl && { mediaUrl }),
    ...(mediaUrl && detectedMediaType && { mediaType: detectedMediaType }),
  },
});
```

---

## Gap #4: VPS Proxy Logging Needed

**Location:** `supabase/functions/process-whatsapp-queue/index.ts`

**Problem:** No logging of the media fields being sent, making debugging difficult.

**Fix Required:** Add logging before the VPS call:
```typescript
console.log(`Sending message ${msg.id} with media:`, {
  hasMediaUrl: !!msg.media_url,
  mediaType: msg.media_type,
  mediaUrlPreview: msg.media_url?.slice(0, 50),
});
```

---

## Implementation Plan

### Step 1: Add Media Type Detection Helper

Create a shared utility function that can be used across the codebase:

```typescript
// src/lib/mediaUtils.ts
export function getMediaTypeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  
  // Check by extension
  if (lower.match(/\.(mp4|mov|avi|webm)($|\?)/)) return 'video';
  if (lower.match(/\.pdf($|\?)/)) return 'document';
  if (lower.match(/\.(jpg|jpeg|png|webp|gif|bmp)($|\?)/)) return 'image';
  
  // Check by path patterns (Supabase storage often has file type in path)
  if (lower.includes('/video/') || lower.includes('video')) return 'video';
  if (lower.includes('/document/') || lower.includes('.pdf')) return 'document';
  
  // Default to image for unknown
  return 'image';
}
```

### Step 2: Fix Scheduled Message Creation

**File:** `src/hooks/useWorkshopNotification.ts`

Add `media_type` when creating scheduled messages:

```typescript
import { getMediaTypeFromUrl } from '@/lib/mediaUtils';

// Inside runMessagingMutation, around line 369:
messagesToCreate.push({
  organization_id: currentOrganization.id,
  group_id: groupId,
  workshop_id: workshopId,
  message_type: typeKey,
  message_content: processedContent,
  media_url: step.template?.media_url || null,
  media_type: getMediaTypeFromUrl(step.template?.media_url),  // NEW
  scheduled_for: scheduledForUTC.toISOString(),
  status: 'pending' as const,
});
```

### Step 3: Fix Send Message Now

**File:** `src/hooks/useWorkshopNotification.ts`

Add `mediaType` to the VPS proxy call:

```typescript
import { getMediaTypeFromUrl } from '@/lib/mediaUtils';

// Inside sendMessageNowMutation, around line 481:
const { data, error } = await supabase.functions.invoke('vps-whatsapp-proxy', {
  body: {
    action: 'send',
    sessionId: sessionId,
    groupId: group.group_jid,
    message: content,
    ...(mediaUrl && { mediaUrl }),
    ...(mediaUrl && { mediaType: getMediaTypeFromUrl(mediaUrl) }),  // NEW
  },
});
```

### Step 4: Add Logging to Queue Processor

**File:** `supabase/functions/process-whatsapp-queue/index.ts`

Add detailed logging to help debug:

```typescript
// Before line 148 (before sending to VPS):
console.log(`Message ${msg.id} payload:`, {
  hasMedia: !!msg.media_url,
  mediaType: msg.media_type,
  mediaUrlLength: msg.media_url?.length || 0,
});

// Log the full VPS body for debugging:
console.log(`VPS request body:`, vpsBody);
```

### Step 5: Verify VPS Media Support (Investigation)

**Action Required:** We need to verify if the VPS Baileys service actually supports media sending:

1. Check VPS documentation or source code
2. Test manually with a curl command to the VPS
3. Check if there's a different endpoint for media messages

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/mediaUtils.ts` | Create new file with `getMediaTypeFromUrl` helper |
| `src/hooks/useWorkshopNotification.ts` | Add `media_type` to scheduled messages and send-now calls |
| `supabase/functions/process-whatsapp-queue/index.ts` | Add logging for debugging media |

---

## Testing Checklist

After implementation:

- [ ] Create a template with an image attached
- [ ] Schedule a message using that template
- [ ] Check `scheduled_whatsapp_messages` table - `media_type` should NOT be null
- [ ] Wait for cron to process or manually trigger
- [ ] Check edge function logs for media payload details
- [ ] Verify message arrives in WhatsApp WITH the image
- [ ] Test with video (MP4)
- [ ] Test with document (PDF)
- [ ] Test "Send Message Now" with media

---

## Summary

The media is being **saved correctly** to the database, but:

1. **`media_type` is not being populated** when scheduling messages (easy fix)
2. **`media_type` is not being sent** in the "Send Now" flow (easy fix)
3. **VPS may not support media** or expects different field names (needs investigation)

The first two issues are straightforward code fixes. The third requires testing with the actual VPS service to confirm the expected API format.
