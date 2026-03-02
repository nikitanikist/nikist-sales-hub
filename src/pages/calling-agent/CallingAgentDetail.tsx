import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCw, StopCircle, Phone, Clock, DollarSign, Users } from "lucide-react";
import { useCallingAgentDetail } from "@/hooks/useCallingAgentDetail";
import { AgentCallsTable } from "./components/AgentCallsTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-primary/20 text-primary",
  completed: "bg-emerald-500/20 text-emerald-700",
  failed: "bg-destructive/20 text-destructive",
};

export default function CallingAgentDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { campaign, calls, isLoading, refetchCalls, refetchCampaign } = useCallingAgentDetail(campaignId);
  const [retrying, setRetrying] = useState(false);

  const computedStats = useMemo(() => {
    const completed = calls.filter((c) =>
      ["completed", "no-answer", "busy", "failed"].includes(c.status)
    ).length;
    const totalCost = calls.reduce((s, c) => s + (c.total_cost || 0), 0);
    const withDuration = calls.filter((c) => c.call_duration_seconds > 0);
    const avgDuration = withDuration.length > 0
      ? Math.round(withDuration.reduce((s, c) => s + c.call_duration_seconds, 0) / withDuration.length)
      : 0;
    return { completed, totalCost, avgDuration };
  }, [calls]);

  const handleRetry = async () => {
    if (!campaignId) return;
    setRetrying(true);
    const { error } = await supabase.functions.invoke("start-calling-agent-campaign", {
      body: { campaign_id: campaignId },
    });
    setRetrying(false);
    if (error) {
      toast.error("Failed to start campaign");
    } else {
      toast.success("Campaign started!");
      refetchCampaign();
      refetchCalls();
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Campaign not found</div>;
  }

  const progress = campaign.total_contacts > 0
    ? Math.round((computedStats.completed / campaign.total_contacts) * 100)
    : 0;

  const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/operations/calling-agent/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              {campaign.name}
              <Badge variant="outline" className={statusColors[campaign.status] || ""}>{campaign.status}</Badge>
            </h1>
            {campaign.bolna_agent_name && (
              <p className="text-sm text-muted-foreground">Agent: {campaign.bolna_agent_name}</p>
            )}
          </div>
        </div>
        {(campaign.status === "draft" || campaign.status === "failed") && (
          <Button size="sm" onClick={handleRetry} disabled={retrying}>
            <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
            {campaign.status === "draft" ? "Run Campaign" : "Retry"}
          </Button>
        )}
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" />Total Contacts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{campaign.total_contacts}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Phone className="h-3.5 w-3.5" />Completed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{computedStats.completed}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Total Cost</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">₹{computedStats.totalCost.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Avg Duration</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatDuration(computedStats.avgDuration)}</p></CardContent>
        </Card>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Calls Table */}
      <AgentCallsTable calls={calls} />
    </div>
  );
}
