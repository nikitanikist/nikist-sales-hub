import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Plus, MessageCircle, Save, Loader2, User, Info, Trash2 } from "lucide-react";
import { IntegrationSection } from "@/components/settings/IntegrationSection";
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

const REMINDER_TYPES = [
  { key: "call_booked", label: "Call Booked (Confirmation)" },
  { key: "two_days", label: "2 Days Before" },
  { key: "one_day", label: "1 Day Before" },
  { key: "three_hours", label: "3 Hours Before" },
  { key: "one_hour", label: "1 Hour Before" },
  { key: "thirty_minutes", label: "30 Minutes Before" },
  { key: "ten_minutes", label: "10 Minutes Before" },
  { key: "we_are_live", label: "We Are Live" },
];

interface CloserConfig {
  id?: string;
  closer_id: string;
  closer_name: string;
  aisensy_integration_id: string | null;
  templates: Record<string, string>;
  video_url: string;
  support_number: string;
  include_zoom_link_types: string[];
  is_active: boolean;
}

interface AISensySettingsProps {
  integrations: Integration[];
  onSave: (data: { type: string; name: string; config: Record<string, string>; integrationId?: string }) => Promise<void>;
  onDelete: (integrationId: string) => void;
  isSaving: boolean;
}

export function AISensySettings({ integrations, onSave, onDelete, isSaving }: AISensySettingsProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch closers from closer_integrations
  const { data: closers } = useQuery({
    queryKey: ["org-closers-for-notifications", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("closer_integrations")
        .select(`
          closer_id,
          profiles:closer_id(id, full_name, email)
        `)
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      // Deduplicate by closer_id
      const seen = new Set<string>();
      return (data || []).filter((d) => {
        const id = d.closer_id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }).map((d) => {
        const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
        return {
          id: d.closer_id,
          full_name: (profile as any)?.full_name || "Unknown",
          email: (profile as any)?.email || "",
        };
      });
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch existing closer notification configs
  const { data: notificationConfigs } = useQuery({
    queryKey: ["closer-notification-configs", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("closer_notification_configs")
        .select("*")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  // AISensy integrations only
  const aisensyIntegrations = integrations.filter(
    (i) => i.integration_type.startsWith("aisensy")
  );

  // Build closer configs merged with existing DB records
  const closerConfigs: CloserConfig[] = (closers || []).map((closer) => {
    const existing = notificationConfigs?.find((c) => c.closer_id === closer.id);
    return {
      id: existing?.id,
      closer_id: closer.id,
      closer_name: closer.full_name,
      aisensy_integration_id: existing?.aisensy_integration_id || null,
      templates: (existing?.templates as Record<string, string>) || {},
      video_url: existing?.video_url || "",
      support_number: existing?.support_number || "",
      include_zoom_link_types: existing?.include_zoom_link_types || ["ten_minutes", "we_are_live"],
      is_active: existing?.is_active ?? true,
    };
  });

  return (
    <div className="space-y-6">
      {/* Section A: AISensy Account Management */}
      <IntegrationSection
        type="aisensy"
        integrations={aisensyIntegrations}
        onSave={onSave}
        onDelete={onDelete}
        isSaving={isSaving}
      />

      {/* Section B: Per-Closer Notification Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Closer Notification Configuration
          </CardTitle>
          <CardDescription>
            Configure which AISensy account and templates each closer uses for call reminders.
            Closers are automatically loaded from the Team &gt; Closer Assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {closerConfigs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No closers configured yet.</p>
              <p className="text-sm">Add closer assignments in the Team tab first.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {closerConfigs.map((config) => (
                <CloserNotificationCard
                  key={config.closer_id}
                  config={config}
                  aisensyAccounts={aisensyIntegrations}
                  organizationId={currentOrganization?.id || ""}
                  onSaved={() => {
                    queryClient.invalidateQueries({ queryKey: ["closer-notification-configs"] });
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C: Variables Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Template Variables Reference
          </CardTitle>
          <CardDescription>
            These variables are automatically passed to AISensy templates as template parameters (in order).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium">Call Booked</span>
              <span className="text-muted-foreground">customer_name, expert_title, date, time, zoom_info, support_number</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium">2 Days / 1 Day Before</span>
              <span className="text-muted-foreground">customer_name, date, time</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium">3 Hours Before</span>
              <span className="text-muted-foreground">customer_name, date_time_combo</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium">1 Hour Before</span>
              <span className="text-muted-foreground">customer_name, time</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium">30 Minutes Before</span>
              <span className="text-muted-foreground">time</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium">10 Minutes Before</span>
              <span className="text-muted-foreground">customer_name, zoom_link</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">We Are Live</span>
              <span className="text-muted-foreground">customer_name, call_title, zoom_link</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Individual closer notification config card
function CloserNotificationCard({
  config,
  aisensyAccounts,
  organizationId,
  onSaved,
}: {
  config: CloserConfig;
  aisensyAccounts: Integration[];
  organizationId: string;
  onSaved: () => void;
}) {
  const [localConfig, setLocalConfig] = useState<CloserConfig>(config);
  const [saving, setSaving] = useState(false);

  const handleTemplateChange = (reminderType: string, templateName: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      templates: { ...prev.templates, [reminderType]: templateName },
    }));
  };

  const handleZoomLinkToggle = (reminderType: string, include: boolean) => {
    setLocalConfig((prev) => ({
      ...prev,
      include_zoom_link_types: include
        ? [...prev.include_zoom_link_types, reminderType]
        : prev.include_zoom_link_types.filter((t) => t !== reminderType),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        organization_id: organizationId,
        closer_id: localConfig.closer_id,
        aisensy_integration_id: localConfig.aisensy_integration_id || null,
        templates: localConfig.templates,
        video_url: localConfig.video_url || null,
        support_number: localConfig.support_number || null,
        include_zoom_link_types: localConfig.include_zoom_link_types,
        is_active: localConfig.is_active,
      };

      if (localConfig.id) {
        const { error } = await supabase
          .from("closer_notification_configs")
          .update(payload)
          .eq("id", localConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("closer_notification_configs")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: `Notification config saved for ${localConfig.closer_name}` });
      onSaved();
    } catch (error: any) {
      toast({ title: "Failed to save config", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!localConfig.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("closer_notification_configs")
        .delete()
        .eq("id", localConfig.id);
      if (error) throw error;
      toast({ title: `Config deleted for ${localConfig.closer_name}` });
      onSaved();
    } catch (error: any) {
      toast({ title: "Failed to delete config", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {localConfig.closer_name}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor={`active-${localConfig.closer_id}`} className="text-sm">
                Active
              </Label>
              <Switch
                id={`active-${localConfig.closer_id}`}
                checked={localConfig.is_active}
                onCheckedChange={(checked) =>
                  setLocalConfig((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
            {localConfig.is_active ? (
              <Badge variant="default">Enabled</Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AISensy Account Selector */}
        <div className="space-y-2">
          <Label>AISensy Account</Label>
          <Select
            value={localConfig.aisensy_integration_id || ""}
            onValueChange={(value) =>
              setLocalConfig((prev) => ({ ...prev, aisensy_integration_id: value || null }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select AISensy account" />
            </SelectTrigger>
            <SelectContent>
              {aisensyAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.integration_name || account.integration_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Video URL & Support Number */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Video URL (for Call Booked)</Label>
            <Input
              placeholder="https://...video.mp4"
              value={localConfig.video_url}
              onChange={(e) =>
                setLocalConfig((prev) => ({ ...prev, video_url: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Support Number</Label>
            <Input
              placeholder="+919266395637"
              value={localConfig.support_number}
              onChange={(e) =>
                setLocalConfig((prev) => ({ ...prev, support_number: e.target.value }))
              }
            />
          </div>
        </div>

        <Separator />

        {/* Template Name Inputs per Reminder Type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Template Names per Reminder Type</Label>
          <div className="grid gap-3">
            {REMINDER_TYPES.map((rt) => (
              <div key={rt.key} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-48 shrink-0">{rt.label}</span>
                <Input
                  placeholder="aisensy_template_name"
                  value={localConfig.templates[rt.key] || ""}
                  onChange={(e) => handleTemplateChange(rt.key, e.target.value)}
                  className="flex-1"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={localConfig.include_zoom_link_types.includes(rt.key)}
                    onCheckedChange={(checked) => handleZoomLinkToggle(rt.key, checked)}
                  />
                  <span className="text-xs text-muted-foreground">Zoom</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-2">
          {localConfig.id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1">
                  <Trash2 className="h-4 w-4" />
                  Delete Config
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Notification Config</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure? Reminders for {localConfig.closer_name} will stop sending.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={handleSave} disabled={saving} className="gap-2 ml-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
