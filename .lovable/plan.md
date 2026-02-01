

# Enhanced WhatsApp Community Creation System

## Overview

This plan implements a comprehensive system for enriching WhatsApp group creation with profile pictures, descriptions, and automatic tag assignment. The system ties together tags, templates, and WhatsApp group creation settings.

---

## Current State Analysis

| Component | Current State |
|-----------|--------------|
| **Tags** | Exist with name, color, description, and linked sequence |
| **Workshops** | Have `tag_id` field but no auto-assignment |
| **WhatsApp Community Creation** | Creates groups with just name + generic description |
| **VPS Endpoints** | `POST /create-community` - doesn't support profile picture or custom description |

---

## Feature Breakdown

### Feature 1: Default Tag for New Workshops

**Goal**: When a workshop is created (manually or via webhook), automatically assign a "default" tag.

**Database Changes**:
```sql
ALTER TABLE workshop_tags 
ADD COLUMN is_default BOOLEAN DEFAULT FALSE;

-- Ensure only one tag can be default per organization
CREATE UNIQUE INDEX idx_workshop_tags_default_unique 
ON workshop_tags (organization_id) 
WHERE is_default = TRUE;
```

**UI Changes** (WorkshopNotificationSettings.tsx - Tags tab):
- Add a toggle/checkbox next to each tag: "Set as Default"
- Only one tag can be default at a time (selecting a new one removes the previous)
- Show a badge "Default" next to the default tag in the list

**Hook Changes** (useWorkshopTags.ts):
- Add `setDefaultTag(tagId)` mutation
- This mutation sets `is_default = true` for the selected tag and `is_default = false` for all others in the org

**Workshop Creation Changes**:
1. **Manual creation** (Workshops.tsx): When creating, auto-fetch and assign the default tag
2. **Auto-creation** (ingest-tagmango edge function): When creating a new workshop, query for the default tag and assign it

---

### Feature 2: WhatsApp Group Creation Templates (Community Templates)

**Goal**: Create templates that define how WhatsApp groups are created for workshops with specific tags.

**New Database Table**:
```sql
CREATE TABLE community_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES workshop_tags(id) ON DELETE CASCADE,
  profile_picture_url TEXT,  -- Stored in Supabase Storage
  description_template TEXT NOT NULL,  -- Can contain variables like {workshop_name}, {workshop_date}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, tag_id)  -- One template per tag per org
);
```

**Supported Template Variables**:
| Variable | Description |
|----------|-------------|
| `{workshop_name}` | Full workshop title |
| `{workshop_title}` | Title part before "<>" |
| `{workshop_date}` | Date part after "<>" (e.g., "1st February") |
| `{start_time}` | Formatted start time (e.g., "7:00 PM IST") |

**UI Changes** - New Section in WhatsApp Connection Settings:

```
┌─ Community Creation Templates ─────────────────────┐
│                                                     │
│ Define how WhatsApp groups are created for each    │
│ workshop tag.                                       │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Tag: [Evening Workshop ▾]                       │ │
│ │                                                 │ │
│ │ Profile Picture:                                │ │
│ │ [📷 Upload Image] [Preview]                    │ │
│ │                                                 │ │
│ │ Group Description:                              │ │
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │ Welcome to {workshop_title}!               │ │ │
│ │ │                                             │ │ │
│ │ │ 📅 {workshop_date}                         │ │ │
│ │ │ ⏰ {start_time}                            │ │ │
│ │ │                                             │ │ │
│ │ │ Stay tuned for updates!                    │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ │                                                 │ │
│ │ [Save Template]                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Existing Templates:                                 │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🏷 Evening Workshop  │ [📷] Description set    │ │
│ │ 🏷 Morning Class     │ [📷] Description set    │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Storage Bucket**:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('community-templates', 'community-templates', true);
```

---

### Feature 3: VPS Endpoint Updates

**Current VPS Create-Community**:
```json
POST /create-community
{
  "sessionId": "wa_xxx",
  "name": "Workshop Name",
  "description": "Community for Workshop Name",
  "settings": { "announcement": true, "restrict": true }
}
```

**Required VPS Enhancement** (needs VPS code update):
```json
POST /create-community
{
  "sessionId": "wa_xxx",
  "name": "Workshop Name",
  "description": "Welcome to Crypto Masterclass! 📅 1st Feb ⏰ 7 PM",
  "profilePictureUrl": "https://storage.example.com/template.jpg",  // NEW
  "settings": { "announcement": true, "restrict": true }
}
```

The VPS would need to:
1. Accept `profilePictureUrl`
2. Download the image
3. Use Baileys' `updateProfilePicture()` method after group creation

**Note**: If VPS doesn't support profile pictures yet, we can phase this feature.

---

### Feature 4: Link Sending Session to Workshop

**Problem**: When WhatsApp messages are sent, the UI doesn't track which phone number sends them.

**Current State**:
- `workshops.whatsapp_session_id` field exists but may not be used
- Messages are sent via `scheduled_whatsapp_messages` but the sending session might not be tracked

**Solution**:
1. When scheduling messages for a workshop, store the `session_id` being used
2. Display the sending phone number in the Workshop Detail Sheet

**UI Enhancement** (WorkshopDetailSheet.tsx):
```
┌─ WhatsApp Settings ──────────────────────────────┐
│ 📱 Sending from: +91 98765 43210                 │  ← NEW
│ 👥 3 Groups Linked                               │
│                                                   │
│ [Select Groups ▾]                                │
└──────────────────────────────────────────────────┘
```

---

### Feature 5: Auto-Apply Template When Creating Community

**Flow**: When `create-whatsapp-community` edge function runs:

