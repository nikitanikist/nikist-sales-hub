import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppSession } from "@/hooks/useWhatsAppSession";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
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
import { ArrowLeft, ArrowRight, Check, Search, Users, Send, Clock, X, Loader2 } from "lucide-react";
import { WhatsAppPreview } from "@/components/settings/WhatsAppPreview";
import {
  TemplateMediaUpload,
  validateWhatsAppMedia,
  getMediaType,
  getMediaTypeFromUrl,
  type MediaType,
} from "@/components/settings/TemplateMediaUpload";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Select Groups", "Draft Message", "Configure", "Confirm"];

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
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaFileName, setMediaFileName] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  // Media upload handler
  const handleMediaSelect = async (file: File) => {
    const validation = validateWhatsAppMedia(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    if (!currentOrganization) return;

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${currentOrganization.id}/${timestamp}_${sanitizedFileName}`;

      const { data, error } = await supabase.storage
        .from("template-media")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("template-media").getPublicUrl(data.path);

      setMediaUrl(urlData.publicUrl);
      setMediaFile(file);
      setMediaFileName(file.name);
      const type = getMediaType(file);
      setMediaType(type);
      toast.success("Media uploaded successfully");
    } catch (err: any) {
      toast.error("Failed to upload media", { description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleMediaRemove = async () => {
    if (mediaUrl) {
      try {
        const urlObj = new URL(mediaUrl);
        const pathMatch = urlObj.pathname.match(/\/template-media\/(.+)$/);
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[1]);
          await supabase.storage.from("template-media").remove([filePath]);
        }
      } catch (e) { /* ignore */ }
    }
    setMediaUrl(null);
    setMediaFile(null);
    setMediaFileName(null);
    setMediaType("");
  };

  const handleLoadTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSelectedTemplateId(id);
      setMessageContent(tpl.content);
      if (tpl.media_url) {
        setMediaUrl(tpl.media_url);
        setMediaType(getMediaTypeFromUrl(tpl.media_url));
        const urlParts = tpl.media_url.split("/");
        setMediaFileName(urlParts[urlParts.length - 1]);
      }
    }
  };

  const handleClearTemplate = () => {
    setSelectedTemplateId("");
    setMessageContent("");
    setMediaUrl(null);
    setMediaFile(null);
    setMediaFileName(null);
    setMediaType("");
  };

  const currentMediaType: MediaType = mediaFile
    ? getMediaType(mediaFile)
    : getMediaTypeFromUrl(mediaUrl || null);

  const handleSubmit = async () => {
    if (!currentOrganization || !selectedSessionId) return;
    setIsSubmitting(true);

    try {
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Send Notification</h1>
      </div>

      {/* Step indicator - labeled stepper */}
      <div className="flex items-center justify-center gap-0 py-2">
        {STEP_LABELS.map((label, i) => {
          const s = (i + 1) as Step;
          const isCompleted = s < step;
          const isActive = s === step;
          return (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`
                    h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold
                    transition-all duration-300 ease-out
                    ${isCompleted
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                      : isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/20 scale-110"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                    }
                  `}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : s}
                </div>
                <span
                  className={`
                    text-xs font-semibold whitespace-nowrap transition-colors
                    ${isCompleted
                      ? "text-emerald-600"
                      : isActive
                      ? "text-primary"
                      : "text-slate-400"
                    }
                  `}
                >
                  {label}
                </span>
              </div>
              {i < 3 && (
                <div
                  className={`
                    h-1 w-12 sm:w-20 mx-2 mt-[-24px] rounded-full transition-all duration-500
                    ${isCompleted ? "bg-emerald-500" : "bg-slate-200"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Select Groups */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Groups</CardTitle>
            <CardDescription>Choose which groups to send the notification to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Select number" />
              </SelectTrigger>
              <SelectContent>
                {connectedSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.display_name || s.phone_number || s.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search groups..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="flex items-center justify-between">
              <button onClick={toggleAll} className="text-sm text-primary hover:underline">
                {selectedGroupIds.size === filteredGroups.length && filteredGroups.length > 0 ? "Deselect All" : "Select All"}
              </button>
              <Badge variant="secondary">{selectedGroupIds.size} selected</Badge>
            </div>

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

      {/* Step 2: Draft Message - Two Column */}
      {step === 2 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Compose Panel */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Draft Message</CardTitle>
              <CardDescription>Compose your notification message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
              {/* Template selector with clear */}
              {templates.length > 0 && (
                <div>
                  <Label className="text-sm">Load from template</Label>
                  <div className="flex gap-2">
                    <Select value={selectedTemplateId} onValueChange={handleLoadTemplate}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplateId && (
                      <Button variant="ghost" size="icon" onClick={handleClearTemplate} title="Clear template">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Media Upload */}
              <div>
                <Label className="text-sm text-muted-foreground">Media Attachment (optional)</Label>
                <TemplateMediaUpload
                  mediaUrl={mediaUrl}
                  mediaFile={mediaFile}
                  fileName={mediaFileName}
                  isUploading={isUploading}
                  onSelect={handleMediaSelect}
                  onRemove={handleMediaRemove}
                />
              </div>

              {/* Message Content */}
              <div className="flex-1 flex flex-col">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message here..."
                  className="min-h-[160px] flex-1 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card className="bg-[#efeae2] overflow-hidden">
            <CardHeader className="pb-3 bg-white/80 backdrop-blur-sm">
              <CardTitle className="text-lg font-semibold">Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <WhatsAppPreview
                content={messageContent}
                mediaUrl={mediaUrl}
                mediaType={currentMediaType}
              />
            </CardContent>
          </Card>
        </div>
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

      {/* Step 4: Confirmation - Two Column */}
      {step === 4 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Confirm & Send</CardTitle>
              <CardDescription>Review your notification before sending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { label: "Campaign", value: campaignName },
                  { label: "Groups", value: `${selectedGroups.length} groups` },
                  { label: "Total Audience", value: `${totalAudience.toLocaleString()} members` },
                  { label: "Delay", value: DELAY_OPTIONS.find((d) => d.value === delaySeconds)?.label },
                  {
                    label: "Schedule",
                    value: sendMode === "now" ? "Send Now" : new Date(scheduledFor).toLocaleString(),
                    icon: sendMode === "now" ? Send : Clock,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {item.icon && <item.icon className="h-3.5 w-3.5" />}
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
              {mediaUrl && (
                <Badge variant="outline" className="mt-2">
                  {mediaType || "attachment"}: {mediaFileName || mediaUrl.split("/").pop()}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Message Preview */}
          <Card className="bg-[#efeae2] overflow-hidden">
            <CardHeader className="pb-3 bg-white/80 backdrop-blur-sm">
              <CardTitle className="text-lg font-semibold">Message Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <WhatsAppPreview
                content={messageContent}
                mediaUrl={mediaUrl}
                mediaType={currentMediaType}
              />
            </CardContent>
          </Card>
        </div>
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
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
            ) : sendMode === "schedule" ? (
              <><Clock className="h-4 w-4" /> Schedule Campaign</>
            ) : (
              <><Send className="h-4 w-4" /> Send Now</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default SendNotification;
