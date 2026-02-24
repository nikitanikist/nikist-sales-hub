import { useRef, DragEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, RefreshCw, X, Video, FileText, Image } from 'lucide-react';

// WhatsApp media limits
const WHATSAPP_MEDIA_LIMITS = {
  image: {
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: ['image/jpeg', 'image/png', 'image/webp'],
    formatNames: 'JPEG, PNG, WEBP'
  },
  video: {
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: ['video/mp4'],
    formatNames: 'MP4'
  },
  document: {
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: ['application/pdf'],
    formatNames: 'PDF'
  }
};

export type MediaType = 'image' | 'video' | 'document';

export function getMediaType(file: File | null): MediaType {
  if (!file) return 'image';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf') return 'document';
  return 'image';
}

export function getMediaTypeFromUrl(url: string | null): MediaType {
  if (!url) return 'image';
  const lower = url.toLowerCase();
  if (lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm')) return 'video';
  if (lower.includes('.pdf')) return 'document';
  return 'image';
}

export function validateWhatsAppMedia(file: File): { valid: boolean; error?: string } {
  const type = getMediaType(file);
  const limits = WHATSAPP_MEDIA_LIMITS[type];

  if (!limits.formats.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid format. Allowed: ${limits.formatNames}`
    };
  }

  if (file.size > limits.maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum: ${formatFileSize(limits.maxSize)}`
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface TemplateMediaUploadProps {
  mediaUrl: string | null;
  mediaFile: File | null;
  fileName?: string | null;
  isUploading: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

export function TemplateMediaUpload({
  mediaUrl,
  mediaFile,
  fileName,
  isUploading,
  onSelect,
  onRemove,
}: TemplateMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset image error state when URL changes
  const prevUrlRef = useRef(mediaUrl);
  if (prevUrlRef.current !== mediaUrl) {
    prevUrlRef.current = mediaUrl;
    setImageError(false);
  }

  const mediaType = mediaFile ? getMediaType(mediaFile) : getMediaTypeFromUrl(mediaUrl);
  const displayName = mediaFile?.name || fileName || 'Media';
  const displaySize = mediaFile ? formatFileSize(mediaFile.size) : null;

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
    // Reset input value so selecting the same file again triggers onChange
    e.target.value = '';
  };

  // Uploaded state - show media preview
  if (mediaUrl) {
    return (
      <div className="border rounded-lg p-3 bg-muted/50">
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          {mediaType === 'image' && (
            imageError ? (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center border">
                <Image className="h-6 w-6 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt="Preview"
                className="h-12 w-12 rounded object-cover border"
                onError={() => setImageError(true)}
              />
            )
          )}
          {mediaType === 'video' && (
            <div className="h-12 w-12 rounded bg-blue-100 flex items-center justify-center border">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
          )}
          {mediaType === 'document' && (
            <div className="h-12 w-12 rounded bg-red-100 flex items-center justify-center border">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
          )}

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{displayName}</p>
            {displaySize && (
              <p className="text-xs text-muted-foreground">{displaySize}</p>
            )}
          </div>

          {/* Actions */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => inputRef.current?.click()}
            title="Replace media"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            title="Remove media"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // Uploading state
  if (isUploading) {
    return (
      <div className="border-2 border-dashed border-primary/50 rounded-lg p-8 text-center bg-primary/5">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          Uploading media...
        </p>
      </div>
    );
  }

  // Empty state - drop zone
  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
      }`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex justify-center gap-2 mb-3">
        <Image className="h-8 w-8 text-muted-foreground/50" />
        <Video className="h-8 w-8 text-muted-foreground/50" />
        <FileText className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium">Drop media here or click to upload</p>
      <p className="text-xs text-muted-foreground mt-1">
        Image (JPEG, PNG), Video (MP4), or PDF • Max 16MB
      </p>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
        onChange={handleFileChange}
      />
    </div>
  );
}
