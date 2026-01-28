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

export const useUserRole = (): UseUserRoleReturn => {
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

        // Now get all of the user's roles (user may have multiple)
        const { data: userRoles, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id);

        if (roleError) {
          console.error("Error fetching user role:", roleError);
          setIsLoading(false);
          return;
        }

        // Priority: super_admin > admin > manager > sales_rep > viewer
        const rolesList = userRoles?.map(r => r.role) || [];
        let fetchedRole: UserRole = null;
        if (rolesList.includes('super_admin')) {
          fetchedRole = 'super_admin';
        } else if (rolesList.includes('admin')) {
          fetchedRole = 'admin';
        } else if (rolesList.includes('manager')) {
          fetchedRole = 'manager';
        } else if (rolesList.includes('sales_rep')) {
          fetchedRole = 'sales_rep';
        } else if (rolesList.includes('viewer')) {
          fetchedRole = 'viewer';
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

        // Admins and super admins always have all permissions
        if (fetchedRole === 'admin' || fetchedRole === 'super_admin') {
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
  }, [user?.email]);

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
