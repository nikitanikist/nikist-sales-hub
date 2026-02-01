

# Fix SMS Sending: Switch to DLT Manual API

## Problem Summary

The SMS test message failed with error: `"Invalid Message ID (or Template, Entity ID)"`

**Root Cause:** The edge function uses `route: 'dlt'` which expects Fast2SMS's internal 6-digit Message ID (assigned when templates are registered in their DLT Manager portal). The current implementation passes the TRAI DLT Template ID (19-digit number like `1207174549154211511`), which Fast2SMS doesn't recognize.

## Solution

Switch from `route: 'dlt'` to `route: 'dlt_manual'` which allows sending DLT SMS by passing:
- Your TRAI Entity ID
- The TRAI DLT Template ID  
- The full message text with variables substituted
- The sender ID (header)

This bypasses Fast2SMS's DLT Manager entirely and works with the DLT IDs you already have.

---

## Implementation

### Step 1: Add Entity ID Secret

A new environment secret is needed:
- **FAST2SMS_ENTITY_ID**: Your TRAI-registered Entity ID (also called Principal Entity ID)

### Step 2: Update the SMS Template Table

Add a column to store the actual message content (not just preview). This is needed because `dlt_manual` route requires the full message text.

Actually, the `content_preview` field already contains the full template text, so we can use that.

### Step 3: Update Edge Function

**File:** `supabase/functions/process-sms-queue/index.ts`

Changes:
1. Add `FAST2SMS_ENTITY_ID` environment variable
2. Fetch template `content_preview` in addition to `dlt_template_id`
3. Switch route from `dlt` to `dlt_manual`
4. Build the full message by replacing `{#var#}` placeholders with actual values
5. Pass all required parameters for the manual route

**New API call structure:**
```javascript
const fast2smsBody = {
  route: 'dlt_manual',
  sender_id: FAST2SMS_SENDER_ID,      // e.g., "NIKIST"
  message: messageWithVariables,       // Full message text with vars replaced
  entity_id: FAST2SMS_ENTITY_ID,      // TRAI Entity ID
  template_id: template.dlt_template_id, // TRAI DLT Template ID
  numbers: phoneNumber,
  flash: '0'
};
```

### Step 4: Update SMS Template Query

Fetch `content_preview` field to get the full message text:
```typescript
const templatesResult = await supabase
  .from('sms_templates')
  .select('id, dlt_template_id, variables, content_preview')  // Add content_preview
  .in('id', templateIds);
```

### Step 5: Build Message with Variables

Create a function to replace `{#var#}` placeholders:
```typescript
function buildMessageWithVariables(
  contentTemplate: string,
  variableValues: Record<string, string> | null,
  variables: { key: string; label: string }[] | null
): string {
  let message = contentTemplate;
  
  if (variables && variableValues) {
    // Sort variables by key (var1, var2, etc.)
    const sortedVars = [...variables].sort((a, b) => {
      const aNum = parseInt(a.key.replace('var', '')) || 0;
      const bNum = parseInt(b.key.replace('var', '')) || 0;
      return aNum - bNum;
    });
    
    // Replace each {#var#} with the corresponding value
    for (const v of sortedVars) {
      const value = variableValues[v.key] || '';
      message = message.replace('{#var#}', value);
    }
  }
  
  return message;
}
```

---

## Required Environment Secret

You'll need to add your TRAI Entity ID as a secret:

| Secret Name | Description |
|-------------|-------------|
| FAST2SMS_ENTITY_ID | Your DLT-registered Principal Entity ID from TRAI |

---

## Technical Details

### Current (Broken) Implementation
```javascript
{
  route: 'dlt',
  sender_id: 'NIKIST',
  message: '1207174549154211511',     // ❌ Wrong - Fast2SMS expects 6-digit internal ID
  variables_values: 'amit|crypto...',
  numbers: '9457263922'
}
```

### Fixed Implementation
```javascript
{
  route: 'dlt_manual',
  sender_id: 'NIKIST',
  entity_id: '1201159547823456789',   // ✅ TRAI Entity ID
  template_id: '1207174549154211511', // ✅ TRAI DLT Template ID
  message: 'Hi amit, Your session crypto masterclass is scheduled for today at 7pm. Join WhatsApp for zoom link: https://...\n\n-Nikist School',  // ✅ Full message
  numbers: '9457263922',
  flash: '0'
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/process-sms-queue/index.ts` | Switch to `dlt_manual` route with proper parameters |
| Environment Secrets | Add `FAST2SMS_ENTITY_ID` |

---

## Summary

The fix requires:
1. Adding your TRAI Entity ID as a secret
2. Updating the edge function to use `dlt_manual` route
3. Building the full message text by substituting variables into the template

After this change, SMS will be sent using the DLT template IDs you already have imported, without needing to manually register each template in Fast2SMS's portal.

