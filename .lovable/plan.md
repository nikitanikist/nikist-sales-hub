

# Workshop-Specific Template Variable Input System

## Problem Statement

When running a message sequence for a workshop, templates may contain variables like `{zoom_link}` or `{whatsapp_group_link}` that are **not** auto-fillable. Currently, these variables are sent as literal text (e.g., the message shows "{zoom_link}" instead of an actual link).

### Current State

**Auto-filled variables** (lines 354-358 in `useWorkshopNotification.ts`):
- `{workshop_name}` - Resolved from `workshop.title`
- `{date}` - Resolved from `workshop.start_date` formatted as "MMMM d, yyyy"
- `{time}` - Resolved from `workshop.start_date` formatted as "h:mm a"

**Manual variables** (not currently handled):
- `{zoom_link}` - Needs user input
- `{whatsapp_group_link}` - Needs user input
- Any other custom variables users might add

### Your Requirement

1. When clicking "Run Sequence", scan all templates in the sequence
2. Detect variables that require manual input
3. Show a dialog asking for those values
4. Save values **per workshop** (not globally)
5. Use those values consistently across all messages in that run
6. Next workshop needs fresh input (different Zoom links, etc.)

---

## Solution Architecture

### User Flow

```
User clicks "Run Sequence"
       ↓
┌─────────────────────────────────────────────┐
│  System scans sequence templates for        │
│  {variable} patterns                        │
└─────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────┐
│  If manual variables found, show dialog:    │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ Crypto Wealth Masterclass - Variables  │ │
│  │                                        │ │
│  │ Auto-filled (read-only):               │ │
│  │ • Workshop Name: Crypto Wealth...      │ │
│  │ • Date: January 30, 2026               │ │
│  │ • Time: 7:00 PM                        │ │
│  │                                        │ │
│  │ Please fill in:                        │ │
│  │ • Zoom Link: [________________]        │ │
│  │ • WhatsApp Group Link: [______]        │ │
│  │                                        │ │
│  │ [Cancel]         [Save & Run Sequence] │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────┐
│  Save variables to workshop_sequence_vars   │
│  table (workshop_id + variable_key + value) │
└─────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────┐
│  Schedule messages with all variables       │
│  replaced (both auto-filled and manual)     │
└─────────────────────────────────────────────┘
```

---

## Database Design

### New Table: `workshop_sequence_variables`

Stores manual variable values per workshop:

```sql
CREATE TABLE workshop_sequence_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  variable_key TEXT NOT NULL,      -- e.g., "zoom_link"
  variable_value TEXT NOT NULL,    -- e.g., "https://zoom.us/j/123456"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one value per variable per workshop
  UNIQUE(workshop_id, variable_key)
);

-- RLS policies
ALTER TABLE workshop_sequence_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view variables in their org"
ON workshop_sequence_variables FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can manage variables in their org"
ON workshop_sequence_variables FOR ALL
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);
```

### Why This Design?

| Consideration | Decision |
|---------------|----------|
| **Scope** | Variables are stored per `workshop_id`, not per sequence or globally |
| **Reusability** | If a user runs the sequence again for the same workshop, values are pre-filled |
| **Independence** | Different workshops have completely separate variable values |
| **Cleanup** | When workshop is deleted, variables are cascade deleted |

---

## Implementation Plan

### Phase 1: Variable Detection Utility

**New file: `src/lib/templateVariables.ts`**

