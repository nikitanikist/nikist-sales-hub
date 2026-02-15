

# Enhance Create Community Dialog: Profile Picture + Better Labels

## Changes

### 1. Add Profile Picture Upload (`CreateGroupDialog.tsx`)

- Add a file input for uploading a community profile picture
- Upload to the existing `community-templates` storage bucket (already public with RLS policies)
- When a template is selected, auto-fill the profile picture from the template's `profile_picture_url`
- Show a circular preview with a remove button (same pattern used in `CommunityTemplateEditor.tsx`)
- Pass the `profilePictureUrl` to the edge function

### 2. Improve Setting Labels (`CreateGroupDialog.tsx`)

Add descriptive subtitles under each toggle:
- **Announcement only**: "Only admins can send messages in the group"
- **Restrict settings**: "Only admins can edit community name, icon, and description"

### 3. Pass Profile Picture to VPS (`vps-whatsapp-proxy/index.ts`)

- Accept a `profilePictureUrl` field in the `create-community-standalone` action
- Forward it to the VPS `/create-community` endpoint so the community is created with the profile picture set

## Files Modified

| File | Change |
|------|--------|
| `src/components/whatsapp/CreateGroupDialog.tsx` | Add image upload input, preview, auto-fill from template, descriptive toggle subtitles |
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Accept and forward `profilePictureUrl` in `create-community-standalone` action |

## No Database Changes Required
The `community-templates` storage bucket already exists and is public.
