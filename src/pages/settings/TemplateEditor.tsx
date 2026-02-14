import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Save, Loader2, Circle } from 'lucide-react';
import { useMessageTemplates, TEMPLATE_VARIABLES } from '@/hooks/useMessageTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { 
  TemplateMediaUpload, 
  validateWhatsAppMedia, 
  getMediaType,
  MediaType 
} from '@/components/settings/TemplateMediaUpload';
import { WhatsAppPreview } from '@/components/settings/WhatsAppPreview';
import { MessageToolbar } from '@/components/settings/MessageToolbar';

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { templates, createTemplate, updateTemplate, isCreating, isUpdating } = useMessageTemplates();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(!!id);

  const isEditing = !!id;
  const isSaving = isCreating || isUpdating;

  // Determine back navigation based on current route
  const isWhatsAppContext = window.location.pathname.startsWith('/whatsapp');
  const backPath = isWhatsAppContext ? '/whatsapp/templates' : '/settings?tab=templates';
  const backLabel = isWhatsAppContext ? 'Back to Templates' : 'Back to Templates';

  // Load existing template if editing
  useEffect(() => {
    if (id && templates.length > 0) {
      const template = templates.find(t => t.id === id);
      if (template) {
        setName(template.name);
        setContent(template.content);
        setDescription(template.description || '');
        setMediaUrl(template.media_url || null);
        // Extract file name from URL if present
        if (template.media_url) {
          const urlParts = template.media_url.split('/');
          const fullFileName = urlParts[urlParts.length - 1];
          // Remove timestamp prefix if present (format: timestamp_filename)
          const nameParts = fullFileName.split('_');
          if (nameParts.length > 1 && !isNaN(Number(nameParts[0]))) {
            setFileName(nameParts.slice(1).join('_'));
          } else {
            setFileName(fullFileName);
          }
        }
        setIsLoading(false);
      }
    } else if (!id) {
      setIsLoading(false);
    }
  }, [id, templates]);

  // Handle media upload to Supabase Storage
  const uploadMedia = async (file: File): Promise<string> => {
    if (!currentOrganization) {
      throw new Error('No organization selected');
    }

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${currentOrganization.id}/${timestamp}_${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from('template-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('template-media')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  // Delete media from storage
  const deleteMedia = async (url: string) => {
    try {
      // Extract file path from URL
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/template-media\/(.+)$/);
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        await supabase.storage
          .from('template-media')
          .remove([filePath]);
      }
    } catch (error) {
      console.error('Failed to delete media:', error);
    }
  };

  // Handle file selection
  const handleMediaSelect = async (file: File) => {
    // Validate file
    const validation = validateWhatsAppMedia(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadMedia(file);
      setMediaUrl(url);
      setMediaFile(file);
      setFileName(file.name);
      toast.success('Media uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload media');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle media removal
  const handleMediaRemove = async () => {
    if (mediaUrl) {
      await deleteMedia(mediaUrl);
    }
    setMediaUrl(null);
    setMediaFile(null);
    setFileName(null);
  };

  // Handle save
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!content.trim()) {
      toast.error('Message content is required');
      return;
    }

    try {
      if (isEditing && id) {
        updateTemplate({
          id,
          name: name.trim(),
          content: content.trim(),
          description: description.trim() || undefined,
          media_url: mediaUrl,
        });
      } else {
        await createTemplate({
          name: name.trim(),
          content: content.trim(),
          description: description.trim() || undefined,
          media_url: mediaUrl,
        });
      }
      navigate(backPath);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  // Insert text at cursor position
  const handleInsertText = (before: string, after?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + before + (after || ''));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = content;
    
    if (after && start === end) {
      // No selection, insert markers and position cursor between them
      const newValue = currentValue.substring(0, start) + before + after + currentValue.substring(end);
      setContent(newValue);
      // Position cursor between the markers
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length);
      }, 0);
    } else {
      // Has selection or just inserting text
      const newValue = currentValue.substring(0, start) + before + currentValue.substring(end);
      setContent(newValue);
    }
  };

  // Insert variable
  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + ' ' + variable);
      return;
    }

    const start = textarea.selectionStart;
    const newValue = content.substring(0, start) + variable + content.substring(start);
    setContent(newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  // Determine media type for preview
  const currentMediaType: MediaType = mediaFile 
    ? getMediaType(mediaFile) 
    : (mediaUrl?.toLowerCase().includes('.mp4') ? 'video' 
       : mediaUrl?.toLowerCase().includes('.pdf') ? 'document' 
       : 'image');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b z-10">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(backPath)}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Template Name Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Circle className="h-3 w-3 fill-primary stroke-primary" />
            <span className="text-sm font-medium uppercase tracking-wide">Template Name</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Reminder, We Are Live, etc."
              className="text-lg"
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description (optional)"
              className="text-muted-foreground"
            />
          </div>
        </div>

        {/* Edit and Preview Section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Circle className="h-3 w-3 fill-primary stroke-primary" />
            <span className="text-sm font-medium uppercase tracking-wide">Edit and Preview Template</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Compose Panel */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Compose</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4">
              {/* Media Upload */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Media Attachment</Label>
                <TemplateMediaUpload
                  mediaUrl={mediaUrl}
                  mediaFile={mediaFile}
                  fileName={fileName}
                  isUploading={isUploading}
                  onSelect={handleMediaSelect}
                  onRemove={handleMediaRemove}
                />
              </div>

              {/* Message Content */}
              <div className="flex-1 flex flex-col space-y-2">
                <Label className="text-sm text-muted-foreground">Message</Label>
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your message here...

Use variables like {workshop_name} to personalize messages.
Use *text* for bold and _text_ for italic."
                  className="flex-1 min-h-[200px] resize-none"
                />
                
                {/* Quick variable badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <Badge
                      key={v.key}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-secondary transition-colors"
                      onClick={() => handleInsertVariable(v.key)}
                      title={v.description}
                    >
                      {v.key}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Toolbar */}
              <MessageToolbar
                onAttachClick={() => fileInputRef.current?.click()}
                onInsertText={handleInsertText}
                onInsertVariable={handleInsertVariable}
                textareaRef={textareaRef}
              />

              {/* Hidden file input for toolbar */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMediaSelect(file);
                  e.target.value = '';
                }}
              />
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card className="bg-[#efeae2] overflow-hidden">
            <CardHeader className="pb-3 bg-white/80 backdrop-blur-sm">
              <CardTitle className="text-lg font-semibold">Preview Message</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <WhatsAppPreview
                content={content}
                mediaUrl={mediaUrl}
                mediaType={currentMediaType}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
