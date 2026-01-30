import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, FileText, Image } from 'lucide-react';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import { useMessageTemplates, MessageTemplate } from '@/hooks/useMessageTemplates';

interface SendMessageNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopTitle: string;
  workshopStartDate: string;
  timezone: string;
  onSend: (params: {
    templateId: string;
    content: string;
    mediaUrl: string | null;
  }) => void;
  isSending: boolean;
  groupCount?: number;
}

export function SendMessageNowDialog({
  open,
  onOpenChange,
  workshopTitle,
  workshopStartDate,
  timezone,
  onSend,
  isSending,
  groupCount = 1,
}: SendMessageNowDialogProps) {
  const { templates, templatesLoading } = useMessageTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  // Process template content with variables - use org timezone
  const processedContent = useMemo(() => {
    if (!selectedTemplate) return '';
    return selectedTemplate.content
      .replace(/{workshop_name}/g, workshopTitle)
      .replace(/{date}/g, formatInOrgTime(workshopStartDate, timezone, 'MMMM d, yyyy'))
      .replace(/{time}/g, formatInOrgTime(workshopStartDate, timezone, 'h:mm a'));
  }, [selectedTemplate, workshopTitle, workshopStartDate, timezone]);

  const handleSend = () => {
    if (!selectedTemplate) return;
    onSend({
      templateId: selectedTemplate.id,
      content: processedContent,
      mediaUrl: selectedTemplate.media_url,
    });
  };

  const handleClose = () => {
    if (!isSending) {
      setSelectedTemplateId('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Message Now
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Select Template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              disabled={templatesLoading || isSending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {template.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message Preview */}
          {selectedTemplate && (
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <ScrollArea className="h-40 rounded-md border bg-muted/50 p-3">
                <div className="text-sm whitespace-pre-wrap">{processedContent}</div>
                {selectedTemplate.media_url && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Image className="h-4 w-4" />
                    <span>Media attached</span>
                  </div>
                )}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                Variables like {'{workshop_name}'} are replaced with actual values
              </p>
            </div>
          )}

          {/* Empty state */}
          {!selectedTemplate && !templatesLoading && templates.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No templates available. Create templates in Settings.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedTemplate || isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Now {groupCount > 1 ? `(${groupCount} groups)` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