1. Get workshop details (including `tag_id`)
2. If workshop has a tag, look up `community_templates` for that tag
3. If template exists:
   - Parse description template and replace variables
   - Pass `description` and `profilePictureUrl` to VPS
4. If no template, use default description

**Edge Function Changes** (create-whatsapp-community/index.ts):
```typescript
// Step: Look up community template for this workshop's tag
if (workshop.tag_id) {
  const { data: template } = await supabase
    .from('community_templates')
    .select('*')
    .eq('tag_id', workshop.tag_id)
    .single();
  
  if (template) {
    // Parse description with variables
    description = parseTemplateVariables(template.description_template, {
      workshop_name: workshopName,
      workshop_title: workshopTitle,
      workshop_date: workshopDate,
      start_time: startTime,
    });
    profilePictureUrl = template.profile_picture_url;
  }
}
```

---

## Implementation Phases

### Phase 1: Default Tag System
| Task | File |
|------|------|
| Add `is_default` column to `workshop_tags` | SQL Migration |
| Update `useWorkshopTags.ts` with `setDefaultTag` | Hook |
| Add toggle in Tags tab UI | WorkshopNotificationSettings.tsx |
| Auto-assign default tag on manual workshop creation | Workshops.tsx |
| Auto-assign default tag on webhook workshop creation | ingest-tagmango/index.ts |

### Phase 2: Community Templates
| Task | File |
|------|------|
| Create `community_templates` table | SQL Migration |
| Create storage bucket `community-templates` | SQL Migration |
| Create `useCommunityTemplates.ts` hook | New Hook |
| Create Community Templates UI section | WhatsAppConnection.tsx or new component |
| Upload profile picture functionality | UI Component |

### Phase 3: Enhanced Community Creation
| Task | File |
|------|------|
| Update `create-whatsapp-community` to use templates | Edge Function |
| Update `vps-whatsapp-proxy` to pass profilePictureUrl | Edge Function |
| **VPS Update Required**: Add profile picture support | VPS Server Code |

### Phase 4: Sending Session Display
| Task | File |
|------|------|
| Ensure `whatsapp_session_id` is set when scheduling | RunMessagingButton.tsx |
| Display sending number in WorkshopDetailSheet | WorkshopDetailSheet.tsx |

---

## Database Migration Summary

```sql
-- Migration 1: Default tag feature
ALTER TABLE workshop_tags 
ADD COLUMN is_default BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX idx_workshop_tags_default_unique 
ON workshop_tags (organization_id) 
WHERE is_default = TRUE;

-- Migration 2: Community templates
CREATE TABLE community_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES workshop_tags(id) ON DELETE CASCADE,
  profile_picture_url TEXT,
  description_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, tag_id)
);

-- RLS Policies
ALTER TABLE community_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates in their org" ON community_templates
  FOR SELECT USING (
    organization_id = ANY(get_user_organization_ids()) 
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can manage templates in their org" ON community_templates
  FOR ALL USING (
    (organization_id = ANY(get_user_organization_ids()) 
     AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
    OR is_super_admin(auth.uid())
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('community-templates', 'community-templates', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload to community-templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'community-templates');

CREATE POLICY "Anyone can view community-templates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'community-templates');
```

---

## Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| **Modify** | `src/hooks/useWorkshopTags.ts` | Add `setDefaultTag` mutation |
| **Create** | `src/hooks/useCommunityTemplates.ts` | CRUD for community templates |
| **Modify** | `src/pages/settings/WorkshopNotificationSettings.tsx` | Add default tag toggle in Tags tab |
| **Modify** | `src/pages/settings/WhatsAppConnection.tsx` | Add Community Templates section |
| **Create** | `src/components/settings/CommunityTemplateEditor.tsx` | Template editor with image upload |
| **Modify** | `src/pages/Workshops.tsx` | Auto-assign default tag on create |
| **Modify** | `supabase/functions/ingest-tagmango/index.ts` | Auto-assign default tag on webhook create |
| **Modify** | `supabase/functions/create-whatsapp-community/index.ts` | Use template for description/image |
| **Modify** | `supabase/functions/vps-whatsapp-proxy/index.ts` | Pass profilePictureUrl to VPS |
| **Modify** | `src/components/operations/WorkshopDetailSheet.tsx` | Show sending phone number |

---

## VPS Dependency

**Important**: The profile picture feature requires VPS modifications:

1. Accept `profilePictureUrl` in POST /create-community
2. After creating the group, download the image
3. Use Baileys' `sock.updateProfilePicture(groupJid, imageBuffer)` to set the picture

If VPS changes are not immediately feasible, we can:
- Implement everything else first
- Show a "Profile Picture" field that's stored but not yet applied
- Add VPS support later

---

## User Experience Flow

### Creating a New Workshop (Manual)
```
1. User clicks "New Workshop"
2. Fills in workshop details
3. System automatically assigns default tag (if one exists)
4. Workshop created → Community creation triggered
5. Community template for that tag is applied
   → Group gets custom description
   → Group gets profile picture (if VPS supports it)
6. Group is linked to workshop
```

### Creating a New Workshop (Webhook)
```
1. Lead comes in via Pabbly/TagMango webhook
2. Workshop doesn't exist → Auto-created
3. Default tag is auto-assigned
4. Community creation is triggered
5. Template is applied (description + profile picture)
6. Lead is assigned to workshop
```

---

## Summary

This plan implements a complete pipeline from tag configuration to enhanced WhatsApp group creation:

1. **Tags get a "default" option** → Auto-applied to new workshops
2. **Community Templates** → Define profile picture + description per tag
3. **Enhanced group creation** → Uses templates for rich groups
4. **Session tracking** → Shows which number sends messages

The system is modular and can be implemented in phases, with the VPS profile picture support being optional for the initial release.

