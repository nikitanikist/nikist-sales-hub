

# Add "Record Audio" Feature to IVR Audio Library

## Overview
Add a "Record Audio" button alongside "Upload Audio" that opens a dialog with browser-based microphone recording. The user can record, preview, re-record, and confirm — saving directly to the audio library.

## Changes

### `src/pages/ivr/IvrAudioLibrary.tsx`

1. **Add "Record Audio" button** next to the existing "Upload Audio" button (using `Mic` icon from lucide-react)
2. **Add state**: `recordDialogOpen`, `audioName` for record dialog, `isRecording`, `recordedBlob`, `recordedUrl`, `mediaRecorderRef`
3. **Record Dialog** with these states:
   - **Initial**: Name input + "Start Recording" button
   - **Recording**: Pulsing indicator + elapsed time + "Stop Recording" button
   - **Recorded**: Audio `<audio>` player to preview + "Re-record" and "Save" buttons
4. **Recording logic**:
   - Use `navigator.mediaDevices.getUserMedia({ audio: true })` for mic access
   - Create `MediaRecorder`, collect chunks via `ondataavailable`
   - On stop, create a `Blob` (audio/webm) and object URL for preview
5. **Save logic**:
   - Convert the recorded blob to a File, upload to `ivr-audio` storage bucket (same path pattern as upload)
   - Insert into `ivr_audio_library` table (reuse existing mutation pattern)
   - Invalidate query cache, close dialog

### No backend changes needed
The storage bucket and table already exist — recording just produces a file blob instead of a file input.

