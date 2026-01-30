import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_TIMEZONE } from "@/lib/timezoneUtils";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  timezone: string;
}

interface OrganizationMember {
  organization_id: string;
  role: string;
  is_org_admin: boolean;
  organization: Organization;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const CURRENT_ORG_KEY = "lovable_current_org_id";

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  const fetchOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setIsLoading(false);
      return;
    }

    try {
      // First check if user is super admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (!profile) {
        setIsLoading(false);
        return;
      }

      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.id)
        .eq("role", "super_admin")
        .maybeSingle();

      const userIsSuperAdmin = !!superAdminRole;
      setIsSuperAdmin(userIsSuperAdmin);

      let orgs: Organization[] = [];

      if (userIsSuperAdmin) {
        // Super admins can see all organizations
        const { data: allOrgs, error } = await supabase
          .from("organizations")
          .select("id, name, slug, logo_url, is_active, timezone")
          .order("name");

        if (error) throw error;
        orgs = (allOrgs || []).map(org => ({
          ...org,
          timezone: org.timezone || DEFAULT_TIMEZONE,
        }));
      } else {
        // Regular users see only their organizations
        const { data: memberships, error } = await supabase
          .from("organization_members")
          .select(`
            organization_id,
            role,
            is_org_admin,
            organizations (
              id,
              name,
              slug,
              logo_url,
              is_active,
              timezone
            )
          `)
          .eq("user_id", profile.id);

        if (error) throw error;

        // Extract organizations from memberships
        orgs = (memberships || [])
          .map((m: any) => ({
            ...m.organizations,
            timezone: m.organizations?.timezone || DEFAULT_TIMEZONE,
          }))
          .filter((org: any) => org !== null && org.id);

        // Check if user is org admin for current org
        const currentOrgMembership = memberships?.find(
          (m: any) => m.organization_id === currentOrganization?.id
        );
        setIsOrgAdmin(currentOrgMembership?.is_org_admin || false);
      }

      setOrganizations(orgs);

      // Set current organization
      const savedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
      const savedOrg = orgs.find((o) => o.id === savedOrgId);
      
      if (savedOrg) {
        setCurrentOrganization(savedOrg);
      } else if (orgs.length > 0) {
        setCurrentOrganization(orgs[0]);
        localStorage.setItem(CURRENT_ORG_KEY, orgs[0].id);
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  const switchOrganization = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      localStorage.setItem(CURRENT_ORG_KEY, orgId);
    }
  };

  const refreshOrganizations = async () => {
    await fetchOrganizations();
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        isLoading,
        isSuperAdmin,
        isOrgAdmin,
        switchOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
