import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceCampaigns } from "@/hooks/useVoiceCampaigns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, StopCircle, Eye, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CampaignStatusBadge, formatCost } from "./components/index";
import { CreateBroadcastDialog } from "./CreateBroadcastDialog";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CallingCampaigns() {
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: campaigns = [], isLoading, refetch } = useVoiceCampaigns(filter);
  const navigate = useNavigate();

  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleStop = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    const { error } = await supabase.functions.invoke("stop-voice-campaign", { body: { campaign_id: campaignId } });
    if (error) {
      toast.error("Failed to stop campaign");
    } else {
      toast.success("Campaign stopped");
      refetch();
    }
  };

  const handleRetry = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    setRetryingId(campaignId);
    const { error } = await supabase.functions.invoke("start-voice-campaign", { body: { campaign_id: campaignId } });
    setRetryingId(null);
    if (error) {
      toast.error("Failed to start campaign");
    } else {
      toast.success("Campaign started");
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Calling Campaigns" />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Broadcast
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="running">In Progress</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Confirmed</TableHead>
              <TableHead>Rescheduled</TableHead>
              <TableHead>Not Interested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No campaigns found</TableCell></TableRow>
            ) : (
              campaigns.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/calling/campaigns/${c.id}`)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>{c.total_contacts}</TableCell>
                  <TableCell>{c.calls_completed}/{c.total_contacts}</TableCell>
                  <TableCell className="text-green-600">{c.calls_confirmed}</TableCell>
                  <TableCell className="text-blue-600">{c.calls_rescheduled}</TableCell>
                  <TableCell className="text-destructive">{c.calls_not_interested}</TableCell>
                  <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                  <TableCell>{formatCost(c.total_cost)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigate(`/calling/campaigns/${c.id}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {(c.status === "draft" || c.status === "failed") && (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => handleRetry(e, c.id)} disabled={retryingId === c.id}>
                          <RefreshCw className={`h-3.5 w-3.5 ${retryingId === c.id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      {c.status === "running" && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={(e) => handleStop(e, c.id)}>
                          <StopCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateBroadcastDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
