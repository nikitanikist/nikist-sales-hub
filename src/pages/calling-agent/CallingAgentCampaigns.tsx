import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, ArrowLeft } from "lucide-react";
import { useCallingAgentCampaigns } from "@/hooks/useCallingAgentCampaigns";
import { CreateAgentCampaignDialog } from "./CreateAgentCampaignDialog";
import { PageHeader } from "@/components/PageHeader";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-primary/20 text-primary",
  scheduled: "bg-warning/20 text-warning",
  completed: "bg-emerald-500/20 text-emerald-700",
  failed: "bg-destructive/20 text-destructive",
};

export default function CallingAgentCampaigns() {
  const navigate = useNavigate();
  const { campaigns, isLoading, refetch } = useCallingAgentCampaigns();
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState("all");

  const filtered = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/operations/calling-agent")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Agent Campaigns" subtitle="All calling agent campaigns" />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Rocket className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No campaigns found.</p>
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
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/operations/calling-agent/campaigns/${c.id}`)}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.bolna_agent_name || "-"}</TableCell>
                        <TableCell><Badge variant="outline" className={statusColors[c.status] || ""}>{c.status}</Badge></TableCell>
                        <TableCell>{c.total_contacts}</TableCell>
                        <TableCell>{c.calls_completed}</TableCell>
                        <TableCell>₹{c.total_cost.toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateAgentCampaignDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refetch} />
    </div>
  );
}
