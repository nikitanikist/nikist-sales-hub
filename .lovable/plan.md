

# Fix SMS Sending: Implement DLT Manual Route

## What Was Wrong

The current implementation uses `route: 'dlt'` which requires Fast2SMS's internal 6-digit message IDs. Since we're using TRAI's 19-digit DLT Template IDs, Fast2SMS rejected the request with "Invalid Message ID".

## Solution

Switch to `route: 'dlt_manual'` which allows sending SMS directly using:
- Your TRAI Entity ID: `1201172906487465179`
- Your existing TRAI DLT Template IDs
- The full message text with variables already substituted

---

## Implementation Steps

### Step 1: Add Your Entity ID as a Secret

Add a new backend secret:
| Secret Name | Value |
|-------------|-------|
| `FAST2SMS_ENTITY_ID` | `1201172906487465179` |

### Step 2: Update the Edge Function

**File:** `supabase/functions/process-sms-queue/index.ts`

**Changes:**

1. **Add Entity ID environment variable** at line 73-77
2. **Fetch `content_preview` in template query** at line 121
3. **Add new function** to build the full message with variables substituted
4. **Replace API call** from `dlt` route to `dlt_manual` route with proper parameters

**Before (Current - Broken):**
```javascript
const fast2smsBody = {
  route: 'dlt',
  sender_id: FAST2SMS_SENDER_ID,
  message: template.dlt_template_id,     // ❌ Fast2SMS expects 6-digit internal ID
  variables_values: 'value1|value2',
  numbers: phoneNumber,
};
```

**After (Fixed):**
```javascript
const fast2smsBody = {
  route: 'dlt_manual',
  sender_id: FAST2SMS_SENDER_ID,
  entity_id: FAST2SMS_ENTITY_ID,         // ✅ Your TRAI Entity ID
  template_id: template.dlt_template_id, // ✅ TRAI DLT Template ID
  message: fullMessageWithVariables,     // ✅ Complete message text
  numbers: phoneNumber,
  flash: '0'
};
```

### Step 3: Build Full Message Text

New helper function that takes the `content_preview` template and replaces each `{#var#}` placeholder with actual values:

```text
Template: "Hi {#var#}, Your session {#var#} is scheduled for {#var#}. -Nikist School"
Variables: {var1: "Amit", var2: "Crypto Masterclass", var3: "7 PM today"}
Result: "Hi Amit, Your session Crypto Masterclass is scheduled for 7 PM today. -Nikist School"
```

---

## Files Modified

| File | Changes |
|------|---------|
| Backend Secrets | Add `FAST2SMS_ENTITY_ID` = `1201172906487465179` |
| `supabase/functions/process-sms-queue/index.ts` | Switch to `dlt_manual` route, build full message |

---

## Why This Works

The `dlt_manual` route is designed for businesses that have their own TRAI DLT registration. Instead of registering templates in Fast2SMS's portal, you send:
- Your registered Entity ID (proving you're authorized)
- The TRAI Template ID (for DLT compliance tracking)
- The exact message text (must match your DLT-approved template)

Fast2SMS then forwards this to the carrier network with proper DLT headers.

