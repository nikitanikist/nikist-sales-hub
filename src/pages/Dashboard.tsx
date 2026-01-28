import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, DollarSign, TrendingUp, LayoutDashboard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AutomationStatusWidget from "@/components/AutomationStatusWidget";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";

const Dashboard = () => {
  const queryClient = useQueryClient();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  // Real-time subscription for leads table
  useEffect(() => {
    if (!currentOrganization) return;

    const channel = supabase
      .channel('dashboard-leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        () => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats", currentOrganization.id] });
          queryClient.invalidateQueries({ queryKey: ["leads-by-status", currentOrganization.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentOrganization]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return { totalLeads: 0, totalWorkshops: 0, totalSales: 0, totalRevenue: 0 };

      const [leadsResult, workshopsResult, salesResult] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact" }).eq("organization_id", currentOrganization.id),
        supabase.from("workshops").select("*", { count: "exact" }).eq("organization_id", currentOrganization.id),
        supabase.from("sales").select("amount").eq("organization_id", currentOrganization.id),
      ]);

      const totalRevenue = salesResult.data?.reduce((sum, sale) => sum + Number(sale.amount), 0) || 0;

      return {
        totalLeads: leadsResult.count || 0,
        totalWorkshops: workshopsResult.count || 0,
        totalSales: salesResult.data?.length || 0,
        totalRevenue,
      };
    },
    enabled: !!currentOrganization,
  });

  const { data: leadsByStatus } = useQuery({
    queryKey: ["leads-by-status", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];

      const { data } = await supabase
        .from("leads")
        .select("status")
        .eq("organization_id", currentOrganization.id);

      const statusCounts = data?.reduce((acc: any, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(statusCounts || {}).map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
      }));
    },
    enabled: !!currentOrganization,
  });

  // Show loading state while organization is loading
  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  // Wait for organization to be available
  if (!currentOrganization) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="No Organization Selected"
        description="Please select an organization to view the dashboard."
      />
    );
  }

  const statCards = [
    {
      title: "Total Leads",
      value: stats?.totalLeads || 0,
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Workshops",
      value: stats?.totalWorkshops || 0,
      icon: Calendar,
      color: "text-chart-2",
    },
    {
      title: "Closed Sales",
      value: stats?.totalSales || 0,
      icon: TrendingUp,
      color: "text-chart-3",
    },
    {
      title: "Total Revenue",
      value: `$${stats?.totalRevenue.toLocaleString() || 0}`,
      icon: DollarSign,
      color: "text-success",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back! Here's an overview of your CRM activity.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <AutomationStatusWidget />
        </div>
      </div>
      
      {/* Stats Cards - 2 columns on mobile, 4 on desktop */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-lg sm:text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-base sm:text-lg">Leads by Status</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
          {leadsByStatus && leadsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 300}>
              <BarChart data={leadsByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="status" 
                  tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
                  interval={0}
                  angle={window.innerWidth < 640 ? -45 : 0}
                  textAnchor={window.innerWidth < 640 ? "end" : "middle"}
                  height={window.innerWidth < 640 ? 60 : 30}
                />
                <YAxis tick={{ fontSize: 10 }} width={30} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              No leads data to display yet. Add your first lead to see stats here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
