import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PermissionKey, DEFAULT_PERMISSIONS, PERMISSION_KEYS } from "@/lib/permissions";

type UserRole = 'admin' | 'sales_rep' | 'viewer' | 'manager' | 'super_admin' | null;

interface UseUserRoleReturn {
  role: UserRole;
  isAdmin: boolean;
  isCloser: boolean;
  isManager: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  profileId: string | null;
  permissions: Record<PermissionKey, boolean>;
  hasPermission: (key: PermissionKey) => boolean;
}

export const useUserRole = (organizationId?: string | null): UseUserRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({} as Record<PermissionKey, boolean>);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.email) {
        setRole(null);
        setProfileId(null);
        setPermissions({} as Record<PermissionKey, boolean>);
        setIsLoading(false);
        return;
      }

      try {
        // First get the profile ID by email
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          setIsLoading(false);
          return;
        }

        if (!profile) {
          console.log("No profile found for user:", user.email);
          setIsLoading(false);
          return;
        }

        setProfileId(profile.id);

        // Check if super admin first (global role)
        const { data: superAdminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id)
          .eq("role", "super_admin")
          .maybeSingle();

        if (superAdminRole) {
          setRole('super_admin');
          // Super admin has all permissions
          const allPermissionKeys = Object.values(PERMISSION_KEYS);
          const permissionsMap: Record<PermissionKey, boolean> = {} as Record<PermissionKey, boolean>;
          allPermissionKeys.forEach(key => {
            permissionsMap[key] = true;
          });
          setPermissions(permissionsMap);
          setIsLoading(false);
          return;
        }

        // Get the current organization from localStorage
        const currentOrgId = organizationId ?? localStorage.getItem("lovable_current_org_id");

        let fetchedRole: UserRole = null;

        if (currentOrgId) {
          // Get org-specific role from organization_members
          const { data: membership } = await supabase
            .from("organization_members")
            .select("role, is_org_admin")
            .eq("user_id", profile.id)
            .eq("organization_id", currentOrgId)
            .maybeSingle();

          if (membership) {
            fetchedRole = membership.role as UserRole;
          }
        }

        // Fallback to global role if no org-specific role found
        if (!fetchedRole) {
          const { data: userRoles, error: roleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          if (roleError) {
            console.error("Error fetching user role:", roleError);
          } else {
            // Priority: admin > manager > sales_rep > viewer
            const rolesList = userRoles?.map(r => r.role) || [];
            if (rolesList.includes('admin')) {
              fetchedRole = 'admin';
            } else if (rolesList.includes('manager')) {
              fetchedRole = 'manager';
            } else if (rolesList.includes('sales_rep')) {
              fetchedRole = 'sales_rep';
            } else if (rolesList.includes('viewer')) {
              fetchedRole = 'viewer';
            }
          }
        }

        setRole(fetchedRole);

        // Fetch user permissions
        const { data: userPermissions, error: permError } = await supabase
          .from("user_permissions")
          .select("permission_key, is_enabled")
          .eq("user_id", profile.id);

        if (permError) {
          console.error("Error fetching permissions:", permError);
        }

        // Build permissions map
        const allPermissionKeys = Object.values(PERMISSION_KEYS);
        const permissionsMap: Record<PermissionKey, boolean> = {} as Record<PermissionKey, boolean>;
        
        // Check if user has any custom permissions stored
        if (userPermissions && userPermissions.length > 0) {
          // Use stored permissions
          allPermissionKeys.forEach(key => {
            const perm = userPermissions.find(p => p.permission_key === key);
            permissionsMap[key] = perm ? perm.is_enabled : false;
          });
        } else {
          // Fall back to role-based defaults
          const defaultPerms = DEFAULT_PERMISSIONS[fetchedRole || 'viewer'] || [];
          allPermissionKeys.forEach(key => {
            permissionsMap[key] = defaultPerms.includes(key);
          });
        }

        // Admins always have all permissions
        if (fetchedRole === 'admin') {
          allPermissionKeys.forEach(key => {
            permissionsMap[key] = true;
          });
        }

        setPermissions(permissionsMap);
      } catch (error) {
        console.error("Error in useUserRole:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, [user?.email, organizationId]);

  const hasPermission = (key: PermissionKey): boolean => {
    // Admins and super admins always have all permissions
    if (role === 'admin' || role === 'super_admin') return true;
    return permissions[key] ?? false;
  };

  return {
    role,
    isAdmin: role === 'admin',
    isCloser: role === 'sales_rep',
    isManager: role === 'manager',
    isSuperAdmin: role === 'super_admin',
    isLoading,
    profileId,
    permissions,
    hasPermission,
  };
};
