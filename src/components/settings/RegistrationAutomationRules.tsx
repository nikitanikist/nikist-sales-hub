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
import { Plus, Trash2, Loader2, Zap, Edit, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Integration {
  id: string;
  integration_type: string;
  integration_name: string | null;
  config: Record<string, string | boolean | undefined>;
  is_active: boolean;
}

interface VariableMapping {
  position: number;
  source: string;
  value?: string;
}

interface Rule {
  id: string;
  trigger_platform: string;
  trigger_id: string;
  label: string;
  is_active: boolean;
  aisensy_integration_id: string | null;
  template_name: string;
  variable_mapping: VariableMapping[];
  google_sheet_webhook_url: string | null;
  sheet_send_duplicates: boolean;
}

const VARIABLE_SOURCES = [
  { value: "registrant_name", label: "Registrant Name" },
  { value: "workshop_title", label: "Workshop Title (before <>)" },
  { value: "workshop_date", label: "Workshop Date (after <>)" },
  { value: "registrant_email", label: "Registrant Email" },
  { value: "registrant_phone", label: "Registrant Phone" },
  { value: "static", label: "Static Value" },
];

interface RegistrationAutomationRulesProps {
  integrations: Integration[];
}

export function RegistrationAutomationRules({ integrations }: RegistrationAutomationRulesProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const aisensyIntegrations = integrations.filter((i) =>
    i.integration_type.startsWith("aisensy")
  );

  const { data: rules, isLoading } = useQuery({
    queryKey: ["registration-confirmation-rules", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("registration_confirmation_rules" as any)
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Rule[];
    },
    enabled: !!currentOrganization?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("registration_confirmation_rules" as any)
        .update({ is_active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-confirmation-rules"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("registration_confirmation_rules" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-confirmation-rules"] });
      toast({ title: "Rule deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (rule: Rule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Registration Automations
            </CardTitle>
            <CardDescription>
              Automatically send WhatsApp confirmations when a user registers on TagMango (or other platforms).
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="gap-1" size="sm">
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !rules || rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No registration automation rules yet.</p>
            <p className="text-sm">Click "Add Rule" to create your first automation.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const account = aisensyIntegrations.find((a) => a.id === rule.aisensy_integration_id);
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between px-4 py-3 border rounded-lg bg-muted/30"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{rule.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {rule.trigger_platform}
                      </Badge>
                      {rule.is_active ? (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                      <span>ID: {rule.trigger_id}</span>
                      <span>Template: {rule.template_name}</span>
                      <span>Account: {account?.integration_name || "Unknown"}</span>
                      <span>{rule.variable_mapping?.length || 0} variables</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: rule.id, is_active: checked })
                      }
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{rule.label}"? Registrations for this Mango ID will no longer trigger WhatsApp confirmations.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(rule.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        aisensyAccounts={aisensyIntegrations}
        organizationId={currentOrganization?.id || ""}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["registration-confirmation-rules"] });
          setDialogOpen(false);
        }}
      />
    </Card>
  );
}

