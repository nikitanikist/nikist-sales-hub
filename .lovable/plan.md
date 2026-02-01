
# Ultra-Fast Branded URL Redirect

## The Solution

Inject a tiny inline JavaScript snippet directly into `index.html` that runs **before** React loads. This script will:

1. Detect if the current URL matches `/link/:slug`
2. Make a direct API call to the backend function to get the destination
3. Redirect immediately (before any React bundle downloads)
4. If it fails, let React handle it as a fallback

## How It Works

```
User clicks: app.tagfunnel.ai/link/xyz
              ↓
index.html loads (tiny, ~5KB)
              ↓
Inline script runs IMMEDIATELY
              ↓
Detects /link/xyz pattern
              ↓
Calls backend function (fast API call)
              ↓
Gets destination URL
              ↓
window.location.href = destination
              ↓
User lands on WhatsApp (~200-300ms total)

(React never even starts loading!)
```

## Implementation

### Step 1: Create Backend Function for Fast Lookup

**File:** `supabase/functions/link-redirect/index.ts`

A lightweight function that:
- Accepts GET request with slug
- Calls `increment_link_click` RPC
- Returns JSON with destination URL
- Super fast response (~50-100ms)

### Step 2: Add Inline Script to index.html

**File:** `index.html`

Add a tiny inline script in the `<head>` that:
- Checks if URL starts with `/link/`
- Extracts the slug
- Fetches destination from backend function
- Redirects immediately
- If error, lets the page continue loading (fallback to React)

```html
<script>
(function() {
  var path = window.location.pathname;
  if (path.startsWith('/link/')) {
    var slug = path.replace('/link/', '');
    if (slug) {
      fetch('https://swnpxkovxhinxzprxviz.supabase.co/functions/v1/link-redirect?slug=' + encodeURIComponent(slug))
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.url) window.location.href = d.url; })
        .catch(function() { /* fallback to React */ });
    }
  }
})();
</script>
```

### Step 3: Keep React Route as Fallback

The existing `/link/:slug` React route stays as-is for:
- Error display (link not found)
- Fallback if the inline script fails
- Graceful degradation

## Result

| Aspect | Before | After |
|--------|--------|-------|
| URL | `app.tagfunnel.ai/link/xyz` | `app.tagfunnel.ai/link/xyz` (same!) |
| Speed | 2-3 seconds | 200-300ms |
| User sees | Loading spinner | Nothing (instant redirect) |
| Bundle load | Full React app | Nothing (skipped entirely) |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/link-redirect/index.ts` | Create | Fast API endpoint for destination lookup |
| `supabase/config.toml` | Modify | Add function config (no JWT required) |
| `index.html` | Modify | Add inline redirect script |

## Technical Details

### Backend Function Response Format

```json
// Success
{ "url": "https://chat.whatsapp.com/abc123" }

// Not found
{ "error": "not_found" }
```

### Inline Script (~500 bytes)

The script is:
- Synchronous check of URL path
- Async fetch (doesn't block anything)
- Immediate redirect on success
- Silent fallback on failure

### Why This Works

1. **index.html is tiny** - Downloads in ~50ms
2. **Inline script runs before any module loading** - No waiting for React
3. **Backend function is fast** - ~50-100ms response
4. **Redirect happens before bundle download starts** - User sees nothing
5. **Branded URL preserved** - Same `app.tagfunnel.ai/link/xyz` format

## Fallback Behavior

If the inline script fails (network error, timeout, etc.):
- React app loads normally
- Shows loading spinner
- Makes the same API call
- Shows error page if link not found

This ensures users always get redirected or see a proper error page, never a broken experience.
