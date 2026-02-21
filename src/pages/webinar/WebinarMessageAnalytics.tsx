import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, CheckCircle2, Eye, EyeOff, SmilePlus, Clock, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { WhatsAppPreview } from "@/components/settings/WhatsAppPreview";
import { getMediaTypeFromUrl } from "@/components/settings/TemplateMediaUpload";

const WebinarMessageAnalytics = () => {
  const { messageId } = useParams<{ messageId: string }>();
  const navigate = useNavigate();
  const orgTz = useOrgTimezone();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data: message, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["webinar-message-analytics", messageId],
    queryFn: async () => {
      if (!messageId) return null;
      const { data, error } = await supabase
        .from("scheduled_webinar_messages")
        .select(`
          *,
          whatsapp_groups!inner(group_name, participant_count)
        `)
        .eq("id", messageId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!messageId,
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!messageId) return;
    const channel = supabase
      .channel(`webinar-msg-analytics-${messageId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scheduled_webinar_messages", filter: `id=eq.${messageId}` },
        () => {}
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [messageId]);

  useEffect(() => {
    if (dataUpdatedAt > 0) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  // Re-render relative time every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" />
          <Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="text-center py-12 text-muted-foreground p-4 sm:p-6">
        <p>Message not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/webinar/notification")}>
          Back to Webinars
        </Button>
      </div>
    );
  }

  const group = message.whatsapp_groups as { group_name: string; participant_count: number | null };
  const memberCount = group?.participant_count ?? 0;
  const isSent = message.status === "sent";
  const isAwaitingDelivery = isSent && (message.delivered_count || 0) === 0;
  const isAwaitingReads = isSent && (message.read_count || 0) === 0;
  const isAwaitingReactions = isSent && (message.reaction_count || 0) === 0;
  const isAwaitingAny = isAwaitingDelivery || isAwaitingReads || isAwaitingReactions;

  const mediaType = message.media_type || getMediaTypeFromUrl(message.media_url || null);

  const AwaitingValue = () => (
    <div className="space-y-1">
      <Skeleton className="h-7 w-14 rounded" />
      <p className="text-xs text-muted-foreground animate-pulse">Fetching...</p>
    </div>
  );

  const statItems = [
    { label: "Group Members", value: memberCount, icon: Users, color: "text-primary", bgTint: "bg-primary/10", borderColor: "border-l-primary", gradientFrom: "from-primary/5" },
    { label: "Status", value: message.status.charAt(0).toUpperCase() + message.status.slice(1), icon: CheckCircle2, color: "text-violet-500", bgTint: "bg-violet-500/10", borderColor: "border-l-violet-500", gradientFrom: "from-violet-500/5" },
    { label: "Delivered, Not Yet Read", value: isAwaitingDelivery ? null : message.delivered_count || 0, icon: EyeOff, color: "text-emerald-500", bgTint: "bg-emerald-500/10", borderColor: "border-l-emerald-500", gradientFrom: "from-emerald-500/5", awaiting: isAwaitingDelivery },
    { label: "Read", value: isAwaitingReads ? null : message.read_count || 0, icon: Eye, color: "text-blue-500", bgTint: "bg-blue-500/10", borderColor: "border-l-blue-500", gradientFrom: "from-blue-500/5", awaiting: isAwaitingReads },
    { label: "Reactions", value: isAwaitingReactions ? null : message.reaction_count || 0, icon: SmilePlus, color: "text-amber-500", bgTint: "bg-amber-500/10", borderColor: "border-l-amber-500", gradientFrom: "from-amber-500/5", awaiting: isAwaitingReactions },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 -mx-4 -mt-2 px-4 pt-2 sm:-mx-6 sm:px-6">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/webinar/notification")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <PageHeader title="Message Analytics" />
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {group?.group_name || "Unknown Group"} · {message.message_type.replace(/_/g, " ")}
            </p>
          </div>
          <Badge variant={message.status === "sent" ? "default" : message.status === "failed" ? "destructive" : "secondary"}>
            {message.status}
          </Badge>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Stats */}
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

          {/* Preview */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0">
            <Card className="bg-[hsl(var(--muted)/0.3)] overflow-hidden h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Message Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <WhatsAppPreview
                  content={message.message_content}
                  mediaUrl={message.media_url}
                  mediaType={mediaType as any}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebinarMessageAnalytics;
