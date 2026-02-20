

# Build Webinar Notification Feature

## Overview

A new **Webinar** module that mirrors the existing Workshop Notification system but operates independently. Webinars have their own database table, sidebar menu, creation flow, and notification pipeline. When a webinar is created, a WhatsApp community is automatically created and linked to it. Users can then send notification sequences to that community.

---

## 1. Database Changes

### New Table: `webinars`

| Column | Type | Default | Notes |
|---|---|---|---|
| id | UUID | gen_random_uuid() | Primary key |
| title | TEXT | NOT NULL | Webinar name |
| description | TEXT | nullable | Optional description |
| start_date | TIMESTAMPTZ | NOT NULL | Start date and time |
| end_date | TIMESTAMPTZ | NOT NULL | End date and time |
| tag_id | UUID | nullable | FK to workshop_tags |
| organization_id | UUID | NOT NULL | FK to organizations |
| created_by | UUID | NOT NULL | FK to auth.users |
| whatsapp_group_id | UUID | nullable | Legacy single group link |
| whatsapp_session_id | UUID | nullable | Selected WhatsApp session |
| community_group_id | UUID | nullable | Auto-created community |
| automation_status | JSONB | `{"whatsapp_group_linked": false, "messages_scheduled": false}` | Tracks setup progress |
| status | TEXT | 'planned' | planned/confirmed/completed/cancelled |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

### New Table: `webinar_whatsapp_groups` (junction)

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| webinar_id | UUID | FK to webinars |
| group_id | UUID | FK to whatsapp_groups |
| created_at | TIMESTAMPTZ | |

### New Table: `scheduled_webinar_messages`

Same schema as `scheduled_whatsapp_messages` but with `webinar_id` instead of `workshop_id`:

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| group_id | UUID | FK to whatsapp_groups |
| webinar_id | UUID | FK to webinars |
| message_type | TEXT | Step label |
| message_content | TEXT | Processed content |
| media_url | TEXT | nullable |
| media_type | TEXT | nullable |
| scheduled_for | TIMESTAMPTZ | When to send |
| status | TEXT | pending/sending/sent/failed/cancelled |
| sent_at | TIMESTAMPTZ | nullable |
| error_message | TEXT | nullable |
| retry_count | INT | default 0 |
| created_by | UUID | nullable |
| created_at | TIMESTAMPTZ | |

### New Table: `webinar_sequence_variables`

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| webinar_id | UUID | FK to webinars |
| variable_key | TEXT | Variable name |
| variable_value | TEXT | Value |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### RLS Policies

All four tables will have RLS enabled with org-based isolation policies (select/insert/update/delete restricted to users belonging to the same organization), following the same pattern used for workshop tables.

### Realtime

Enable realtime on `scheduled_webinar_messages` for live checkpoint tracking.

### Triggers

- `update_updated_at_column` trigger on `webinars` and `webinar_sequence_variables`

---

## 2. Auto Community Creation on Webinar Create

When a webinar is created with a tag:

1. The frontend calls the existing `create-whatsapp-community` edge function (or a new `create-webinar-community` variant) passing the webinar ID, name, and org ID
2. The edge function:
   - Looks up the tag's community template
   - Gets the org's community session and admin numbers
   - Calls VPS `/create-community` with announcement-only settings (no General chat)
   - Inserts the group into `whatsapp_groups`
   - Links it via `webinar_whatsapp_groups`
   - Updates `webinars.community_group_id`

A new edge function `create-webinar-community` will be created, closely mirroring `create-whatsapp-community` but referencing the `webinars` table instead of `workshops`.

---

## 3. Message Processing

A new edge function `process-webinar-queue` will be created, mirroring `process-whatsapp-queue` but reading from `scheduled_webinar_messages`. It will be triggered by a cron job every minute.

### Migration for Cron Job

```text
SELECT cron.schedule(
  'process-webinar-queue',
  '* * * * *',
  $$SELECT net.http_post(
    url := '...',
    ...
  )$$
);
```

---

## 4. Sidebar and Routing

### Sidebar Changes (`AppLayout.tsx`)

Add a new top-level collapsible menu item "Webinar" with one child:

```text
{
  title: "Webinar",
  icon: Video (from lucide-react),
  children: [
    { title: "Webinar Notification", path: "/webinar/notification", permissionKey: 'webinar' }
  ]
}
```

### Permission Changes (`permissions.ts`)

- Add `webinar` to `PERMISSION_KEYS`
- Add route mapping: `/webinar/notification` -> `webinar`
- Add to `PERMISSION_LABELS`: `'Webinar Notification'`
- Add to `PERMISSION_GROUPS` under a new "Webinar" group
- Add to `DEFAULT_PERMISSIONS` for admin and manager roles

### Route Changes (`App.tsx`)

```text
<Route path="/webinar/notification" element={<ProtectedRoute><ErrorBoundary><WebinarNotification /></ErrorBoundary></ProtectedRoute>} />
```

---

## 5. Frontend Pages and Components

### New Files

