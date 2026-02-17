

# Make Closer Remarks Mandatory for Negative Statuses

## Summary
When a closer sets the status to **Not Converted**, **No Show**, **Rescheduled**, or **Refunded**, the "Closer Remarks" field will be required. The save will be blocked with a toast message if remarks are empty.

## Changes

### 1. `src/pages/CloserAssignedCalls.tsx` — `handleSave` function (around line 828)

Add a validation check after the existing batch/classes validations:

```typescript
const remarksRequiredStatuses = ['not_converted', 'no_show', 'reschedule', 'refunded'];
if (remarksRequiredStatuses.includes(editData.status) && !editData.closer_remarks?.trim()) {
  toast({ 
    title: "Remarks Required", 
    description: "Please add closer remarks for this status", 
    variant: "destructive" 
  });
  return;
}
```

### 2. `src/pages/AllCloserCalls.tsx` — `handleSave` function (around line 567)

Add the identical validation check after the existing batch/classes validations.

### 3. Visual indicator (both files)

Add a red asterisk or "(required)" label next to the "Closer Remarks" label when the selected status is one of the four mandatory statuses, so closers know before they try to save.

## No other changes needed
- No database changes required (the column already exists and accepts text)
- No edge function changes needed
- This applies to all closers equally since both pages share the same validation logic

