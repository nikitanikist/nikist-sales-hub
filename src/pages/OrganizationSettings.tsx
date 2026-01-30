import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Settings, Building2, Blocks, Puzzle, Users, Video, Calendar, MessageCircle, Webhook } from "lucide-react";
import { IntegrationSection } from "@/components/settings/IntegrationSection";
import { GeneralSettings } from "@/pages/settings/GeneralSettings";
import { ModulesSettings } from "@/pages/settings/ModulesSettings";
import { PabblyIntegration } from "@/pages/settings/PabblyIntegration";
import { WhatsAppConnection } from "@/pages/settings/WhatsAppConnection";
import { PageIntro } from "@/components/PageIntro";
import { CloserAssignments } from "@/components/settings/CloserAssignments";

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

const OrganizationSettings = () => {
  const { currentOrganization } = useOrganization();
  const { isSuperAdmin } = useUserRole();
  const queryClient = useQueryClient();

  // Fetch ALL integrations for the organization
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["org-integrations", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("organization_integrations")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Integration[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Group integrations by base type
  const groupedIntegrations = useMemo(() => {
    const groups: Record<"zoom" | "calendly" | "whatsapp", Integration[]> = {
      zoom: [],
      calendly: [],
      whatsapp: [],
    };

    integrations?.forEach((integration) => {
      const type = integration.integration_type;
      if (type.startsWith("zoom") || type === "zoom") {
        groups.zoom.push(integration);
      } else if (type.startsWith("calendly")) {
        groups.calendly.push(integration);
      } else if (type.startsWith("whatsapp")) {
        groups.whatsapp.push(integration);
      }
    });

    return groups;
  }, [integrations]);

  // Save/Update integration mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      type,
      name,
      config,
      integrationId,
    }: {
      type: string;
      name: string;
      config: Record<string, string>;
      integrationId?: string;
    }) => {
      if (!currentOrganization?.id) throw new Error("No organization selected");

      if (integrationId) {
        // Update existing integration
        const { error } = await supabase
          .from("organization_integrations")
          .update({
            integration_name: name,
            config: config,
            is_active: true,
          })
          .eq("id", integrationId);
        if (error) throw error;
      } else {
        // Create new integration with unique type suffix
        const existingCount = groupedIntegrations[type as keyof typeof groupedIntegrations]?.length || 0;
        const integrationTypeKey = existingCount === 0 ? type : `${type}_${Date.now()}`;

        const { error } = await supabase.from("organization_integrations").insert({
          organization_id: currentOrganization.id,
          integration_type: integrationTypeKey,
          integration_name: name,
          config: config,
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
      toast({
        title: "Failed to save integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete integration mutation
  const deleteMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const { error } = await supabase
        .from("organization_integrations")
        .delete()
        .eq("id", integrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-integrations"] });
      toast({ title: "Integration deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = async (data: {
    type: string;
    name: string;
    config: Record<string, string>;
    integrationId?: string;
  }) => {
    await saveMutation.mutateAsync(data);
  };

  const handleDelete = (integrationId: string) => {
    deleteMutation.mutate(integrationId);
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        icon={Settings}
        tagline="Configure Your Workspace"
        description="Customize integrations and preferences."
        variant="violet"
      />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            General
          </TabsTrigger>
          {/* Only show Modules tab for Super Admins */}
          {isSuperAdmin && (
            <TabsTrigger value="modules" className="gap-2">
              <Blocks className="h-4 w-4" />
              Modules
            </TabsTrigger>
          )}
          <TabsTrigger value="integrations" className="gap-2">
            <Puzzle className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>

        {/* Modules Tab (Super Admin Only) */}
        {isSuperAdmin && (
          <TabsContent value="modules">
            <ModulesSettings />
          </TabsContent>
        )}

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          {/* Nested Tabs for Integration Types */}
          <Tabs defaultValue="zoom" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 max-w-lg">
              <TabsTrigger value="zoom" className="gap-2">
                <Video className="h-4 w-4" />
                Zoom
                {groupedIntegrations.zoom.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
                    {groupedIntegrations.zoom.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="calendly" className="gap-2">
                <Calendar className="h-4 w-4" />
                Calendly
                {groupedIntegrations.calendly.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
                    {groupedIntegrations.calendly.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
                {groupedIntegrations.whatsapp.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
                    {groupedIntegrations.whatsapp.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-2">
                <Webhook className="h-4 w-4" />
                Pabbly
              </TabsTrigger>
            </TabsList>

            <TabsContent value="zoom">
              <IntegrationSection
                type="zoom"
                integrations={groupedIntegrations.zoom}
                onSave={handleSave}
                onDelete={handleDelete}
                isSaving={saveMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="calendly">
              <IntegrationSection
                type="calendly"
                integrations={groupedIntegrations.calendly}
                onSave={handleSave}
                onDelete={handleDelete}
                isSaving={saveMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="whatsapp">
              <WhatsAppConnection />
            </TabsContent>

            <TabsContent value="webhooks">
              <PabblyIntegration />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <CloserAssignments />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationSettings;
