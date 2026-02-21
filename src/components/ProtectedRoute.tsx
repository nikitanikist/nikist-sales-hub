import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { getPermissionForRoute, isCohortRoute, PERMISSION_KEYS } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  requiredPermission?: string;
}

const ProtectedRoute = ({ children, adminOnly = false, requiredPermission }: ProtectedRouteProps) => {
  const { isAdmin, isCloser, isSuperAdmin, isLoading } = useUserRole();
  const location = useLocation();

  if (isLoading) {
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

  // Regular users landing on / should go to WhatsApp dashboard
  if (!isSuperAdmin && location.pathname === "/") {
    return <Navigate to="/whatsapp" replace />;
  }

  // If this is an admin-only route and user is a closer, redirect to calls
  if (adminOnly && isCloser && !isAdmin && !isSuperAdmin) {
    return <Navigate to="/calls" replace />;
  }

  // Check cohort route permissions for closers
  if (isCohortRoute(location.pathname) && isCloser && !isAdmin && !isSuperAdmin) {
    // Closers can only access cohort batches if they have the permission
    const permission = getPermissionForRoute(location.pathname);
    if (permission && permission !== PERMISSION_KEYS.cohort_batches) {
      return <Navigate to="/calls" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
