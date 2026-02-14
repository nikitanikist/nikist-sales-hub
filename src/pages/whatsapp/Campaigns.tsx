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
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Clock, Send, AlertTriangle, Trash2, LayoutList, List } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [activeFilter, setActiveFilter] = useState("all");
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
    if (activeFilter === "all") return campaigns;
    if (activeFilter === "failed") return campaigns.filter((c) => c.status === "failed" || c.status === "partial_failure");
    return campaigns.filter((c) => c.status === activeFilter);
  }, [campaigns, activeFilter]);

  const counts = useMemo(() => {
    if (!campaigns) return { all: 0, completed: 0, scheduled: 0, sending: 0, failed: 0 };
    return {
      all: campaigns.length,
      completed: campaigns.filter((c) => c.status === "completed").length,
      scheduled: campaigns.filter((c) => c.status === "scheduled").length,
      sending: campaigns.filter((c) => c.status === "sending").length,
      failed: campaigns.filter((c) => c.status === "failed" || c.status === "partial_failure").length,
    };
  }, [campaigns]);

  const filterCards = [
    { key: "all", label: "All", count: counts.all, icon: List, color: "text-primary", bgTint: "bg-primary/5", activeBorder: "border-l-primary", activeRing: "ring-primary" },
    { key: "completed", label: "Completed", count: counts.completed, icon: CheckCircle2, color: "text-emerald-500", bgTint: "bg-emerald-500/5", activeBorder: "border-l-emerald-500", activeRing: "ring-emerald-500" },
    { key: "scheduled", label: "Scheduled", count: counts.scheduled, icon: Clock, color: "text-blue-500", bgTint: "bg-blue-500/5", activeBorder: "border-l-blue-500", activeRing: "ring-blue-500" },
    { key: "sending", label: "Sending", count: counts.sending, icon: Send, color: "text-violet-500", bgTint: "bg-violet-500/5", activeBorder: "border-l-violet-500", activeRing: "ring-violet-500" },
    { key: "failed", label: "Failed", count: counts.failed, icon: AlertTriangle, color: "text-destructive", bgTint: "bg-destructive/5", activeBorder: "border-l-destructive", activeRing: "ring-destructive" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Campaigns" />

      {/* Clickable filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {filterCards.map((card) => {
          const isActive = activeFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setActiveFilter(card.key)}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border-l-4 bg-card px-4 py-4 text-left transition-all duration-200 hover:shadow-md",
                isActive
                  ? `${card.activeBorder} ring-2 ${card.activeRing} shadow-md ${card.bgTint}`
                  : "border-l-transparent border hover:border-l-muted-foreground/30 hover:bg-accent/30"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                isActive ? `${card.bgTint}` : "bg-muted/60"
              )}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight tracking-tight">{card.count}</p>
                <p className="text-xs text-muted-foreground font-medium truncate">{card.label}</p>
              </div>
            </button>
          );
        })}
      </div>

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
                    {activeFilter === "all"
                      ? "No campaigns yet. Send your first notification from the Dashboard."
                      : `No ${activeFilter} campaigns.`}
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
