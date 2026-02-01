import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export function useCommunitySession() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch current community session ID from organization
  const { data: communitySessionId, isLoading: isLoadingSession } = useQuery({
    queryKey: ["community-session", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return null;
      
      const { data, error } = await supabase
        .from("organizations")
        .select("community_session_id")
        .eq("id", currentOrganization.id)
        .single();
      
      if (error) {
        console.error("Error fetching community session:", error);
        return null;
      }
      
      return data?.community_session_id || null;
    },
    enabled: !!currentOrganization,
  });

  // Fetch connected WhatsApp sessions for the organization
  const { data: connectedSessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ["connected-whatsapp-sessions", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("id, phone_number, display_name, status")
        .eq("organization_id", currentOrganization.id)
        .eq("status", "connected")
        .order("updated_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching connected sessions:", error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!currentOrganization,
  });

  // Mutation to update community session
  const updateCommunitySessionMutation = useMutation({
    mutationFn: async (sessionId: string | null) => {
      if (!currentOrganization) throw new Error("No organization selected");
      
      const { error } = await supabase
        .from("organizations")
        .update({ community_session_id: sessionId })
        .eq("id", currentOrganization.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-session"] });
      toast.success("Community creation number updated");
    },
    onError: (error: any) => {
      console.error("Error updating community session:", error);
      toast.error("Failed to update community creation number");
    },
  });

  const setCommunitySession = (sessionId: string | null) => {
    updateCommunitySessionMutation.mutate(sessionId);
  };

  return {
    communitySessionId,
    connectedSessions: connectedSessions || [],
    isLoading: isLoadingSession || isLoadingSessions,
    setCommunitySession,
    isUpdating: updateCommunitySessionMutation.isPending,
  };
}
