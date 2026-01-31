
# Fix: Sequence Step Inline Editing - Exit Edit Mode After Save

## Problem Summary

When editing a sequence step:
1. User clicks the edit icon (pencil) on a step row
2. Row enters edit mode with time, template, and label fields
3. User makes changes and clicks the green checkmark (save)
4. Toast shows "Step updated" BUT the row **stays in edit mode**
5. The green checkmark remains instead of reverting to the pencil icon
6. After refreshing, changes may or may not be persisted

Additionally, the cancel button shows a Trash icon which is confusing (looks like delete).

## Root Cause Analysis

Looking at the code in `WorkshopNotificationSettings.tsx`:

```typescript
const handleSaveEdit = async () => {
  if (!editingStepId) return;
  try {
    await onUpdateStep({...});
    setEditingStepId(null);  // Should exit edit mode
  } catch (error) {
    // Error handled by mutation - but editingStepId is NOT reset!
  }
};
```

**Issue 1**: If `onUpdateStep` throws an error, `setEditingStepId(null)` is never called, leaving the row stuck in edit mode.

**Issue 2**: The cancel button uses a Trash icon (`<Trash2 />`) which is confusing - users expect a cancel/X icon.

**Issue 3**: There's a potential race condition where the `useEffect` that watches `sequence` changes may interfere with the manual `setEditingStepId(null)` call.

## Solution

### 1. Always Exit Edit Mode After Save Attempt

Move `setEditingStepId(null)` to a `finally` block so it always runs:

```typescript
const handleSaveEdit = async () => {
  if (!editingStepId) return;
  try {
    await onUpdateStep({...});
    // Success toast is handled by mutation
  } catch (error) {
    // Error toast is handled by mutation
  } finally {
    // Always exit edit mode, regardless of success/failure
    setEditingStepId(null);
    setEditingValues({ send_time: '', template_id: '', time_label: '' });
  }
};
```

### 2. Fix Cancel Button Icon

Replace the confusing Trash icon with an X icon for the cancel action:

```typescript
// Current (confusing):
<Trash2 className="h-4 w-4 text-muted-foreground" />

// Fixed:
<X className="h-4 w-4 text-muted-foreground" />
```

### 3. Remove Redundant Reset from useEffect

The `useEffect` that watches `sequence` should NOT reset `editingStepId` unconditionally, as this can cause issues. Instead, only reset on dialog open/close:

```typescript
useEffect(() => {
  if (sequence) {
    setName(sequence.name || '');
    setDescription(sequence.description || '');
  } else {
    setName('');
    setDescription('');
  }
  setNewStepTime('11:00');
  setNewStepTemplate('');
  setNewStepLabel('');
  setShowSaved(false);
  // DON'T reset editingStepId here - let handleSaveEdit control it
}, [sequence]);

// Add separate effect for dialog close
useEffect(() => {
  if (!open) {
    setEditingStepId(null);
    setEditingValues({ send_time: '', template_id: '', time_label: '' });
  }
}, [open]);
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/settings/WorkshopNotificationSettings.tsx` | Fix handleSaveEdit, fix cancel icon, improve useEffect logic |

---

## Detailed Code Changes

### SequenceEditorDialog Component

**A. Add X icon import:**
```typescript
import { Plus, Edit2, Trash2, FileText, ListOrdered, Tag, Clock, Loader2, Image, Check, X } from 'lucide-react';
```

**B. Fix handleSaveEdit function:**
```typescript
const handleSaveEdit = async () => {
  if (!editingStepId) return;
  try {
    await onUpdateStep({
      id: editingStepId,
      send_time: editingValues.send_time + ':00',
      template_id: editingValues.template_id,
      time_label: editingValues.time_label || undefined,
    });
  } catch (error) {
    // Error toast is shown by mutation
  } finally {
    // Always exit edit mode
    setEditingStepId(null);
    setEditingValues({ send_time: '', template_id: '', time_label: '' });
  }
};
```

**C. Fix cancel button icon:**
```typescript
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8"
  onClick={cancelEditing}
  disabled={isUpdatingStep}
>
  <X className="h-4 w-4 text-muted-foreground" />
</Button>
```

**D. Improve useEffect logic:**
```typescript
// Sync name/description when sequence changes
useEffect(() => {
  if (sequence) {
    setName(sequence.name || '');
    setDescription(sequence.description || '');
  } else {
    setName('');
    setDescription('');
  }
  setNewStepTime('11:00');
  setNewStepTemplate('');
  setNewStepLabel('');
  setShowSaved(false);
  // Remove editingStepId reset from here
}, [sequence]);

// Reset edit state when dialog closes
useEffect(() => {
  if (!open) {
    setEditingStepId(null);
    setEditingValues({ send_time: '', template_id: '', time_label: '' });
  }
}, [open]);
```

---

## Expected Outcome

After implementation:
1. Clicking the green checkmark (save) will always exit edit mode, whether the save succeeds or fails
2. If save fails, user will see an error toast and can click edit again to retry
3. The cancel button will show an X icon instead of a trash icon
4. Edit state properly resets when the dialog is closed
5. No more "stuck" edit mode after saving changes
