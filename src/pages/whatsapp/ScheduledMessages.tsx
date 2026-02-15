import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { X, Clock, CalendarClock, FileEdit } from "lucide-react";

const ScheduledMessages = () => {
  const { currentOrganization } = useOrganization();
  const orgTz = useOrgTimezone();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["scheduled-campaigns", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("notification_campaigns")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .in("status", ["scheduled", "draft"])
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const cancelMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      await supabase.from("notification_campaign_groups").delete().eq("campaign_id", campaignId);
      const { error } = await supabase.from("notification_campaigns").delete().eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["notification-campaigns"] });
      toast.success("Campaign cancelled");
    },
    onError: (err: Error) => {
      toast.error("Failed to cancel", { description: err.message });
    },
  });

  const counts = useMemo(() => {
    if (!campaigns) return { total: 0, scheduled: 0, draft: 0 };
    return {
      total: campaigns.length,
      scheduled: campaigns.filter((c) => c.status === "scheduled").length,
      draft: campaigns.filter((c) => c.status === "draft").length,
    };
  }, [campaigns]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const summaryCards = [
    { label: "Total Pending", value: counts.total, icon: Clock, gradient: "from-primary/10 to-primary/5", iconColor: "text-primary" },
    { label: "Scheduled", value: counts.scheduled, icon: CalendarClock, gradient: "from-blue-500/10 to-blue-500/5", iconColor: "text-blue-500" },
    { label: "Drafts", value: counts.draft, icon: FileEdit, gradient: "from-amber-500/10 to-amber-500/5", iconColor: "text-amber-500" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 -mx-4 -mt-2 px-4 pt-2 sm:-mx-6 sm:px-6">
      <div className="space-y-6">
        <PageHeader title="Scheduled Messages" />

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {summaryCards.map((card) => (
            <Card key={card.label} className={`bg-gradient-to-br ${card.gradient} border-0 shadow-sm`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center">
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-slate-500 font-medium">Campaign</TableHead>
                  <TableHead className="text-slate-500 font-medium">Scheduled For</TableHead>
                  <TableHead className="text-center text-slate-500 font-medium">Groups</TableHead>
                  <TableHead className="text-center text-slate-500 font-medium">Status</TableHead>
                  <TableHead className="w-20 text-slate-500 font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!campaigns || campaigns.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                          <CalendarClock className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">No scheduled campaigns</h3>
                        <p className="text-sm text-slate-500 max-w-sm">
                          Schedule a notification to have it sent automatically at a future time.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">
                        {c.scheduled_for
                          ? orgTz.format(c.scheduled_for, "MMM d, yyyy h:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">{c.total_groups}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{c.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelMutation.mutate(c.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ScheduledMessages;
