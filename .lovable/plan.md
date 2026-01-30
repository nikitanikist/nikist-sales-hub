

# Workshop Notification Operations System - Implementation Plan

## Overview

This plan implements the Workshop Notification Operations UI, enabling admins to configure message templates, create template sequences with dynamic times, organize workshops using tags, and schedule automated WhatsApp group messages.

---

## Database Changes

### New Tables Required

Three new tables need to be created:

**1. `workshop_tags`** - Categorize workshops and link to template sequences

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| name | TEXT | Tag name (e.g., "Evening Workshop") |
| color | TEXT | Hex color for UI badge |
| description | TEXT | Optional description |
| template_sequence_id | UUID | FK to template_sequences |
| created_at | TIMESTAMPTZ | Auto-generated |
| updated_at | TIMESTAMPTZ | Auto-generated |

**2. `template_sequences`** - Named collections of templates with scheduled times

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| name | TEXT | Sequence name (e.g., "Evening Notification Sequence") |
| description | TEXT | Optional description |
| created_at | TIMESTAMPTZ | Auto-generated |
| updated_at | TIMESTAMPTZ | Auto-generated |

**3. `template_sequence_steps`** - Individual steps within a sequence

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| sequence_id | UUID | FK to template_sequences |
| template_id | UUID | FK to whatsapp_message_templates |
| send_time | TIME | Admin-configurable time (e.g., "11:00:00") |
| time_label | TEXT | Friendly label (e.g., "Morning Reminder") |
| step_order | INTEGER | Order within sequence |
| created_at | TIMESTAMPTZ | Auto-generated |

**4. Columns to add to `workshops` table**

| Column | Type | Notes |
|--------|------|-------|
| tag_id | UUID | FK to workshop_tags |
| whatsapp_session_id | UUID | FK to whatsapp_sessions (which WA account to use) |

**Note:** The `whatsapp_group_id` and `automation_status` columns already exist on the workshops table.

---

## Architecture Flow

```text
+---------------------+
|   Workshop Tags     |
|  "Evening Workshop" |
|         |           |
|    sequence_id -----|------+
+---------------------+      |
                             v
+---------------------+    +-------------------------+
|     Workshops       |    |  Template Sequences     |
|                     |    | "Evening Notification"  |
|    tag_id ----------|--->|                         |
|                     |    +-------------------------+
|  whatsapp_session_id|              |
|         |           |              v
+---------|-----------+    +-------------------------+
          |                |   Sequence Steps        |
          v                |  11:00 AM -> Template 1 |
+---------------------+    |  01:00 PM -> Template 2 |
|  WhatsApp Sessions  |    |  06:00 PM -> Template 3 |
| (Multiple accounts) |    |  06:55 PM -> Template 4 |
+---------------------+    +-------------------------+
```

---

## Files to Create

### Pages

| File | Purpose |
|------|---------|
| `src/pages/operations/WorkshopNotification.tsx` | Main table page showing workshops with date, name, tag, registrations |
| `src/pages/operations/index.ts` | Barrel export |
| `src/pages/settings/WorkshopNotificationSettings.tsx` | Settings page with 3 tabs: Templates, Sequences, Tags |

### Components

| File | Purpose |
|------|---------|
| `src/components/operations/WorkshopDetailSheet.tsx` | Slide-over panel with tag selector, WA account/group, checkpoints |
| `src/components/operations/WorkshopTagBadge.tsx` | Color-coded tag badge component |
| `src/components/operations/MessageCheckpoints.tsx` | Real-time checkbox list with status (Sent/Pending/Failed) |
| `src/components/operations/RunMessagingButton.tsx` | Action button to schedule all messages |
| `src/components/settings/TemplateEditor.tsx` | Dialog to create/edit message templates with media upload |
| `src/components/settings/SequenceEditor.tsx` | Dialog to create/edit sequences with time pickers |
| `src/components/settings/TagEditor.tsx` | Dialog to create/edit tags with color picker and sequence assignment |

### Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useWorkshopTags.ts` | CRUD operations for workshop tags |
| `src/hooks/useTemplateSequences.ts` | CRUD operations for template sequences and steps |
| `src/hooks/useWorkshopNotification.ts` | Business logic for scheduling messages + real-time subscription |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AppLayout.tsx` | Add "Operations" collapsible menu with "Workshop Notification" submenu |
| `src/App.tsx` | Add routes for `/operations/workshop-notification` and settings tab |
| `src/pages/OrganizationSettings.tsx` | Add "Notifications" tab linking to workshop notification settings |

---

## Implementation Details

### 1. Sidebar Navigation (AppLayout.tsx)

Add new collapsible menu item after "All Workshops":

```typescript
{
  title: "Operations",
  icon: Activity,
  children: [
    { title: "Workshop Notification", path: "/operations/workshop-notification", permissionKey: 'workshops' as PermissionKey },
  ],
  moduleSlug: 'workshops'
},
```

### 2. Workshop Notification Page

**Table Columns:**
- Date (formatted from `workshops.start_date`)
- Workshop Name (`workshops.title`)
- Tag (color-coded badge from `workshop_tags` via `tag_id`)
- Registrations (count from `lead_assignments`)
- Action (View button opens sheet)

**Features:**
- Search by workshop name
- Filter by tag
- Sorted by date descending (newest first)

### 3. Workshop Detail Sheet

**Sections:**

1. **Overview** - Registration count, workshop date/time
2. **Workshop Tag** - Dropdown to select/change tag, shows linked sequence name
3. **WhatsApp Settings**:
   - Account dropdown (lists all connected sessions)
   - Group dropdown (lists groups from selected account)
4. **Message Checkpoints** - Real-time list showing:
   - Checkbox icon (filled if sent)
   - Time (e.g., "11:00 AM")
   - Template name (e.g., "Morning Reminder")
   - Status badge (Sent/Pending/Scheduled/Failed)
5. **Run the Messaging** button - Schedules all messages from tag's sequence

### 4. Real-Time Checkpoints

Subscribe to `scheduled_whatsapp_messages` table changes:

```typescript
supabase
  .channel('checkpoints-realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'scheduled_whatsapp_messages',
    filter: `workshop_id=eq.${workshopId}`
  }, () => {
    queryClient.invalidateQueries({ queryKey: ['workshop-messages', workshopId] });
  })
  .subscribe();
