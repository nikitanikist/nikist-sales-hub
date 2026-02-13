import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, CheckCircle2, XCircle, Clock, Eye, SmilePlus, CheckCheck } from "lucide-react";
import { format } from "date-fns";

const CampaignDetail = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading: campaignLoading } = useQuery({
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
  });

  const { data: campaignGroups, isLoading: groupsLoading } = useQuery({
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

  if (campaignLoading || groupsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
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
  const totalDelivered = campaignGroups?.reduce((sum, g) => sum + ((g as any).delivered_count || 0), 0) || 0;
  const totalReads = campaignGroups?.reduce((sum, g) => sum + (g.read_count || 0), 0) || 0;
  const totalReactions = campaignGroups?.reduce((sum, g) => sum + (g.reaction_count || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp/campaigns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={campaign.name} />
        <Badge variant={campaign.status === "completed" ? "default" : campaign.status === "sending" ? "secondary" : "outline"}>
          {campaign.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Audience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.total_audience?.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{sentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" /> Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{failedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCheck className="h-4 w-4 text-emerald-500" /> Delivered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{totalDelivered}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" /> Read
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{totalReads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <SmilePlus className="h-4 w-4 text-amber-500" /> Reactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{totalReactions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Message preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Message</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{campaign.message_content}</p>
          {campaign.media_url && (
            <Badge variant="outline" className="mt-2">{campaign.media_type}: {campaign.media_url.split("/").pop()}</Badge>
          )}
        </CardContent>
      </Card>

      {/* Groups breakdown */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Reads</TableHead>
                <TableHead className="text-right">Reactions</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignGroups?.map((g, idx) => (
                <TableRow key={g.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{g.group_name}</TableCell>
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
                    {(g as any).delivered_count > 0 ? (
                      <span className="text-emerald-500 font-medium">{(g as any).delivered_count}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {g.read_count > 0 ? (
                      <span className="text-blue-500 font-medium">{g.read_count}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {g.reaction_count > 0 ? (
                      <span className="text-amber-500 font-medium">{g.reaction_count}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {g.sent_at ? format(new Date(g.sent_at), "h:mm a") : "—"}
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
  );
};

export default CampaignDetail;
