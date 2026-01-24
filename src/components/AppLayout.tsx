import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useState } from "react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarFooter, SidebarTrigger, useSidebar, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, LayoutDashboard, Users, UserCog, Calendar, DollarSign, TrendingUp, LogOut, Bell, User, Phone, Package, ClipboardList, UsersRound, GraduationCap, Zap, Wallet, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ROUTE_TO_PERMISSION, PermissionKey } from "@/lib/permissions";

// Menu item type with optional children for submenus
interface MenuItem {
  title: string;
  icon: typeof LayoutDashboard;
  path?: string;
  isBeta?: boolean;
  permissionKey?: PermissionKey;
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
}

const SidebarNavigation = ({ menuItems, navigate, location, signOut, userEmail }: SidebarNavigationProps) => {
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
        <div className="flex items-center gap-2">
          <div className="p-2 bg-sidebar-primary rounded-lg">
            <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">Nikist CRM</h2>
            <p className="text-xs text-sidebar-foreground/60">{userEmail}</p>
          </div>
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

const AppLayout = () => {
  const { user, signOut, loading } = useAuth();
  const { isAdmin, isCloser, isManager, isLoading: roleLoading, hasPermission } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Check route access based on permissions
  useEffect(() => {
    if (roleLoading || loading || !user) return;
    
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
  }, [roleLoading, loading, user, location.pathname, hasPermission, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // All menu items with permission keys
  const allMenuItems: MenuItem[] = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/", isBeta: true, permissionKey: 'dashboard' },
    { title: "Daily Money Flow", icon: Wallet, path: "/daily-money-flow", permissionKey: 'daily_money_flow' },
    { title: "Customers", icon: Users, path: "/leads", permissionKey: 'customers' },
    { title: "Customer Insights", icon: ClipboardList, path: "/onboarding", permissionKey: 'customer_insights' },
    { title: "1:1 Call Schedule", icon: Phone, path: "/calls", permissionKey: 'call_schedule' },
    { title: "Sales Closers", icon: UserCog, path: "/sales-closers", permissionKey: 'sales_closers' },
    { 
      title: "Cohort Batches", 
      icon: GraduationCap, 
      children: [
        { title: "Insider Crypto Club", path: "/batches", permissionKey: 'batch_icc' },
        { title: "Future Mentorship", path: "/futures-mentorship", permissionKey: 'batch_futures' },
        { title: "High Future", path: "/high-future", permissionKey: 'batch_high_future' },
      ]
    },
    { title: "All Workshops", icon: Calendar, path: "/workshops", isBeta: true, permissionKey: 'workshops' },
    { title: "Sales", icon: DollarSign, path: "/sales", isBeta: true, permissionKey: 'sales' },
    { title: "Active Funnels", icon: TrendingUp, path: "/funnels", isBeta: true, permissionKey: 'funnels' },
    { title: "Products", icon: Package, path: "/products", isBeta: true, permissionKey: 'products' },
    { title: "Users", icon: UsersRound, path: "/users", permissionKey: 'users' },
  ];

  // Filter menu items based on permissions
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .map(item => {
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

  const menuItems = filterMenuItems(allMenuItems);

  const notificationCount = 10; // Demo value

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <SidebarNavigation 
          menuItems={menuItems}
          navigate={navigate}
          location={location}
          signOut={signOut}
          userEmail={user.email}
        />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background border-b border-border">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3">
              {/* Left Section: Toggle + Heading */}
              <div className="flex items-center gap-2 sm:gap-3">
                <SidebarTrigger className="h-9 w-9 sm:h-10 sm:w-10" />
                <h1 className="text-lg sm:text-xl font-semibold hidden sm:block">Nikist CRM</h1>
              </div>
              
              {/* Right Section: Notifications + Profile */}
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Notification Bell with Badge */}
                <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {notificationCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-[10px] sm:text-xs rounded-full"
                    >
                      {notificationCount}
                    </Badge>
                  )}
                </Button>
                
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

export default AppLayout;
