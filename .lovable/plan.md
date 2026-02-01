

# Improved UX: Auto-Fetch Invite Link on Group Selection

## Current Problem

1. **Manual button clicks**: User has to click "Get Link" button for each group without an invite link
2. **Button cropping**: The "Get Link" button text is getting cut off due to space constraints
3. **Clunky experience**: Too many steps to select a group

## Proposed Solution

Replace the list-based selection with a simple **Select dropdown**. When user selects a group:
- If it already has an invite link → just select it (done!)
- If it doesn't have an invite link → automatically fetch it in the background, show a loading indicator, and once fetched, it's ready

## New UX Flow

```
Select Group                                      [Sync Groups]
┌──────────────────────────────────────────────────────────────┐
│  Choose a group...                                       ▼   │
└──────────────────────────────────────────────────────────────┘

[Dropdown opens]
┌──────────────────────────────────────────────────────────────┐
│  🟢 Crypto Masterclass <> 1st February          👥 230  ✓    │
│  🟢 test amit                                   👥 1         │
│  ⚪ 10th August <> Ethical Hacking             👥 112       │  ← no invite link yet
│  ⚪ 12th October (FB) <> Ethical Hacking       👥 99        │
└──────────────────────────────────────────────────────────────┘

[User selects "10th August <> Ethical Hacking" which has no invite link]

Select Group                                      [Sync Groups]
┌──────────────────────────────────────────────────────────────┐
│  🔄 10th August <> Ethical Hacking... (fetching link)        │  ← auto-fetching
└──────────────────────────────────────────────────────────────┘

[After fetch completes]

Select Group                                      [Sync Groups]
┌──────────────────────────────────────────────────────────────┐
│  🟢 10th August <> Ethical Hacking & Bug Hunting        ✓    │  ← ready!
└──────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### File: `src/components/operations/CreateLinkDialog.tsx`

**1. Replace ScrollArea list with Select component**

Replace the current `ScrollArea` with groups list (lines 343-399) with a `Select` component:

| Current | New |
|---------|-----|
| `<ScrollArea>` with group buttons | `<Select>` dropdown with all groups |
| Manual "Get Link" button | Auto-fetch on selection |
| Two sections (ready/need link) | Single list, visual indicator for status |

**2. Add auto-fetch logic when selecting a group**

Create a new handler `handleGroupSelect(groupId)`:
- Find the selected group
- If `invite_link` exists → just set `selectedGroupId`
- If `invite_link` is `null` → call `fetchInviteLink()` automatically, show loading state

**3. Track fetching state for selected group**

- Use `isFetchingInviteLink` and `fetchingInviteLinkGroupId` from the hook
- Show a spinner in the Select trigger when fetching

**4. Update selected group after invite link is fetched**

- After successful fetch, the hook already invalidates queries
- The group will automatically have `invite_link` populated
- UI updates automatically via React Query

**5. Clean up unused components**

- Remove `GroupItem` component (no longer needed)
- Remove `GroupItemWithFetch` component (no longer needed)
- Simplify the code significantly

### Code Changes Summary

| Location | Change |
|----------|--------|
| Lines 343-399 | Replace `ScrollArea` + group items with `<Select>` dropdown |
| Lines 96-105 | Update `handleFetchInviteLink` → new `handleGroupSelect` with auto-fetch |
| Lines 427-521 | Remove `GroupItem` and `GroupItemWithFetch` components |
| Add | Loading state in Select trigger when fetching |
| Add | Visual indicator (🟢/⚪) in dropdown items showing link status |

### Select Dropdown Design

```tsx
<Select
  value={selectedGroupId || ''}
  onValueChange={handleGroupSelect}
  disabled={isFetchingInviteLink}
>
  <SelectTrigger>
    {isFetchingInviteLink && fetchingInviteLinkGroupId === selectedGroupId ? (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Fetching invite link...</span>
      </div>
    ) : (
      <SelectValue placeholder="Choose a group..." />
    )}
  </SelectTrigger>
  <SelectContent>
    {filteredGroups.map((group) => (
      <SelectItem key={group.id} value={group.id}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${group.invite_link ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{group.group_name}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            👥 {group.participant_count}
          </span>
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

## Benefits

| Before | After |
|--------|-------|
| Scroll through list, find group, click "Get Link" button, wait, then select | Just select from dropdown - link fetched automatically |
| Button text cropping | No buttons needed |
| Two separate sections | Single clean dropdown |
| Multiple clicks | One click to select |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/operations/CreateLinkDialog.tsx` | Replace list with Select, add auto-fetch on selection, remove unused components |

