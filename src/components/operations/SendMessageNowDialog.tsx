import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, FileText, Image } from 'lucide-react';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { extractVariables, categorizeVariables, getVariableLabel } from '@/lib/templateVariables';

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
  savedVariables?: Record<string, string>;
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
  savedVariables = {},
}: SendMessageNowDialogProps) {
  const { templates, templatesLoading } = useMessageTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [manualValues, setManualValues] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  // Extract and categorize variables from selected template
  const { manual } = useMemo(() => {
    if (!selectedTemplate?.content) return { autoFilled: [], manual: [] };
    const allVars = extractVariables(selectedTemplate.content);
    return categorizeVariables(allVars);
  }, [selectedTemplate?.content]);

  // Initialize manual values when template changes or dialog opens
  useEffect(() => {
    if (!selectedTemplate) {
      setManualValues({});
      return;
    }
    
    const initial: Record<string, string> = {};
    manual.forEach(key => {
      initial[key] = savedVariables[key] || '';
    });
    setManualValues(initial);
  }, [selectedTemplate?.id, manual.join(','), savedVariables]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId('');
      setManualValues({});
    }
  }, [open]);

  // Process template content with all variables replaced
  const processedContent = useMemo(() => {
    if (!selectedTemplate) return '';
    
    let content = selectedTemplate.content
      .replace(/{workshop_name}/gi, workshopTitle)
      .replace(/{date}/gi, formatInOrgTime(workshopStartDate, timezone, 'MMMM d, yyyy'))
      .replace(/{time}/gi, formatInOrgTime(workshopStartDate, timezone, 'h:mm a'));
    
    // Replace manual variables
    for (const [key, value] of Object.entries(manualValues)) {
      if (value) {
        content = content.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
      }
    }
    
    return content;
  }, [selectedTemplate, workshopTitle, workshopStartDate, timezone, manualValues]);

  // Validation - all manual variables must be filled
  const allManualFilled = manual.length === 0 || 
    manual.every(key => manualValues[key]?.trim());

  const handleSend = () => {
    if (!selectedTemplate || !allManualFilled) return;
    onSend({
      templateId: selectedTemplate.id,
      content: processedContent,
      mediaUrl: selectedTemplate.media_url,
    });
  };

  const handleClose = () => {
    if (!isSending) {
      setSelectedTemplateId('');
      setManualValues({});
      onOpenChange(false);
    }
  };

  const handleManualValueChange = (key: string, value: string) => {
    setManualValues(prev => ({ ...prev, [key]: value }));
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

          {/* Manual Variable Inputs */}
          {selectedTemplate && manual.length > 0 && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">Enter values for variables:</Label>
              {manual.map(key => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {getVariableLabel(key)} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={manualValues[key] || ''}
                    onChange={(e) => handleManualValueChange(key, e.target.value)}
                    placeholder={`Enter ${getVariableLabel(key).toLowerCase()}...`}
                    disabled={isSending}
                  />
                </div>
              ))}
            </div>
          )}

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
            disabled={!selectedTemplate || isSending || !allManualFilled}
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
