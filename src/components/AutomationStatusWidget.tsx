import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

const AutomationStatusWidget = () => {
  const queryClient = useQueryClient();
  const { isAdmin, isManager, isLoading: roleLoading } = useUserRole();

  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["automation-status"],
    queryFn: async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get most recent lead created_at
      const { data: latestLead } = await supabase
        .from("leads")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Get count in last 1 hour
      const { count: lastHourCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneHourAgo.toISOString());

      // Get count in last 24 hours
      const { count: last24hCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", twentyFourHoursAgo.toISOString());

      return {
        lastRegistration: latestLead?.created_at ? new Date(latestLead.created_at) : null,
        lastHourCount: lastHourCount || 0,
        last24hCount: last24hCount || 0,
      };
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  // Only show to admin/manager
  if (roleLoading || (!isAdmin && !isManager)) {
    return null;
  }

  const getStatusColor = () => {
    if (!stats?.lastRegistration) return "text-muted-foreground";
    const minutesAgo = (Date.now() - stats.lastRegistration.getTime()) / 1000 / 60;
    if (minutesAgo < 60) return "text-green-500";
    if (minutesAgo < 180) return "text-yellow-500";
    return "text-orange-500";
  };

  const getStatusIcon = () => {
    if (!stats?.lastRegistration) return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    const minutesAgo = (Date.now() - stats.lastRegistration.getTime()) / 1000 / 60;
    if (minutesAgo < 60) return <Zap className="h-4 w-4 text-green-500" />;
    if (minutesAgo < 180) return <Clock className="h-4 w-4 text-yellow-500" />;
    return <AlertCircle className="h-4 w-4 text-orange-500" />;
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {getStatusIcon()}
            Automation Status
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Last registration: </span>
              <span className={getStatusColor()}>
                {stats?.lastRegistration
                  ? formatDistanceToNow(stats.lastRegistration, { addSuffix: true })
                  : "No data"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              1h: <span className="font-medium text-foreground">{stats?.lastHourCount}</span>
              {" • "}
              24h: <span className="font-medium text-foreground">{stats?.last24hCount}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AutomationStatusWidget;
