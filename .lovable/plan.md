

# Add Download Audio (as MP3) to IVR Audio Library

## Overview
Add a "Download" button on each audio card that fetches the audio file, converts it to MP3 format client-side, and triggers a browser download.

## Technical Approach

Since the stored files can be WAV or WebM, and the user wants MP3 downloads, we need client-side conversion. Pure browser APIs cannot encode MP3 natively, so we have two options:

1. **Use `lamejs` library** — a pure JavaScript MP3 encoder (~90KB). This gives true MP3 output.
2. **Download as WAV** — simpler, no extra dependency, but not MP3.

Given the explicit MP3 requirement, we'll use `lamejs`.

## Changes

### Install dependency
- Add `lamejs` package (JavaScript MP3 encoder)

### `src/pages/ivr/IvrAudioLibrary.tsx`

1. **Import** `Download` icon from lucide-react
2. **Add `downloadAsMP3` function**:
   - Fetch the audio URL as an ArrayBuffer
   - Decode using `AudioContext.decodeAudioData()` to get raw PCM samples
   - Encode to MP3 using lamejs (`Mp3Encoder`)
   - Create a Blob and trigger download with `<a>` element click
3. **Add Download button** next to the existing Play button on each audio card:
   ```tsx
   <Button variant="outline" size="sm" onClick={() => downloadAsMP3(clip)}>
     <Download className="h-3 w-3 mr-1" /> Download
   </Button>
   ```

The conversion pipeline:
```text
Fetch audio URL → AudioContext.decodeAudioData() → Float32 PCM → lamejs Mp3Encoder → MP3 Blob → Download
```

