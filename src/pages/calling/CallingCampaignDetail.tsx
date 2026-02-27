import { useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useVoiceCampaignDetail } from "@/hooks/useVoiceCampaignDetail";
import { useVoiceCampaignRealtime } from "@/hooks/useVoiceCampaignRealtime";
import { Button } from "@/components/ui/button";
import { ArrowLeft, StopCircle, RefreshCw } from "lucide-react";
import { CampaignAnalyticsCards } from "./components/CampaignAnalyticsCards";
import { CampaignProgressBar } from "./components/CampaignProgressBar";
import { CampaignCallsTable } from "./components/CampaignCallsTable";
import { CampaignStatusBadge } from "./components/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VoiceCampaign, VoiceCampaignCall } from "@/types/voice-campaign";

export default function CallingCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { campaign, calls, isLoading, refetchCalls, refetchCampaign } = useVoiceCampaignDetail(campaignId);

  const [liveCampaign, setLiveCampaign] = useState<VoiceCampaign | null>(null);
  const [liveCalls, setLiveCalls] = useState<Map<string, VoiceCampaignCall>>(new Map());

  const onCallUpdate = useCallback((call: VoiceCampaignCall) => {
    setLiveCalls((prev) => {
      const next = new Map(prev);
      next.set(call.id, call);
      return next;
    });
  }, []);

  const onCampaignUpdate = useCallback((camp: VoiceCampaign) => {
    setLiveCampaign(camp);
  }, []);

  useVoiceCampaignRealtime(campaignId, onCallUpdate, onCampaignUpdate);

  // Fix 9: Use whichever data is more recent to prevent status flicker
  const currentCampaign = useMemo(() => {
    if (!liveCampaign) return campaign;
    if (!campaign) return liveCampaign;
    return new Date(liveCampaign.updated_at) >= new Date(campaign.updated_at)
      ? liveCampaign
      : campaign;
  }, [liveCampaign, campaign]);
  const mergedCalls = useMemo(() => {
    const map = new Map<string, VoiceCampaignCall>();
    calls.forEach((c) => map.set(c.id, c));
    liveCalls.forEach((c, id) => map.set(id, c));
    return Array.from(map.values());
  }, [calls, liveCalls]);

  const avgDuration = useMemo(() => {
    const withDuration = mergedCalls.filter((c) => c.call_duration_seconds);
    if (withDuration.length === 0) return 0;
    return Math.round(withDuration.reduce((sum, c) => sum + (c.call_duration_seconds || 0), 0) / withDuration.length);
  }, [mergedCalls]);

  const computedStats = useMemo(() => {
    const completed = mergedCalls.filter(c =>
      ["completed", "no-answer", "busy", "failed"].includes(c.status)
    ).length;
    const confirmed = mergedCalls.filter(c => c.outcome === "confirmed").length;
    const rescheduled = mergedCalls.filter(c => c.outcome === "rescheduled").length;
    const notInterested = mergedCalls.filter(c =>
      ["not_interested", "angry"].includes(c.outcome || "")
    ).length;
    const noAnswer = mergedCalls.filter(c =>
      ["no_response", "no_answer"].includes(c.outcome || "")
    ).length;
    const failed = mergedCalls.filter(c => c.status === "failed").length;
    const totalCost = mergedCalls.reduce((s, c) => s + (c.total_cost || 0), 0);
    return { completed, confirmed, rescheduled, notInterested, noAnswer, failed, totalCost };
  }, [mergedCalls]);

  const [retrying, setRetrying] = useState(false);

  const handleStop = async () => {
    if (!campaignId) return;
    const { error } = await supabase.functions.invoke("stop-voice-campaign", { body: { campaign_id: campaignId } });
    if (error) {
      toast.error("Failed to stop campaign");
    } else {
      toast.success("Campaign stopped");
      refetchCampaign();
      refetchCalls();
    }
  };

  const handleRetry = async () => {
    if (!campaignId) return;
    setRetrying(true);
    const { error } = await supabase.functions.invoke("start-voice-campaign", { body: { campaign_id: campaignId } });
    setRetrying(false);
    if (error) {
      toast.error("Failed to start campaign");
    } else {
      toast.success("Campaign started");
      refetchCampaign();
      refetchCalls();
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading campaign...</div>;
  }

  if (!currentCampaign) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Campaign not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calling/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              {currentCampaign.name}
              <CampaignStatusBadge status={currentCampaign.status} />
            </h1>
            {currentCampaign.workshop_name && (
              <p className="text-sm text-muted-foreground">{currentCampaign.workshop_name} • {currentCampaign.workshop_time || ""}</p>
            )}
          </div>
        </div>
        {(currentCampaign.status === "draft" || currentCampaign.status === "failed") && (
          <Button size="sm" onClick={handleRetry} disabled={retrying}>
            <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
            Retry Campaign
          </Button>
        )}
        {currentCampaign.status === "running" && (
          <Button variant="destructive" size="sm" onClick={handleStop}>
            <StopCircle className="h-4 w-4 mr-2" />
            Stop Campaign
          </Button>
        )}
      </div>

      <CampaignAnalyticsCards campaign={currentCampaign} computedStats={computedStats} avgDuration={avgDuration} />
      <CampaignProgressBar completed={computedStats.completed} total={currentCampaign.total_contacts} />
      <CampaignCallsTable calls={mergedCalls} />
    </div>
  );
}
