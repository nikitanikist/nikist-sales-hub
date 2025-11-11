import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarFooter, SidebarTrigger } from "@/components/ui/sidebar";
import { Building2, LayoutDashboard, Users, UserCog, Calendar, DollarSign, LogOut, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const AppLayout = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/" },
    { title: "Customers", icon: Users, path: "/leads" },
    { title: "Sales Closers", icon: UserCog, path: "/sales-closers" },
    { title: "All Workshops", icon: Calendar, path: "/workshops" },
    { title: "Sales", icon: DollarSign, path: "/sales" },
  ];

  const notificationCount = 10; // Demo value

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sidebar-primary rounded-lg">
                <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-sidebar-foreground">Nikist CRM</h2>
                <p className="text-xs text-sidebar-foreground/60">{user.email}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={location.pathname === item.path}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background border-b border-border">
            <div className="flex items-center justify-between px-4 py-3">
              {/* Left Section: Toggle + Heading */}
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <h1 className="text-xl font-semibold">Nikist CRM</h1>
              </div>
              
              {/* Right Section: Notifications + Profile */}
              <div className="flex items-center gap-4">
                {/* Notification Bell with Badge */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full"
                    >
                      {notificationCount}
                    </Badge>
                  )}
                </Button>
                
                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.email?.[0].toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">My Account</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      Edit profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
