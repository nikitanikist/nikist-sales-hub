import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Edit, Trash2, Eye, EyeOff, CheckCircle, XCircle, 
  Video, Calendar, MessageCircle 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

interface IntegrationCardProps {
  integration: Integration;
  onEdit: (integration: Integration) => void;
  onDelete: (integrationId: string) => void;
}

const getIntegrationIcon = (type: string) => {
  if (type.startsWith("zoom")) return <Video className="h-5 w-5" />;
  if (type.startsWith("calendly")) return <Calendar className="h-5 w-5" />;
  if (type.startsWith("whatsapp")) return <MessageCircle className="h-5 w-5" />;
  if (type.startsWith("aisensy")) return <MessageCircle className="h-5 w-5" />;
  return null;
};

const getDisplayValue = (config: IntegrationConfig, key: string): string => {
  // Check if using env secret reference
  if (config.uses_env_secrets && config[`${key}_secret`]) {
    return `[Env: ${config[`${key}_secret`]}]`;
  }
  const value = config[key];
  return typeof value === "string" ? value : "";
};

const maskValue = (value: string): string => {
  if (!value) return "";
  if (value.startsWith("[Env:")) return value; // Don't mask env references
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
};

export function IntegrationCard({ integration, onEdit, onDelete }: IntegrationCardProps) {
  const [revealSecrets, setRevealSecrets] = useState(false);
  const config = integration.config || {};

  const getConfigFields = () => {
    const type = integration.integration_type;
    
    if (type.startsWith("zoom") || type === "zoom") {
      return [
        { key: "account_id", label: "Account ID", secret: true },
        { key: "client_id", label: "Client ID", secret: true },
        { key: "client_secret", label: "Client Secret", secret: true },
        { key: "host_email", label: "Host Email", secret: false },
      ];
    }
    
    if (type.startsWith("calendly")) {
      return [
        { key: "api_token", label: "API Token", secret: true },
        { key: "calendly_url", label: "Calendly URL", secret: false },
        { key: "event_type_uri", label: "Event Type URI", secret: false },
      ];
    }
    
    if (type.startsWith("whatsapp")) {
      return [
        { key: "api_key", label: "API Key", secret: true },
        { key: "source", label: "Source Number", secret: false },
        { key: "video_url", label: "Video URL", secret: false },
        { key: "support_number", label: "Support Number", secret: false },
      ];
    }

    if (type.startsWith("aisensy")) {
      return [
        { key: "api_key", label: "API Key", secret: true },
        { key: "source", label: "Source Number", secret: false },
      ];
    }
    
    return [];
  };

  const fields = getConfigFields();

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {getIntegrationIcon(integration.integration_type)}
            {integration.integration_name || integration.integration_type}
          </CardTitle>
          <div className="flex items-center gap-2">
            {integration.is_active ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                Inactive
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          {fields.map((field) => {
            const value = getDisplayValue(config, field.key);
            if (!value) return null;
            
            return (
              <div key={field.key} className="flex justify-between">
                <span className="text-muted-foreground">{field.label}:</span>
                <span className="font-mono text-xs">
                  {field.secret && !revealSecrets ? maskValue(value) : value}
                </span>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevealSecrets(!revealSecrets)}
            className="gap-1"
          >
            {revealSecrets ? (
              <>
                <EyeOff className="h-4 w-4" />
                Hide
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Reveal
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(integration)}
            className="gap-1"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Integration</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{integration.integration_name || integration.integration_type}"? 
                  This action cannot be undone and may affect closers using this integration.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(integration.id)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
