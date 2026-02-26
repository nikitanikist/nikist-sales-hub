import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { WhatsAppTemplateConfig } from "./WhatsAppTemplateConfig";
import { TestConnectionButton } from "./TestConnectionButton";

interface IntegrationConfig {
  [key: string]: string | boolean | undefined | Record<string, unknown>;
  templates?: Record<string, unknown>;
}

interface Integration {
  id: string;
  integration_type: string;
  integration_name: string | null;
  config: IntegrationConfig;
  is_active: boolean;
}

interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationType: "zoom" | "calendly" | "whatsapp" | "aisensy" | "bolna";
  existingIntegration?: Integration | null;
  onSave: (data: { name: string; config: Record<string, unknown>; integrationId?: string }) => Promise<void>;
  isSaving: boolean;
}

const getFieldsForType = (type: string) => {
  switch (type) {
    case "zoom":
      return [
        { key: "account_id", label: "Account ID", placeholder: "Enter Zoom Account ID", secret: true },
        { key: "client_id", label: "Client ID", placeholder: "Enter Zoom Client ID", secret: true },
        { key: "client_secret", label: "Client Secret", placeholder: "Enter Zoom Client Secret", secret: true },
        { key: "host_email", label: "Host Email", placeholder: "zoom-host@company.com", secret: false },
      ];
    case "calendly":
      return [
        { key: "api_token", label: "API Token", placeholder: "Enter Calendly Personal Access Token", secret: true },
        { key: "calendly_url", label: "Calendly URL", placeholder: "https://calendly.com/your-name/event", secret: false },
        { key: "event_type_uri", label: "Event Type URI", placeholder: "https://api.calendly.com/event_types/...", secret: false },
      ];
    case "whatsapp":
      return [
        { key: "api_key", label: "AiSensy API Key", placeholder: "Enter AiSensy API Key", secret: true },
        { key: "source", label: "Source Number", placeholder: "919266395637", secret: false },
        { key: "support_number", label: "Support Number", placeholder: "+919266395637", secret: false },
        { key: "video_url", label: "Video URL for Call Booking", placeholder: "https://...video.mp4", secret: false },
      ];
    case "aisensy":
      return [
        { key: "api_key", label: "AISensy API Key", placeholder: "Enter AISensy API Key", secret: true },
        { key: "source", label: "Source Number", placeholder: "919266395637", secret: false },
      ];
    case "bolna":
      return [
        { key: "api_key", label: "Bolna API Key", placeholder: "Enter Bolna API Key", secret: true },
        { key: "agent_id", label: "Default Agent ID", placeholder: "Enter default Bolna Agent ID", secret: false },
        { key: "webhook_secret", label: "Webhook Secret", placeholder: "Enter webhook verification secret", secret: true },
      ];
    default:
      return [];
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "zoom": return "Zoom";
    case "calendly": return "Calendly";
    case "whatsapp": return "WhatsApp";
    case "aisensy": return "AISensy";
    case "bolna": return "Calling Agent";
    default: return type;
  }
};

export function AddIntegrationDialog({
  open,
  onOpenChange,
  integrationType,
  existingIntegration,
  onSave,
  isSaving,
}: AddIntegrationDialogProps) {
  const isEditing = !!existingIntegration;
  const fields = getFieldsForType(integrationType);
  
  const [name, setName] = useState(existingIntegration?.integration_name || "");
  const [config, setConfig] = useState<Record<string, string>>(() => {
    if (existingIntegration?.config) {
      const existingConfig = existingIntegration.config;
      const initialConfig: Record<string, string> = {};
      fields.forEach((field) => {
        // Handle both direct values and env secret references
        if (existingConfig.uses_env_secrets && existingConfig[`${field.key}_secret`]) {
          initialConfig[field.key] = `[Env: ${existingConfig[`${field.key}_secret`]}]`;
        } else {
          const value = existingConfig[field.key];
          initialConfig[field.key] = typeof value === "string" ? value : "";
        }
      });
      return initialConfig;
    }
    return {};
  });
  
  // WhatsApp template configuration
  const [templates, setTemplates] = useState<Record<string, unknown>>(() => {
    if (existingIntegration?.config?.templates) {
      return existingIntegration.config.templates as Record<string, unknown>;
    }
    return {};
  });

  // Sync state when dialog opens with existing integration
  useEffect(() => {
    if (open) {
      if (existingIntegration) {
        // Sync name
        setName(existingIntegration.integration_name || "");
        
        // Sync config fields
        const existingConfig = existingIntegration.config || {};
        const newConfig: Record<string, string> = {};
        fields.forEach((field) => {
          if (existingConfig.uses_env_secrets && existingConfig[`${field.key}_secret`]) {
            newConfig[field.key] = `[Env: ${existingConfig[`${field.key}_secret`]}]`;
          } else {
            const value = existingConfig[field.key];
            newConfig[field.key] = typeof value === "string" ? value : "";
          }
        });
        setConfig(newConfig);
        
        // Sync templates (for WhatsApp)
        if (existingConfig.templates) {
          setTemplates(existingConfig.templates as Record<string, unknown>);
        } else {
          setTemplates({});
        }
      } else {
        // Reset form for new integration
        setName("");
        setConfig({});
        setTemplates({});
      }
    }
  }, [open, existingIntegration?.id]);

  const handleSave = async () => {
    // Filter out empty values and env references that weren't changed
    const cleanConfig: Record<string, unknown> = {};
    Object.entries(config).forEach(([key, value]) => {
      if (value && !value.startsWith("[Env:")) {
        cleanConfig[key] = value;
      }
    });
    
    // Add templates for WhatsApp
    if (integrationType === "whatsapp" && Object.keys(templates).length > 0) {
      cleanConfig.templates = templates;
    }

    await onSave({
      name: name || `${getTypeLabel(integrationType)} Integration`,
      config: cleanConfig,
      integrationId: existingIntegration?.id,
    });
    
    // Reset form
    setName("");
    setConfig({});
    setTemplates({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Add"} {getTypeLabel(integrationType)} Integration
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the integration configuration. Leave fields unchanged to keep existing values."
              : `Configure a new ${getTypeLabel(integrationType)} integration for your organization.`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="integration-name">Integration Name</Label>
            <Input
              id="integration-name"
              placeholder={`e.g., "${getTypeLabel(integrationType)} - Main Account"`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this integration (e.g., "Free Leads WhatsApp", "Dipanshu Calendly")
            </p>
          </div>

          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.secret ? "password" : "text"}
                placeholder={field.placeholder}
                value={config[field.key] || ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
              {isEditing && config[field.key]?.startsWith("[Env:") && (
                <p className="text-xs text-muted-foreground">
                  Currently using environment secret. Enter a new value to override.
                </p>
              )}
            </div>
          ))}
          
          {/* Test Connection Button */}
          <div className="pt-2">
            <TestConnectionButton 
              integrationType={integrationType} 
              config={config} 
            />
          </div>
          
          {/* WhatsApp Template Configuration */}
          {integrationType === "whatsapp" && (
            <WhatsAppTemplateConfig 
              templates={templates} 
              onChange={setTemplates} 
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? "Update" : "Save"} Integration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
