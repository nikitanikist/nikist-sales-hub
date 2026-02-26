import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceCampaigns } from "@/hooks/useVoiceCampaigns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Plus, Users, Activity, Calendar, CheckCircle, PhoneCall, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CampaignStatusBadge, formatCost } from "./components/index";
import { CreateBroadcastDialog } from "./CreateBroadcastDialog";
import { format } from "date-fns";

export default function CallingDashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: campaigns = [], isLoading } = useVoiceCampaigns();
  const navigate = useNavigate();

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "running").length;
  const scheduledCampaigns = campaigns.filter((c) => c.status === "scheduled").length;
  const completedCampaigns = campaigns.filter((c) => c.status === "completed").length;
  const totalCalls = campaigns.reduce((sum, c) => sum + c.calls_completed, 0);
  const totalCost = campaigns.reduce((sum, c) => sum + (c.total_cost || 0), 0);

  const summaryCards = [
    { title: "Total Campaigns", value: totalCampaigns, icon: Phone },
    { title: "Active", value: activeCampaigns, icon: Activity },
    { title: "Scheduled", value: scheduledCampaigns, icon: Calendar },
    { title: "Completed", value: completedCampaigns, icon: CheckCircle },
    { title: "Total Calls", value: totalCalls, icon: PhoneCall },
    { title: "Total Cost", value: formatCost(totalCost), icon: IndianRupee },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Calling Dashboard" />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Calling Broadcast
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.title} className="border border-border">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <card.icon className="h-3.5 w-3.5" />
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Phone className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No campaigns yet</p>
              <Button variant="outline" onClick={() => setDialogOpen(true)}>Create your first broadcast</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.slice(0, 10).map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/calling/campaigns/${c.id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>{c.total_contacts}</TableCell>
                    <TableCell>{c.calls_completed}/{c.total_contacts}</TableCell>
                    <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                    <TableCell>{formatCost(c.total_cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateBroadcastDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
