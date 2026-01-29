import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useCallback } from "react";

interface Module {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_premium: boolean;
  display_order: number;
}

interface OrganizationModule {
  id: string;
  organization_id: string;
  module_id: string;
  is_enabled: boolean;
  enabled_at: string | null;
  config: Record<string, unknown>;
  modules: Module;
}

export function useModules() {
  const { currentOrganization, isSuperAdmin } = useOrganization();

  // Fetch all modules (reference data)
  const { data: allModules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as Module[];
    },
  });

  // Fetch organization's enabled modules
  const { data: orgModules = [], isLoading: orgModulesLoading } = useQuery({
    queryKey: ["organization-modules", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from("organization_modules")
        .select(`
          *,
          modules (*)
        `)
        .eq("organization_id", currentOrganization.id);
      
      if (error) throw error;
      return data as OrganizationModule[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Check if a specific module is enabled
  const isModuleEnabled = useCallback((slug: string): boolean => {
    // Super admins bypass module checks
    if (isSuperAdmin) return true;
    
    // If no organization, no modules are enabled
    if (!currentOrganization) return false;
    
    // Find the module by slug and check if it's enabled
    const orgModule = orgModules.find(
      (om) => om.modules?.slug === slug && om.is_enabled
    );
    
    return !!orgModule;
  }, [orgModules, currentOrganization, isSuperAdmin]);

  // Get module configuration for a specific module
  const getModuleConfig = useCallback((slug: string): Record<string, unknown> | null => {
    const orgModule = orgModules.find(
      (om) => om.modules?.slug === slug
    );
    
    return orgModule?.config || null;
  }, [orgModules]);

  // Get enabled modules list
  const enabledModules = orgModules
    .filter((om) => om.is_enabled)
    .map((om) => om.modules)
    .filter(Boolean) as Module[];

  return {
    allModules,
    enabledModules,
    orgModules,
    isModuleEnabled,
    getModuleConfig,
    isLoading: modulesLoading || orgModulesLoading,
  };
}
