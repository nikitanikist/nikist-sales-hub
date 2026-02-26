import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { getPermissionForRoute, isCohortRoute, PERMISSION_KEYS, ROUTE_TO_PERMISSION } from "@/lib/permissions";
import { useOrgFeatureOverrides } from "@/hooks/useOrgFeatureOverrides";
import { useOrganization } from "@/hooks/useOrganization";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  requiredPermission?: string;
}

// Find the first route the current user can actually access
function useFirstAccessibleRoute() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = useUserRole(currentOrganization?.id);
  const { isPermissionDisabled } = useOrgFeatureOverrides();

  const preferredRoutes = [
    '/whatsapp',
    '/leads',
    '/calls',
    '/workshops',
    '/sales',
    '/funnels',
    '/products',
    '/daily-money-flow',
    '/onboarding',
    '/sales-closers',
    '/users',
    '/settings',
    '/my-plan',
  ];

  for (const route of preferredRoutes) {
    const permKey = ROUTE_TO_PERMISSION[route];
    if (!permKey) continue;
    if (hasPermission(permKey) && !isPermissionDisabled(permKey)) {
      return route;
    }
  }
  return '/whatsapp';
}

const ProtectedRoute = ({ children, adminOnly = false, requiredPermission }: ProtectedRouteProps) => {
  const { currentOrganization } = useOrganization();
  const { isAdmin, isCloser, isSuperAdmin, isLoading } = useUserRole(currentOrganization?.id);
  const { isLoading: overridesLoading } = useOrgFeatureOverrides();
  const location = useLocation();
  const firstAccessibleRoute = useFirstAccessibleRoute();

  if (isLoading || overridesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-20 rounded" />
        </div>
      </div>
    );
  }

  // Super admins should be redirected to /super-admin if they're on regular routes
  if (isSuperAdmin && location.pathname === "/") {
    return <Navigate to="/super-admin" replace />;
  }

  // Regular users landing on / should go to first accessible route
  if (!isSuperAdmin && location.pathname === "/") {
    return <Navigate to={firstAccessibleRoute} replace />;
  }

  // If this is an admin-only route and user is a closer, redirect to first accessible
  if (adminOnly && isCloser && !isAdmin && !isSuperAdmin) {
    return <Navigate to={firstAccessibleRoute} replace />;
  }

  // Check cohort route permissions for closers
  if (isCohortRoute(location.pathname) && isCloser && !isAdmin && !isSuperAdmin) {
    const permission = getPermissionForRoute(location.pathname);
    if (permission && permission !== PERMISSION_KEYS.cohort_batches) {
      return <Navigate to={firstAccessibleRoute} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
