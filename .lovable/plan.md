

# Workshop Tag Assignment Integration Plan

## Overview

This plan adds tag assignment functionality to the All Workshops section and ensures the Workshop Notification page displays all workshops correctly.

---

## Changes Summary

### 1. Add Tag Selection to Workshop Add/Edit Dialog

**File to modify:** `src/pages/Workshops.tsx`

Add a new dropdown field for tag selection in the workshop form, allowing users to:
- Assign a tag when **creating** a new workshop (optional)
- Assign or change a tag when **editing** an existing workshop

**Implementation details:**

1. Import the `useWorkshopTags` hook to fetch available tags
2. Add a new state variable for selected tag
3. Add a Tag dropdown field in the form (between Status and Related Lead fields)
4. Include `tag_id` in the form submission data
5. Update both create and update mutations to include the tag

**Form field placement:**
```
Title | Description | Start Date | End Date | Location | Max Participants | 
Ad Spend | Amount | Funnel | Product | Status | Tag (NEW) | Related Lead
```

**UI Preview:**
```
+-----------------------------------------------+
|  Tag (Optional)                               |
|  [Select a tag...                         v]  |
|  +-------------------------------------------+
|  |  [•] Evening Workshop                     |
|  |  [•] Morning Webinar                      |
|  |  [•] Special Event                        |
|  +-------------------------------------------+
+-----------------------------------------------+
```

---

### 2. Verify Workshop Notification Page Data Fetching

The current implementation in `useWorkshopNotification.ts` correctly fetches all workshops for the organization. The query at line 64-72 fetches workshops with their tags and groups joined.

**If workshops still don't appear**, it may be due to:
- Different organization context between pages
- The workshops query returns empty if `workshopIds.length === 0` at line 78

**Fix:** Move the empty check to after the return statement to ensure all workshops are returned even if registration counting fails.

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Workshops.tsx` | Add tag dropdown to Add/Edit dialog, include tag_id in form submission |

### Code Changes in Workshops.tsx

1. **Add import:**
```typescript
import { useWorkshopTags } from '@/hooks/useWorkshopTags';
```

2. **Add hook call:**
```typescript
const { tags, tagsLoading } = useWorkshopTags();
```

3. **Add state for selected tag:**
```typescript
const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
```

4. **Sync tag state when editing:**
```typescript
useEffect(() => {
  setSelectedTagId(editingWorkshop?.tag_id || null);
}, [editingWorkshop]);
```

5. **Update handleSubmit to include tag_id:**
```typescript
const data = {
  // ... existing fields
  tag_id: selectedTagId === "none" ? null : selectedTagId,
};
```

6. **Add Tag dropdown in form (after Status field):**
```tsx
<div className="space-y-2">
  <Label htmlFor="tag_id">Tag (Optional)</Label>
  <Select 
    name="tag_id" 
    value={selectedTagId ?? "none"}
    onValueChange={(value) => setSelectedTagId(value === "none" ? null : value)}
    disabled={tagsLoading}
  >
    <SelectTrigger>
      <SelectValue placeholder={tagsLoading ? "Loading..." : "Select a tag"} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">None</SelectItem>
      {tags && tags.length > 0 ? (
        tags.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            <div className="flex items-center gap-2">
              <span 
                className="h-2 w-2 rounded-full" 
                style={{ backgroundColor: tag.color || '#8B5CF6' }} 
              />
              {tag.name}
            </div>
          </SelectItem>
        ))
      ) : (
        <div className="py-3 px-2 text-center text-sm text-muted-foreground">
          No tags available. Create tags in Settings → Notifications.
        </div>
      )}
    </SelectContent>
  </Select>
</div>
```

---

## User Flow After Implementation

### Creating a New Workshop with Tag
1. User clicks "Add Workshop" button
2. User fills in workshop details
3. User optionally selects a tag from dropdown (shows color indicator)
4. User clicks "Create Workshop"
5. Workshop is created with the assigned tag

### Editing Existing Workshop to Add Tag
1. User clicks edit (pencil) icon on a workshop row
2. Dialog opens with current workshop data (including current tag if any)
3. User selects/changes tag from dropdown
4. User clicks "Update Workshop"
5. Tag is saved to the workshop

### Viewing in Workshop Notification Page
1. User navigates to Operations → Workshop Notification
2. All workshops appear in the table with:
   - Date
   - Workshop Name
   - Tag (color-coded badge or "—" if none)
   - Registrations count
   - Automation Status
   - View button
3. User clicks "View" to open the detail sheet with full notification controls

---

## Testing Checklist

- [ ] Tag dropdown appears in Add Workshop dialog
- [ ] Tag dropdown appears in Edit Workshop dialog
- [ ] Tags load from the database with correct colors
- [ ] Selecting a tag and creating workshop saves correctly
- [ ] Editing workshop to add/change tag works
- [ ] Workshop Notification page shows all workshops
- [ ] Tags display with correct colors in both pages
- [ ] "None" option clears the tag assignment

---

## Estimated Effort

| Task | Time |
|------|------|
| Add tag dropdown to Workshops.tsx | 30 min |
| Test create/edit functionality | 15 min |
| Verify Workshop Notification displays | 10 min |
| **Total** | **~1 hour** |

