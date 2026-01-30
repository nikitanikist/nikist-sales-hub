/**
 * Utility functions for media type detection and validation
 */

export type MediaType = 'image' | 'video' | 'document';

/**
 * Detect media type from a URL based on file extension or path patterns
 * @param url The media URL to analyze
 * @returns The detected media type, or null if no URL provided
 */
export function getMediaTypeFromUrl(url: string | null | undefined): MediaType | null {
  if (!url) return null;
  
  const lower = url.toLowerCase();
  
  // Check by file extension (handles query params after extension)
  if (lower.match(/\.(mp4|mov|avi|webm|mkv)($|\?)/)) return 'video';
  if (lower.match(/\.pdf($|\?)/)) return 'document';
  if (lower.match(/\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)($|\?)/)) return 'image';
  
  // Check by path patterns (Supabase storage often has type hints in path)
  if (lower.includes('/video/') || lower.includes('/videos/')) return 'video';
  if (lower.includes('/document/') || lower.includes('/documents/')) return 'document';
  if (lower.includes('/image/') || lower.includes('/images/')) return 'image';
  
  // Default to image for unknown (most common case)
  return 'image';
}

/**
 * Get the MIME type category from a MIME type string
 * @param mimeType The MIME type (e.g., 'image/jpeg', 'video/mp4')
 * @returns The media type category
 */
export function getMediaTypeFromMime(mimeType: string | null | undefined): MediaType | null {
  if (!mimeType) return null;
  
  const lower = mimeType.toLowerCase();
  
  if (lower.startsWith('video/')) return 'video';
  if (lower === 'application/pdf') return 'document';
  if (lower.startsWith('image/')) return 'image';
  
  return null;
}

/**
 * Format file size in human-readable format
 * @param bytes File size in bytes
 * @returns Formatted string like "2.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * WhatsApp media size limits
 */
export const WHATSAPP_MEDIA_LIMITS = {
  image: {
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: ['image/jpeg', 'image/png', 'image/webp'],
    formatNames: 'JPEG, PNG, WEBP',
  },
  video: {
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: ['video/mp4'],
    formatNames: 'MP4',
  },
  document: {
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: ['application/pdf'],
    formatNames: 'PDF',
  },
} as const;

/**
 * Validate a file against WhatsApp media limits
 * @param file The file to validate
 * @returns Validation result with error message if invalid
 */
export function validateWhatsAppMedia(file: File): { valid: boolean; error?: string } {
  const mediaType = getMediaTypeFromMime(file.type);
  
  if (!mediaType) {
    return {
      valid: false,
      error: 'Unsupported file type. Use JPEG, PNG, WEBP, MP4, or PDF.',
    };
  }
  
  const limits = WHATSAPP_MEDIA_LIMITS[mediaType];
  const allowedFormats = limits.formats as readonly string[];
  
  if (!allowedFormats.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid format for ${mediaType}. Allowed: ${limits.formatNames}`,
    };
  }
  
  if (file.size > limits.maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum: ${formatFileSize(limits.maxSize)}`,
    };
  }
  
  return { valid: true };
}
