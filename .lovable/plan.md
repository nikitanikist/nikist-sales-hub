

# Fix: IVR Audio Not Playing During Calls

## Root Cause Analysis

Looking at the VoBiz logs and edge function code, I identified **two issues** causing dead air:

### Issue 1: Wrong Language Code Format

The VoBiz Gather docs specify language values like `en-US`, `hi-IN`. Our code passes `"hi"` (bare ISO code). VoBiz likely fails to initialize speech recognition with an invalid language code, which could cause the entire XML execution to error out silently — including the `<Play>` elements that come before `<Gather>`.

**Fix:** Map language codes to VoBiz-compatible BCP-47 format (`hi` → `hi-IN`, `en` → `en-US`, etc.)

### Issue 2: Play Audio Should Be Nested Inside Gather

The VoBiz documentation explicitly states: *"You can nest Speak XML and Play XML elements inside Gather XML to prompt users for inputs."* All their examples show `<Play>` and `<Speak>` **nested inside** `<Gather>`, not placed before it.

Our current XML structure:
```xml
<Play>opening.mp3</Play>      <!-- outside Gather -->
<Gather inputType="speech" ...>
</Gather>                       <!-- empty Gather -->
```

VoBiz expected structure:
```xml
<Gather inputType="speech" ...>
    <Play>opening.mp3</Play>    <!-- nested inside Gather -->
</Gather>
```

When `<Play>` is outside `<Gather>`, VoBiz plays the audio but then the empty `<Gather>` may behave unpredictably. When nested, VoBiz plays the audio as a prompt and simultaneously begins listening for speech input.

## Changes

### File: `supabase/functions/ivr-call-answer/index.ts`

1. Add language code mapping function (`hi` → `hi-IN`, `en` → `en-US`, etc.)
2. Restructure XML to nest `<Play>` inside `<Gather>`:

```xml
<Response>
    <Gather inputType="speech" ... action="ivr-call-response">
        <Play>opening.mp3</Play>
    </Gather>
    <Gather inputType="speech" ... action="ivr-call-response">
        <Play>repeat.mp3</Play>
    </Gather>
    <Play>goodbye.mp3</Play>
    <Hangup/>
</Response>
```

3. Log the full XML being returned for debugging

### File: `supabase/functions/ivr-call-response/index.ts`

Same fixes for the retry XML (nest Play inside Gather, fix language code).

### Deploy

Redeploy `ivr-call-answer` and `ivr-call-response` after changes.

## Files Changed
- `supabase/functions/ivr-call-answer/index.ts`
- `supabase/functions/ivr-call-response/index.ts`

