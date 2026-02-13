import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppSession } from "@/hooks/useWhatsAppSession";
import { useWhatsAppGroups, WhatsAppGroup } from "@/hooks/useWhatsAppGroups";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Search, Users, Send, Clock } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const DELAY_OPTIONS = [
  { value: 1, label: "1 second" },
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 15, label: "15 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
];

const SendNotification = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { sessions, sessionsLoading } = useWhatsAppSession();
  const { sendableGroups: groups, groupsLoading } = useWhatsAppGroups();
  const { templates } = useMessageTemplates();

  const [step, setStep] = useState<Step>(1);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [messageContent, setMessageContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const connectedSessions = useMemo(
    () => sessions?.filter((s) => s.status === "connected") || [],
    [sessions]
  );

  // Auto-select first connected session
  useMemo(() => {
    if (!selectedSessionId && connectedSessions.length > 0) {
      setSelectedSessionId(connectedSessions[0].id);
    }
  }, [connectedSessions, selectedSessionId]);

  const filteredGroups = useMemo(() => {
    let result = groups || [];
    if (selectedSessionId) {
      result = result.filter((g) => g.session_id === selectedSessionId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((g) => g.group_name.toLowerCase().includes(q));
    }
    return result;
  }, [groups, selectedSessionId, search]);

  const selectedGroups = useMemo(
    () => (groups || []).filter((g) => selectedGroupIds.has(g.id)),
    [groups, selectedGroupIds]
  );

  const totalAudience = useMemo(
    () => selectedGroups.reduce((sum, g) => sum + (g.participant_count || 0), 0),
    [selectedGroups]
  );

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedGroupIds.size === filteredGroups.length) {
      setSelectedGroupIds(new Set());
    } else {
      setSelectedGroupIds(new Set(filteredGroups.map((g) => g.id)));
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return selectedGroupIds.size > 0;
      case 2: return messageContent.trim().length > 0;
      case 3: return !!selectedSessionId && !!campaignName.trim() && (sendMode === "now" || !!scheduledFor);
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!currentOrganization || !selectedSessionId) return;
    setIsSubmitting(true);

    try {
      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("notification_campaigns")
        .insert({
          organization_id: currentOrganization.id,
          session_id: selectedSessionId,
          name: campaignName,
          message_content: messageContent,
          media_url: mediaUrl || null,
          media_type: mediaType || null,
          delay_seconds: delaySeconds,
          scheduled_for: sendMode === "schedule" ? scheduledFor : null,
          status: sendMode === "schedule" ? "scheduled" : "sending",
          total_groups: selectedGroups.length,
          total_audience: totalAudience,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create campaign groups
      const groupRows = selectedGroups.map((g) => ({
        campaign_id: campaign.id,
        group_id: g.id,
        group_jid: g.group_jid,
        group_name: g.group_name,
        member_count: g.participant_count || 0,
      }));

      const { error: groupsError } = await supabase
        .from("notification_campaign_groups")
        .insert(groupRows);

      if (groupsError) throw groupsError;

      toast.success(
        sendMode === "schedule"
          ? "Campaign scheduled successfully!"
          : "Campaign started! Messages are being sent."
      );
      navigate("/whatsapp/campaigns");
    } catch (err: any) {
      toast.error("Failed to create campaign", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionsLoading || groupsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Send Notification" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 4 && <div className={`h-0.5 w-8 ${s < step ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Groups */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Groups</CardTitle>
            <CardDescription>Choose which groups to send the notification to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Session filter */}
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {connectedSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.display_name || s.phone_number || s.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search groups..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            {/* Select all */}
            <div className="flex items-center justify-between">
              <button onClick={toggleAll} className="text-sm text-primary hover:underline">
                {selectedGroupIds.size === filteredGroups.length && filteredGroups.length > 0 ? "Deselect All" : "Select All"}
              </button>
              <Badge variant="secondary">{selectedGroupIds.size} selected</Badge>
            </div>

            {/* Group list */}
            <div className="max-h-72 overflow-y-auto space-y-1 border rounded-md p-2">
              {filteredGroups.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={selectedGroupIds.has(g.id)}
                    onCheckedChange={() => toggleGroup(g.id)}
                  />
                  <span className="flex-1 text-sm">{g.group_name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {g.participant_count}
                  </span>
                </label>
              ))}
              {filteredGroups.length === 0 && (
                <p className="text-center py-4 text-sm text-muted-foreground">No groups found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Draft Message */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Draft Message</CardTitle>
            <CardDescription>Compose your notification message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template selector */}
            {templates.length > 0 && (
              <div>
                <Label className="text-sm">Load from template</Label>
                <Select onValueChange={(id) => {
                  const tpl = templates.find((t) => t.id === id);
                  if (tpl) {
                    setMessageContent(tpl.content);
                    if (tpl.media_url) {
                      setMediaUrl(tpl.media_url);
                      // Detect media type from extension
                      const ext = tpl.media_url.split('.').pop()?.toLowerCase();
                      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) setMediaType('image');
                      else if (['mp4', 'mov', 'avi'].includes(ext || '')) setMediaType('video');
                      else setMediaType('document');
                    }
                  }
                }}>
                  <SelectTrigger className="w-full sm:w-[260px]">
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Type your message here..."
                className="min-h-[120px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mediaUrl">Media URL (optional)</Label>
                <Input
                  id="mediaUrl"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <Label htmlFor="mediaType">Media Type</Label>
                <Select value={mediaType} onValueChange={setMediaType}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Configuration */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Send Configuration</CardTitle>
            <CardDescription>Configure campaign name, delay, and scheduling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., January Workshop Reminder"
              />
            </div>

            <div>
              <Label>Send From</Label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connectedSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name || s.phone_number || s.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Delay Between Messages</Label>
              <Select value={String(delaySeconds)} onValueChange={(v) => setDelaySeconds(Number(v))}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELAY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>When to Send</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={sendMode === "now"} onChange={() => setSendMode("now")} className="accent-primary" />
                  <span className="text-sm">Send Now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={sendMode === "schedule"} onChange={() => setSendMode("schedule")} className="accent-primary" />
                  <span className="text-sm">Schedule for Later</span>
                </label>
              </div>
              {sendMode === "schedule" && (
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full sm:w-[280px]"
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm & Send</CardTitle>
            <CardDescription>Review your notification before sending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Campaign</span>
                <p className="font-medium">{campaignName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Groups</span>
                <p className="font-medium">{selectedGroups.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Audience</span>
                <p className="font-medium">{totalAudience.toLocaleString()} members</p>
              </div>
              <div>
                <span className="text-muted-foreground">Delay</span>
                <p className="font-medium">{DELAY_OPTIONS.find((d) => d.value === delaySeconds)?.label}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Schedule</span>
                <p className="font-medium flex items-center gap-1">
                  {sendMode === "now" ? (
                    <><Send className="h-3.5 w-3.5" /> Send Now</>
                  ) : (
                    <><Clock className="h-3.5 w-3.5" /> {new Date(scheduledFor).toLocaleString()}</>
                  )}
                </p>
              </div>
            </div>

            <div className="border rounded-md p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Message Preview</p>
              <p className="text-sm whitespace-pre-wrap">{messageContent}</p>
              {mediaUrl && (
                <Badge variant="outline" className="mt-2">{mediaType || "attachment"}: {mediaUrl.split("/").pop()}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 1 ? navigate("/whatsapp") : setStep((step - 1) as Step))}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        {step < 4 ? (
          <Button onClick={() => setStep((step + 1) as Step)} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : sendMode === "schedule" ? "Schedule Campaign" : "Send Now"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default SendNotification;
