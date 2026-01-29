import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useModules } from "@/hooks/useModules";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Blocks, Phone, GraduationCap, Presentation, DollarSign, Loader2, ShieldAlert } from "lucide-react";

// Icon mapping for modules
const moduleIcons: Record<string, typeof Phone> = {
  Phone,
  GraduationCap,
  Presentation,
  DollarSign,
};

export function ModulesSettings() {
  const { currentOrganization } = useOrganization();
  const { allModules, orgModules, isLoading } = useModules();
  const { isSuperAdmin } = useUserRole();
  const queryClient = useQueryClient();

  // Toggle module mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ moduleId, isEnabled }: { moduleId: string; isEnabled: boolean }) => {
      if (!currentOrganization?.id) throw new Error("No organization selected");

      // Check if organization_module record exists
      const existingRecord = orgModules.find((om) => om.module_id === moduleId);

      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
          .from("organization_modules")
          .update({
            is_enabled: isEnabled,
            enabled_at: isEnabled ? new Date().toISOString() : null,
          })
          .eq("id", existingRecord.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from("organization_modules")
          .insert({
            organization_id: currentOrganization.id,
            module_id: moduleId,
            is_enabled: isEnabled,
            enabled_at: isEnabled ? new Date().toISOString() : null,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-modules"] });
      toast({ title: "Module updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update module",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isModuleEnabled = (moduleId: string): boolean => {
    const orgModule = orgModules.find((om) => om.module_id === moduleId);
    return orgModule?.is_enabled ?? false;
  };

  const handleToggle = (moduleId: string, currentState: boolean) => {
    toggleMutation.mutate({ moduleId, isEnabled: !currentState });
  };

  // Only Super Admins can access this component
  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground max-w-md">
            Only Super Admins can manage module settings. Contact your system administrator 
            to enable or disable modules for this organization.
          </p>
        </CardContent>
      </Card>
    );
  }

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
          <Blocks className="h-5 w-5" />
          Module Settings
        </CardTitle>
        <CardDescription>
          Enable or disable modules for {currentOrganization.name}. Disabling a module will hide 
          it from the sidebar and prevent access to related features.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allModules.map((module) => {
            const IconComponent = moduleIcons[module.icon || ""] || Blocks;
            const isEnabled = isModuleEnabled(module.id);
            const isPending = toggleMutation.isPending;

            return (
              <div
                key={module.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{module.name}</h4>
                      {module.is_premium && (
                        <Badge variant="secondary" className="text-xs">
                          Premium
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => handleToggle(module.id, isEnabled)}
                  disabled={isPending}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
