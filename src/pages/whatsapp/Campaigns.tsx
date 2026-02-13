import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  completed: "default",
  partial_failure: "destructive",
};

const Campaigns = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();

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
      <PageHeader title="Campaigns" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-center">Groups</TableHead>
                <TableHead className="text-right">Audience</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!campaigns || campaigns.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No campaigns yet. Send your first notification from the Dashboard.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => navigate(`/whatsapp/campaigns/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-center">{c.total_groups}</TableCell>
                    <TableCell className="text-right">{c.total_audience?.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={(STATUS_COLORS[c.status] as any) || "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(c.created_at), "MMM d, yyyy h:mm a")}
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

export default Campaigns;
