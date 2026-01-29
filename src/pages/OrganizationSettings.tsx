import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Video, Calendar, MessageCircle, Save, TestTube, Check, X, Loader2 } from "lucide-react";

interface IntegrationConfig {
  zoom?: {
    account_id: string;
    client_id: string;
    client_secret: string;
  };
  calendly?: {
    api_token: string;
    event_type_uri: string;
    default_closer_id: string;
  };
  whatsapp?: {
    api_key: string;
    source: string;
    video_url: string;
    support_number: string;
  };
}

const OrganizationSettings = () => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);

  // Fetch existing integrations
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["org-integrations", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("organization_integrations")
        .select("*")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  // Form state for each integration
  const [zoomConfig, setZoomConfig] = useState({
    account_id: "",
    client_id: "",
    client_secret: "",
  });

  const [calendlyConfig, setCalendlyConfig] = useState({
    api_token: "",
    event_type_uri: "",
    default_closer_id: "",
  });

  const [whatsappConfig, setWhatsappConfig] = useState({
    api_key: "",
    source: "",
    video_url: "",
    support_number: "+919266395637",
  });

  // Load existing config into form
  const getExistingConfig = (type: string) => {
    const integration = integrations?.find(i => i.integration_type === type);
    return integration?.config as Record<string, string> | undefined;
  };

  const zoomExisting = getExistingConfig("zoom");
  const calendlyExisting = getExistingConfig("calendly");
  const whatsappExisting = getExistingConfig("whatsapp");

  // Save integration mutation
  const saveMutation = useMutation({
    mutationFn: async ({ type, config }: { type: string; config: Record<string, string> }) => {
      if (!currentOrganization?.id) throw new Error("No organization selected");

      const existingIntegration = integrations?.find(i => i.integration_type === type);

      if (existingIntegration) {
        const { error } = await supabase
          .from("organization_integrations")
          .update({ config, is_active: true })
          .eq("id", existingIntegration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_integrations")
          .insert({
            organization_id: currentOrganization.id,
            integration_type: type,
            config,
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-integrations"] });
      toast({ title: "Integration saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save integration", description: error.message, variant: "destructive" });
    },
  });

  // Test Zoom connection
  const testZoom = async () => {
    setTestingIntegration("zoom");
    try {
      const config = zoomExisting || zoomConfig;
      if (!config.account_id || !config.client_id || !config.client_secret) {
        throw new Error("Please fill in all Zoom credentials");
      }

      const credentials = btoa(`${config.client_id}:${config.client_secret}`);
      const response = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=account_credentials&account_id=${config.account_id}`,
      });

      if (response.ok) {
        toast({ title: "Zoom connection successful!", description: "Your Zoom credentials are valid." });
      } else {
        const errorText = await response.text();
        throw new Error(`Invalid credentials: ${errorText}`);
      }
    } catch (error: any) {
      toast({ title: "Zoom connection failed", description: error.message, variant: "destructive" });
    } finally {
      setTestingIntegration(null);
    }
  };

  // Test Calendly connection
  const testCalendly = async () => {
    setTestingIntegration("calendly");
    try {
      const config = calendlyExisting || calendlyConfig;
      if (!config.api_token) {
        throw new Error("Please enter your Calendly API token");
      }

      const response = await fetch("https://api.calendly.com/users/me", {
        headers: { Authorization: `Bearer ${config.api_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        toast({ 
          title: "Calendly connection successful!", 
          description: `Connected as: ${data.resource?.name || data.resource?.email}` 
        });
      } else {
        throw new Error("Invalid API token");
      }
    } catch (error: any) {
      toast({ title: "Calendly connection failed", description: error.message, variant: "destructive" });
    } finally {
      setTestingIntegration(null);
    }
  };

  const isIntegrationActive = (type: string) => {
    return integrations?.some(i => i.integration_type === type && i.is_active);
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Configure integrations for {currentOrganization.name}
        </p>
      </div>

      <Tabs defaultValue="zoom" className="space-y-4">
        <TabsList>
          <TabsTrigger value="zoom" className="gap-2">
            <Video className="h-4 w-4" />
            Zoom
            {isIntegrationActive("zoom") && <Badge variant="secondary" className="ml-1">Active</Badge>}
          </TabsTrigger>
          <TabsTrigger value="calendly" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendly
            {isIntegrationActive("calendly") && <Badge variant="secondary" className="ml-1">Active</Badge>}
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
            {isIntegrationActive("whatsapp") && <Badge variant="secondary" className="ml-1">Active</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Zoom Integration */}
        <TabsContent value="zoom">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Zoom Integration
              </CardTitle>
              <CardDescription>
                Configure Zoom Server-to-Server OAuth credentials for automatic meeting creation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zoom-account-id">Account ID</Label>
                  <Input
                    id="zoom-account-id"
                    placeholder="Enter Zoom Account ID"
                    value={zoomConfig.account_id || zoomExisting?.account_id || ""}
                    onChange={(e) => setZoomConfig(prev => ({ ...prev, account_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zoom-client-id">Client ID</Label>
                  <Input
                    id="zoom-client-id"
                    placeholder="Enter Zoom Client ID"
                    value={zoomConfig.client_id || zoomExisting?.client_id || ""}
                    onChange={(e) => setZoomConfig(prev => ({ ...prev, client_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zoom-client-secret">Client Secret</Label>
                  <Input
                    id="zoom-client-secret"
                    type="password"
                    placeholder="Enter Zoom Client Secret"
                    value={zoomConfig.client_secret || zoomExisting?.client_secret || ""}
                    onChange={(e) => setZoomConfig(prev => ({ ...prev, client_secret: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => saveMutation.mutate({ type: "zoom", config: zoomConfig.account_id ? zoomConfig : (zoomExisting || {}) })}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={testZoom}
                  disabled={testingIntegration === "zoom"}
                >
                  {testingIntegration === "zoom" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendly Integration */}
        <TabsContent value="calendly">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendly Integration
              </CardTitle>
              <CardDescription>
                Configure Calendly API for automatic call scheduling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="calendly-token">API Token</Label>
                  <Input
                    id="calendly-token"
                    type="password"
                    placeholder="Enter Calendly API Token"
                    value={calendlyConfig.api_token || calendlyExisting?.api_token || ""}
                    onChange={(e) => setCalendlyConfig(prev => ({ ...prev, api_token: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calendly-event-type">Event Type URI (optional)</Label>
                  <Input
                    id="calendly-event-type"
                    placeholder="https://api.calendly.com/event_types/..."
                    value={calendlyConfig.event_type_uri || calendlyExisting?.event_type_uri || ""}
                    onChange={(e) => setCalendlyConfig(prev => ({ ...prev, event_type_uri: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used to route incoming webhooks to this organization
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => saveMutation.mutate({ type: "calendly", config: calendlyConfig.api_token ? calendlyConfig : (calendlyExisting || {}) })}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={testCalendly}
                  disabled={testingIntegration === "calendly"}
                >
                  {testingIntegration === "calendly" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Integration */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                WhatsApp Integration (AiSensy)
              </CardTitle>
              <CardDescription>
                Configure AiSensy WhatsApp API for call reminders and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-api-key">API Key</Label>
                  <Input
                    id="whatsapp-api-key"
                    type="password"
                    placeholder="Enter AiSensy API Key"
                    value={whatsappConfig.api_key || whatsappExisting?.api_key || ""}
                    onChange={(e) => setWhatsappConfig(prev => ({ ...prev, api_key: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-source">Source Number</Label>
                  <Input
                    id="whatsapp-source"
                    placeholder="e.g., 919266395637"
                    value={whatsappConfig.source || whatsappExisting?.source || ""}
                    onChange={(e) => setWhatsappConfig(prev => ({ ...prev, source: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-video">Video URL (optional)</Label>
                  <Input
                    id="whatsapp-video"
                    placeholder="URL for booking confirmation video"
                    value={whatsappConfig.video_url || whatsappExisting?.video_url || ""}
                    onChange={(e) => setWhatsappConfig(prev => ({ ...prev, video_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-support">Support Number</Label>
                  <Input
                    id="whatsapp-support"
                    placeholder="+919266395637"
                    value={whatsappConfig.support_number || whatsappExisting?.support_number || "+919266395637"}
                    onChange={(e) => setWhatsappConfig(prev => ({ ...prev, support_number: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => saveMutation.mutate({ type: "whatsapp", config: whatsappConfig.api_key ? whatsappConfig : (whatsappExisting || {}) })}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationSettings;