| File | Purpose |
|---|---|
| `src/pages/webinar/WebinarNotification.tsx` | Main page with table of webinars and Create Webinar button |
| `src/pages/webinar/index.ts` | Re-exports |
| `src/hooks/useWebinarNotification.ts` | Data fetching, CRUD, messaging, community creation -- mirrors useWorkshopNotification |

### WebinarNotification Page

- **Create Webinar Dialog**: A popup with fields for:
  - Webinar Name (text input)
  - Start Date & Time (datetime-local input, timezone-aware)
  - End Date & Time (datetime-local input, timezone-aware)
  - Tag (select from existing workshop_tags)
  - On submit: creates the webinar record, then automatically triggers community creation in the background

- **Webinar Table**: Lists all webinars with columns:
  - Date (start date/time)
  - Webinar Name
  - Tag
  - Status (Assign Tag / Select Account / Select Groups / Run Sequence / Ready)
  - Actions (Send WhatsApp Notification button, View details, Delete)

- **Webinar Detail Sheet**: A slide-out panel (reusing the same collapsible section pattern from WorkshopDetailSheet) with:
  - Overview section (date, community link)
  - Tag section (select/change tag)
  - WhatsApp Settings (select account, select groups)
  - Run Sequence button (with variable injection dialog)
  - Message Checkpoints (real-time delivery tracking)

- **Analytics on messages**: After sending, the detail sheet shows:
  - Total messages sent
  - Delivered count
  - Read count (not yet read = delivered minus read)
  - Reactions count
  - Sent timestamp
  - Real-time updates via Supabase Realtime subscription

### Reused Components

The following existing components will be reused directly (they are generic enough):
- `WorkshopTagBadge` (rename references to just "TagBadge" conceptually but reuse as-is)
- `MessageCheckpoints` / `toCheckpoints`
- `MessagingActions`
- `SendMessageNowDialog`
- `MultiGroupSelect`
- `CollapsibleSection`
- `SequenceVariablesDialog`
- `MessagingProgressBanner`
- `SequenceProgressButton`
- `ConfirmDeleteDialog`

---

## 6. Hook: `useWebinarNotification`

This hook mirrors `useWorkshopNotification` with the following changes:
- Queries `webinars` table instead of `workshops`
- Creates scheduled messages in `scheduled_webinar_messages`
- Links groups via `webinar_whatsapp_groups`
- Calls `create-webinar-community` edge function
- Subscribes to realtime on `scheduled_webinar_messages`

Standalone hooks:
- `useWebinarMessages(webinarId)` -- queries `scheduled_webinar_messages`
- `useWebinarGroups(webinarId)` -- queries `webinar_whatsapp_groups`

---

## 7. Edge Functions

### `create-webinar-community/index.ts`

Nearly identical to `create-whatsapp-community` but:
- Reads from `webinars` table instead of `workshops`
- Links via `webinar_whatsapp_groups` instead of `workshop_whatsapp_groups`
- Updates `webinars.community_group_id`

### `process-webinar-queue/index.ts`

Nearly identical to `process-whatsapp-queue` but:
- Reads from `scheduled_webinar_messages` instead of `scheduled_whatsapp_messages`

---

## Technical Details

### Files to Create

| File | Description |
|---|---|
| `src/pages/webinar/WebinarNotification.tsx` | Main webinar notification page |
| `src/pages/webinar/index.ts` | Exports |
| `src/hooks/useWebinarNotification.ts` | All webinar data fetching and mutations |
| `supabase/functions/create-webinar-community/index.ts` | Auto community creation for webinars |
| `supabase/functions/process-webinar-queue/index.ts` | Cron-driven message processor |
| Migration file | Tables, RLS, triggers, realtime, cron |

### Files to Modify

| File | Changes |
|---|---|
| `src/components/AppLayout.tsx` | Add "Webinar" menu item with "Webinar Notification" child |
| `src/lib/permissions.ts` | Add `webinar` permission key, route mapping, labels, groups, defaults |
| `src/App.tsx` | Add `/webinar/notification` route |
| `supabase/config.toml` | Add `[functions.create-webinar-community]` and `[functions.process-webinar-queue]` with `verify_jwt = false` |

### Community Creation Behavior

When a webinar is created:
1. The webinar row is inserted into `webinars`
2. If a tag is selected and the org has a community session configured, the `create-webinar-community` edge function is called asynchronously (fire-and-forget, matching the "best-effort" pattern used for workshops)
3. The community is created with **announcement-only** settings and **no General chat** (matching the existing community creation logic that stores the announcement group JID)
4. The community is automatically linked to the webinar

### Sequence/Notification Flow

1. User clicks "Send WhatsApp Notification" on a webinar
2. Detail sheet opens showing tag, WhatsApp account, and linked groups
3. User clicks "Run Sequence" -- the tag's template sequence is used
4. Messages are scheduled into `scheduled_webinar_messages` with proper timezone handling
5. `process-webinar-queue` cron picks them up and sends via VPS
6. Real-time checkpoints show delivery progress
7. Read receipts and reactions update via existing webhook infrastructure (webhooks will need a minor update to also check `scheduled_webinar_messages` for matching message tracking)

