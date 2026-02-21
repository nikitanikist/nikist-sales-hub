import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useCallback } from "react";

interface OrgFeatureOverrides {
  disabled_permissions: string[];
  disabled_integrations: string[];
}

export function useOrgFeatureOverrides() {
  const { currentOrganization } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["org-feature-overrides", currentOrganization?.id],
    queryFn: async (): Promise<OrgFeatureOverrides> => {
      if (!currentOrganization?.id) {
        return { disabled_permissions: [], disabled_integrations: [] };
      }

      const { data, error } = await supabase
        .from("organization_feature_overrides")
        .select("disabled_permissions, disabled_integrations")
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching org feature overrides:", error);
        return { disabled_permissions: [], disabled_integrations: [] };
      }

      return {
        disabled_permissions: (data?.disabled_permissions as string[]) || [],
        disabled_integrations: (data?.disabled_integrations as string[]) || [],
      };
    },
    enabled: !!currentOrganization?.id,
  });

  const disabledPermissions = data?.disabled_permissions || [];
  const disabledIntegrations = data?.disabled_integrations || [];

  const isPermissionDisabled = useCallback(
    (key: string) => disabledPermissions.includes(key),
    [disabledPermissions]
  );

  const isIntegrationDisabled = useCallback(
    (slug: string) => disabledIntegrations.includes(slug),
    [disabledIntegrations]
  );

  return {
    disabledPermissions,
    disabledIntegrations,
    isPermissionDisabled,
    isIntegrationDisabled,
    isLoading,
  };
}
