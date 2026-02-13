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
import { format } from "date-fns";
import { X } from "lucide-react";

const ScheduledMessages = () => {
  const { currentOrganization } = useOrganization();
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
      // Delete campaign groups first, then campaign
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Scheduled Messages" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Scheduled For</TableHead>
                <TableHead className="text-center">Groups</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!campaigns || campaigns.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No scheduled campaigns
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm">
                      {c.scheduled_for
                        ? format(new Date(c.scheduled_for), "MMM d, yyyy h:mm a")
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
  );
};

export default ScheduledMessages;
