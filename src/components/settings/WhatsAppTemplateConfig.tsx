import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, MessageCircle } from "lucide-react";

interface TemplateConfig {
  name: string;
  isVideo: boolean;
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
  call_booked: { name: "", isVideo: true },
  two_days: { name: "", isVideo: false },
  one_day: { name: "", isVideo: false },
  three_hours: { name: "", isVideo: false },
  one_hour: { name: "", isVideo: false },
  thirty_minutes: { name: "", isVideo: false },
  ten_minutes: { name: "", isVideo: false },
  we_are_live: { name: "", isVideo: false },
};

const TEMPLATE_INFO = [
  { key: "call_booked", label: "Call Booked (Immediate)", description: "Sent immediately after call is scheduled", isVideo: true },
  { key: "two_days", label: "2 Days Before", description: "Reminder sent 2 days before the call", isVideo: false },
  { key: "one_day", label: "1 Day Before", description: "Reminder sent 1 day before the call", isVideo: false },
  { key: "three_hours", label: "3 Hours Before", description: "Reminder sent 3 hours before the call", isVideo: false },
  { key: "one_hour", label: "1 Hour Before", description: "Reminder sent 1 hour before the call", isVideo: false },
  { key: "thirty_minutes", label: "30 Minutes Before", description: "Reminder sent 30 minutes before the call", isVideo: false },
  { key: "ten_minutes", label: "10 Minutes Before", description: "Reminder with Zoom link, sent 10 minutes before", isVideo: false },
  { key: "we_are_live", label: "Call Started (Live)", description: "Sent when the call time arrives with Zoom link", isVideo: false },
];

interface WhatsAppTemplateConfigProps {
  templates: Record<string, unknown>;
  onChange: (templates: Record<string, unknown>) => void;
}

export function WhatsAppTemplateConfig({ templates, onChange }: WhatsAppTemplateConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse templates from config - handle both old and new format
  const parseTemplates = (): WhatsAppTemplatesState => {
    if (!templates || typeof templates !== "object") return DEFAULT_TEMPLATES;
    
    const parsed = { ...DEFAULT_TEMPLATES };
    Object.keys(DEFAULT_TEMPLATES).forEach((key) => {
      const templateKey = key as keyof WhatsAppTemplatesState;
      const templateData = templates[key];
      
      if (templateData && typeof templateData === "object") {
        const data = templateData as Record<string, unknown>;
        // Handle both old format (template_name) and new format (name)
        const name = (data.name as string) || (data.template_name as string) || "";
        const templateInfo = TEMPLATE_INFO.find(t => t.key === key);
        parsed[templateKey] = {
          name,
          isVideo: templateInfo?.isVideo ?? false,
        };
      }
    });
    return parsed;
  };

  const currentTemplates = parseTemplates();

  const handleTemplateChange = (key: string, value: string) => {
    const templateInfo = TEMPLATE_INFO.find(t => t.key === key);
    const updated = {
      ...templates,
      [key]: {
        name: value,
        isVideo: templateInfo?.isVideo ?? false,
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
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{info.label}</h4>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                    {info.isVideo && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Video Template
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Template Name</Label>
                    <Input
                      placeholder="e.g., call_reminder_template"
                      value={template?.name || ""}
                      onChange={(e) => handleTemplateChange(info.key, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              );
            })}
            
            <p className="text-xs text-muted-foreground">
              Leave template names empty to skip that reminder. Video URL is configured at the integration level above.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