```typescript
// Known auto-filled variables
export const AUTO_FILLED_VARIABLES = ['workshop_name', 'date', 'time'];

// Extract all {variable} patterns from template content
export function extractVariables(content: string): string[] {
  const regex = /\{([a-z_]+)\}/gi;
  const matches = content.match(regex) || [];
  // Remove braces and deduplicate
  return [...new Set(matches.map(m => m.slice(1, -1).toLowerCase()))];
}

// Separate variables into auto-filled and manual
export function categorizeVariables(allVariables: string[]) {
  const autoFilled = allVariables.filter(v => AUTO_FILLED_VARIABLES.includes(v));
  const manual = allVariables.filter(v => !AUTO_FILLED_VARIABLES.includes(v));
  return { autoFilled, manual };
}

// Extract from all templates in a sequence
export function extractSequenceVariables(steps: Array<{ template?: { content: string } | null }>) {
  const allVars = new Set<string>();
  steps.forEach(step => {
    if (step.template?.content) {
      extractVariables(step.template.content).forEach(v => allVars.add(v));
    }
  });
  return categorizeVariables([...allVars]);
}
```

### Phase 2: Database Table Creation

**Migration: Create `workshop_sequence_variables` table**

```sql
-- Create table for storing workshop-specific variable values
CREATE TABLE IF NOT EXISTS workshop_sequence_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  variable_key TEXT NOT NULL,
  variable_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workshop_id, variable_key)
);

-- Enable RLS
ALTER TABLE workshop_sequence_variables ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view variables in their org"
ON workshop_sequence_variables FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can manage variables in their org"
ON workshop_sequence_variables FOR ALL
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  OR is_super_admin(auth.uid())
);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE workshop_sequence_variables;
```

### Phase 3: Variable Input Dialog

**New file: `src/components/operations/SequenceVariablesDialog.tsx`**

A dialog component that:

1. Receives the list of manual variables needed
2. Shows auto-filled values as read-only (for context)
3. Provides input fields for each manual variable
4. Pre-fills from existing saved values if available
5. Validates all required fields are filled
6. Returns the complete variable map on submit

**UI Structure:**

```
┌─────────────────────────────────────────────────────────┐
│ Configure Message Variables                             │
│ Workshop: Crypto Wealth Masterclass - Jan 30            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Auto-filled (from workshop data):                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Workshop Name   Crypto Wealth Masterclass           │ │
│ │ Date            January 30, 2026                    │ │
│ │ Time            7:00 PM                             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Enter values for these variables:                       │
│                                                         │
│ Zoom Link *                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ https://zoom.us/j/...                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ WhatsApp Group Link *                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ https://chat.whatsapp.com/...                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ℹ️ These values will be used for all messages in this   │
│    sequence for this workshop only.                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                      [Cancel]   [Save & Run Sequence]   │
└─────────────────────────────────────────────────────────┘
```

### Phase 4: Hook for Variable Management

**New file: `src/hooks/useSequenceVariables.ts`**

```typescript
// Hook to manage workshop-specific sequence variables
export function useSequenceVariables(workshopId: string | null) {
  // Fetch saved variables for this workshop
  const { data: savedVariables, isLoading } = useQuery({...});
  
  // Save/update variables mutation
  const saveVariables = useMutation({
    mutationFn: async (variables: Record<string, string>) => {
      // Upsert each variable
      for (const [key, value] of Object.entries(variables)) {
        await supabase
          .from('workshop_sequence_variables')
          .upsert({
            organization_id,
            workshop_id: workshopId,
            variable_key: key,
            variable_value: value,
          }, { onConflict: 'workshop_id,variable_key' });
      }
    }
  });
  
  return { savedVariables, isLoading, saveVariables };
}
```

### Phase 5: Update Run Messaging Flow

**Modify: `src/components/operations/WorkshopDetailSheet.tsx`**

Update the "Run Sequence" button flow:

```typescript
// State for variable dialog
const [variablesDialogOpen, setVariablesDialogOpen] = useState(false);
const [pendingRunData, setPendingRunData] = useState<{
  workshopId: string;
  workshop: WorkshopWithDetails;
  groupIds: string[];
  manualVariables: string[];
} | null>(null);

// Modified run sequence handler
const handleRunSequence = async () => {
  // 1. Fetch sequence and extract variables
  const { autoFilled, manual } = await extractSequenceVariablesForWorkshop(workshop);
  
  // 2. If manual variables needed, show dialog
  if (manual.length > 0) {
    setPendingRunData({ workshopId, workshop, groupIds, manualVariables: manual });
    setVariablesDialogOpen(true);
    return;
  }
  
  // 3. If no manual variables, run directly
  runMessaging({ workshopId, workshop, groupIds, variables: {} });
};

// Handle dialog submission
const handleVariablesSaved = (variables: Record<string, string>) => {
  if (pendingRunData) {
    runMessaging({
      ...pendingRunData,
      variables,
    });
    setVariablesDialogOpen(false);
    setPendingRunData(null);
  }
};
```

