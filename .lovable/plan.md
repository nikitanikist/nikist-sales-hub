

# Fix: Convert Recorded Audio from WebM to WAV for VoBiz Compatibility

## Problem
The browser records audio in **WebM/Opus** format, but VoBiz (the telephony provider) only supports **MP3 or WAV** files. When VoBiz tries to play a `.webm` file during a call, it results in silence and the call hangs up immediately.

## Solution
Convert the recorded WebM blob to **WAV format** on the client side before uploading. This uses the Web Audio API to decode the audio and re-encode it as a PCM WAV file — no server-side conversion needed.

## Changes

### `src/pages/ivr/IvrAudioLibrary.tsx`

1. **Add a `webmToWav` helper function** that:
   - Creates an `AudioContext` and decodes the WebM blob into raw PCM samples
   - Encodes those samples into a proper WAV file (16-bit PCM, mono, 48kHz)
   - Returns a new `Blob` with MIME type `audio/wav`

2. **Update the save logic** (~line 155-170):
   - Before uploading, call `webmToWav(recordedBlob)` to convert the blob
   - Change the upload file extension from `.webm` to `.wav`
   - Change the `File` constructor to use `type: "audio/wav"` and name `recording.wav`

3. **Preview remains unchanged** — the browser can play WebM fine for preview; only the uploaded file is converted to WAV.

### Technical detail of WAV encoding
```text
WebM Blob → AudioContext.decodeAudioData() → Float32 PCM → 16-bit PCM → WAV header + data → WAV Blob
```

This is a pure client-side conversion with no external libraries needed.

