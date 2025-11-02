import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const Dashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [leadsResult, workshopsResult, salesResult] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact" }),
        supabase.from("workshops").select("*", { count: "exact" }),
        supabase.from("sales").select("amount"),
      ]);

      const totalRevenue = salesResult.data?.reduce((sum, sale) => sum + Number(sale.amount), 0) || 0;

      return {
        totalLeads: leadsResult.count || 0,
        totalWorkshops: workshopsResult.count || 0,
        totalSales: salesResult.data?.length || 0,
        totalRevenue,
      };
    },
  });

  const { data: leadsByStatus } = useQuery({
    queryKey: ["leads-by-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("status");

      const statusCounts = data?.reduce((acc: any, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(statusCounts || {}).map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
      }));
    },
  });

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your CRM activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leadsByStatus}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
