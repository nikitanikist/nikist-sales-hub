

# Fix: Sequence Step Editor - Improve UX and Fix Duplicate Key Issues

## Problems Identified

| Issue | Description | Root Cause |
|-------|-------------|------------|
| Cannot edit step time/template | No edit functionality for existing steps | Missing inline edit UI |
| "Duplicate key violation" error | After delete + add same step | Unique constraint on `(sequence_id, step_order)` + stale step_order calculation |
| Must delete entire sequence | Workaround for above issues | Poor error recovery |
| Steps not reordered after delete | Gaps in step_order values | Missing reorder logic after delete |

## Technical Root Cause

The database has a **unique constraint** on `(sequence_id, step_order)`:
```sql
CREATE UNIQUE INDEX template_sequence_steps_sequence_id_step_order_key 
ON public.template_sequence_steps USING btree (sequence_id, step_order)
```

When adding a step, the code calculates:
```typescript
step_order: (sequence.steps?.length || 0) + 1
```

This can collide with existing step_order values if:
1. The local state is stale
2. Steps were deleted but DB still has gaps

## Solution Overview

1. **Add inline editing for existing steps** - Allow changing time, template, and label directly in the table row
2. **Fix step_order calculation** - Use `MAX(step_order) + 1` instead of array length
3. **Reorder steps after delete** - Recalculate step_order values after deletion
4. **Await delete completion** - Wait for delete mutation before allowing new inserts
5. **Better error messages** - Show helpful guidance instead of raw DB errors

---

## Implementation Plan

### Step 1: Update the Hook (useTemplateSequences.ts)

**A. Fix step_order calculation**

Add a helper function to get the next step_order:
```typescript
const getNextStepOrder = (steps: TemplateSequenceStep[]): number => {
  if (!steps || steps.length === 0) return 1;
  return Math.max(...steps.map(s => s.step_order)) + 1;
};
```

**B. Add step reordering after delete**

After deleting a step, renumber remaining steps to prevent gaps:
```typescript
// In deleteStepMutation.onSuccess:
// Recalculate step_order for remaining steps
```

**C. Update step mutation for inline editing**

Ensure `updateStep` properly handles time and template changes.

---

### Step 2: Update SequenceEditorDialog Component

**A. Add inline edit mode for each step**

Replace static display with editable fields:

| Before | After |
|--------|-------|
| Static time text | Time input (editable on click) |
| Static template name | Template dropdown (editable on click) |
| Delete button only | Edit + Delete buttons |

**B. Use proper step_order when adding**

Pass the calculated step_order from parent that uses `getNextStepOrder()`.

**C. Await delete before allowing add**

```typescript
const handleDeleteStep = async (stepId: string) => {
  await deleteStep(stepId); // Wait for completion
  // Then refresh data before allowing new adds
};
```

---

### Step 3: UI Changes to SequenceEditorDialog

**Current table row (read-only):**
```
| 11:00 | Morning Reminder | Morning | [Delete] |
```

**New table row (inline editable):**
```
| [Time Input] | [Template Dropdown] | [Label Input] | [Save] [Delete] |
```

**Detailed changes:**

1. Each row becomes an inline form with:
   - Time picker (type="time")
   - Template select dropdown
   - Label text input
   - Save button (appears when changed)
   - Delete button

2. Track which row is being edited via state
3. Show "Saving..." indicator during update

---

### Step 4: Improve Error Handling

Replace cryptic "duplicate key value violation" with:
```typescript
if (error.message.includes('duplicate key')) {
  toast.error('This slot is already taken. Please wait and try again.');
} else {
  toast.error('Failed to add step', { description: error.message });
}
```

---

## Files to Change

| File | Changes |
|------|---------|
| `src/hooks/useTemplateSequences.ts` | Add `getNextStepOrder`, fix delete to reorder, improve error messages |
| `src/pages/settings/WorkshopNotificationSettings.tsx` | Add inline editing UI, proper async handling, better UX |

---

## Technical Details

### useTemplateSequences.ts Changes

```typescript
// Add reorder function
const reorderStepsAfterDelete = async (sequenceId: string, deletedOrder: number) => {
  // Get all steps with order > deletedOrder and decrement their order
  const { data: stepsToUpdate } = await supabase
    .from('template_sequence_steps')
    .select('id, step_order')
    .eq('sequence_id', sequenceId)
    .gt('step_order', deletedOrder)
    .order('step_order', { ascending: true });
  
  if (stepsToUpdate && stepsToUpdate.length > 0) {
    for (const step of stepsToUpdate) {
      await supabase
        .from('template_sequence_steps')
        .update({ step_order: step.step_order - 1 })
        .eq('id', step.id);
    }
  }
};
```

### SequenceEditorDialog UI Changes

Add state for editing:
```typescript
const [editingStepId, setEditingStepId] = useState<string | null>(null);
const [editingValues, setEditingValues] = useState<{
  send_time: string;
  template_id: string;
  time_label: string;
}>({ send_time: '', template_id: '', time_label: '' });
```

Table row becomes:
```tsx
{editingStepId === step.id ? (
  // Editable row
  <>
    <TableCell>
      <Input type="time" value={editingValues.send_time} onChange={...} />
    </TableCell>
    <TableCell>
      <Select value={editingValues.template_id} onValueChange={...}>...</Select>
    </TableCell>
    <TableCell>
      <Input value={editingValues.time_label} onChange={...} />
    </TableCell>
    <TableCell>
      <Button onClick={handleSaveEdit}>Save</Button>
      <Button onClick={() => setEditingStepId(null)}>Cancel</Button>
    </TableCell>
  </>
) : (
  // Read-only row with edit button
  <>
    <TableCell>{step.send_time?.slice(0, 5)}</TableCell>
    <TableCell>{step.template?.name}</TableCell>
    <TableCell>{step.time_label || '—'}</TableCell>
    <TableCell>
      <Button onClick={() => startEditing(step)}><Edit2 /></Button>
      <Button onClick={() => handleDelete(step)}><Trash2 /></Button>
    </TableCell>
  </>
)}
```

---

## Expected Outcome

After implementation:
1. Users can click on any step to edit time, template, or label inline
2. No more "duplicate key" errors when adding steps after deletion
3. Step order is automatically maintained without gaps
4. Clear feedback when saving changes
5. Proper async handling prevents race conditions

