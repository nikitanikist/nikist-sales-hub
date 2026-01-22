import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths, startOfMonth, endOfMonth, getDay, startOfWeek, endOfWeek } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, IndianRupee, TrendingUp, TrendingDown, Calendar, Trash2, Pencil, Upload, Trophy, ChevronLeft, ChevronRight, Target, Percent, Award, Star, Zap, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, ReferenceLine } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import AddMoneyFlowDialog from "@/components/AddMoneyFlowDialog";
import { ImportMoneyFlowDialog } from "@/components/ImportMoneyFlowDialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  // Prepare chart data (last 30 days) with rolling averages
  const chartData = useMemo(() => {
    const last30 = entries.slice(0, 30).reverse();
    return last30.map((e, index) => {
      // Calculate 7-day rolling average
      const startIdx = Math.max(0, index - 6);
      const last7 = last30.slice(startIdx, index + 1);
      const avg7Cash = last7.reduce((sum, x) => sum + Number(x.cash_collected), 0) / last7.length;
      
      return {
        date: format(new Date(e.date), "dd MMM"),
        revenue: Number(e.total_revenue),
        cash: Number(e.cash_collected),
        avg7Cash: Math.round(avg7Cash),
      };
    });
  }, [entries]);

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
    cash: {
      label: "Cash Collected",
      color: "hsl(var(--chart-2))",
    },
    avg7Cash: {
      label: "7-Day Avg",
      color: "hsl(var(--chart-3))",
    },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value}`;
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
    const collectionEfficiency = totalRevenue > 0 ? ((totalCash / totalRevenue) * 100).toFixed(1) : '0';

    const bestDay = filteredEntries.length > 0
      ? filteredEntries.reduce((best, current) =>
          Number(current.cash_collected) > Number(best.cash_collected) ? current : best
        , filteredEntries[0])
      : null;

    return { totalCash, totalRevenue, gap, gapPercentage, collectionEfficiency, bestDay, periodStart, periodEnd, daysCount: filteredEntries.length };
  }, [entries, insightsPeriod, customDateRange]);

  // Month-over-Month Comparison
  const momData = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = now;
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const currentMonthEntries = entries.filter((e) => {
      const d = new Date(e.date);
      return d >= currentMonthStart && d <= currentMonthEnd;
    });

    const lastMonthEntries = entries.filter((e) => {
      const d = new Date(e.date);
      return d >= lastMonthStart && d <= lastMonthEnd;
    });

    const currentCash = currentMonthEntries.reduce((sum, e) => sum + Number(e.cash_collected), 0);
    const lastCash = lastMonthEntries.reduce((sum, e) => sum + Number(e.cash_collected), 0);
    const currentRevenue = currentMonthEntries.reduce((sum, e) => sum + Number(e.total_revenue), 0);
    const lastRevenue = lastMonthEntries.reduce((sum, e) => sum + Number(e.total_revenue), 0);

    const cashGrowth = lastCash > 0 ? ((currentCash - lastCash) / lastCash * 100).toFixed(1) : '0';
    const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100).toFixed(1) : '0';

    // Projected monthly total based on current run rate
    const daysPassed = currentMonthEntries.length || 1;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedCash = Math.round((currentCash / daysPassed) * daysInMonth);
    const projectedRevenue = Math.round((currentRevenue / daysPassed) * daysInMonth);
    const dailyAvgCash = Math.round(currentCash / daysPassed);

    return {
      currentCash,
      lastCash,
      currentRevenue,
      lastRevenue,
      cashGrowth,
      revenueGrowth,
      projectedCash,
      projectedRevenue,
      dailyAvgCash,
      daysPassed,
      daysRemaining: daysInMonth - daysPassed,
    };
  }, [entries]);

  // Weekday Performance Analysis
  const weekdayData = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayStats: { [key: number]: { total: number; count: number } } = {};
    
    // Initialize
    for (let i = 0; i < 7; i++) {
      dayStats[i] = { total: 0, count: 0 };
    }

    // Aggregate last 90 days
    const last90 = entries.filter(e => new Date(e.date) >= subDays(new Date(), 90));
    last90.forEach((e) => {
      const dayOfWeek = getDay(new Date(e.date));
      dayStats[dayOfWeek].total += Number(e.cash_collected);
      dayStats[dayOfWeek].count += 1;
    });

    const result = dayNames.map((name, index) => ({
      day: name,
      avgCash: dayStats[index].count > 0 ? Math.round(dayStats[index].total / dayStats[index].count) : 0,
      totalCash: dayStats[index].total,
      count: dayStats[index].count,
    }));

    const bestDay = result.reduce((best, current) => 
      current.avgCash > best.avgCash ? current : best
    , result[0]);

    return { weekdayStats: result, bestWeekday: bestDay };
  }, [entries]);

  // All-Time Records
  const allTimeRecords = useMemo(() => {
    if (entries.length === 0) return null;

    // Best single day
    const bestDay = entries.reduce((best, current) =>
      Number(current.cash_collected) > Number(best.cash_collected) ? current : best
    , entries[0]);

    // Best week (rolling 7 days)
    let bestWeek = { startDate: '', cash: 0 };
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (let i = 0; i <= sortedEntries.length - 7; i++) {
      const weekCash = sortedEntries.slice(i, i + 7).reduce((sum, e) => sum + Number(e.cash_collected), 0);
      if (weekCash > bestWeek.cash) {
        bestWeek = { startDate: sortedEntries[i].date, cash: weekCash };
      }
    }

    // Best month
    const monthlyTotals: { [key: string]: number } = {};
    entries.forEach((e) => {
      const monthKey = format(new Date(e.date), 'MMM yyyy');
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + Number(e.cash_collected);
    });
    const bestMonth = Object.entries(monthlyTotals).reduce((best, [month, cash]) =>
      cash > best.cash ? { month, cash } : best
    , { month: '', cash: 0 });

    // Lifetime totals
    const lifetimeCash = entries.reduce((sum, e) => sum + Number(e.cash_collected), 0);
    const lifetimeRevenue = entries.reduce((sum, e) => sum + Number(e.total_revenue), 0);
    const lifetimeEfficiency = lifetimeRevenue > 0 ? ((lifetimeCash / lifetimeRevenue) * 100).toFixed(1) : '0';

    return {
      bestDay: { date: bestDay.date, cash: Number(bestDay.cash_collected) },
      bestWeek,
      bestMonth,
      lifetimeCash,
      lifetimeRevenue,
      lifetimeEfficiency,
      totalDays: entries.length,
    };
  }, [entries]);

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

      {/* Business Intelligence Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends & Growth</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
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
                    {formatCompactCurrency(insightsData.totalCash)}
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
                    {formatCompactCurrency(insightsData.totalRevenue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Booked during the period
                  </p>
                </div>

                {/* Collection Efficiency */}
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Percent className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Collection Efficiency</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {insightsData.collectionEfficiency}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCompactCurrency(insightsData.gap)} pending
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
                        {formatCompactCurrency(Number(insightsData.bestDay.cash_collected))} collected
                      </p>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">No data available</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends & Growth Tab */}
        <TabsContent value="trends" className="space-y-4">
          {/* Month-over-Month Comparison */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Cash Growth MoM */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cash Growth (MoM)</CardTitle>
                {Number(momData.cashGrowth) >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${Number(momData.cashGrowth) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Number(momData.cashGrowth) >= 0 ? '+' : ''}{momData.cashGrowth}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCompactCurrency(momData.currentCash)} vs {formatCompactCurrency(momData.lastCash)} last month
                </p>
              </CardContent>
            </Card>

            {/* Revenue Growth MoM */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue Growth (MoM)</CardTitle>
                {Number(momData.revenueGrowth) >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${Number(momData.revenueGrowth) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Number(momData.revenueGrowth) >= 0 ? '+' : ''}{momData.revenueGrowth}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCompactCurrency(momData.currentRevenue)} vs {formatCompactCurrency(momData.lastRevenue)} last month
                </p>
              </CardContent>
            </Card>

            {/* Projected Monthly Cash */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projected Month End</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCompactCurrency(momData.projectedCash)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on {momData.daysPassed} days avg • {momData.daysRemaining} days left
                </p>
              </CardContent>
            </Card>

            {/* Daily Average */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCompactCurrency(momData.dailyAvgCash)}
                </div>
                <p className="text-xs text-muted-foreground">
                  This month's daily cash avg
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart with Rolling Averages */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cash Collection with 7-Day Rolling Average</CardTitle>
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
                        dataKey="cash"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--chart-2))" }}
                        name="Daily Cash"
                      />
                      <Line
                        type="monotone"
                        dataKey="avg7Cash"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="7-Day Avg"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Weekday Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Day-of-Week Performance
                  <Badge variant="secondary" className="ml-2">Last 90 Days</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdayData.weekdayStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Avg Cash']}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar
                        dataKey="avgCash"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                        name="Average Cash"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Best Day: {weekdayData.bestWeekday.day}</span>
                    <span className="text-sm text-muted-foreground">
                      ({formatCurrency(weekdayData.bestWeekday.avgCash)} avg)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekday Stats Table */}
            <Card>
              <CardHeader>
                <CardTitle>Weekday Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-right">Avg Cash</TableHead>
                      <TableHead className="text-right">Total Cash</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekdayData.weekdayStats.map((day) => (
                      <TableRow key={day.day}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {day.day}
                            {day.day === weekdayData.bestWeekday.day && (
                              <Star className="h-3 w-3 text-yellow-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(day.avgCash)}</TableCell>
                        <TableCell className="text-right">{formatCompactCurrency(day.totalCash)}</TableCell>
                        <TableCell className="text-right">{day.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          {allTimeRecords && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Best Day Ever */}
              <Card className="border-yellow-200 dark:border-yellow-900/50 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">🏆 Best Day Ever</CardTitle>
                  <Trophy className="h-5 w-5 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {formatCompactCurrency(allTimeRecords.bestDay.cash)}
                  </div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                    {format(new Date(allTimeRecords.bestDay.date), "dd MMMM yyyy")}
                  </p>
                </CardContent>
              </Card>

              {/* Best Week Ever */}
              <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">🔥 Best Week Ever</CardTitle>
                  <Zap className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {formatCompactCurrency(allTimeRecords.bestWeek.cash)}
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                    Week of {format(new Date(allTimeRecords.bestWeek.startDate), "dd MMM yyyy")}
                  </p>
                </CardContent>
              </Card>

              {/* Best Month Ever */}
              <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">⭐ Best Month Ever</CardTitle>
                  <Award className="h-5 w-5 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCompactCurrency(allTimeRecords.bestMonth.cash)}
                  </div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
                    {allTimeRecords.bestMonth.month}
                  </p>
                </CardContent>
              </Card>

              {/* Lifetime Cash */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lifetime Cash Collected</CardTitle>
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatCompactCurrency(allTimeRecords.lifetimeCash)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across {allTimeRecords.totalDays} days of data
                  </p>
                </CardContent>
              </Card>

              {/* Lifetime Revenue */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lifetime Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCompactCurrency(allTimeRecords.lifetimeRevenue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total booked revenue
                  </p>
                </CardContent>
              </Card>

              {/* Lifetime Efficiency */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lifetime Efficiency</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {allTimeRecords.lifetimeEfficiency}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Overall collection rate
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
