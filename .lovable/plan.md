

# Template Editor Redesign - Full Page with Media Upload

## Overview

This plan transforms the basic template editor dialog into a professional full-page template composer with side-by-side editing and live WhatsApp preview, inspired by the competitor screenshots provided. The new editor will support file uploads for images, videos, and documents with proper WhatsApp validation.

---

## Design Inspiration Analysis

From the screenshots provided:

| Feature | Description |
|---------|-------------|
| Go Back Button | Top-left navigation to return to template list |
| Template Name | Input field at top with "Update template" button |
| Two-Column Layout | Left: Compose area, Right: Live preview |
| Media Attachment | File appears as a card with thumbnail, name, actions |
| Message Content | Textarea with attached media shown above it |
| Formatting Toolbar | Bottom bar with attachment, emoji, bold, italic, variables |
| WhatsApp Preview | Realistic message bubble with sender info and timestamp |

---

## Architecture Approach

Instead of modifying the existing dialog, create a **dedicated route** for template editing:

```
/settings/templates/new     → Create new template
/settings/templates/:id     → Edit existing template
```

This provides:
- Full screen real estate for the two-column layout
- Better UX for the complex editor
- Cleaner separation of concerns
- Ability to navigate back with proper state

---

## Implementation Plan

### 1. Create Storage Bucket for Template Media

**Database Migration:**
- Create `template-media` storage bucket with public access
- Set up RLS policies for organization-scoped uploads
- Allow image, video, and document file types

**Bucket Configuration:**
| Setting | Value |
|---------|-------|
| Name | `template-media` |
| Public | Yes (for WhatsApp to access URLs) |
| File Size Limit | 16MB (conservative for WhatsApp) |
| Allowed Types | image/jpeg, image/png, video/mp4, application/pdf |

### 2. Create Template Editor Page

**New File:** `src/pages/settings/TemplateEditor.tsx`

**Layout Structure:**
```
+--------------------------------------------------------------+
| [← Back to Templates]                    [Save Template]     |
+--------------------------------------------------------------+
| Template Name: [____________________]                        |
+--------------------------------------------------------------+
|                                                              |
| +------------------------+  +-----------------------------+  |
| | Compose               |  | Preview Message             |  |
| +------------------------+  +-----------------------------+  |
| |                        |  |                             |  |
| | [Media Attachment]     |  |  WhatsApp-style preview     |  |
| |  +----------------+    |  |  with realistic bubbles     |  |
| |  | [img] file.jpg |    |  |                             |  |
| |  +----------------+    |  |  +----------------------+   |  |
| |                        |  |  | [Media Preview]      |   |  |
| | [Textarea]             |  |  | Message text here... |   |  |
| | Message content...     |  |  | 2:42 PM ✓✓           |   |  |
| |                        |  |  +----------------------+   |  |
| |                        |  |                             |  |
| +------------------------+  +-----------------------------+  |
| | [📎] [😊] [B] [I] [{x}]|                                |  |
| +------------------------+                                   |
+--------------------------------------------------------------+
```

### 3. Media Upload Component

**New File:** `src/components/settings/TemplateMediaUpload.tsx`

**Features:**
- Drag and drop zone
- File type icons (image/video/document)
- Upload progress indicator
- Remove/replace media button
- File size validation with clear error messages

**WhatsApp Media Validation:**
| Type | Max Size | Formats |
|------|----------|---------|
| Image | 16MB | JPEG, PNG, WEBP |
| Video | 16MB | MP4 |
| Document | 16MB | PDF |

### 4. WhatsApp Preview Component

**New File:** `src/components/settings/WhatsAppPreview.tsx`

**Features:**
- Realistic WhatsApp message bubble styling
- Team Nikist sender header with phone number
- Timestamp showing current time
- Media preview (image/video thumbnail/document icon)
- Message text with variable highlighting
- Green chat background

### 5. Formatting Toolbar Component

**New File:** `src/components/settings/MessageToolbar.tsx`

**Toolbar Actions:**
| Icon | Action |
|------|--------|
| 📎 (Paperclip) | Open file picker for media upload |
| 😊 (Smile) | Emoji picker (future enhancement) |
| **B** | Insert bold formatting (*text*) |
| *I* | Insert italic formatting (_text_) |
| { } | Insert variable picker dropdown |
| 📊 | Poll/Survey (placeholder for future) |