### Phase 6: Update Message Scheduling Logic

**Modify: `src/hooks/useWorkshopNotification.ts`**

Update `runMessagingMutation` to accept and use manual variables:

```typescript
// Updated mutation function signature
mutationFn: async ({ 
  workshopId, 
  workshop,
  groupIds,
  variables = {}, // NEW: Manual variables passed from dialog
}: { 
  workshopId: string; 
  workshop: WorkshopWithDetails;
  groupIds: string[];
  variables?: Record<string, string>; // NEW
}) => {
  // ... existing code ...
  
  // Enhanced variable replacement
  const processedContent = templateContent
    // Auto-filled variables
    .replace(/{workshop_name}/g, workshop.title)
    .replace(/{date}/g, format(workshopDateInOrgTz, 'MMMM d, yyyy'))
    .replace(/{time}/g, format(workshopDateInOrgTz, 'h:mm a'))
    // Manual variables from user input
    .replace(/{zoom_link}/g, variables.zoom_link || '{zoom_link}')
    .replace(/{whatsapp_group_link}/g, variables.whatsapp_group_link || '{whatsapp_group_link}');
    
  // Or use a more generic approach:
  let processedContent = templateContent;
  for (const [key, value] of Object.entries(variables)) {
    processedContent = processedContent.replace(
      new RegExp(`\\{${key}\\}`, 'gi'),
      value
    );
  }
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/templateVariables.ts` | Variable extraction and categorization utilities |
| `src/hooks/useSequenceVariables.ts` | Hook for fetching/saving workshop variables |
| `src/components/operations/SequenceVariablesDialog.tsx` | Dialog UI for variable input |

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useWorkshopNotification.ts` | Accept variables param, apply to all messages |
| `src/components/operations/WorkshopDetailSheet.tsx` | Add variable dialog flow before running sequence |
| `src/components/operations/MessagingActions.tsx` | Pass through updated handler |
| `src/components/operations/notification-channels/WhatsAppGroupTab.tsx` | Integrate with new flow |
| `src/hooks/useMessageTemplates.ts` | Update `TEMPLATE_VARIABLES` with new variable types |

---

## Variable Display Formatting

For better UX, convert snake_case variable keys to human-readable labels:

```typescript
const VARIABLE_LABELS: Record<string, string> = {
  'zoom_link': 'Zoom Meeting Link',
  'whatsapp_group_link': 'WhatsApp Group Invite Link',
  'youtube_link': 'YouTube Live Link',
  'telegram_link': 'Telegram Group Link',
  // Add more as needed
};

function getVariableLabel(key: string): string {
  return VARIABLE_LABELS[key] || 
    key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
```

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No manual variables in sequence | Skip dialog, run directly |
| Same workshop run again | Pre-fill from saved values |
| Different workshop | Fresh empty inputs |
| User cancels dialog | Don't run sequence |
| Partial input | Validation prevents submission |
| Template updated after save | Re-scan for new variables |

---

## Summary

This implementation creates a robust system where:

1. **Detection**: Automatically scans templates for `{variable}` patterns
2. **Categorization**: Separates auto-filled (workshop_name, date, time) from manual variables
3. **Input Dialog**: Shows when manual variables are found, with pre-fill for repeat runs
4. **Workshop Scope**: Values are tied to `workshop_id`, ensuring different workshops have independent values
5. **Consistency**: All messages in a sequence use the same variable values
6. **Persistence**: Values are saved to database for future reference and re-runs

