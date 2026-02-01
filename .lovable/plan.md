
Goal
- Make the “Create Dynamic Link” popup feel dynamic: it should grow to fit content up to the screen height, keep the footer (Cancel/Create) always visible, and ensure scrolling happens inside the group list/body — not by scrolling the whole popup.

What’s causing the “not dynamic / whole popup scrolls” feeling (based on current code)
- In `CreateLinkDialog.tsx`, `DialogContent` currently has: `max-h-[90vh] overflow-y-auto`.
  - This makes the entire modal container the scrollable area.
  - When you mouse-wheel over the group list, the scroll often bubbles and scrolls the modal container, which feels like the whole popup is moving.
- `DialogContent` (base component) is a `grid` layout by default. With a lot of content, grid + container scrolling tends to feel less “stable” than a flex layout with a dedicated scroll region.

Proposed UX behavior
- The popup expands naturally with content until it reaches 90vh.
- After 90vh, only the “body” section scrolls (and within that, the group list scrolls as needed).
- Footer stays pinned/visible at the bottom of the popup (so user never loses “Create Link” button).

Implementation plan (frontend only)

1) Convert this dialog instance to a “flex column” modal with a dedicated scroll body
File: `src/components/operations/CreateLinkDialog.tsx`
- Change `DialogContent` className from:
  - `sm:max-w-2xl max-h-[90vh] overflow-y-auto`
  to something like:
  - `sm:max-w-2xl max-h-[90vh] flex flex-col`
  (removes container scrolling and overrides default `grid` with `flex` because Tailwind’s last display class wins.)

- Restructure children inside `DialogContent`:
  - Keep `<DialogHeader />` as `shrink-0`
  - Wrap the main form section (`<div className="space-y-6 py-4">…`) inside a new container:
    - `className="flex-1 overflow-y-auto pr-1"`
    - Optionally add: `overscroll-contain` (prevents scroll chaining to the page on some browsers)
  - Keep `<DialogFooter />` as `shrink-0` and consider adding:
    - `border-t bg-background sticky?` (not required if footer is outside the scroll region, but we can add a subtle separation line)

Result:
- The modal itself stops scrolling.
- Only the body scrolls when content exceeds max height.
- Footer remains visible.

2) Ensure scrolling stays inside the group list (and doesn’t bubble to the dialog body)
File: `src/components/operations/CreateLinkDialog.tsx`
- Keep the group list `ScrollArea` height fixed (current `h-64` is correct).
- Add a scroll-containment/bubbling fix on the group list wrapper:
  - Option A (preferred, CSS-only): add `overscroll-contain` to the `ScrollArea` root:
    - `className="h-64 rounded-md border overscroll-contain"`
  - Option B (guaranteed): add an event handler to stop wheel bubbling:
    - `<ScrollArea ... onWheelCapture={(e) => e.stopPropagation()}>`
  - We can combine both for best reliability across devices.

Result:
- When you scroll over groups, only the group list scrolls (not the entire popup).

3) Make modal height feel more “content-driven”
File: `src/components/operations/CreateLinkDialog.tsx`
- Remove extra vertical padding that forces extra space when not needed, or tune it:
  - Current: `space-y-6 py-4` is fine, but if the dialog feels “too tall” for small content, we can reduce `py-4` to `py-3` and adjust spacing.
- Keep `max-h-[90vh]` to avoid going beyond the visible screen.

4) Quick verification steps (to confirm the fix)
- Open `/operations/dynamic-links` → Create New Link → WhatsApp Group.
- Confirm:
  - Modal grows and stops at 90vh.
  - Footer buttons (Cancel/Create Link) are always visible.
  - Scrolling the group list does not scroll the whole modal.
  - When there are many groups, only the list scrolls; when there are fewer groups, modal shrinks accordingly.

Files to change
- `src/components/operations/CreateLinkDialog.tsx` (primary)
- No changes needed to shared `src/components/ui/dialog.tsx` unless we later want this behavior globally across all dialogs.

Edge cases & notes
- If the WhatsApp group list becomes extremely long (many sections), the dialog body scroll will still work, while the group list remains independently scrollable (nested scroll). The wheel-capture/overscroll containment is important to prevent “scroll tug-of-war”.
- On mobile, nested scrolling can be tricky. If needed, we can switch from nested scrolling to a single scroll area (dialog body only) by making the group list height “auto” and letting the body handle scrolling. We’ll only do that if you report mobile scroll issues after this change.