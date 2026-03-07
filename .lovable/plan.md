

# Fix: VoBiz Rejects `hi-IN` — Hindi Not in Supported Languages

## Root Cause

The VoBiz logs clearly state:

> **"Gather 'language' is not in suported language codes."**

VoBiz's [supported language list](https://www.docs.vobiz.ai/xml/gather/supported-languages) has only **27 languages**, and **Hindi is NOT one of them**. Our mapping of `hi` → `hi-IN` produces a code VoBiz doesn't recognize, causing it to reject the entire XML and hang up immediately.

The call timeline confirms this:
- 22:31:15 — Call answered
- 22:31:16 — XML returned with `language="hi-IN"`
- 22:31:17 — VoBiz rejects: "language is not in supported language codes"
- 22:31:17 — Call disconnected (HangupSource: "Error")

## Fix

Since Hindi speech recognition is not available on VoBiz, we have two options:

**Option A (recommended):** Use `en-IN` (English India) as the fallback. VoBiz will still transcribe Hindi-accented speech reasonably well, and our keyword matching (`haan`, `nahi`, `bilkul`, etc.) handles the actual intent detection — we don't need perfect Hindi transcription, just enough to match keywords.

**Option B:** Remove the `language` attribute entirely and let VoBiz default to `en-US`.

### Changes

**Both files:** `supabase/functions/ivr-call-answer/index.ts` and `supabase/functions/ivr-call-response/index.ts`

Update the `mapLanguageCode` function to map unsupported Indian languages to `en-IN`:

```typescript
function mapLanguageCode(lang: string): string {
  // VoBiz supported codes only
  const supported = new Set([
    "en-AU","en-CA","en-GB","en-IE","en-IN","en-PH","en-SG","en-US","en-ZA",
    "de-DE","es-ES","es-MX","es-US","fr-CA","fr-FR","it-IT","ja-JP","ko-KR",
    "nl-NL","pt-BR","pt-PT","ru-RU","zh","zh-HK","zh-TW","yue-Hant-HK","af-ZA"
  ]);
  
  // If already a supported BCP-47 code, use as-is
  if (supported.has(lang)) return lang;
  
  // Map short codes
  const map: Record<string, string> = {
    en: "en-IN",
    hi: "en-IN",  // Hindi not supported; use English India (keyword matching handles intent)
    bn: "en-IN",
    ta: "en-IN",
    te: "en-IN",
    mr: "en-IN",
    gu: "en-IN",
    kn: "en-IN",
    ml: "en-IN",
    pa: "en-IN",
    ur: "en-IN",
  };
  
  return map[lang.toLowerCase()] || "en-US";
}
```

### Deploy
Redeploy `ivr-call-answer` and `ivr-call-response`.

## Files Changed
- `supabase/functions/ivr-call-answer/index.ts`
- `supabase/functions/ivr-call-response/index.ts`

