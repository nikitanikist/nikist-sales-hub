

# Dynamic Links (URL Redirection System)

Replace Shivani's manual Hostinger workflow with an in-app link management system.

---

## Overview

Create a self-service Dynamic Links feature that lets your team:
1. Create permanent links like `app.tagfunnel.ai/link/whatsapp-group`
2. Change where these links point (WhatsApp group, external URL) anytime
3. Track how many people clicked each link

---

## User Flow

```text
1. Shivani goes to Operations → Dynamic Links
2. Clicks "Create Link"
3. Enters slug: "whatsapp-group" → Preview shows: yourapp.com/link/whatsapp-group
4. Chooses destination:
   - Option A: Paste any URL manually
   - Option B: Select WhatsApp Group from synced list → Auto-uses invite link
5. Saves link

When workshop changes:
1. Opens existing link
2. Clicks "Change Destination"
3. Selects new WhatsApp group
4. Saves → All users now redirected to new group
```

---

## Database Schema

### New Table: `dynamic_links`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Multi-tenant isolation |
| slug | text | URL path (e.g., "whatsapp-group") |
| destination_url | text | Where to redirect (manual URL) |
| whatsapp_group_id | uuid | FK to whatsapp_groups (optional) |
| click_count | integer | Total clicks (default 0) |
| is_active | boolean | Enable/disable link |
| created_by | uuid | Who created it |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last modified |

**Constraints:**
- Unique on (organization_id, slug) - prevents duplicate slugs per org
- Either destination_url OR whatsapp_group_id must be set (not both)

**RLS Policies:**
- SELECT: Users in organization can view
- INSERT/UPDATE: Admins and managers can manage
- DELETE: Admins only

---

## Architecture

### How Redirection Works

```text
User visits: nikist-sales-hub.lovable.app/link/whatsapp-group
                           ↓
       React Router catches /link/:slug route
                           ↓
       LinkRedirect page fetches destination from DB
                           ↓
       Increments click_count atomically
                           ↓
       Redirects browser to destination URL
```

**Note:** This works on your custom domain automatically once connected. The same code handles both `nikist-sales-hub.lovable.app/link/...` and `app.tagfunnel.ai/link/...`.

---

## UI Design

### Operations Menu Addition

```text
Operations
├── Workshop Notification
└── Dynamic Links  ← NEW
```

### Dynamic Links Page

```text
┌─ Dynamic Links ────────────────────────────────────────────┐
│                                                             │
│ Create shareable links that you can update anytime.        │
│ Perfect for WhatsApp group invites that change each        │
│ workshop.                                                   │
│                                                             │
│ [ + Create New Link ]                                       │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ /link/whatsapp-group                                    ││
│ │ → 🟢 WhatsApp: "Free Crypto Workshop - Jan 30"          ││
│ │                                                          ││
│ │ Clicks: 847  •  Created 2 days ago                      ││
│ │                        [Copy Link] [Edit] [Delete]       ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ /link/telegram                                          ││
│ │ → 🔗 https://t.me/nikistchannel                         ││
│ │                                                          ││
│ │ Clicks: 234  •  Created 1 week ago                      ││
│ │                        [Copy Link] [Edit] [Delete]       ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Create/Edit Link Dialog

```text
┌─ Create Dynamic Link ───────────────────────────────────┐
│                                                          │
│ Link Slug                                                │
│ ┌──────────────────────────────────────────────────────┐│
│ │ whatsapp-group                                       ││
│ └──────────────────────────────────────────────────────┘│
│ yourapp.com/link/whatsapp-group                          │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ Destination Type                                         │
│ ○ WhatsApp Group (select from synced groups)            │
│ ● Custom URL                                             │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐│
│ │ https://example.com/...                              ││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
│ OR                                                       │
│                                                          │
│ Select WhatsApp Group                                    │
│ ┌──────────────────────────────────────────────────────┐│
│ │ 🔍 Search groups...                                  ││
│ ├──────────────────────────────────────────────────────┤│
│ │ ⭐ Today's Workshop                                  ││
│ │   🟢 Free Crypto Workshop - Feb 1 (invite link ✓)   ││
│ ├──────────────────────────────────────────────────────┤│
│ │ All Groups                                           ││
│ │   🟢 Free Crypto Workshop - Jan 30 (invite link ✓)  ││
│ │   ⚪ Marketing Team (no invite link)                 ││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
│                              [Cancel] [Save Link]        │
└──────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/pages/operations/DynamicLinks.tsx` | Main page with link list |
| `src/pages/operations/LinkRedirect.tsx` | Redirect handler (public, no auth) |
| `src/components/operations/CreateLinkDialog.tsx` | Create/edit link form |
| `src/components/operations/LinkCard.tsx` | Individual link display |
| `src/hooks/useDynamicLinks.ts` | Data fetching and mutations |

### Modified Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/link/:slug` route (public) and `/operations/dynamic-links` route |
| `src/pages/operations/index.ts` | Export DynamicLinks component |
| `src/components/AppLayout.tsx` | Add "Dynamic Links" to Operations menu |

---

## Implementation Phases

### Phase 1: Database Setup
- Create `dynamic_links` table with RLS policies
- Add unique constraint on (organization_id, slug)

### Phase 2: Redirect Handler
- Create public `/link/:slug` route
- Fetch destination, increment click count, redirect
- Show "Link not found" page for invalid slugs

### Phase 3: Management UI
- Dynamic Links page under Operations
- Create/Edit dialog with WhatsApp group selection
- Copy link functionality
- Click count display

### Phase 4: Navigation
- Add to Operations submenu
- Add permissions check (admin/manager only for editing)

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Slug already exists | Show error "This slug is already in use" |
| WhatsApp group has no invite link | Disable selection, show "Fetch invite link first" |
| Link is disabled | Show "This link is currently inactive" page |
| Organization deleted | Links become orphaned (handled by cascade) |
| Invalid characters in slug | Validate: only lowercase letters, numbers, hyphens |

---

## Custom Domain Note

Once you connect `app.tagfunnel.ai` to your Lovable project (via Settings → Domains), all `/link/...` URLs will automatically work on both:
- `nikist-sales-hub.lovable.app/link/whatsapp-group`
- `app.tagfunnel.ai/link/whatsapp-group`

No code changes needed - React Router handles the paths regardless of domain.

