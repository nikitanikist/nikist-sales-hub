

# Fix: Sequence Steps Table Not Updating in Real-Time After Adding a Step

## Problem Summary

When adding a new step to a sequence:
1. User selects a time, template, and optionally a label
2. User clicks the "+" button
3. The step is successfully saved to the database
4. The steps table does **NOT** immediately show the new step
5. User must close the dialog and reopen it to see the newly added step

This is a poor UX - users expect to see their changes immediately.

## Root Cause Analysis

Looking at the code in `WorkshopNotificationSettings.tsx` (lines 925-941):

```typescript
onAddStep={async (data) => {
  await createStep(data);
  // Refresh sequence data
  const { data: updated } = await import('@/integrations/supabase/client').then(m => 
    m.supabase
      .from('template_sequences')
      .select(`*, steps:template_sequence_steps(*, template:whatsapp_message_templates(id, name))`)
      .eq('id', editingSequence.id)
      .single()
  );
  if (updated) {
    setEditingSequence({...});
  }
}}
```

**Potential Issues:**

| Issue | Description |
|-------|-------------|
| Dynamic Import Timing | Using `import()` syntax can cause unexpected timing issues in async flows |
| Missing await | The Promise chain may not properly wait for state updates |
| Query inconsistency | The SELECT query fetches `id, name` but the dialog may need `content, media_url` for consistency |

The most likely issue is the **dynamic import pattern** (`await import(...).then(m => m.supabase...)`). This pattern:
1. Adds unnecessary complexity
2. Can cause race conditions between the import and the query
3. Is harder to debug

## Solution

**Simplify the refresh logic by using the `supabase` client directly** (it's already imported at the top of the file through the hook).

Instead of dynamic imports, we should:
1. Call `queryClient.invalidateQueries` to refresh the sequence data in the background
2. Use a dedicated refetch function or manually update the `editingSequence` state using the already-imported supabase client

**Recommended Approach:**

Option A: Use the `useSequence` hook from `useTemplateSequences` to manage the editing sequence state reactively
- This would make the dialog automatically update when the query cache is invalidated
- Cleaner separation of concerns

Option B: Fix the current pattern by using the supabase client directly without dynamic import
- Less refactoring
- Still requires manual state updates

I recommend **Option A** for a more robust solution.

---

## Implementation Plan

### Step 1: Modify WorkshopNotificationSettings to Use the Hook's `useSequence`

Currently the component uses a local `editingSequence` state. Instead, we should:

1. Store just the `editingSequenceId` in local state
2. Use the `useSequence(editingSequenceId)` hook to get reactive data
3. The hook already invalidates queries on add/delete/update, so the dialog will auto-refresh

```typescript
// Current approach (problematic)
const [editingSequence, setEditingSequence] = useState<any>(null);

// New approach (reactive)
const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
const { data: editingSequence } = useSequence(editingSequenceId);
```

### Step 2: Simplify the onAddStep Handler

Remove the manual refresh logic since the hook will automatically refetch:

```typescript
// Current (complex)
onAddStep={async (data) => {
  await createStep(data);
  // Long manual refresh code...
}}

// New (simple)
onAddStep={async (data) => {
  await createStep(data);
  // Hook automatically invalidates and refetches!
}}
```

### Step 3: Update Dialog Open/Close Logic

```typescript
// When opening edit dialog
onClick={() => { 
  setEditingSequenceId(s.id);  // Just set the ID
  setSequenceDialogOpen(true); 
}}

// When closing
onOpenChange={(open) => {
  setSequenceDialogOpen(open);
  if (!open) setEditingSequenceId(null);
}}
```

---

## Files to Change

| File | Changes |
|------|---------|
| `src/hooks/useTemplateSequences.ts` | Ensure `useSequence` is exported properly (already done) |
| `src/pages/settings/WorkshopNotificationSettings.tsx` | Replace `editingSequence` state with hook-based reactive approach |

---

## Detailed Code Changes

### WorkshopNotificationSettings.tsx

**A. Update imports:**
```typescript
const { 
  sequences, 
  sequencesLoading, 
  createSequence, 
  deleteSequence, 
  createStep, 
  deleteStepAsync, 
  updateStepAsync, 
  isCreatingSequence, 
  isCreatingStep, 
  isUpdatingStep,
  useSequence  // Add this
} = useTemplateSequences();
```

**B. Replace editingSequence state with ID-based reactive hook:**
```typescript
// Replace this:
const [editingSequence, setEditingSequence] = useState<any>(null);

// With this:
const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
const { data: editingSequence, isLoading: isLoadingEditingSequence } = useSequence(editingSequenceId);
```

**C. Update dialog trigger:**
```typescript
// When clicking edit button on a sequence row
onClick={() => { 
  setEditingSequenceId(s.id); 
  setSequenceDialogOpen(true); 
}}

// When creating new sequence
onClick={() => { 
  setEditingSequenceId(null); 
  setSequenceDialogOpen(true); 
}}
```

**D. Simplify onSave handler:**
```typescript
onSave={async (data) => {
  if (data.id) {
    // Existing sequence - handled by hook
  } else {
    // New sequence - set the ID to start editing
    const newSeq = await createSequence(data);
    setEditingSequenceId(newSeq.id);
  }
}}
```

**E. Simplify onAddStep handler (remove manual refresh):**
```typescript
onAddStep={async (data) => {
  await createStep(data);
  // No manual refresh needed - hook invalidates queries automatically
}}
```

**F. Simplify onDeleteStep and onUpdateStep handlers:**
```typescript
onDeleteStep={async (stepId, sequenceId, stepOrder) => {
  await deleteStepAsync({ stepId, sequenceId, stepOrder });
  // No manual refresh needed
}}

onUpdateStep={async (data) => {
  await updateStepAsync(data);
  // No manual refresh needed
}}
```

**G. Reset ID when closing dialog:**
```typescript
onOpenChange={(open) => {
  setSequenceDialogOpen(open);
  if (!open) {
    setEditingSequenceId(null);
  }
}}
```

---

## Technical Note: Why This Works

The `useSequence` hook (lines 122-150 in `useTemplateSequences.ts`) uses React Query with the key `['template-sequence', sequenceId]`.

When `createStep`, `deleteStep`, or `updateStep` mutations complete, they call:
```typescript
queryClient.invalidateQueries({ queryKey: ['template-sequence'] });
```

This automatically triggers a refetch of the sequence data, and since we're using the hook in the component, React will re-render with the updated data.

---

## Expected Outcome

After implementation:
1. User adds a step via the "+" button
2. The step mutation completes and invalidates the query
3. React Query automatically refetches the sequence with its updated steps
4. The table immediately shows the new step without closing/reopening the dialog
5. Same behavior for editing and deleting steps

