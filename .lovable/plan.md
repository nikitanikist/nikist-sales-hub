

# Fix SMS Sending: Switch to DLT Manual API

## Problem Summary

The SMS test message failed with error: `"Invalid Message ID (or Template, Entity ID)"`

**Root Cause:** The edge function uses `route: 'dlt'` which expects Fast2SMS's internal **6-digit Message ID** (assigned when you register templates in Fast2SMS's DLT Manager portal). The current implementation passes the TRAI DLT Template ID (19-digit number like `1207174549154211511`), which Fast2SMS doesn't recognize for the `dlt` route.

## Two Solutions Available

### Option A: Use Fast2SMS DLT Manager (Current Route - `dlt`)

Register each template in Fast2SMS's DLT Manager at https://fast2sms.com/dlt:
- Log into Fast2SMS Dashboard
- Go to DLT Manager
- Add your DLT-approved Sender IDs (Headers) and Content Templates
- Fast2SMS assigns a 6-digit message_id to each template
- Use that 6-digit ID in the API instead of the TRAI template ID

**Pros:** Fast2SMS validates your templates before sending
**Cons:** Manual work to register each template in their portal

### Option B: Use DLT Manual Route (`dlt_manual`) - Recommended

Send SMS directly using your TRAI DLT credentials without registering in Fast2SMS:

**Required Parameters:**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `route` | Must be `dlt_manual` | `"dlt_manual"` |
| `sender_id` | Your DLT-approved header | `"NIKIST"` |
| `message` | **Full message text** with variables already substituted | `"Hi Amit, Your session..."` |
| `entity_id` | Your TRAI Principal Entity ID (from Jio DLT, NOT Fast2SMS) | `"1201XXXXXXXXX"` |
| `template_id` | Your TRAI DLT Template ID (19-digit) | `"1207174549154211511"` |
| `numbers` | Recipient phone number(s) | `"9876543210"` |
| `flash` | Flash SMS option (optional) | `"0"` |

**Pros:** No need to register templates in Fast2SMS portal
**Cons:** Fast2SMS doesn't validate - if message doesn't exactly match DLT template, it fails

---

## Required Information from User

For the DLT Manual route, I need your **TRAI Principal Entity ID**:

1. Log into your Jio DLT portal (or whichever operator you registered with)
2. Your Principal Entity ID is displayed in your profile/dashboard
3. It's the ID assigned to "Nikist Media Private Limited" when you completed DLT registration
4. Format: Usually starts with `12` and is about 19 digits

This is NOT a Fast2SMS ID - it's YOUR company's registration ID with TRAI DLT.

---

## Implementation (Once Entity ID is Provided)

### Step 1: Add Entity ID as Secret

Add your TRAI Principal Entity ID as a Lovable Cloud secret:
- **Secret Name:** `FAST2SMS_ENTITY_ID`
- **Value:** Your 19-digit TRAI Principal Entity ID

### Step 2: Update Edge Function

**File:** `supabase/functions/process-sms-queue/index.ts`

Changes:
1. Add `FAST2SMS_ENTITY_ID` environment variable
2. Fetch template `content_preview` to get the full message text
3. Switch route from `dlt` to `dlt_manual`
4. Build the full message by replacing `{#var#}` placeholders with actual values
5. Pass all required parameters for the manual route

### Current (Broken) Implementation
```javascript
{
  route: 'dlt',
  sender_id: 'NIKIST',
  message: '1207174549154211511',     // ❌ Fast2SMS expects 6-digit internal ID
  variables_values: 'amit|crypto...',
  numbers: '9457263922'
}
```

### Fixed Implementation (DLT Manual)
```javascript
{
  route: 'dlt_manual',
  sender_id: 'NIKIST',
  entity_id: '12XXXXXXXXXXXXXXXXX',   // ✅ Your TRAI Principal Entity ID
  template_id: '1207174549154211511', // ✅ TRAI DLT Template ID
  message: 'Hi amit, Your session crypto masterclass is scheduled for today at 7pm. Join WhatsApp: https://...\n\n-Nikist School',  // ✅ Full message with vars replaced
  numbers: '9457263922',
  flash: '0'
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/process-sms-queue/index.ts` | Switch to `dlt_manual` route, fetch content_preview, build full message |
| Environment Secrets | Add `FAST2SMS_ENTITY_ID` (your TRAI Entity ID) |

---

## Summary

The fix requires:
1. Getting your TRAI Principal Entity ID from your Jio DLT portal
2. Adding it as a secret `FAST2SMS_ENTITY_ID`
3. Updating the edge function to:
   - Use `route: 'dlt_manual'`
   - Pass `entity_id` and `template_id`
   - Build the complete message text with variables substituted (not just variable values)