### 6. Update Routing

**File:** `src/App.tsx`

Add new routes:
```tsx
<Route path="/settings/templates/new" element={<TemplateEditor />} />
<Route path="/settings/templates/:id" element={<TemplateEditor />} />
```

### 7. Update Hook for Media Upload

**File:** `src/hooks/useMessageTemplates.ts`

**Add functions:**
- `uploadTemplateMedia(file: File): Promise<string>` - Upload to storage, return public URL
- `deleteTemplateMedia(url: string): Promise<void>` - Remove from storage
- Update `createTemplate` and `updateTemplate` to handle media URL

---

## Detailed Component Specifications

### TemplateEditor Page

```tsx
function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Load existing template if editing
  useEffect(() => {
    if (id) {
      loadTemplate(id);
    }
  }, [id]);
  
  // Handle media upload
  const handleMediaSelect = async (file: File) => {
    // Validate file type and size
    const validation = validateWhatsAppMedia(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    
    setIsUploading(true);
    try {
      const url = await uploadTemplateMedia(file);
      setMediaUrl(url);
      setMediaFile(file);
    } catch (error) {
      toast.error('Failed to upload media');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle save
  const handleSave = async () => {
    await createOrUpdateTemplate({
      id,
      name,
      content,
      description,
      media_url: mediaUrl
    });
    navigate('/settings');
  };
  
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b z-10">
        <div className="container py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/settings')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {id ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </div>
      
      {/* Template Name Section */}
      <div className="container py-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Circle className="h-4 w-4" />
          <span className="font-medium">Template Name</span>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter template name"
          className="max-w-md"
        />
      </div>
      
      {/* Edit and Preview Section */}
      <div className="container pb-8">
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Circle className="h-4 w-4" />
          <span className="font-medium">Edit and preview template</span>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Compose Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compose</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Media Attachment Area */}
              <TemplateMediaUpload
                mediaUrl={mediaUrl}
                mediaFile={mediaFile}
                isUploading={isUploading}
                onSelect={handleMediaSelect}
                onRemove={() => {
                  setMediaFile(null);
                  setMediaUrl(null);
                }}
              />
              
              {/* Message Content */}
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Message..."
                className="min-h-[200px] resize-none"
              />
              
              {/* Variable badges */}
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map(v => (
                  <Badge
                    key={v.key}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setContent(prev => prev + v.key)}
                  >
                    {v.key}
                  </Badge>
                ))}
              </div>
            </CardContent>
            
            {/* Toolbar */}
            <div className="border-t p-3 flex gap-2">
              <Button variant="ghost" size="icon" onClick={triggerFileInput}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" disabled>
                <Smile className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={insertBold}>
                <Bold className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={insertItalic}>
                <Italic className="h-4 w-4" />
              </Button>
              <VariablePickerDropdown onSelect={insertVariable} />
            </div>
          </Card>
          
          {/* Preview Panel */}
          <Card className="bg-[#efeae2]">
            <CardHeader>
              <CardTitle className="text-lg">Preview message</CardTitle>
            </CardHeader>
            <CardContent>
              <WhatsAppPreview
                content={content}
                mediaUrl={mediaUrl}
                mediaType={getMediaType(mediaFile)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

### TemplateMediaUpload Component

```tsx
function TemplateMediaUpload({ mediaUrl, mediaFile, isUploading, onSelect, onRemove }) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // File type detection
  const mediaType = mediaFile ? getMediaType(mediaFile) : 'image';
  
  if (mediaUrl) {
    return (
      <div className="border rounded-lg p-3 bg-muted/50">
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          {mediaType === 'image' && (
            <img src={mediaUrl} className="h-12 w-12 rounded object-cover" />
          )}
          {mediaType === 'video' && (
            <div className="h-12 w-12 rounded bg-blue-100 flex items-center justify-center">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
          )}
          {mediaType === 'document' && (
            <div className="h-12 w-12 rounded bg-red-100 flex items-center justify-center">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
          )}
          
          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{mediaFile?.name || 'Media'}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(mediaFile?.size || 0)}
            </p>
          </div>
          
          {/* Actions */}
          <Button variant="ghost" size="icon" onClick={() => inputRef.current?.click()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
  
  if (isUploading) {
    return (
      <div className="border-2 border-dashed rounded-lg p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>
      </div>
    );
  }
  
  return (
    <div
      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">Upload media</p>
      <p className="text-xs text-muted-foreground mt-1">
        Image, video, or PDF (max 16MB)
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
        onChange={(e) => onSelect(e.target.files?.[0])}
      />
    </div>
  );
}
```

### WhatsAppPreview Component

```tsx
function WhatsAppPreview({ content, mediaUrl, mediaType }) {
  const now = new Date();
  const timeString = format(now, 'h:mm a');
  
  return (
    <div className="min-h-[400px] bg-[#efeae2] p-4 rounded-lg">
      {/* Chat header */}
      <div className="bg-white rounded-lg shadow mb-4 p-3 flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-green-500 text-white">TN</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-green-600">Team Nikist</p>
          <p className="text-xs text-muted-foreground">+91 97178 17488</p>
        </div>
      </div>
      
      {/* Message bubble */}
      <div className="flex justify-end">
        <div className="bg-[#dcf8c6] rounded-lg shadow max-w-[85%] overflow-hidden">
          {/* Media */}
          {mediaUrl && mediaType === 'image' && (
            <img src={mediaUrl} className="w-full max-h-64 object-cover" />
          )}
          {mediaUrl && mediaType === 'video' && (
            <div className="bg-black aspect-video flex items-center justify-center">
              <Play className="h-12 w-12 text-white/80" />
            </div>
          )}
          {mediaUrl && mediaType === 'document' && (
            <div className="bg-gray-100 p-4 flex items-center gap-3">
              <FileText className="h-8 w-8 text-red-500" />
              <span className="font-medium">Document</span>
            </div>
          )}
          
          {/* Text content */}
          {content && (
            <div className="p-3">
              <p className="whitespace-pre-wrap">
                {highlightVariables(content)}
              </p>
            </div>
          )}
          
          {/* Timestamp */}
          <div className="text-right px-3 pb-2">
            <span className="text-xs text-gray-500">{timeString}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Database Migration

```sql
-- Create storage bucket for template media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-media',
  'template-media',
  true,
  16777216, -- 16MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
);

-- RLS Policy: Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'template-media');

-- RLS Policy: Allow public read access
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'template-media');

-- RLS Policy: Allow delete by uploader
CREATE POLICY "Allow delete by uploader" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'template-media' AND auth.uid()::text = owner::text);
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/settings/TemplateEditor.tsx` | Create | Full-page template editor with split layout |
| `src/components/settings/TemplateMediaUpload.tsx` | Create | Drag-drop media upload with validation |
| `src/components/settings/WhatsAppPreview.tsx` | Create | Realistic WhatsApp message preview |
| `src/components/settings/MessageToolbar.tsx` | Create | Formatting toolbar with variable picker |
| `src/hooks/useMessageTemplates.ts` | Modify | Add media upload/delete functions |
| `src/App.tsx` | Modify | Add new routes for template editor |
| `src/pages/settings/WorkshopNotificationSettings.tsx` | Modify | Update template list to navigate to new editor |

---

## WhatsApp Media Validation

```typescript
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

function validateWhatsAppMedia(file: File): { valid: boolean; error?: string } {
  const type = getMediaCategory(file.type);
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
```

---

## Navigation Flow

```
Settings Page (Tabs)
    └── Templates Tab
        ├── Template List (table with name, preview, actions)
        └── "New Template" button → /settings/templates/new
            
Template Editor Page
    ├── Back button → /settings (with tab state preserved)
    ├── Template name input
    ├── Two-column layout
    │   ├── Left: Compose
    │   │   ├── Media upload zone
    │   │   ├── Message textarea
    │   │   ├── Variable badges
    │   │   └── Formatting toolbar
    │   └── Right: WhatsApp Preview
    │       ├── Chat header
    │       └── Message bubble with media + text
    └── Save button
```

---

## Summary

This redesign provides:

1. **Professional UX** - Full-page editor matching competitor quality
2. **Real File Uploads** - Storage bucket with proper validation
3. **Live Preview** - Realistic WhatsApp message rendering
4. **Media Validation** - Enforces WhatsApp size/format limits
5. **Intuitive Toolbar** - Quick access to formatting and variables
6. **Responsive Design** - Works on desktop and tablet

