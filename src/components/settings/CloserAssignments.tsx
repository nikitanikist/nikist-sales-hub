import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Users, Video, Calendar, MessageCircle, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Integration {
  id: string;
  integration_type: string;
  integration_name: string | null;
}

interface CloserIntegration {
  id: string;
  closer_id: string;
  integration_id: string;
  is_default: boolean;
}

export function CloserAssignments() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch closers in organization (users with sales_rep role)
  const { data: closers = [], isLoading: closersLoading } = useQuery({
    queryKey: ["org-closers", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      // First get org members with sales_rep role
      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", currentOrganization.id)
        .eq("role", "sales_rep");

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // Then fetch their profiles
      const userIds = members.map((m) => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      return (profiles || []) as Profile[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch available integrations (Zoom + Calendly only)
  const { data: integrations = [], isLoading: integrationsLoading } = useQuery({
    queryKey: ["org-scheduling-integrations", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from("organization_integrations")
        .select("id, integration_type, integration_name")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .or("integration_type.like.zoom%,integration_type.like.calendly%");

      if (error) throw error;
      return data as Integration[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch closer-integration assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["closer-integrations", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from("closer_integrations")
        .select("*")
        .eq("organization_id", currentOrganization.id);

      if (error) throw error;
      return data as CloserIntegration[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Assign integration to closer
  const assignMutation = useMutation({
    mutationFn: async ({ closerId, integrationId }: { closerId: string; integrationId: string | null }) => {
      if (!currentOrganization?.id) throw new Error("No organization selected");

      // First, remove any existing assignment for this closer
      await supabase
        .from("closer_integrations")
        .delete()
        .eq("organization_id", currentOrganization.id)
        .eq("closer_id", closerId);

      // If integrationId is provided, create new assignment
      if (integrationId) {
        const { error } = await supabase
          .from("closer_integrations")
          .insert({
            organization_id: currentOrganization.id,
            closer_id: closerId,
            integration_id: integrationId,
            is_default: true,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-integrations"] });
      toast({ title: "Assignment updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getCloserIntegration = (closerId: string): string | null => {
    const assignment = assignments.find((a) => a.closer_id === closerId);
    return assignment?.integration_id || null;
  };

  const getIntegrationIcon = (type: string) => {
    if (type.startsWith("zoom")) return Video;
    if (type.startsWith("calendly")) return Calendar;
    return MessageCircle;
  };

  const getIntegrationType = (type: string) => {
    if (type.startsWith("zoom")) return "Zoom";
    if (type.startsWith("calendly")) return "Calendly";
    return type;
  };

  const isLoading = closersLoading || integrationsLoading || assignmentsLoading;

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Closer Integrations
        </CardTitle>
        <CardDescription>
          Assign scheduling integrations (Zoom or Calendly) to each sales closer. 
          This determines how calls are booked for each closer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {closers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sales closers found. Add team members with the "Sales Rep" role first.
          </p>
        ) : integrations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scheduling integrations configured. Add a Zoom or Calendly integration first.
          </p>
        ) : (
          <div className="space-y-4">
            {closers.map((closer) => {
              const currentIntegrationId = getCloserIntegration(closer.id);
              const currentIntegration = integrations.find((i) => i.id === currentIntegrationId);

              return (
                <div
                  key={closer.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{closer.full_name}</p>
                    <p className="text-sm text-muted-foreground">{closer.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {currentIntegration && (
                      <Badge variant="secondary" className="gap-1">
                        {(() => {
                          const Icon = getIntegrationIcon(currentIntegration.integration_type);
                          return <Icon className="h-3 w-3" />;
                        })()}
                        {getIntegrationType(currentIntegration.integration_type)}
                      </Badge>
                    )}
                    <Select
                      value={currentIntegrationId || "none"}
                      onValueChange={(value) => 
                        assignMutation.mutate({ 
                          closerId: closer.id, 
                          integrationId: value === "none" ? null : value 
                        })
                      }
                      disabled={assignMutation.isPending}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select integration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Integration</SelectItem>
                        {integrations.map((integration) => {
                          const Icon = getIntegrationIcon(integration.integration_type);
                          return (
                            <SelectItem key={integration.id} value={integration.id}>
                              <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {integration.integration_name || integration.integration_type}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
