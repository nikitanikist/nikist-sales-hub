import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useModules } from "@/hooks/useModules";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Lock } from "lucide-react";

interface ModuleGuardProps {
  moduleSlug: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * ModuleGuard protects routes based on whether a module is enabled for the organization.
 * Super admins bypass all module checks.
 */
export function ModuleGuard({ moduleSlug, children, fallback }: ModuleGuardProps) {
  const { isModuleEnabled, isLoading } = useModules();
  const { isSuperAdmin, isLoading: roleLoading } = useUserRole();

  // Show loading state while checking module status
  if (isLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Super admins bypass all module checks
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check if module is enabled
  if (!isModuleEnabled(moduleSlug)) {
    // If a fallback is provided, show it instead of redirecting
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // Redirect to dashboard if module is not enabled
    return <Navigate to="/whatsapp" replace />;
  }

  return <>{children}</>;
}

/**
 * DisabledModuleFallback - A simple component to show when a module is disabled
 */
export function DisabledModuleFallback({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <div className="bg-muted rounded-full p-4 mb-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Module Not Available</h2>
      <p className="text-muted-foreground max-w-md">
        The <strong>{moduleName}</strong> module is not enabled for your organization. 
        Please contact your administrator to enable this feature.
      </p>
    </div>
  );
}
