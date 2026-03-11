import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIvrCampaigns } from "@/hooks/useIvrCampaigns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, StopCircle, Eye, Play } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateIvrCampaignDialog } from "./CreateIvrCampaignDialog";
import type { IvrCampaign } from "@/types/ivr-campaign";

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "outline" },
    scheduled: { label: "Scheduled", variant: "secondary" },
    running: { label: "Running", variant: "default" },
    paused: { label: "Paused", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const config = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function IvrCampaigns() {
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: campaigns = [], isLoading, refetch } = useIvrCampaigns(filter);
  const navigate = useNavigate();

  const handleStart = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    const { error } = await supabase.functions.invoke("start-ivr-campaign", { body: { campaign_id: campaignId } });
    if (error) {
      toast.error("Failed to start campaign");
    } else {
      toast.success("IVR campaign started");
      refetch();
    }
  };

  const handleStop = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    const { error } = await supabase.functions.invoke("stop-ivr-campaign", { body: { campaign_id: campaignId } });
    if (error) {
      toast.error("Failed to stop campaign");
    } else {
      toast.success("IVR campaign stopped");
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="IVR Campaigns" />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
              <TableHead className="text-right">Answered</TableHead>
              <TableHead className="text-right">No Answer</TableHead>
              <TableHead className="text-right">Cost (₹)</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No campaigns found</TableCell></TableRow>
            ) : (
              campaigns.map((c: IvrCampaign) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/ivr/campaigns/${c.id}`)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell className="text-right">{c.total_contacts}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{c.calls_answered}</TableCell>
                  <TableCell className="text-right">{c.calls_no_answer}</TableCell>
                  <TableCell className="text-right">₹{(c.total_cost || 0).toFixed(2)}</TableCell>
                  <TableCell>{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/ivr/campaigns/${c.id}`); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {["draft", "scheduled"].includes(c.status) && (
                        <Button variant="ghost" size="icon" onClick={(e) => handleStart(e, c.id)}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {c.status === "running" && (
                        <Button variant="ghost" size="icon" onClick={(e) => handleStop(e, c.id)}>
                          <StopCircle className="h-4 w-4" />
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

      <CreateIvrCampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => { refetch(); setDialogOpen(false); }} />
    </div>
  );
}
