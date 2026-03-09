

# Update WhatsApp Link Template — Image and Group Link

## What Changes

Update two hardcoded default values in `supabase/functions/send-whatsapp-link/index.ts`:

### 1. WhatsApp Group Link (line ~48)
**Current:** `https://app.tagfunnel.ai/link/today-whatsapp-group-icc`
**New:** `https://chat.whatsapp.com/Fwyt3nS0gT4Jg4QjBESo5Z`

### 2. Image URL (line ~80)
**Current:** `https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6805dc865e03fc0bfe0a7132/4662926_service%20image.jpeg`
**New:** `https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6805dc865e03fc0bfe0a7132/6091959_anku.jpeg`

## File Changed
- `supabase/functions/send-whatsapp-link/index.ts`

No other logic changes needed. The function will be redeployed automatically.