```

### 5. Run the Messaging Logic

When user clicks "Run the Messaging":

1. Validate group is linked (error if not)
2. Validate tag is assigned (error if no sequence)
3. Get sequence steps from tag's template_sequence_id
4. For each step:
   - Calculate scheduled time: `workshopDate + step.send_time`
   - Skip if time is in the past
   - Check if already scheduled (avoid duplicates)
   - Insert into `scheduled_whatsapp_messages`
5. Show success toast with count
6. Update `workshops.automation_status` JSONB

### 6. Settings: Templates Tab

- Table showing all templates with name, preview, actions
- Create/Edit dialog with:
  - Template name input
  - Rich textarea for content
  - Variable hints: `{workshop_name}`, `{date}`, `{time}`, `{zoom_link}`
  - Optional media upload field

### 7. Settings: Sequences Tab

- List of sequences with name and step count
- Create/Edit dialog with:
  - Sequence name input
  - Sortable list of steps, each with:
    - Time picker (any time from 00:00-23:59)
    - Template dropdown
    - Label input (optional)
    - Remove button
  - Add step button

### 8. Settings: Tags Tab

- List of tags with name, color badge, linked sequence
- Create/Edit dialog with:
  - Tag name input
  - Color picker (preset colors: Purple, Blue, Green, Yellow, Orange, Red)
  - Template sequence dropdown
  - Description input (optional)

---

## RLS Policies for New Tables

All new tables will follow the existing organization-scoped pattern:

```sql
-- SELECT: Users in org can view
CREATE POLICY "Users can view tags in their organization"
ON workshop_tags FOR SELECT
USING (organization_id = ANY (get_user_organization_ids()) OR is_super_admin(auth.uid()));

-- INSERT: Admins and managers can create
CREATE POLICY "Admins can create tags"
ON workshop_tags FOR INSERT
WITH CHECK ((organization_id = ANY (get_user_organization_ids()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

-- UPDATE/DELETE: Same as INSERT
```

Similar policies for `template_sequences` and `template_sequence_steps`.

---

## Migration Order

1. Create `template_sequences` table (no dependencies)
2. Create `template_sequence_steps` table (depends on template_sequences + whatsapp_message_templates)
3. Create `workshop_tags` table (depends on template_sequences)
4. Add `tag_id` and `whatsapp_session_id` columns to `workshops`
5. Add indexes for performance
6. Add RLS policies to all new tables
7. Enable realtime for `scheduled_whatsapp_messages` (if not already enabled)

---

## Testing Checklist

**Workshop Notification Page:**
- [ ] Table displays all workshops with correct data
- [ ] Tag badge shows with correct color
- [ ] View button opens detail sheet
- [ ] Search filters correctly

**Workshop Detail Sheet:**
- [ ] Tag dropdown shows all org tags
- [ ] Changing tag updates sequence display
- [ ] WhatsApp account dropdown shows all connected sessions
- [ ] Group dropdown shows groups from selected account
- [ ] Checkpoints show real-time status updates

**Run the Messaging:**
- [ ] Error shown if no group linked
- [ ] Error shown if no tag assigned
- [ ] Creates correct scheduled messages
- [ ] Skips past times
- [ ] Doesn't create duplicates
- [ ] Updates automation_status

**Settings: Templates:**
- [ ] Can create, edit, delete templates
- [ ] Content saves correctly

**Settings: Sequences:**
- [ ] Can create sequences with multiple steps
- [ ] Time picker allows any time
- [ ] Steps can be reordered

**Settings: Tags:**
- [ ] Can create tags with colors
- [ ] Can link sequence to tag
- [ ] Color shows correctly in badge

---

## Estimated Effort by Component

| Component | Estimate |
|-----------|----------|
| Database migrations (3 tables + columns) | 0.5 day |
| Hooks (3 new hooks) | 1 day |
| Sidebar navigation update | 0.5 day |
| Workshop Notification page + table | 1 day |
| Workshop Detail Sheet | 1.5 days |
| Real-time checkpoints | 0.5 day |
| Run the Messaging logic | 1 day |
| Settings: Template Editor | 1 day |
| Settings: Sequence Editor | 1.5 days |
| Settings: Tag Editor | 0.5 day |
| Integration into OrganizationSettings | 0.5 day |
| Testing and polish | 1.5 days |
| **Total** | **~11 days** |

