import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type UserRole = 'admin' | 'sales_rep' | 'viewer' | null;

interface UseUserRoleReturn {
  role: UserRole;
  isAdmin: boolean;
  isCloser: boolean;
  isLoading: boolean;
  profileId: string | null;
}

export const useUserRole = (): UseUserRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.email) {
        setRole(null);
        setProfileId(null);
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

        // Now get the user's role
        const { data: userRole, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id)
          .maybeSingle();

        if (roleError) {
          console.error("Error fetching user role:", roleError);
          setIsLoading(false);
          return;
        }

        setRole(userRole?.role || null);
      } catch (error) {
        console.error("Error in useUserRole:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, [user?.email]);

  return {
    role,
    isAdmin: role === 'admin',
    isCloser: role === 'sales_rep',
    isLoading,
    profileId,
  };
};
