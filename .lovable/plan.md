

# Workshop Notification Settings - Bug Fixes

## Overview

This plan fixes 5 critical UX bugs in the Workshop Notification Settings page that prevent users from effectively editing templates, sequences, and tags. The main issues are:

1. **Template editor missing media upload** - No way to add images/videos to templates
2. **State not syncing on edit** - All three editor dialogs (Template, Sequence, Tag) use `useState` without `useEffect`, causing stale data when editing

## Bug Analysis

### Root Cause: useState Without Sync

All three editor dialogs have the same pattern issue:

```typescript
// Current (broken)
const [name, setName] = useState(template?.name || '');

// Problem: useState initial value only runs on FIRST mount
// When dialog stays mounted but template prop changes, state doesn't update
```

### Solution Pattern

Add `useEffect` to sync state when the entity prop changes:

```typescript
const [name, setName] = useState(template?.name || '');

useEffect(() => {
  if (template) {
    setName(template.name || '');
    // ... sync other fields
  } else {
    setName('');
    // ... reset other fields
  }
}, [template]);
```

---

## Implementation Details

### Fix 1: TemplateEditorDialog - Add State Sync + Media Upload

**File:** `src/pages/settings/WorkshopNotificationSettings.tsx` (Lines 20-107)

| Change | Description |
|--------|-------------|
| Add `useEffect` | Sync `name`, `content`, `description`, `mediaUrl` when `template` prop changes |
| Add `mediaUrl` state | Track media URL value |
| Add media URL input | Text input for external media URL |
| Update `handleSave` | Include `media_url` in save payload |
| Add media preview | Show image preview when URL is set |

**UI Addition:**
```
Message Content: [textarea]
Variables: {workshop_name} {date} ...

Media (Optional)
[URL input field] [placeholder: https://example.com/image.jpg]
[Preview thumbnail if URL is set]
```

**Why URL-only (no file upload)?**
- No storage bucket exists yet
- Creating a bucket requires additional RLS policy setup
- URL-based media is simpler and matches common workflow (WhatsApp media hosting)
- Can add file upload as future enhancement

### Fix 2: SequenceEditorDialog - Add State Sync

**File:** `src/pages/settings/WorkshopNotificationSettings.tsx` (Lines 109-288)

| Change | Description |
|--------|-------------|
| Add `useEffect` | Sync `name` and `description` when `sequence` prop changes |
| Also reset step input fields | Clear `newStepTime`, `newStepTemplate`, `newStepLabel` when sequence changes |

This fixes:
- Name field empty when editing
- "Name is required" error on save

### Fix 3: TagEditorDialog - Add State Sync

**File:** `src/pages/settings/WorkshopNotificationSettings.tsx` (Lines 290-405)

| Change | Description |
|--------|-------------|
| Add `useEffect` | Sync `name`, `color`, `description`, `sequenceId` when `tag` prop changes |

This fixes:
- All fields empty when editing existing tag
- Having to re-enter all data

---

## Code Changes Summary

### TemplateEditorDialog (Lines 20-107)

```typescript
// Add import at top of file
import { useState, useEffect } from 'react';

// Inside TemplateEditorDialog:
const [name, setName] = useState(template?.name || '');
const [content, setContent] = useState(template?.content || '');
const [description, setDescription] = useState(template?.description || '');
const [mediaUrl, setMediaUrl] = useState(template?.media_url || '');

// ADD THIS useEffect
useEffect(() => {
  if (template) {
    setName(template.name || '');
    setContent(template.content || '');
    setDescription(template.description || '');
    setMediaUrl(template.media_url || '');
  } else {
    setName('');
    setContent('');
    setDescription('');
    setMediaUrl('');
  }
}, [template]);

// Update handleSave to include media_url
const handleSave = () => {
  if (!name.trim() || !content.trim()) {
    toast.error('Name and content are required');
    return;
  }
  onSave({ 
    id: template?.id, 
    name, 
    content, 
    description, 
    media_url: mediaUrl.trim() || null 
  });
};

// Add media section in JSX after Message Content
<div className="space-y-2">
  <Label>Media URL (Optional)</Label>
  <Input
    value={mediaUrl}
    onChange={(e) => setMediaUrl(e.target.value)}
    placeholder="https://example.com/image.jpg"
  />
  {mediaUrl && (
    <img 
      src={mediaUrl} 
      alt="Preview" 
      className="h-20 object-cover rounded border"
      onError={(e) => e.currentTarget.style.display = 'none'}
    />
  )}
</div>
```

### SequenceEditorDialog (Lines 109-288)

```typescript
const [name, setName] = useState(sequence?.name || '');
const [description, setDescription] = useState(sequence?.description || '');
const [newStepTime, setNewStepTime] = useState('11:00');
const [newStepTemplate, setNewStepTemplate] = useState('');
const [newStepLabel, setNewStepLabel] = useState('');

// ADD THIS useEffect
useEffect(() => {
  if (sequence) {
    setName(sequence.name || '');
    setDescription(sequence.description || '');
  } else {
    setName('');
    setDescription('');
  }
  // Reset step inputs when sequence changes
  setNewStepTime('11:00');
  setNewStepTemplate('');
  setNewStepLabel('');
}, [sequence]);
```

### TagEditorDialog (Lines 290-405)

```typescript
const [name, setName] = useState(tag?.name || '');
const [color, setColor] = useState(tag?.color || TAG_COLORS[0].value);
const [description, setDescription] = useState(tag?.description || '');
const [sequenceId, setSequenceId] = useState(tag?.template_sequence_id || '_none');

// ADD THIS useEffect
useEffect(() => {
  if (tag) {
    setName(tag.name || '');
    setColor(tag.color || TAG_COLORS[0].value);
    setDescription(tag.description || '');
    setSequenceId(tag.template_sequence_id || '_none');
  } else {
    setName('');
    setColor(TAG_COLORS[0].value);
    setDescription('');
    setSequenceId('_none');
  }
}, [tag]);
```

---

## Testing Checklist

After implementation, verify:

**Templates**
- [ ] Create new template - fields are empty
- [ ] Edit existing template - fields show existing values
- [ ] Edit template - save works without re-entering data
- [ ] Create new template after editing - fields are empty (not stale)
- [ ] Add media URL - shows preview
- [ ] Save with media URL - persists correctly
- [ ] Remove media URL - clears on save

**Sequences**
- [ ] Create new sequence - name field is empty
- [ ] Edit existing sequence - name shows existing value
- [ ] Edit sequence and save - no "name is required" error
- [ ] Step input fields reset between different sequences

**Tags**
- [ ] Create new tag - all fields empty/default
- [ ] Edit existing tag - all fields show existing values
- [ ] Edit tag and save - no validation errors
- [ ] Color selection persists correctly
- [ ] Sequence selection persists correctly

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/settings/WorkshopNotificationSettings.tsx` | Add `useEffect` to all three dialogs, add media URL field to template editor |

---

## Future Enhancements (Out of Scope)

1. **File Upload** - Would require creating a storage bucket with RLS policies
2. **Media Type Detection** - Differentiate between image/video preview
3. **Media Library** - Reusable media assets across templates

