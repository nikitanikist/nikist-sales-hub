import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute = ({ children, adminOnly = false }: ProtectedRouteProps) => {
  const { isAdmin, isCloser, isSuperAdmin, isLoading } = useUserRole();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Super admins should be redirected to /super-admin if they're on regular routes
  if (isSuperAdmin && location.pathname === "/") {
    return <Navigate to="/super-admin" replace />;
  }

  // If this is an admin-only route and user is a closer, redirect to calls
  if (adminOnly && isCloser && !isAdmin && !isSuperAdmin) {
    return <Navigate to="/calls" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
