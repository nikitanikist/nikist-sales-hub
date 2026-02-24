

# Fix: Broken Template Media Preview and Silent Upload Failures

## What Happened

The "last notification" template has a media URL saved (`1769899496226_last_notification.png`), but the actual file does not exist in storage. This means the upload either failed silently or the file was deleted, but the URL was kept in the database. The preview shows a broken image icon because it tries to load a URL that returns a 404.

## Two Issues to Fix

### 1. Broken image preview -- no fallback for missing files

**File: `src/components/settings/TemplateMediaUpload.tsx`**

The `<img>` tag at line 125-129 has no `onError` handler. When the image URL is broken (404), it shows the browser's default broken-image icon with no way to recover.

**Fix:** Add an `onError` handler on the `<img>` tag that replaces the broken image with a placeholder icon (the `Image` icon from lucide-react), matching the style of the video/document fallbacks already in the component.

### 2. No upload verification -- silent failures

**File: `src/pages/settings/TemplateEditor.tsx`**

The `uploadMedia` function (lines 78-104) uploads the file and then calls `getPublicUrl()` to construct the URL. But `getPublicUrl()` does not verify the file exists -- it just builds a URL string. If the upload partially fails (network glitch, timeout), the code still returns a URL and shows "Media uploaded successfully", even though the file isn't actually in storage.

**Fix:** After upload, add a HEAD request to verify the file is accessible before returning the URL. If the file is not reachable, throw an error so the toast shows "Failed to upload media" and the broken URL is never saved.

```
// After getting the public URL:
const verifyResponse = await fetch(urlData.publicUrl, { method: 'HEAD' });
if (!verifyResponse.ok) {
  throw new Error('Upload verification failed - file not accessible');
}
```

### 3. Immediate data fix

The existing template "last notification" (ID: `7c7787ef-...`) has a broken `media_url`. The user needs to re-upload the image. No migration needed -- the user can simply open the template editor, remove the broken media, and upload the file again.

## Files to Change

- `src/components/settings/TemplateMediaUpload.tsx` -- Add `onError` fallback on the image preview
- `src/pages/settings/TemplateEditor.tsx` -- Add upload verification after `getPublicUrl()`
- `src/pages/whatsapp/SendNotification.tsx` -- Same upload verification fix (uses the same pattern)
