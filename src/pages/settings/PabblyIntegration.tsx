import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Webhook, Plus, Copy, Trash2, Loader2, ArrowDownToLine, ArrowUpFromLine, Check, ExternalLink, TestTube } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface OrganizationWebhook {
  id: string;
  organization_id: string;
  name: string;
  direction: "incoming" | "outgoing";
  url: string | null;
  secret: string;
  trigger_event: string | null;
  payload_template: Record<string, unknown>;
  field_mappings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

const TRIGGER_EVENTS = [
  { value: "lead.created", label: "Lead Created" },
  { value: "lead.updated", label: "Lead Updated" },
  { value: "call.scheduled", label: "Call Scheduled" },
  { value: "call.completed", label: "Call Completed" },
  { value: "call.status_changed", label: "Call Status Changed" },
  { value: "student.converted", label: "Student Converted" },
  { value: "student.emi_paid", label: "EMI Payment Received" },
  { value: "workshop.registration", label: "Workshop Registration" },
];

export function PabblyIntegration() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state for new webhook
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    direction: "outgoing" as "incoming" | "outgoing",
    url: "",
    trigger_event: "",
  });

  // Fetch webhooks
  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["organization-webhooks", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("organization_webhooks")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as OrganizationWebhook[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (webhook: typeof newWebhook) => {
      if (!currentOrganization?.id) throw new Error("No organization selected");

      const { error } = await supabase
        .from("organization_webhooks")
        .insert({
          organization_id: currentOrganization.id,
          name: webhook.name,
          direction: webhook.direction,
          url: webhook.direction === "outgoing" ? webhook.url : null,
          trigger_event: webhook.direction === "outgoing" ? webhook.trigger_event : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-webhooks"] });
      setIsAddDialogOpen(false);
      setNewWebhook({ name: "", direction: "outgoing", url: "", trigger_event: "" });
      toast({ title: "Webhook created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle webhook active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("organization_webhooks")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-webhooks"] });
      toast({ title: "Webhook updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organization_webhooks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-webhooks"] });
      toast({ title: "Webhook deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getIncomingWebhookUrl = (webhookId: string) => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || window.location.origin;
    return `${baseUrl}/functions/v1/pabbly-webhook/${webhookId}`;
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const handleCreateWebhook = () => {
    if (!newWebhook.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (newWebhook.direction === "outgoing" && !newWebhook.url.trim()) {
      toast({ title: "URL is required for outgoing webhooks", variant: "destructive" });
      return;
    }
    createMutation.mutate(newWebhook);
  };

  const incomingWebhooks = webhooks.filter((w) => w.direction === "incoming");
  const outgoingWebhooks = webhooks.filter((w) => w.direction === "outgoing");

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Pabbly / Webhooks
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure incoming and outgoing webhooks for automation
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  placeholder="e.g., Pabbly Lead Sync"
                />
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={newWebhook.direction}
                  onValueChange={(v) => setNewWebhook({ ...newWebhook, direction: v as "incoming" | "outgoing" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incoming">
                      <span className="flex items-center gap-2">
                        <ArrowDownToLine className="h-4 w-4" />
                        Incoming (receive data)
                      </span>
                    </SelectItem>
                    <SelectItem value="outgoing">
                      <span className="flex items-center gap-2">
                        <ArrowUpFromLine className="h-4 w-4" />
                        Outgoing (send data)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newWebhook.direction === "outgoing" && (
                <>
                  <div className="space-y-2">
                    <Label>Trigger Event</Label>
                    <Select
                      value={newWebhook.trigger_event}
                      onValueChange={(v) => setNewWebhook({ ...newWebhook, trigger_event: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger event" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_EVENTS.map((event) => (
                          <SelectItem key={event.value} value={event.value}>
                            {event.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Destination URL</Label>
                    <Input
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                      placeholder="https://connect.pabbly.com/workflow/..."
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateWebhook} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Incoming Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowDownToLine className="h-4 w-4" />
            Incoming Webhooks
          </CardTitle>
          <CardDescription>
            URLs that external services (like Pabbly) can call to send data to your CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          {incomingWebhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No incoming webhooks configured. Add one to receive data from external services.
            </p>
          ) : (
            <div className="space-y-3">
              {incomingWebhooks.map((webhook) => (
                <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      <Switch
                        checked={webhook.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: webhook.id, isActive: checked })}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-md">
                        {getIncomingWebhookUrl(webhook.id)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(getIncomingWebhookUrl(webhook.id), webhook.id)}
                        className="text-foreground">
                        {copiedId === webhook.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Secret: <code className="bg-muted px-1 rounded">{webhook.secret.substring(0, 12)}...</code>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(webhook.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outgoing Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpFromLine className="h-4 w-4" />
            Outgoing Webhooks
          </CardTitle>
          <CardDescription>
            Send data to external services when events occur in your CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          {outgoingWebhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No outgoing webhooks configured. Add one to send data when events occur.
            </p>
          ) : (
            <div className="space-y-3">
              {outgoingWebhooks.map((webhook) => (
                <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      <Switch
                        checked={webhook.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: webhook.id, isActive: checked })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Trigger: <span className="font-medium">{webhook.trigger_event || "Not set"}</span>
                    </p>
                    <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block truncate max-w-md">
                      {webhook.url}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={webhook.url || "#"} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
