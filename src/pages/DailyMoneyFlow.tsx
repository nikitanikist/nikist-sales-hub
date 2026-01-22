import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, IndianRupee, TrendingUp, Calendar, Trash2, Pencil, Upload, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import AddMoneyFlowDialog from "@/components/AddMoneyFlowDialog";
import { ImportMoneyFlowDialog } from "@/components/ImportMoneyFlowDialog";
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
  creator_name?: string | null;
}

type InsightsPeriod = '1m' | '3m' | '6m' | '1y' | 'custom';

const DailyMoneyFlow = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoneyFlowEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Insights period state
  const [insightsPeriod, setInsightsPeriod] = useState<InsightsPeriod>('3m');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all money flow entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["daily-money-flow"],
    queryFn: async () => {
      // First fetch money flow entries
      const { data: moneyFlowData, error: moneyFlowError } = await supabase
        .from("daily_money_flow")
        .select("*")
        .order("date", { ascending: false });

      if (moneyFlowError) throw moneyFlowError;

      // Get unique creator IDs
      const creatorIds = [...new Set(moneyFlowData?.map(e => e.created_by).filter(Boolean))];
      
      // Fetch profiles for creators
      let profilesMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);
        
        if (profilesData) {
          profilesMap = Object.fromEntries(profilesData.map(p => [p.id, p.full_name]));
        }
      }

      // Merge creator names
      return (moneyFlowData || []).map(entry => ({
        ...entry,
        creator_name: entry.created_by ? profilesMap[entry.created_by] : null
      })) as MoneyFlowEntry[];
    },
  });

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('daily-money-flow-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_money_flow'
        },
        () => {
          // Invalidate and refetch when any change occurs
          queryClient.invalidateQueries({ queryKey: ["daily-money-flow"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  // Insights calculations
  const insightsData = useMemo(() => {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;

    switch (insightsPeriod) {
      case '1m':
        periodStart = subMonths(now, 1);
        break;
      case '3m':
        periodStart = subMonths(now, 3);
        break;
      case '6m':
        periodStart = subMonths(now, 6);
        break;
      case '1y':
        periodStart = subMonths(now, 12);
        break;
      case 'custom':
        periodStart = customDateRange.from || subMonths(now, 3);
        periodEnd = customDateRange.to || now;
        break;
      default:
        periodStart = subMonths(now, 3);
    }

    const filteredEntries = entries.filter((e) => {
      const entryDate = new Date(e.date);
      return entryDate >= periodStart && entryDate <= periodEnd;
    });

    const totalCash = filteredEntries.reduce((sum, e) => sum + Number(e.cash_collected), 0);
    const totalRevenue = filteredEntries.reduce((sum, e) => sum + Number(e.total_revenue), 0);
    const gap = totalRevenue - totalCash;
    const gapPercentage = totalRevenue > 0 ? ((gap / totalRevenue) * 100).toFixed(1) : '0';

    const bestDay = filteredEntries.length > 0
      ? filteredEntries.reduce((best, current) =>
          Number(current.cash_collected) > Number(best.cash_collected) ? current : best
        , filteredEntries[0])
      : null;

    return { totalCash, totalRevenue, gap, gapPercentage, bestDay, periodStart, periodEnd, daysCount: filteredEntries.length };
  }, [entries, insightsPeriod, customDateRange]);

  // Pagination calculations
  const totalPages = Math.ceil(entries.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedEntries = entries.slice(startIndex, endIndex);

  // Reset to page 1 when page size changes
  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
  };

  const getPeriodLabel = (period: InsightsPeriod) => {
    switch (period) {
      case '1m': return 'Last Month';
      case '3m': return 'Last 3 Months';
      case '6m': return 'Last 6 Months';
      case '1y': return 'Last 1 Year';
      case 'custom': return 'Custom Range';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Daily Money Flow</h1>
          <p className="text-muted-foreground">Track daily revenue and cash collection</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Data
          </Button>
        </div>
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

      {/* Insights Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold">Period Insights</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={insightsPeriod} onValueChange={(value) => setInsightsPeriod(value as InsightsPeriod)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">Last Month</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="1y">Last 1 Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {insightsPeriod === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    {customDateRange.from && customDateRange.to 
                      ? `${format(customDateRange.from, "dd MMM")} - ${format(customDateRange.to, "dd MMM yyyy")}`
                      : "Pick dates"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="range"
                    selected={{ from: customDateRange.from, to: customDateRange.to }}
                    onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Cash Collection */}
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Total Cash Collection</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(insightsData.totalCash)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {insightsData.daysCount} days in {getPeriodLabel(insightsPeriod).toLowerCase()}
              </p>
            </div>

            {/* Total Revenue */}
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Total Revenue</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(insightsData.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Booked during the period
              </p>
            </div>

            {/* Revenue Gap */}
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <IndianRupee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Revenue Gap</span>
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(insightsData.gap)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {insightsData.gapPercentage}% uncollected
              </p>
            </div>

            {/* Best Collection Day */}
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Best Collection Day</span>
              </div>
              {insightsData.bestDay ? (
                <>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                    {format(new Date(insightsData.bestDay.date), "dd MMM yyyy")}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(Number(insightsData.bestDay.cash_collected))} collected
                  </p>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No data available</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>All Entries</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries</span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No entries yet. Click "Add Data" to get started.
            </div>
          ) : (
            <>
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
                  {paginatedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {format(new Date(entry.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(entry.total_revenue))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(entry.cash_collected))}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.notes || "-"}</TableCell>
                      <TableCell>{entry.creator_name || "-"}</TableCell>
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

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, entries.length)} of {entries.length} entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
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

      {/* Import Dialog */}
      <ImportMoneyFlowDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
    </div>
  );
};

export default DailyMoneyFlow;
