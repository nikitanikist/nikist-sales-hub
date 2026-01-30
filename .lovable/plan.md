
# Add Manual Variable Support to "Send Message Now" Dialog

## Problem
When using "Send Message Now" to send an immediate message, templates containing manual variables like `{zoom_link}` or `{whatsapp_group_link}` display the literal placeholder text instead of actual values. The dialog currently only replaces auto-filled variables (workshop_name, date, time).

## Current Flow
```
User clicks "Send Message Now"
       ↓
Select template from dropdown
       ↓
Preview shows {zoom_link} as literal text  ← BUG
       ↓
Message sent with {zoom_link} visible
```

## Proposed Flow
```
User clicks "Send Message Now"
       ↓
Select template from dropdown
       ↓
System scans template for {variables}
       ↓
If manual variables found:
┌────────────────────────────────────────┐
│ Template: After Noon Notification      │
│                                        │
│ Enter values for variables:            │
│ ┌────────────────────────────────────┐ │
│ │ Zoom Link *                        │ │
│ │ [_________________________]        │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Message Preview:                       │
│ ┌────────────────────────────────────┐ │
│ │ Tonight at 7 PM, you'll learn...  │ │
│ │                                    │ │
│ │ https://zoom.us/j/123456          │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
       ↓
All variables replaced correctly
       ↓
Message sent with actual link
```

---

## Implementation Details

### File to Modify: `src/components/operations/SendMessageNowDialog.tsx`

**Changes needed:**

1. **Import variable utilities**
   - Import `extractVariables`, `categorizeVariables`, `getVariableLabel` from templateVariables.ts

2. **Add state for manual variable inputs**
   - Track manual variables detected in selected template
   - Track user-entered values for each variable

3. **Detect variables when template is selected**
   - When user selects a template, extract all variables from its content
   - Separate into auto-filled and manual categories

4. **Add input fields for manual variables**
   - Show input fields for each manual variable when detected
   - Pre-fill from saved workshop variables if available (need to pass savedVariables prop)

5. **Update preview to show replaced values**
   - Replace both auto-filled AND manual variables in the preview
   - Show placeholder hint if variable not yet entered

6. **Validate before sending**
   - Require all manual variables to be filled
   - Disable "Send Now" button until all fields have values

7. **Pass complete content to onSend**
   - Content passed to onSend should have all variables replaced

---

### Updated Component Props

```typescript
interface SendMessageNowDialogProps {
  // ... existing props
  savedVariables?: Record<string, string>;  // NEW: Pre-fill from workshop variables
}
```

### Key Code Changes

**Variable Detection (when template selected):**
```typescript
const { autoFilled, manual } = useMemo(() => {
  if (!selectedTemplate?.content) return { autoFilled: [], manual: [] };
  const allVars = extractVariables(selectedTemplate.content);
  return categorizeVariables(allVars);
}, [selectedTemplate?.content]);
```

**State for manual variable values:**
```typescript
const [manualValues, setManualValues] = useState<Record<string, string>>({});

// Initialize from saved values when template changes
useEffect(() => {
  const initial: Record<string, string> = {};
  manual.forEach(key => {
    initial[key] = savedVariables?.[key] || '';
  });
  setManualValues(initial);
}, [manual, savedVariables]);
```

**Updated preview with all variables replaced:**
```typescript
const processedContent = useMemo(() => {
  if (!selectedTemplate) return '';
  let content = selectedTemplate.content
    .replace(/{workshop_name}/gi, workshopTitle)
    .replace(/{date}/gi, formatInOrgTime(workshopStartDate, timezone, 'MMMM d, yyyy'))
    .replace(/{time}/gi, formatInOrgTime(workshopStartDate, timezone, 'h:mm a'));
  
  // Replace manual variables
  for (const [key, value] of Object.entries(manualValues)) {
    if (value) {
      content = content.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
    }
  }
  
  return content;
}, [selectedTemplate, workshopTitle, workshopStartDate, timezone, manualValues]);
```

**Validation:**
```typescript
const allManualFilled = manual.length === 0 || 
  manual.every(key => manualValues[key]?.trim());
```

---

### UI Layout (when manual variables detected)

```
┌─────────────────────────────────────────────────────────┐
│ ↗ Send Message Now                                  ✕   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Select Template                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ After Noon Notification-1PM                    ▼    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Enter values for variables:                         │ │
│ │                                                     │ │
│ │ Zoom Link *                                         │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ https://zoom.us/j/...                           │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Message Preview                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ https://joinnikitschool.in/crypto-loss-recovery   │ │
│ │ framework                                          │ │
│ │                                                    │ │
│ │ Tonight at 7 PM, you'll learn everything in       │ │
│ │ detail.                                           │ │
│ │                                                    │ │
│ │ https://zoom.us/j/123456789                       │ │
│ │                                                    │ │
│ │ 📷 Media attached                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│ Variables like {workshop_name} are replaced with        │
│ actual values                                           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                        [Cancel]   [↗ Send Now (1 group)]│
└─────────────────────────────────────────────────────────┘
```

---

### Parent Component Update

**WorkshopDetailSheet.tsx** - Pass saved variables to dialog:

```typescript
<SendMessageNowDialog
  // ... existing props
  savedVariables={variablesMap}  // ADD THIS
/>
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/operations/SendMessageNowDialog.tsx` | Add variable detection, input fields, and full replacement logic |
| `src/components/operations/WorkshopDetailSheet.tsx` | Pass `savedVariables` prop to dialog |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Template has no manual variables | No input fields shown, works as before |
| User switches to different template | Reset manual values, re-detect variables |
| Saved variables exist for workshop | Pre-fill input fields |
| User leaves field empty | "Send Now" button disabled |
| Template has only auto-filled vars | No input section, works as before |

---

## Summary

This enhancement extends the existing variable system to the "Send Message Now" dialog:
- Detects `{variable}` patterns in the selected template
- Shows inline input fields for manual variables
- Pre-fills from saved workshop variables when available
- Updates preview in real-time as user types
- Ensures complete variable replacement before sending
