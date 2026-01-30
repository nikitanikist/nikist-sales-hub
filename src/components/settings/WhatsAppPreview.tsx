import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Play, FileText, Check } from 'lucide-react';
import { MediaType, getMediaTypeFromUrl } from './TemplateMediaUpload';

interface WhatsAppPreviewProps {
  content: string;
  mediaUrl?: string | null;
  mediaType?: MediaType;
  senderName?: string;
  phoneNumber?: string;
}

// Function to highlight template variables in content
function highlightVariables(text: string) {
  if (!text) return null;
  
  const parts = text.split(/(\{[^}]+\})/g);
  
  return parts.map((part, index) => {
    if (part.match(/^\{[^}]+\}$/)) {
      return (
        <span
          key={index}
          className="inline-block bg-amber-200 text-amber-900 px-1 rounded text-sm font-medium"
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

// Format WhatsApp text (bold, italic)
function formatWhatsAppText(text: string) {
  let formatted = text;
  
  // Replace *text* with bold
  formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  
  // Replace _text_ with italic  
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  return formatted;
}

export function WhatsAppPreview({
  content,
  mediaUrl,
  mediaType,
  senderName = 'Team Nikist',
  phoneNumber = '+91 97178 17488',
}: WhatsAppPreviewProps) {
  const now = new Date();
  const timeString = format(now, 'h:mm a');
  
  // Determine media type from URL if not provided
  const resolvedMediaType = mediaType || getMediaTypeFromUrl(mediaUrl || null);
  
  const hasContent = content?.trim();
  const hasMedia = !!mediaUrl;
  
  if (!hasContent && !hasMedia) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Start typing to see preview...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[300px]">
      {/* Chat header */}
      <div className="bg-white rounded-lg shadow-sm mb-4 p-3 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-green-500 text-white text-sm font-semibold">
            {senderName.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-green-600 text-sm">{senderName}</p>
          <p className="text-xs text-muted-foreground">{phoneNumber}</p>
        </div>
      </div>

      {/* Message bubble */}
      <div className="flex justify-end">
        <div className="bg-[#dcf8c6] rounded-lg shadow-sm max-w-[90%] overflow-hidden">
          {/* Media */}
          {hasMedia && resolvedMediaType === 'image' && (
            <div className="relative">
              <img
                src={mediaUrl!}
                alt="Preview"
                className="w-full max-h-64 object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23e5e7eb" width="200" height="150"/><text fill="%239ca3af" font-family="sans-serif" font-size="14" text-anchor="middle" x="100" y="80">Image</text></svg>';
                }}
              />
            </div>
          )}
          
          {hasMedia && resolvedMediaType === 'video' && (
            <div className="bg-gray-900 aspect-video flex items-center justify-center min-h-[160px]">
              <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center">
                <Play className="h-8 w-8 text-white ml-1" />
              </div>
            </div>
          )}
          
          {hasMedia && resolvedMediaType === 'document' && (
            <div className="bg-gray-100 p-4 flex items-center gap-3 border-b">
              <div className="h-10 w-10 rounded bg-red-500 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">Document.pdf</p>
                <p className="text-xs text-muted-foreground">PDF Document</p>
              </div>
            </div>
          )}

          {/* Text content */}
          {hasContent && (
            <div className="p-3 pt-2">
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed break-words">
                {highlightVariables(content)}
              </p>
            </div>
          )}

          {/* Timestamp and read receipt */}
          <div className="text-right px-3 pb-2 -mt-1">
            <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
              {timeString}
              <Check className="h-3 w-3 text-blue-500" />
              <Check className="h-3 w-3 text-blue-500 -ml-2" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
