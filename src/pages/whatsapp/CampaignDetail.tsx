import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, CheckCircle2, XCircle, Clock, Eye, SmilePlus, EyeOff, MessageSquare, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { WhatsAppPreview } from "@/components/settings/WhatsAppPreview";
import { getMediaTypeFromUrl } from "@/components/settings/TemplateMediaUpload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";

const CampaignDetail = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const orgTz = useOrgTimezone();
  const { currentOrganization } = useOrganization();

  const queryClient = useQueryClient();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [retrySessionId, setRetrySessionId] = useState<string>("");
  const [isRetrying, setIsRetrying] = useState(false);

  // Fetch connected sessions for retry picker
  const { data: connectedSessions } = useQuery({
    queryKey: ["connected-sessions", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("id, phone_number, status")
        .eq("organization_id", currentOrganization.id)
        .eq("status", "connected");
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  const handleRetryCampaign = async () => {
    if (!retrySessionId || !campaignId) return;
    setIsRetrying(true);
    try {
      // Update campaign session and reset status
      const { error: campaignError } = await supabase
        .from("notification_campaigns")
        .update({
          session_id: retrySessionId,
          status: "sending" as any,
          started_at: null,
          completed_at: null,
          sent_count: 0,
          failed_count: 0,
        })
        .eq("id", campaignId);
      if (campaignError) throw campaignError;

      // Reset failed groups back to pending
      const { error: groupsError } = await supabase
        .from("notification_campaign_groups")
        .update({ status: "pending" as any, error_message: null })
        .eq("campaign_id", campaignId)
        .in("status", ["failed"]);
      if (groupsError) throw groupsError;

      // Trigger the processor
      await supabase.functions.invoke("process-notification-campaigns");

      queryClient.invalidateQueries({ queryKey: ["notification-campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["notification-campaign-groups", campaignId] });
      toast.success("Campaign retry started!");
      setRetrySessionId("");
    } catch (err: any) {
      toast.error("Failed to retry: " + err.message);
    } finally {
      setIsRetrying(false);
    }
  };

  const { data: campaign, isLoading: campaignLoading, dataUpdatedAt: campaignUpdatedAt } = useQuery({
    queryKey: ["notification-campaign", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from("notification_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "sending" ? 5000 : 30000;
    },
  });

  // Realtime subscription for campaign status updates
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notification_campaigns", filter: `id=eq.${campaignId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notification-campaign", campaignId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId, queryClient]);

  const { data: campaignGroups, isLoading: groupsLoading, dataUpdatedAt: groupsUpdatedAt } = useQuery({
    queryKey: ["notification-campaign-groups", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("notification_campaign_groups")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
    refetchInterval: campaign?.status === "sending" ? 5000 : 30000,
  });

  // Track the latest data update time
  useEffect(() => {
    const latest = Math.max(campaignUpdatedAt || 0, groupsUpdatedAt || 0);
    if (latest > 0) setLastUpdated(new Date(latest));
  }, [campaignUpdatedAt, groupsUpdatedAt]);

  // Re-render relative time every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  if (campaignLoading || groupsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
              <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
            </div>
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12 text-muted-foreground">Campaign not found</div>
    );
  }

  const sentCount = campaignGroups?.filter((g) => g.status === "sent").length || 0;
  const failedCount = campaignGroups?.filter((g) => g.status === "failed").length || 0;
  const pendingCount = campaignGroups?.filter((g) => g.status === "pending").length || 0;
  const totalDelivered = campaignGroups?.reduce((sum, g) => sum + (g.delivered_count || 0), 0) || 0;
  const totalReads = campaignGroups?.reduce((sum, g) => sum + (g.read_count || 0), 0) || 0;
  const totalReactions = campaignGroups?.reduce((sum, g) => sum + (g.reaction_count || 0), 0) || 0;

  const mediaType = campaign.media_type || getMediaTypeFromUrl(campaign.media_url || null);

  const isRecentlySent = campaign.status === "sending" || campaign.status === "completed";
  const isAwaitingDelivery = isRecentlySent && totalDelivered === 0 && sentCount > 0;
  const isAwaitingReads = isRecentlySent && totalReads === 0 && sentCount > 0;
  const isAwaitingReactions = isRecentlySent && totalReactions === 0 && sentCount > 0;
  const isAwaitingAny = isAwaitingDelivery || isAwaitingReads || isAwaitingReactions;

  const AwaitingValue = () => (
    <div className="space-y-1">
      <Skeleton className="h-7 w-14 rounded" />
      <p className="text-xs text-muted-foreground animate-pulse">Fetching...</p>
    </div>
  );

  const statItems = [
    { label: "Audience", value: campaign.total_audience?.toLocaleString() || "0", icon: Users, color: "text-primary", bgTint: "bg-primary/10", borderColor: "border-l-primary", gradientFrom: "from-primary/5" },
    { label: "Sent", value: sentCount, icon: CheckCircle2, color: "text-violet-500", bgTint: "bg-violet-500/10", borderColor: "border-l-violet-500", gradientFrom: "from-violet-500/5" },
    { label: "Failed", value: failedCount, icon: XCircle, color: "text-destructive", bgTint: "bg-destructive/10", borderColor: "border-l-destructive", gradientFrom: "from-destructive/5" },
    { label: "Pending", value: pendingCount, icon: Clock, color: "text-muted-foreground", bgTint: "bg-muted", borderColor: "border-l-muted-foreground", gradientFrom: "from-muted-foreground/5" },
    { label: "Delivered, Not Yet Read", value: isAwaitingDelivery ? null : totalDelivered, icon: EyeOff, color: "text-emerald-500", bgTint: "bg-emerald-500/10", borderColor: "border-l-emerald-500", gradientFrom: "from-emerald-500/5", awaiting: isAwaitingDelivery },
    { label: "Read", value: isAwaitingReads ? null : totalReads, icon: Eye, color: "text-blue-500", bgTint: "bg-blue-500/10", borderColor: "border-l-blue-500", gradientFrom: "from-blue-500/5", awaiting: isAwaitingReads },
    { label: "Reactions", value: isAwaitingReactions ? null : totalReactions, icon: SmilePlus, color: "text-amber-500", bgTint: "bg-amber-500/10", borderColor: "border-l-amber-500", gradientFrom: "from-amber-500/5", awaiting: isAwaitingReactions },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 -mx-4 -mt-2 px-4 pt-2 sm:-mx-6 sm:px-6">
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader title={campaign.name} />
          <Badge variant={campaign.status === "completed" ? "default" : campaign.status === "sending" ? "secondary" : "outline"}>
            {campaign.status}
          </Badge>
          {(campaign.status === "failed" || campaign.status === "partial_failure") && (
            <div className="flex items-center gap-2 ml-auto">
              <Select value={retrySessionId} onValueChange={setRetrySessionId}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Pick session" />
                </SelectTrigger>
                <SelectContent>
                  {connectedSessions?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.phone_number || s.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleRetryCampaign} disabled={!retrySessionId || isRetrying}>
                <RotateCcw className="h-4 w-4 mr-1" />
                {isRetrying ? "Retrying..." : "Retry"}
              </Button>
            </div>
          )}
        </div>

        {/* Top row: Stats grid (left) + Preview (right) */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Stats grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {statItems.map((stat) => (
                <Card key={stat.label} className={`shadow-sm hover:shadow-md transition-shadow border-l-4 ${stat.borderColor} bg-gradient-to-r ${stat.gradientFrom} to-transparent`}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${stat.bgTint}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div className="min-w-0">
                      {stat.awaiting ? (
                        <AwaitingValue />
                      ) : (
                        <p className="text-3xl font-bold leading-tight tracking-tight">{stat.value}</p>
                      )}
                      <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {isAwaitingAny && (
              <div className="flex items-center gap-2 mt-3 px-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                <p className="text-xs text-muted-foreground">Delivery and read receipts may take a few minutes to update after sending.</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2 px-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Last updated: {formatDistanceToNow(lastUpdated, { addSuffix: false })} ago
              </p>
            </div>
          </div>

          {/* WhatsApp preview - portrait */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0">
            <Card className="bg-[hsl(var(--muted)/0.3)] overflow-hidden h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Message Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <WhatsAppPreview
                  content={campaign.message_content}
                  mediaUrl={campaign.media_url}
                  mediaType={mediaType as any}
                />
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Full-width groups breakdown table */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-slate-500 font-medium">#</TableHead>
                  <TableHead className="text-slate-500 font-medium">Group</TableHead>
                  <TableHead className="text-right text-slate-500 font-medium">Members</TableHead>
                  <TableHead className="text-center text-slate-500 font-medium">Status</TableHead>
                  <TableHead className="text-right text-slate-500 font-medium">Delivered, Not Yet Read</TableHead>
                  <TableHead className="text-right text-slate-500 font-medium">Reads</TableHead>
                  <TableHead className="text-right text-slate-500 font-medium">Reactions</TableHead>
                  <TableHead className="text-slate-500 font-medium">Sent At</TableHead>
                  <TableHead className="text-slate-500 font-medium">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignGroups?.map((g, idx) => (
                  <TableRow key={g.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                    <TableCell className="text-slate-400 text-sm">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-slate-800">{g.group_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{g.member_count}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          g.status === "sent" ? "default" : g.status === "failed" ? "destructive" : "secondary"
                        }
                      >
                        {g.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {g.delivered_count > 0 ? (
                        <span className="text-emerald-500 font-medium">{g.delivered_count}</span>
                      ) : g.status === "sent" && isRecentlySent ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />...</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {g.read_count > 0 ? (
                        <span className="text-blue-500 font-medium">{g.read_count}</span>
                      ) : g.status === "sent" && isRecentlySent ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs"><span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />...</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {g.reaction_count > 0 ? (
                        <span className="text-amber-500 font-medium">{g.reaction_count}</span>
                      ) : g.status === "sent" && isRecentlySent ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />...</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g.sent_at ? orgTz.format(g.sent_at, "h:mm a") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                      {g.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CampaignDetail;
