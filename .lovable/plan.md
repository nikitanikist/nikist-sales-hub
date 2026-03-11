

# Enhance Audio Recording Quality

## Problem
The current recording uses default `getUserMedia` and `MediaRecorder` settings, which typically produce low-bitrate, compressed audio.

## Changes

### `src/pages/ivr/IvrAudioLibrary.tsx`

1. **Upgrade `getUserMedia` constraints** — Request high-quality audio with echo cancellation and noise suppression:
   ```typescript
   navigator.mediaDevices.getUserMedia({
     audio: {
       sampleRate: 48000,
       channelCount: 1,
       echoCancellation: true,
       noiseSuppression: true,
       autoGainControl: true,
     }
   });
   ```

2. **Set MediaRecorder to high bitrate** — Use `audio/webm;codecs=opus` at 128kbps:
   ```typescript
   const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
     ? "audio/webm;codecs=opus"
     : "audio/webm";
   const recorder = new MediaRecorder(stream, {
     mimeType,
     audioBitsPerSecond: 128000,
   });
   ```

3. **Update blob creation** to use the selected mimeType consistently.

These are browser-level optimizations — the best we can control from client-side code. The combination of noise suppression, echo cancellation, auto gain, and higher bitrate will produce noticeably cleaner recordings.

