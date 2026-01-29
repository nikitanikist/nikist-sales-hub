import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useModules } from "@/hooks/useModules";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarFooter, SidebarTrigger, useSidebar, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, LayoutDashboard, Users, UserCog, Calendar, DollarSign, TrendingUp, LogOut, User, Phone, Package, ClipboardList, UsersRound, GraduationCap, Wallet, ChevronDown, Shield, Rocket, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ROUTE_TO_PERMISSION, PermissionKey } from "@/lib/permissions";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { OrganizationProvider, useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";

// Icon mapping for dynamic cohort types
const iconMap: Record<string, typeof LayoutDashboard> = {
  Users: Users,
  TrendingUp: TrendingUp,
  Rocket: Rocket,
  GraduationCap: GraduationCap,
};

// Menu item type with optional children for submenus
interface MenuItem {
  title: string;
  icon: typeof LayoutDashboard;
  path?: string;
  isBeta?: boolean;
  permissionKey?: PermissionKey;
  moduleSlug?: string; // NEW: Module this menu item belongs to
  children?: {
    title: string;
    path: string;
    permissionKey?: PermissionKey;
  }[];
}

// Sidebar navigation component that uses useSidebar hook for auto-close on mobile
interface SidebarNavigationProps {
  menuItems: MenuItem[];
  navigate: (path: string) => void;
  location: { pathname: string };
  signOut: () => void;
  userEmail: string | undefined;
  isSuperAdmin?: boolean;
  organizationName?: string;
}

const SidebarNavigation = ({ menuItems, navigate, location, signOut, userEmail, isSuperAdmin, organizationName }: SidebarNavigationProps) => {
  const { setOpenMobile, isMobile } = useSidebar();

  const handleNavigation = (path: string) => {
    navigate(path);
    // Auto-close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Gradient background for logo */}
            <div className="p-2.5 bg-gradient-to-br from-primary to-[hsl(280,83%,58%)] rounded-xl shadow-md">
              {isSuperAdmin ? (
                <Shield className="h-5 w-5 text-white" />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-sidebar-foreground">
                {isSuperAdmin ? "Super Admin" : organizationName || "CRM"}
              </h2>
              <p className="text-xs text-sidebar-foreground/60 truncate max-w-[140px]">{userEmail}</p>
            </div>
          </div>
          {/* Hide OrganizationSwitcher for Super Admins */}
          {!isSuperAdmin && <OrganizationSwitcher />}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            item.children ? (
              // Collapsible menu item with children
              <Collapsible
                key={item.title}
                defaultOpen={item.children.some(child => location.pathname === child.path)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={item.children.some(child => location.pathname === child.path)}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.children.map((child) => (
                        <SidebarMenuSubItem key={child.path}>
                          <SidebarMenuSubButton
                            onClick={() => handleNavigation(child.path)}
                            isActive={location.pathname === child.path}
                          >
                            <span>{child.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              // Regular menu item without children
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  onClick={() => handleNavigation(item.path!)}
                  isActive={location.pathname === item.path}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                  {item.isBeta && (
                    <Badge 
                      variant="outline" 
                      className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-warning text-foreground border-warning font-medium"
                    >
                      Beta
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

const AppLayoutContent = () => {
  const { user, signOut, loading } = useAuth();
  const { isAdmin, isCloser, isManager, isSuperAdmin, isLoading: roleLoading, hasPermission } = useUserRole();
  const { currentOrganization, isSuperAdmin: orgIsSuperAdmin } = useOrganization();
  const { isModuleEnabled, isLoading: modulesLoading } = useModules();
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch dynamic cohort types for the current organization
  const { data: cohortTypes = [] } = useQuery({
    queryKey: ["cohort-types", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("cohort_types")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization && !isSuperAdmin,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Skip permission checks for super admin routes
  const isSuperAdminRoute = location.pathname.startsWith("/super-admin");

  // Check route access based on permissions (skip for super admin routes)
  useEffect(() => {
    if (roleLoading || loading || !user || isSuperAdminRoute) return;
    
    const currentPath = location.pathname;
    const permissionKey = ROUTE_TO_PERMISSION[currentPath];
    
    // Skip permission check for paths without a permission mapping
    if (!permissionKey) return;
    
    // Check if user has permission for current route
    if (!hasPermission(permissionKey)) {
      // Find first accessible route
      const accessibleRoute = Object.entries(ROUTE_TO_PERMISSION).find(
        ([path, key]) => hasPermission(key)
      );
      
      if (accessibleRoute) {
        navigate(accessibleRoute[0]);
      } else {
        // No accessible routes - this shouldn't happen for valid users
        console.warn("User has no accessible routes");
      }
    }
  }, [roleLoading, loading, user, location.pathname, hasPermission, navigate, isSuperAdminRoute]);

  // Build dynamic cohort children from database (must be before early returns)
  const dynamicCohortChildren = useMemo(() => {
    // If no cohort types exist, show "Create Cohort" option for admins
    if (cohortTypes.length === 0) {
      return [
        { title: "+ Create Cohort", path: "/cohorts/manage", permissionKey: 'cohort_batches' as PermissionKey },
      ];
    }
    
    // Map cohort types to menu items with dynamic routes
    const items = cohortTypes.map(cohort => ({
      title: cohort.name,
      path: cohort.route,
      // Use unified cohort permission for all cohort types
      permissionKey: 'cohort_batches' as PermissionKey,
    }));
    
    // Add "Manage" option at the end for admins
    if (isAdmin) {
      items.push({
        title: "⚙ Manage Cohorts",
        path: "/cohorts/manage",
        permissionKey: 'cohort_batches' as PermissionKey,
      });
    }
    
    return items;
  }, [cohortTypes, isAdmin]);

  // All menu items with permission keys and module associations
  const allMenuItems: MenuItem[] = useMemo(() => [
    { title: "Dashboard", icon: LayoutDashboard, path: "/", isBeta: true, permissionKey: 'dashboard' as PermissionKey },
    { title: "Daily Money Flow", icon: Wallet, path: "/daily-money-flow", permissionKey: 'daily_money_flow' as PermissionKey, moduleSlug: 'daily-money-flow' },
    { title: "Customers", icon: Users, path: "/leads", permissionKey: 'customers' as PermissionKey },
    { title: "Customer Insights", icon: ClipboardList, path: "/onboarding", permissionKey: 'customer_insights' as PermissionKey },
    { title: "1:1 Call Schedule", icon: Phone, path: "/calls", permissionKey: 'call_schedule' as PermissionKey, moduleSlug: 'one-to-one-funnel' },
    { title: "Sales Closers", icon: UserCog, path: "/sales-closers", permissionKey: 'sales_closers' as PermissionKey, moduleSlug: 'one-to-one-funnel' },
    { 
      title: "Cohort Batches", 
      icon: GraduationCap, 
      children: dynamicCohortChildren,
      moduleSlug: 'cohort-management'
    },
    { title: "All Workshops", icon: Calendar, path: "/workshops", isBeta: true, permissionKey: 'workshops' as PermissionKey, moduleSlug: 'workshops' },
    { title: "Sales", icon: DollarSign, path: "/sales", isBeta: true, permissionKey: 'sales' as PermissionKey },
    { title: "Active Funnels", icon: TrendingUp, path: "/funnels", isBeta: true, permissionKey: 'funnels' as PermissionKey },
    { title: "Products", icon: Package, path: "/products", isBeta: true, permissionKey: 'products' as PermissionKey },
    { title: "Users", icon: UsersRound, path: "/users", permissionKey: 'users' as PermissionKey },
    { title: "Settings", icon: Settings, path: "/settings", permissionKey: 'settings' as PermissionKey },
  ], [dynamicCohortChildren]);

  // Filter menu items based on permissions AND modules
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .map(item => {
        // First check if module is enabled (if item has a moduleSlug)
        if (item.moduleSlug && !isModuleEnabled(item.moduleSlug)) {
          return null;
        }
        
        if (item.children) {
          // Filter children based on permissions
          const filteredChildren = item.children.filter(child => 
            !child.permissionKey || hasPermission(child.permissionKey)
          );
          
          // Only include parent if it has visible children
          if (filteredChildren.length === 0) return null;
          
          return { ...item, children: filteredChildren };
        }
        
        // Check permission for regular items
        if (item.permissionKey && !hasPermission(item.permissionKey)) {
          return null;
        }
        
        return item;
      })
      .filter((item): item is MenuItem => item !== null);
  };

  // Super Admin specific menu - only show Super Admin Dashboard
  const superAdminMenuItems: MenuItem[] = [
    { title: "Super Admin Dashboard", icon: Shield, path: "/super-admin" },
  ];

  // Use super admin menu if user is super admin, otherwise filter regular menu
  const menuItems = isSuperAdmin 
    ? superAdminMenuItems 
    : filterMenuItems(allMenuItems);

  // Early returns after all hooks
  if (loading || roleLoading || modulesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Notification system removed - will be implemented with real backend when needed

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <SidebarNavigation 
          menuItems={menuItems}
          navigate={navigate}
          location={location}
          signOut={signOut}
          userEmail={user.email}
          isSuperAdmin={isSuperAdmin}
          organizationName={currentOrganization?.name}
        />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background border-b border-border">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3">
              {/* Left Section: Toggle + Heading */}
              <div className="flex items-center gap-2 sm:gap-3">
                <SidebarTrigger className="h-9 w-9 sm:h-10 sm:w-10" />
                <h1 className="text-lg sm:text-xl font-semibold hidden sm:block">{currentOrganization?.name || "CRM"}</h1>
              </div>
              
              {/* Right Section: Notifications + Profile */}
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Notification Bell - Hidden until notification system is implemented */}
                {/* TODO: Implement notification system with org-scoped notifications */}
                
                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0">
                      <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm sm:text-base">
                          {user.email?.[0].toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 z-50 bg-popover">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">My Account</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="min-h-[44px] sm:min-h-0">
                      <User className="mr-2 h-4 w-4" />
                      Edit profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={signOut} className="min-h-[44px] sm:min-h-0">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

// Wrap with OrganizationProvider
const AppLayout = () => {
  return (
    <OrganizationProvider>
      <AppLayoutContent />
    </OrganizationProvider>
  );
};

export default AppLayout;
