import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Calendar, DollarSign, TrendingUp, LayoutDashboard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AutomationStatusWidget from "@/components/AutomationStatusWidget";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { StatsCardsSkeleton, ChartCardSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

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
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      title: "Workshops",
      value: stats?.totalWorkshops || 0,
      icon: Calendar,
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
    },
    {
      title: "Closed Sales",
      value: stats?.totalSales || 0,
      icon: TrendingUp,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      title: "Total Revenue",
      value: `₹${stats?.totalRevenue.toLocaleString('en-IN') || 0}`,
      icon: DollarSign,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex justify-end">
        <AutomationStatusWidget />
      </div>
      
      {/* Stats Cards - Enhanced with colored icon backgrounds */}
      {statsLoading ? (
        <StatsCardsSkeleton count={4} />
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, index) => (
            <Card key={stat.title} className="overflow-hidden" style={{ animationDelay: `${index * 50}ms` }}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-3 rounded-xl", stat.iconBg)}>
                    <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
                  </div>
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chart Card with gradient bar */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">Leads by Status</h3>
          {leadsByStatus && leadsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 300}>
              <BarChart data={leadsByStatus}>
                <defs>
                  <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(262, 83%, 58%)" />
                    <stop offset="100%" stopColor="hsl(262, 83%, 70%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="status" 
                  tick={{ fontSize: window.innerWidth < 640 ? 10 : 12, fill: 'hsl(var(--muted-foreground))' }}
                  interval={0}
                  angle={window.innerWidth < 640 ? -45 : 0}
                  textAnchor={window.innerWidth < 640 ? "end" : "middle"}
                  height={window.innerWidth < 640 ? 60 : 30}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                  width={30}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="url(#violetGradient)" 
                  radius={[6, 6, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No leads data yet"
              description="Lead activity will appear here once you start adding leads."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
