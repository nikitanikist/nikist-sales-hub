import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Building2, Users, Clock, AlertTriangle, Download } from "lucide-react";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { format, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface AnalyticsDashboardProps {
  totalOrgs: number;
}

const AnalyticsDashboard = ({ totalOrgs }: AnalyticsDashboardProps) => {
  const {
    subscriptions,
    mrr,
    planDistribution,
    upcomingRenewals,
    expiringTrials,
    paidCount,
    trialCount,
    inactiveCount,
    isLoading,
  } = useSubscriptions();

  // Revenue trend (last 6 months mock based on MRR - in real app would come from payment history)
  const revenueTrend = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    return {
      month: format(date, "MMM"),
      revenue: Math.round(mrr * (0.7 + i * 0.06)),
    };
  });

  const exportRevenueReport = () => {
    const data = subscriptions.map((s) => ({
      Organization: s.organizations?.name || "Unknown",
      Plan: s.billing_plans?.name || "Unknown",
      Status: s.status,
      "Billing Cycle": s.billing_cycle,
      "Monthly Contribution": s.billing_cycle === "yearly" 
        ? ((s.custom_price ?? s.current_price ?? 0) / 12).toFixed(2)
        : (s.custom_price ?? s.current_price ?? 0).toFixed(2),
      "Period End": s.current_period_end ? format(new Date(s.current_period_end), "PP") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Revenue");
    XLSX.writeFile(wb, `revenue-report-${format(new Date(), "yyyy-MM-dd")}.csv`, { bookType: "csv" });
    toast.success("Revenue report exported");
  };

  const exportPaymentHistory = async () => {
    const { data, error } = await supabase
      .from("subscription_payments")
      .select(`*, organizations!subscription_payments_organization_id_fkey (name)`)
      .order("payment_date", { ascending: false });
    if (error) {
      toast.error("Failed to export payments");
      return;
    }
    const rows = (data || []).map((p: any) => ({
      Organization: p.organizations?.name || "Unknown",
      Amount: p.amount,
      Type: p.payment_type,
      Method: p.payment_method || "",
      Status: p.payment_status,
      Reference: p.payment_reference || "",
      Date: p.payment_date ? format(new Date(p.payment_date), "PP") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, `payment-history-${format(new Date(), "yyyy-MM-dd")}.csv`, { bookType: "csv" });
    toast.success("Payment history exported");
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="skeleton-shimmer h-16 rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold data-text">₹{mrr.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orgs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrgs}</div>
            <p className="text-xs text-muted-foreground">{subscriptions.length} with subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidCount}</div>
            <p className="text-xs text-muted-foreground">Active subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Trial</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trialCount}</div>
            {expiringTrials.length > 0 && (
              <p className="text-xs text-warning">{expiringTrials.length} expiring soon</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveCount}</div>
            <p className="text-xs text-muted-foreground">Expired or cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={planDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons + Upcoming Renewals */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportRevenueReport}>
          <Download className="mr-2 h-4 w-4" />
          Export Revenue
        </Button>
        <Button variant="outline" size="sm" onClick={exportPaymentHistory}>
          <Download className="mr-2 h-4 w-4" />
          Export Payments
        </Button>
      </div>

      {upcomingRenewals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Renewals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...upcomingRenewals, ...expiringTrials].map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.organizations?.name}</TableCell>
                    <TableCell>{s.billing_plans?.name}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(s.status === "trial" ? s.trial_ends_at! : s.current_period_end), "PP")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
