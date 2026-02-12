import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Video, Calendar, MessageCircle } from "lucide-react";
import { IntegrationCard } from "./IntegrationCard";
import { AddIntegrationDialog } from "./AddIntegrationDialog";

interface IntegrationConfig {
  [key: string]: string | boolean | undefined;
}

interface Integration {
  id: string;
  integration_type: string;
  integration_name: string | null;
  config: IntegrationConfig;
  is_active: boolean;
}

interface IntegrationSectionProps {
  type: "zoom" | "calendly" | "whatsapp" | "aisensy";
  integrations: Integration[];
  onSave: (data: { 
    type: string; 
    name: string; 
    config: Record<string, string>; 
    integrationId?: string 
  }) => Promise<void>;
  onDelete: (integrationId: string) => void;
  isSaving: boolean;
}

const sectionConfig = {
  zoom: {
    title: "Zoom Integrations",
    description: "Configure Zoom Server-to-Server OAuth credentials for automatic meeting creation",
    icon: Video,
    buttonLabel: "Add Zoom Account",
  },
  calendly: {
    title: "Calendly Integrations",
    description: "Configure Calendly API for automatic call scheduling",
    icon: Calendar,
    buttonLabel: "Add Calendly Account",
  },
  whatsapp: {
    title: "WhatsApp Integrations",
    description: "Configure AiSensy WhatsApp API for call reminders and notifications",
    icon: MessageCircle,
    buttonLabel: "Add WhatsApp Account",
  },
  aisensy: {
    title: "AISensy Accounts",
    description: "Configure AISensy WhatsApp API accounts for one-to-one call reminders",
    icon: MessageCircle,
    buttonLabel: "Add AISensy Account",
  },
};

export function IntegrationSection({
  type,
  integrations,
  onSave,
  onDelete,
  isSaving,
}: IntegrationSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  
  const config = sectionConfig[type];
  const Icon = config.icon;

  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingIntegration(null);
    }
  };

  const handleSave = async (data: { name: string; config: Record<string, string>; integrationId?: string }) => {
    await onSave({
      type,
      name: data.name,
      config: data.config,
      integrationId: data.integrationId,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {config.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {config.description}
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {config.buttonLabel}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {integrations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No {type} integrations configured yet.</p>
            <p className="text-sm">Click "{config.buttonLabel}" to add one.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onEdit={handleEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>

      <AddIntegrationDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        integrationType={type}
        existingIntegration={editingIntegration}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </Card>
  );
}
