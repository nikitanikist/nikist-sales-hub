

# Fix MP3 Download — lamejs ESM Compatibility

## Problem
The `lamejs` library has a known issue with Vite/ESM bundlers where internal globals like `MPEGMode` are not properly exported, causing `ReferenceError: MPEGMode is not defined`.

## Solution
Replace `lamejs` with `@breezystack/lamejs`, an ESM-compatible fork that works correctly with Vite.

## Changes

### Dependencies
- Remove `lamejs`
- Install `@breezystack/lamejs`

### `src/pages/ivr/IvrAudioLibrary.tsx`
- Change import from `lamejs` to `@breezystack/lamejs`
- Everything else (encoder usage) stays identical — the API is the same

This is a one-line import change plus a dependency swap.

