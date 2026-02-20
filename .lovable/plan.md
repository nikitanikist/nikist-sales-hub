
# Webinar Improvements: Community Creation, Table Enhancements, Invite Link

## What Changes

1. **Community creation uses the same standalone method as the WhatsApp Dashboard** -- switching from the current `create-webinar-community` edge function (which calls VPS directly) to using the `vps-whatsapp-proxy` edge function with the `create-community-standalone` action. This ensures no General group is created, and `announcement` + `restrict` settings are applied. The `create-webinar-community` edge function will be refactored to call `vps-whatsapp-proxy` internally, or the frontend will call `vps-whatsapp-proxy` directly and then link the group to the webinar.

2. **Table shows additional columns**: WhatsApp Community name (linked group), member count, and a copy invite link button.

3. **Invite link stored and displayed** -- the community invite link is already stored in `whatsapp_groups.invite_link` during creation. The table will display a copy button for it.

4. **Member count fetched and displayed** -- the `participant_count` from `whatsapp_groups` is shown in the table. It is already updated during sync and community creation.

---

## Technical Plan

### 1. Refactor `create-webinar-community` Edge Function

Update `supabase/functions/create-webinar-community/index.ts` to use the `vps-whatsapp-proxy` `create-community-standalone` action instead of calling VPS directly. This ensures:
- `announcement: true` and `restrict: true` settings are passed (no General group)
- Profile picture and description template variables are still resolved
- The announcement group JID is stored (not the community parent)
- Invite link and participant count are stored in `whatsapp_groups`

The refactored flow:
1. Look up webinar, org, tag, and community template (same as now)
2. Call `vps-whatsapp-proxy` with `action: 'create-community-standalone'` passing `announcement: true`, `restrict: true`, `name`, `description`, `profilePictureUrl`, `organizationId`, `sessionId`
3. The proxy already inserts the group into `whatsapp_groups` with `invite_link` and fetches participant count
4. After the proxy returns, link the group to the webinar via `webinar_whatsapp_groups` and update `webinars.community_group_id`

### 2. Update `WebinarWithDetails` Type and Query

In `src/hooks/useWebinarNotification.ts`:
- Expand the `WebinarWithDetails` interface to include community group details (group name, participant count, invite link)
- Update the Supabase query to join `whatsapp_groups` via `community_group_id` to fetch `group_name`, `participant_count`, and `invite_link`

### 3. Update Webinar Table UI

In `src/pages/webinar/WebinarNotification.tsx`:
- Add new table columns:
  - **WhatsApp Community**: shows the linked community name (from `whatsapp_groups.group_name`)
  - **Members**: shows `participant_count` from the linked group
  - **Copy Link**: a button to copy the `invite_link` to clipboard
- Add the same info to mobile cards
- Show a "Creating..." indicator if community creation is in progress

### 4. Deploy Updated Edge Function

Redeploy `create-webinar-community` after the refactor.

---

### Files to Modify

| File | Changes |
|---|---|
| `supabase/functions/create-webinar-community/index.ts` | Refactor to use `vps-whatsapp-proxy` with `create-community-standalone` action, passing `announcement: true` and `restrict: true` |
| `src/hooks/useWebinarNotification.ts` | Update `WebinarWithDetails` type to include community group info (name, participant_count, invite_link). Update query to join `whatsapp_groups` via `community_group_id` |
| `src/pages/webinar/WebinarNotification.tsx` | Add WhatsApp Community, Members, and Copy Link columns to the table. Add same info to mobile cards |
