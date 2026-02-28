

## Plan: Fix Inactive Rule Logic in `ingest-tagmango`

### Problem
Currently, the dynamic rule query filters by `is_active = true` (line 698). When a rule is toggled inactive, no rule is found, so `handledByDynamicRule` stays `false` and the hardcoded fallback fires — meaning the message still sends.

### Fix (single change in one file)

**File:** `supabase/functions/ingest-tagmango/index.ts`

1. **Remove `.eq('is_active', true)` from the query** (line 698) — fetch the rule regardless of active/inactive status.
2. **Set `handledByDynamicRule = true` whenever a rule exists** (line 706 stays as-is — it already runs when a rule is found).
3. **Wrap the actual send logic (lines 708-810) in an `if (rule.is_active)` check** — only send the WhatsApp message and Google Sheet if the rule is active.
4. **Add a log line** in the else branch: `"Rule exists but is inactive, skipping confirmation"`.

This means:
- **Rule exists + active** → sends confirmation (current behavior)
- **Rule exists + inactive** → skips confirmation AND skips hardcoded fallback (the fix)
- **No rule exists at all** → falls through to hardcoded fallback (safety net for any unmigrated products)

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/ingest-tagmango/index.ts` | Remove `is_active` filter from query, add `if (rule.is_active)` guard around send logic |

### What Is NOT Touched
Everything else — no other files, no database changes, no UI changes.

