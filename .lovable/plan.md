

# Bulk Import SMS Templates from Excel

## Overview

Add a "Bulk Import" feature to the SMS Templates tab that allows importing pre-approved DLT templates directly from the Fast2SMS Excel export format.

## Excel Format Analysis

Based on the uploaded file `AllApprovedContentTemplate.xlsx`, here are the columns we'll map:

| Excel Column | Database Field | Notes |
|--------------|----------------|-------|
| TEMPLATE_ID | `dlt_template_id` | The DLT template ID (e.g., `1207173398907267114`) |
| TEMPLATE_NAME | `name` | Friendly name (e.g., "Morning Reminder") |
| TEMPLATE_CONTENT | `content_preview` | Full template text with `{#var#}` placeholders |
| VARIABLE_COUNT | Used to auto-generate `variables` | Number like `3` or `4` |
| HEADER | Stored for reference (optional) | Sender ID like `NIKIST` |

**Variable Auto-Generation**: Since the Excel provides `VARIABLE_COUNT` but not labels, we'll auto-generate variables as:
- `var1=Variable 1`, `var2=Variable 2`, etc.
- Users can edit labels after import

## User Flow

```text
Settings → Notifications → SMS Templates Tab
                ↓
    [+ Add Template]  [↑ Bulk Import]
                            ↓
                    ┌─────────────────────────────┐
                    │    Import SMS Templates     │
                    ├─────────────────────────────┤
                    │ Step 1: Upload Excel        │
                    │ ┌─────────────────────────┐ │
                    │ │    📄 Drop file here    │ │
                    │ │    or click to browse   │ │
                    │ └─────────────────────────┘ │
                    │                             │
                    │ Supports: .xlsx from        │
                    │ Fast2SMS DLT export         │
                    └─────────────────────────────┘
                            ↓
                    ┌─────────────────────────────┐
                    │ Step 2: Preview (27 found)  │
                    ├─────────────────────────────┤
                    │ ✓ 24 Ready to import        │
                    │ ⚠ 3 Already exist (skip)    │
                    │                             │
                    │ ┌─────────────────────────┐ │
                    │ │ Name       │ DLT ID     │ │
                    │ │────────────│────────────│ │
                    │ │ Morning... │ 1207...    │ │
                    │ │ We Are...  │ 1207...    │ │
                    │ └─────────────────────────┘ │
                    │                             │
                    │      [Cancel] [Import 24]   │
                    └─────────────────────────────┘
                            ↓
                    ┌─────────────────────────────┐
                    │ Step 3: Complete            │
                    ├─────────────────────────────┤
                    │    ✓ Import Complete!       │
                    │                             │
                    │  24 templates imported      │
                    │  3 duplicates skipped       │
                    │                             │
                    │         [Done]              │
                    └─────────────────────────────┘
```

## Technical Implementation

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/settings/ImportSMSTemplatesDialog.tsx` | **Create** | New dialog component for bulk import |
| `src/pages/settings/WorkshopNotificationSettings.tsx` | **Modify** | Add "Bulk Import" button next to "Add Template" |
| `src/hooks/useSMSTemplates.ts` | **Modify** | Add `bulkCreateTemplates` mutation for batch insert |

### New Component: ImportSMSTemplatesDialog

**Features:**
1. **File Upload**: Accept `.xlsx` files only
2. **Excel Parsing**: Use SheetJS (xlsx) library to parse Excel
3. **Duplicate Detection**: Check existing `dlt_template_id` values
4. **Preview Table**: Show all templates with status (ready/duplicate)
5. **Batch Import**: Insert all ready templates in one go
6. **Progress Indicator**: Show import progress
7. **Results Summary**: Success/duplicate/error counts

**Excel Parsing Logic:**
```typescript
// Expected columns from Fast2SMS export
const EXPECTED_COLUMNS = {
  templateId: 'TEMPLATE_ID',
  templateName: 'TEMPLATE_NAME', 
  templateContent: 'TEMPLATE_CONTENT',
  variableCount: 'VARIABLE_COUNT',
  header: 'HEADER',
};

// Auto-generate variables based on count
function generateVariables(count: number): SMSTemplateVariable[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `var${i + 1}`,
    label: `Variable ${i + 1}`,
  }));
}
```

### Hook Enhancement: useSMSTemplates

Add bulk creation:
```typescript
const bulkCreateMutation = useMutation({
  mutationFn: async (templates: CreateSMSTemplateInput[]) => {
    const { data, error } = await supabase
      .from('sms_templates')
      .insert(templates.map(t => ({
        organization_id: currentOrganization.id,
        dlt_template_id: t.dlt_template_id,
        name: t.name,
        content_preview: t.content_preview,
        variables: t.variables || [],
      })))
      .select();
    if (error) throw error;
    return data;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
    toast.success(`${data.length} SMS templates imported successfully`);
  },
});
```

### UI Changes in WorkshopNotificationSettings

Add import button in SMS Templates tab header:
```tsx
<div className="flex justify-between items-center">
  <p className="text-sm text-muted-foreground">
    Add pre-approved DLT templates from Fast2SMS.
  </p>
  <div className="flex gap-2">
    <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
      <Upload className="h-4 w-4 mr-2" />
      Bulk Import
    </Button>
    <Button onClick={() => openAddDialog()}>
      <Plus className="h-4 w-4 mr-2" />
      Add Template
    </Button>
  </div>
</div>
```

### Dependencies

Need to add the SheetJS library for Excel parsing:
- `xlsx` (SheetJS) - for parsing .xlsx files

---

## Implementation Steps

### Step 1: Add xlsx Dependency
Install SheetJS for Excel file parsing

### Step 2: Create ImportSMSTemplatesDialog Component
- Multi-step dialog (upload → preview → importing → complete)
- File input accepting .xlsx files
- Parse Excel using SheetJS
- Map columns to template fields
- Duplicate detection against existing templates
- Preview table with status indicators
- Batch import with progress

### Step 3: Enhance useSMSTemplates Hook
- Add `bulkCreateTemplates` mutation
- Handle batch insert with proper error handling

### Step 4: Integrate in Settings Page
- Add "Bulk Import" button
- Import and use the new dialog component
- Handle dialog state

---

## Template Data Mapping Example

**From Excel Row:**
| HEADER | TEMPLATE_ID | TEMPLATE_NAME | TEMPLATE_CONTENT | VARIABLE_COUNT |
|--------|-------------|---------------|------------------|----------------|
| NIKIST | 1207174541304380020 | We Are Live Explicit | Hi {#var#}, We're live with {#var#}... | 3 |

**To Database Record:**
```json
{
  "dlt_template_id": "1207174541304380020",
  "name": "We Are Live Explicit",
  "content_preview": "Hi {#var#}, We're live with {#var#}...",
  "variables": [
    {"key": "var1", "label": "Variable 1"},
    {"key": "var2", "label": "Variable 2"},
    {"key": "var3", "label": "Variable 3"}
  ]
}
```

---

## Edge Cases Handled

1. **Missing required columns**: Show error if TEMPLATE_ID, TEMPLATE_NAME, or TEMPLATE_CONTENT columns are missing
2. **Empty rows**: Skip rows with empty template IDs
3. **Duplicate templates**: Detect by `dlt_template_id`, show as "already exists", skip during import
4. **HTML in content**: The Excel has `<br/>` tags - we'll preserve them as-is for display
5. **Variable count = 0**: Create template with empty variables array
6. **Large files**: Show loading state during parsing

