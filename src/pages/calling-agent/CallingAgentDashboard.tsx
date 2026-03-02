import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bot, BarChart3, Phone, DollarSign, Rocket, ArrowRight } from "lucide-react";
import { useCallingAgentCampaigns } from "@/hooks/useCallingAgentCampaigns";
import { CreateAgentCampaignDialog } from "./CreateAgentCampaignDialog";
import { PageHeader } from "@/components/PageHeader";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-primary/20 text-primary",
  scheduled: "bg-warning/20 text-warning",
  completed: "bg-emerald-500/20 text-emerald-700",
  failed: "bg-destructive/20 text-destructive",
};

export default function CallingAgentDashboard() {
  const navigate = useNavigate();
  const { campaigns, isLoading, refetch, stats } = useCallingAgentCampaigns();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calling Agent"
        subtitle="AI-powered voice calling campaigns"
      />

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Rocket className="h-4 w-4 mr-2" /> Start Calling Agent
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Campaigns</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.totalCampaigns}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{stats.activeCampaigns}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.totalCalls}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">₹{stats.totalCost.toFixed(2)}</p></CardContent>
        </Card>
      </div>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Campaigns</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/operations/calling-agent/campaigns")}>
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No campaigns yet. Start your first calling agent campaign!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.slice(0, 5).map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/operations/calling-agent/campaigns/${c.id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.bolna_agent_name || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColors[c.status] || ""}>{c.status}</Badge></TableCell>
                    <TableCell>{c.total_contacts}</TableCell>
                    <TableCell>{c.calls_completed}</TableCell>
                    <TableCell>₹{c.total_cost.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateAgentCampaignDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refetch} />
    </div>
  );
}