function RuleDialog({
  open,
  onOpenChange,
  rule,
  aisensyAccounts,
  organizationId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: Rule | null;
  aisensyAccounts: Integration[];
  organizationId: string;
  onSaved: () => void;
}) {
  const isEdit = !!rule;
  const [saving, setSaving] = useState(false);
  const [platform, setPlatform] = useState(rule?.trigger_platform || "tagmango");
  const [triggerId, setTriggerId] = useState(rule?.trigger_id || "");
  const [label, setLabel] = useState(rule?.label || "");
  const [accountId, setAccountId] = useState(rule?.aisensy_integration_id || "");
  const [templateName, setTemplateName] = useState(rule?.template_name || "");
  const [variables, setVariables] = useState<VariableMapping[]>(
    rule?.variable_mapping || [{ position: 1, source: "registrant_name" }]
  );
  const [sheetUrl, setSheetUrl] = useState(rule?.google_sheet_webhook_url || "");
  const [sheetDuplicates, setSheetDuplicates] = useState(rule?.sheet_send_duplicates || false);

  // Reset form when rule changes
  const resetForm = () => {
    setPlatform(rule?.trigger_platform || "tagmango");
    setTriggerId(rule?.trigger_id || "");
    setLabel(rule?.label || "");
    setAccountId(rule?.aisensy_integration_id || "");
    setTemplateName(rule?.template_name || "");
    setVariables(rule?.variable_mapping || [{ position: 1, source: "registrant_name" }]);
    setSheetUrl(rule?.google_sheet_webhook_url || "");
    setSheetDuplicates(rule?.sheet_send_duplicates || false);
  };

  // Reset on open
  useState(() => {
    resetForm();
  });

  const addVariable = () => {
    const nextPos = variables.length + 1;
    setVariables([...variables, { position: nextPos, source: "static", value: "" }]);
  };

  const removeVariable = (index: number) => {
    const updated = variables.filter((_, i) => i !== index).map((v, i) => ({ ...v, position: i + 1 }));
    setVariables(updated);
  };

  const updateVariable = (index: number, field: string, value: string) => {
    const updated = [...variables];
    (updated[index] as any)[field] = value;
    setVariables(updated);
  };

  const handleSave = async () => {
    if (!triggerId || !label || !templateName || !accountId) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        organization_id: organizationId,
        trigger_platform: platform,
        trigger_id: triggerId,
        label,
        aisensy_integration_id: accountId,
        template_name: templateName,
        variable_mapping: variables,
        google_sheet_webhook_url: sheetUrl || null,
        sheet_send_duplicates: sheetDuplicates,
      };

      if (isEdit && rule) {
        const { error } = await supabase
          .from("registration_confirmation_rules" as any)
          .update(payload as any)
          .eq("id", rule.id);
        if (error) throw error;
        toast({ title: "Rule updated successfully" });
      } else {
        const { error } = await supabase
          .from("registration_confirmation_rules" as any)
          .insert(payload as any);
        if (error) throw error;
        toast({ title: "Rule created successfully" });
      }

      onSaved();
    } catch (err: any) {
      toast({
        title: "Failed to save rule",
        description: err.message?.includes("unique") ? "A rule with this Mango ID already exists" : err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Rule" : "Add Registration Automation"}</DialogTitle>
          <DialogDescription>
            Configure automatic WhatsApp confirmation when someone registers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Platform */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tagmango">TagMango</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Trigger ID */}
          <div className="space-y-2">
            <Label>Product / Mango ID *</Label>
            <Input
              placeholder="e.g., 689b7b7e37ddd15a781ec63b"
              value={triggerId}
              onChange={(e) => setTriggerId(e.target.value)}
            />
          </div>

          {/* Step 3: Label */}
          <div className="space-y-2">
            <Label>Label *</Label>
            <Input
              placeholder="e.g., Crypto Masterclass Confirmation"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <Separator />

          {/* Step 4: AISensy Account */}
          <div className="space-y-2">
            <Label>AISensy Account *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {aisensyAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.integration_name || acc.integration_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 5: Template Name */}
          <div className="space-y-2">
            <Label>Template / Campaign Name *</Label>
            <Input
              placeholder="e.g., class_registration_confirmation_copy"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>

          <Separator />

          {/* Step 6: Variable Mapping */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Template Variables</Label>
              <Button variant="outline" size="sm" onClick={addVariable} className="gap-1">
                <Plus className="h-3 w-3" />
                Add Variable
              </Button>
            </div>

            {variables.map((v, i) => (
              <div key={i} className="flex items-start gap-2 p-3 border rounded-md bg-muted/30">
                <div className="flex items-center justify-center h-8 w-8 rounded bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {`{{${v.position}}}`}
                </div>
                <div className="flex-1 space-y-2">
                  <Select
                    value={v.source}
                    onValueChange={(val) => updateVariable(i, "source", val)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VARIABLE_SOURCES.map((src) => (
                        <SelectItem key={src.value} value={src.value}>
                          {src.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {v.source === "static" && (
                    <Input
                      placeholder="Enter static value"
                      value={v.value || ""}
                      onChange={(e) => updateVariable(i, "value", e.target.value)}
                      className="h-8 text-sm"
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeVariable(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          {/* Step 7: Google Sheet */}
          <div className="space-y-2">
            <Label>Google Sheet Webhook URL (optional)</Label>
            <Input
              placeholder="https://hooks.pabbly.com/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={sheetDuplicates}
              onCheckedChange={setSheetDuplicates}
            />
            <Label className="text-sm">Send to sheet for duplicate registrations</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
