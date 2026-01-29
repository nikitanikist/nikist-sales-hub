import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, MessageCircle } from "lucide-react";

interface TemplateConfig {
  template_name: string;
  video_url?: string;
}

interface WhatsAppTemplatesState {
  call_booked: TemplateConfig;
  two_days: TemplateConfig;
  one_day: TemplateConfig;
  three_hours: TemplateConfig;
  one_hour: TemplateConfig;
  thirty_minutes: TemplateConfig;
  ten_minutes: TemplateConfig;
  we_are_live: TemplateConfig;
}

const DEFAULT_TEMPLATES: WhatsAppTemplatesState = {
  call_booked: { template_name: "", video_url: "" },
  two_days: { template_name: "" },
  one_day: { template_name: "" },
  three_hours: { template_name: "" },
  one_hour: { template_name: "" },
  thirty_minutes: { template_name: "" },
  ten_minutes: { template_name: "" },
  we_are_live: { template_name: "" },
};

const TEMPLATE_INFO = [
  { key: "call_booked", label: "Call Booked (Immediate)", description: "Sent immediately after call is scheduled", hasVideo: true },
  { key: "two_days", label: "2 Days Before", description: "Reminder sent 2 days before the call", hasVideo: false },
  { key: "one_day", label: "1 Day Before", description: "Reminder sent 1 day before the call", hasVideo: false },
  { key: "three_hours", label: "3 Hours Before", description: "Reminder sent 3 hours before the call", hasVideo: false },
  { key: "one_hour", label: "1 Hour Before", description: "Reminder sent 1 hour before the call", hasVideo: false },
  { key: "thirty_minutes", label: "30 Minutes Before", description: "Reminder sent 30 minutes before the call", hasVideo: false },
  { key: "ten_minutes", label: "10 Minutes Before", description: "Reminder with Zoom link, sent 10 minutes before", hasVideo: false },
  { key: "we_are_live", label: "Call Started (Live)", description: "Sent when the call time arrives with Zoom link", hasVideo: false },
];

interface WhatsAppTemplateConfigProps {
  templates: Record<string, unknown>;
  onChange: (templates: Record<string, unknown>) => void;
}

export function WhatsAppTemplateConfig({ templates, onChange }: WhatsAppTemplateConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse templates from config
  const parseTemplates = (): WhatsAppTemplatesState => {
    if (!templates || typeof templates !== "object") return DEFAULT_TEMPLATES;
    
    const parsed = { ...DEFAULT_TEMPLATES };
    Object.keys(DEFAULT_TEMPLATES).forEach((key) => {
      const templateKey = key as keyof WhatsAppTemplatesState;
      if (templates[key] && typeof templates[key] === "object") {
        parsed[templateKey] = templates[key] as TemplateConfig;
      }
    });
    return parsed;
  };

  const currentTemplates = parseTemplates();

  const handleTemplateChange = (key: string, field: "template_name" | "video_url", value: string) => {
    const updated = {
      ...templates,
      [key]: {
        ...(templates[key] as TemplateConfig || {}),
        [field]: value,
      },
    };
    onChange(updated);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="h-4 w-4" />
                  Template Configuration
                </CardTitle>
                <CardDescription className="mt-1">
                  Configure AiSensy template names for each reminder type
                </CardDescription>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {TEMPLATE_INFO.map((info) => {
              const templateKey = info.key as keyof WhatsAppTemplatesState;
              const template = currentTemplates[templateKey];
              
              return (
                <div key={info.key} className="p-3 border rounded-lg space-y-3">
                  <div>
                    <h4 className="font-medium text-sm">{info.label}</h4>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Template Name</Label>
                      <Input
                        placeholder="e.g., call_reminder_template"
                        value={template?.template_name || ""}
                        onChange={(e) => handleTemplateChange(info.key, "template_name", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    {info.hasVideo && (
                      <div className="space-y-1">
                        <Label className="text-xs">Video URL (for video templates)</Label>
                        <Input
                          placeholder="https://...video.mp4"
                          value={template?.video_url || ""}
                          onChange={(e) => handleTemplateChange(info.key, "video_url", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            <p className="text-xs text-muted-foreground">
              Leave template names empty to skip that reminder. The system will use your AiSensy account templates.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
