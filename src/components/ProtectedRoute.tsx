import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute = ({ children, adminOnly = false }: ProtectedRouteProps) => {
  const { isAdmin, isCloser, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If this is an admin-only route and user is a closer, redirect to calls
  if (adminOnly && isCloser && !isAdmin) {
    return <Navigate to="/calls" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
