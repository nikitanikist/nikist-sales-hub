import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Clock, Send, AlertTriangle, Trash2, Loader2, LayoutList } from "lucide-react";

const STATUS_BADGE_VARIANT: Record<string, string> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  completed: "default",
  partial_failure: "destructive",
  failed: "destructive",
};

const Campaigns = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["notification-campaigns", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("notification_campaigns")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-campaigns"] });
      toast.success("Campaign deleted");
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast.error("Failed to delete campaign", { description: err.message });
    },
  });

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    if (activeTab === "all") return campaigns;
    return campaigns.filter((c) => c.status === activeTab);
  }, [campaigns, activeTab]);

  // Stat counts
  const counts = useMemo(() => {
    if (!campaigns) return { completed: 0, scheduled: 0, sending: 0, failed: 0 };
    return {
      completed: campaigns.filter((c) => c.status === "completed").length,
      scheduled: campaigns.filter((c) => c.status === "scheduled").length,
      sending: campaigns.filter((c) => c.status === "sending").length,
      failed: campaigns.filter((c) => c.status === "failed" || c.status === "partial_failure").length,
    };
  }, [campaigns]);

  const statCards = [
    { label: "Completed", count: counts.completed, icon: CheckCircle2, color: "text-emerald-500", bg: "from-emerald-500/10 to-emerald-500/5" },
    { label: "Scheduled", count: counts.scheduled, icon: Clock, color: "text-blue-500", bg: "from-blue-500/10 to-blue-500/5" },
    { label: "Sending", count: counts.sending, icon: Send, color: "text-primary", bg: "from-primary/10 to-primary/5" },
    { label: "Failed", count: counts.failed, icon: AlertTriangle, color: "text-destructive", bg: "from-destructive/10 to-destructive/5" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Campaigns" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={`bg-gradient-to-br ${stat.bg} border-0 shadow-sm`}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({campaigns?.length || 0})</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="sending">Sending</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-center">Groups</TableHead>
                <TableHead className="text-right">Audience</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Scheduled For</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <LayoutList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    {activeTab === "all"
                      ? "No campaigns yet. Send your first notification from the Dashboard."
                      : `No ${activeTab} campaigns.`}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCampaigns.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => navigate(`/whatsapp/campaigns/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-center">{c.total_groups}</TableCell>
                    <TableCell className="text-right">{c.total_audience?.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={(STATUS_BADGE_VARIANT[c.status] as any) || "secondary"}>
                        {c.status === "partial_failure" ? "Partial Failure" : c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.scheduled_for
                        ? format(new Date(c.scheduled_for), "MMM d, yyyy h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(c.created_at), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(c.id);
                        }}
                        title="Delete campaign"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign? This action cannot be undone."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};

export default Campaigns;
