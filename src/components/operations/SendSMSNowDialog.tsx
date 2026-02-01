import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, FileText } from 'lucide-react';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import { useSMSTemplates, SMSTemplate } from '@/hooks/useSMSTemplates';

interface SendSMSNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopTitle: string;
  workshopStartDate: string;
  timezone: string;
  onSend: (params: {
    templateId: string;
    variableValues: Record<string, string>;
  }) => void;
  isSending: boolean;
  recipientCount?: number;
}

export function SendSMSNowDialog({
  open,
  onOpenChange,
  workshopTitle,
  workshopStartDate,
  timezone,
  onSend,
  isSending,
  recipientCount = 0,
}: SendSMSNowDialogProps) {
  const { templates, templatesLoading } = useSMSTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [manualValues, setManualValues] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  // Get manual variables (not auto-filled)
  const manualVariables = useMemo(() => {
    if (!selectedTemplate?.variables) return [];
    const autoFilledKeys = ['name', 'workshop_name', 'date', 'time'];
    return selectedTemplate.variables.filter(v => 
      !autoFilledKeys.includes(v.key) &&
      !v.label?.toLowerCase().includes('name') &&
      !v.label?.toLowerCase().includes('date') &&
      !v.label?.toLowerCase().includes('time')
    );
  }, [selectedTemplate]);

  // Initialize manual values when template changes
  useEffect(() => {
    if (!selectedTemplate) {
      setManualValues({});
      return;
    }
    
    const initial: Record<string, string> = {};
    manualVariables.forEach(v => {
      initial[v.key] = '';
    });
    setManualValues(initial);
  }, [selectedTemplate?.id]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId('');
      setManualValues({});
    }
  }, [open]);

  // Build preview by replacing variables
  const processedContent = useMemo(() => {
    if (!selectedTemplate) return '';
    
    let content = selectedTemplate.content_preview;
    
    // Replace auto-filled variables
    const autoValues: Record<string, string> = {
      workshop_name: workshopTitle,
      date: formatInOrgTime(workshopStartDate, timezone, 'MMMM d, yyyy'),
      time: formatInOrgTime(workshopStartDate, timezone, 'h:mm a'),
      name: '[Registrant Name]',
    };
    
    for (const [key, value] of Object.entries(autoValues)) {
      content = content.replace(new RegExp(`\\{#${key}#\\}`, 'gi'), value);
      content = content.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
    }
    
    // Replace manual variables
    for (const [key, value] of Object.entries(manualValues)) {
      if (value) {
        content = content.replace(new RegExp(`\\{#${key}#\\}`, 'gi'), value);
        content = content.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
      }
    }
    
    return content;
  }, [selectedTemplate, workshopTitle, workshopStartDate, timezone, manualValues]);

  // Validation - all manual variables must be filled
  const allManualFilled = manualVariables.length === 0 || 
    manualVariables.every(v => manualValues[v.key]?.trim());

  const handleSend = () => {
    if (!selectedTemplate || !allManualFilled) return;
    
    // Build complete variable values
    const variableValues: Record<string, string> = {
      ...manualValues,
      workshop_name: workshopTitle,
      date: formatInOrgTime(workshopStartDate, timezone, 'MMMM d, yyyy'),
      time: formatInOrgTime(workshopStartDate, timezone, 'h:mm a'),
    };
    
    onSend({
      templateId: selectedTemplate.id,
      variableValues,
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
            Send SMS Now
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
                <SelectValue placeholder="Choose an SMS template..." />
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
          {selectedTemplate && manualVariables.length > 0 && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">Enter values for variables:</Label>
              {manualVariables.map(v => (
                <div key={v.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {v.label} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={manualValues[v.key] || ''}
                    onChange={(e) => handleManualValueChange(v.key, e.target.value)}
                    placeholder={`Enter ${v.label.toLowerCase()}...`}
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
              <ScrollArea className="h-32 rounded-md border bg-muted/50 p-3">
                <div className="text-sm whitespace-pre-wrap">{processedContent}</div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                Variables will be replaced with actual values for each recipient
              </p>
            </div>
          )}

          {/* Empty state */}
          {!selectedTemplate && !templatesLoading && templates.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No SMS templates available. Create templates in Settings.
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
                Send Now {recipientCount > 0 ? `(${recipientCount} recipients)` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
