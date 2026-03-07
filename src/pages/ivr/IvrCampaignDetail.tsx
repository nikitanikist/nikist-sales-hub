import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIvrCampaignDetail } from "@/hooks/useIvrCampaignDetail";
import { useIvrCampaignRealtime } from "@/hooks/useIvrCampaignRealtime";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Play, StopCircle, PhoneCall, ThumbsUp, ThumbsDown, PhoneOff, Clock, MessageSquare, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import type { IvrCampaign, IvrCampaignCall } from "@/types/ivr-campaign";

function outcomeBadge(outcome: string | null, status: string) {
  if (!outcome) {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pending", variant: "outline" },
      queued: { label: "Queued", variant: "secondary" },
      initiated: { label: "Ringing", variant: "secondary" },
      answered: { label: "In Call", variant: "default" },
      no_answer: { label: "No Answer", variant: "destructive" },
      busy: { label: "Busy", variant: "destructive" },
      failed: { label: "Failed", variant: "destructive" },
      voicemail: { label: "Voicemail", variant: "outline" },
      cancelled: { label: "Cancelled", variant: "outline" },
    };
    const config = statusMap[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }
  const outcomeMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    interested: { label: "✅ Interested", variant: "default" },
    not_interested: { label: "❌ Not Interested", variant: "destructive" },
    no_response: { label: "🔇 No Response", variant: "outline" },
    unclear: { label: "❓ Unclear", variant: "secondary" },
    voicemail: { label: "📩 Voicemail", variant: "outline" },
    error: { label: "⚠️ Error", variant: "destructive" },
  };
  const config = outcomeMap[outcome] || { label: outcome, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function IvrCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { campaign, calls, isLoading, refetchCalls, refetchCampaign } = useIvrCampaignDetail(campaignId);

  // Realtime
  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;

  const handleCallUpdate = useCallback(() => {
    refetchCalls();
  }, [refetchCalls]);

  const handleCampaignUpdate = useCallback(() => {
    refetchCampaign();
  }, [refetchCampaign]);

  useIvrCampaignRealtime(campaignId, handleCallUpdate, handleCampaignUpdate);

  const handleStart = async () => {
    const { error } = await supabase.functions.invoke("start-ivr-campaign", { body: { campaign_id: campaignId } });
    if (error) toast.error("Failed to start"); else { toast.success("Campaign started"); refetchCampaign(); }
  };

  const handleStop = async () => {
    const { error } = await supabase.functions.invoke("stop-ivr-campaign", { body: { campaign_id: campaignId } });
    if (error) toast.error("Failed to stop"); else { toast.success("Campaign stopped"); refetchCampaign(); }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!campaign) return <div className="p-8 text-muted-foreground">Campaign not found</div>;

  const totalProcessed = campaign.calls_interested + campaign.calls_not_interested + campaign.calls_no_response + campaign.calls_no_answer + campaign.calls_busy + campaign.calls_failed + campaign.calls_voicemail;
  const progress = campaign.total_contacts > 0 ? (totalProcessed / campaign.total_contacts) * 100 : 0;

  const stats = [
    { label: "Total Contacts", value: campaign.total_contacts, icon: PhoneCall, color: "text-foreground" },
    { label: "Interested", value: campaign.calls_interested, icon: ThumbsUp, color: "text-green-600" },
    { label: "Not Interested", value: campaign.calls_not_interested, icon: ThumbsDown, color: "text-red-500" },
    { label: "No Answer", value: campaign.calls_no_answer, icon: PhoneOff, color: "text-muted-foreground" },
    { label: "No Response", value: campaign.calls_no_response, icon: Clock, color: "text-yellow-600" },
    { label: "WhatsApp Sent", value: calls.filter(c => c.whatsapp_sent).length, icon: MessageSquare, color: "text-green-600" },
    { label: "Failed", value: campaign.calls_failed, icon: AlertCircle, color: "text-destructive" },
    { label: "Cost (₹)", value: `₹${(campaign.total_cost || 0).toFixed(2)}`, icon: PhoneCall, color: "text-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ivr/campaigns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader title={campaign.name} />
          <p className="text-sm text-muted-foreground">{campaign.description || "IVR Voice Campaign"}</p>
        </div>
        <div className="flex gap-2">
          {["draft", "scheduled"].includes(campaign.status) && (
            <Button onClick={handleStart}><Play className="h-4 w-4 mr-2" /> Start</Button>
          )}
          {campaign.status === "running" && (
            <Button variant="destructive" onClick={handleStop}><StopCircle className="h-4 w-4 mr-2" /> Stop</Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>{totalProcessed} / {campaign.total_contacts} calls processed</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle>Call Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Speech</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Retry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No calls yet</TableCell></TableRow>
                ) : (
                  calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="font-medium">{call.contact_name || "—"}</TableCell>
                      <TableCell>{call.contact_phone}</TableCell>
                      <TableCell>{outcomeBadge(call.outcome, call.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {call.speech_transcript || "—"}
                      </TableCell>
                      <TableCell className="text-right">{call.call_duration_seconds > 0 ? `${Math.round(call.call_duration_seconds)}s` : "—"}</TableCell>
                      <TableCell>
                        {call.whatsapp_sent ? (
                          <Badge variant="default">Sent</Badge>
                        ) : call.whatsapp_error ? (
                          <Badge variant="destructive">Error</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{call.retry_count > 0 ? `${call.retry_count}x` : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
