import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, IndianRupee, TrendingUp, Calendar, Trash2, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import AddMoneyFlowDialog from "@/components/AddMoneyFlowDialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MoneyFlowEntry {
  id: string;
  date: string;
  total_revenue: number;
  cash_collected: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const DailyMoneyFlow = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoneyFlowEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all money flow entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["daily-money-flow"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("daily_money_flow")
        .select("*, profiles:created_by(full_name)")
        .order("date", { ascending: false });

      if (error) throw error;
      return data as MoneyFlowEntry[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("daily_money_flow")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-money-flow"] });
      toast({ title: "Entry deleted successfully" });
      setDeletingId(null);
    },
    onError: (error) => {
      toast({ title: "Error deleting entry", description: error.message, variant: "destructive" });
    },
  });

  // Calculate today's data
  const today = format(new Date(), "yyyy-MM-dd");
  const todayEntry = entries.find((e) => e.date === today);
  const todayRevenue = todayEntry?.total_revenue || 0;
  const todayCash = todayEntry?.cash_collected || 0;

  // Calculate this month's data
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const thisMonthEntries = entries.filter((e) => {
    const entryDate = new Date(e.date);
    return entryDate >= monthStart && entryDate <= monthEnd;
  });
  const monthRevenue = thisMonthEntries.reduce((sum, e) => sum + Number(e.total_revenue), 0);
  const monthCash = thisMonthEntries.reduce((sum, e) => sum + Number(e.cash_collected), 0);

  // Prepare chart data (last 30 days)
  const chartData = entries
    .slice(0, 30)
    .reverse()
    .map((e) => ({
      date: format(new Date(e.date), "dd MMM"),
      revenue: Number(e.total_revenue),
      cash: Number(e.cash_collected),
    }));

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
    cash: {
      label: "Cash Collected",
      color: "hsl(var(--chart-2))",
    },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Daily Money Flow</h1>
          <p className="text-muted-foreground">Track daily revenue and cash collection</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayRevenue)}</div>
            <p className="text-xs text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Cash</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayCash)}</div>
            <p className="text-xs text-muted-foreground">Cash collected today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month Revenue</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthRevenue)}</div>
            <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month Cash</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthCash)}</div>
            <p className="text-xs text-muted-foreground">Total collected this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Revenue vs Cash Line Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue vs Cash Collection Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                      name="Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="cash"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-2))" }}
                      name="Cash Collected"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Revenue Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      fill="hsl(var(--primary) / 0.3)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Cash Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Cash Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="cash"
                      fill="hsl(var(--chart-2))"
                      radius={[4, 4, 0, 0]}
                      name="Cash Collected"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No entries yet. Click "Add Data" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cash Collected</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {format(new Date(entry.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(entry.total_revenue))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(entry.cash_collected))}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.notes || "-"}</TableCell>
                    <TableCell>{entry.profiles?.full_name || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingEntry(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(entry.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <AddMoneyFlowDialog
        open={isAddDialogOpen || !!editingEntry}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingEntry(null);
          }
        }}
        editingEntry={editingEntry}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DailyMoneyFlow;
