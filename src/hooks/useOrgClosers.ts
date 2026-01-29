import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface OrgCloser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

/**
 * Hook to fetch closers (sales_rep and admin roles) scoped to the current organization.
 * This ensures multi-tenant data isolation - users only see closers from their org.
 */
export function useOrgClosers() {
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: ["org-closers", currentOrganization?.id],
    queryFn: async (): Promise<OrgCloser[]> => {
      if (!currentOrganization?.id) return [];

      // Query organization_members to get users in this org with sales_rep or admin roles
      // Use separate queries to avoid FK relationship issues
      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", currentOrganization.id)
        .in("role", ["sales_rep", "admin"]);

      if (membersError) {
        console.error("Error fetching org members:", membersError);
        throw membersError;
      }

      if (!members || members.length === 0) return [];

      // Fetch profiles for these users
      const userIds = members.map((m) => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      // Create a map of user_id to role
      const roleMap = new Map(members.map((m) => [m.user_id, m.role]));

      // Transform to a cleaner format
      return (profiles || []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: roleMap.get(profile.id) || "viewer",
      }));
    },
    enabled: !!currentOrganization?.id,
  });
}

export interface OrgIntegration {
  id: string;
  integration_type: string;
  config: Record<string, any>;
  is_active: boolean;
}

/**
 * Hook to fetch integrations configured for the current organization.
 * Used to determine which closers have Zoom, Calendly, etc. configured.
 */
export function useOrgIntegrations() {
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: ["org-integrations", currentOrganization?.id],
    queryFn: async (): Promise<OrgIntegration[]> => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from("organization_integrations")
        .select("id, integration_type, config, is_active")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching org integrations:", error);
        // Return empty array instead of throwing - integrations are optional
        return [];
      }

      // Transform JSONB config to proper Record type
      return (data || []).map((item) => ({
        id: item.id,
        integration_type: item.integration_type,
        config: (typeof item.config === 'object' && item.config !== null ? item.config : {}) as Record<string, any>,
        is_active: item.is_active ?? true,
      }));
    },
    enabled: !!currentOrganization?.id,
  });
}

/**
 * Check if a closer has a specific integration type configured.
 * Matches by host_email in the integration config.
 */
export function hasIntegrationForCloser(
  integrations: OrgIntegration[],
  closerEmail: string,
  integrationType: string
): boolean {
  return integrations.some(
    (i) =>
      i.integration_type.includes(integrationType) &&
      i.config?.host_email?.toLowerCase() === closerEmail?.toLowerCase()
  );
}

/**
 * Get the integration config for a specific closer and type.
 */
export function getIntegrationForCloser(
  integrations: OrgIntegration[],
  closerEmail: string,
  integrationType: string
): OrgIntegration | undefined {
  return integrations.find(
    (i) =>
      i.integration_type.includes(integrationType) &&
      i.config?.host_email?.toLowerCase() === closerEmail?.toLowerCase()
  );
}
