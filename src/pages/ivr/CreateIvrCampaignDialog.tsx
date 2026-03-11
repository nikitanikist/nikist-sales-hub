import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Play, Square, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IvrAudioClip } from "@/types/ivr-campaign";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateIvrCampaignDialog({ open, onOpenChange, onSuccess }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Audio preview
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Step 1
  const [name, setName] = useState("");

  // Step 2 - Audio + CSV + From Number
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<{ name?: string; phone: string }[]>([]);
  const [selectedFromNumber, setSelectedFromNumber] = useState("");

  // Step 3 - Launch mode
  const [launchMode, setLaunchMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("10:00");

  // Load audio library
  const { data: audioClips = [] } = useQuery({
    queryKey: ["ivr-audio-library", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("ivr_audio_library")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as IvrAudioClip[];
    },
    enabled: !!currentOrganization && open,
  });

  // Load VoBiz integration for from_number(s)
  const { data: vobizConfig } = useQuery({
    queryKey: ["vobiz-integration", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return null;
      const { data } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("organization_id", currentOrganization.id)
        .eq("integration_type", "vobiz")
        .eq("is_active", true)
        .limit(1)
        .single();
      return data?.config as { from_number?: string } | null;
    },
    enabled: !!currentOrganization && open,
  });

  // Parse comma-separated from_number into array
  const fromNumbers = (vobizConfig?.from_number || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  // Auto-select if only one number
  const effectiveFromNumber = fromNumbers.length === 1 ? fromNumbers[0] : selectedFromNumber;

  // Audio preview handlers
  const handlePlayPause = () => {
    const clip = audioClips.find((a) => a.id === selectedAudioId);
    if (!clip?.audio_url) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(clip.audio_url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const parseCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes("phone") || header.includes("name") || header.includes("mobile");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const parsed = dataLines.map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length >= 2) {
        return { name: cols[0], phone: cols[1] };
      }
      return { phone: cols[0] };
    }).filter((c) => c.phone && c.phone.length >= 10);

    setContacts(parsed);
    toast.success(`Parsed ${parsed.length} contacts`);
  };

  const getAudioUrl = (id: string) => audioClips.find((a) => a.id === id)?.audio_url || "";

  const handleCreate = async () => {
    if (!currentOrganization || !user) return;
    setLoading(true);

    try {
      const audioUrl = getAudioUrl(selectedAudioId);
      const vobizFrom = effectiveFromNumber;

      if (!audioUrl) {
        toast.error("Please select an audio clip");
        setLoading(false);
        return;
      }
      if (!vobizFrom) {
        toast.error("Please select a phone number");
        setLoading(false);
        return;
      }
      if (contacts.length === 0) {
        toast.error("No contacts loaded");
        setLoading(false);
        return;
      }

      // Build scheduled_at if scheduling
      let scheduledAt: string | null = null;
      if (launchMode === "schedule") {
        if (!scheduleDate) {
          toast.error("Please select a date");
          setLoading(false);
          return;
        }
        // Construct datetime in IST and convert to UTC
        const dateStr = format(scheduleDate, "yyyy-MM-dd");
        const istDatetime = new Date(`${dateStr}T${scheduleTime}:00`);
        // fromZonedTime: treat the input as IST → returns UTC Date
        const utcDate = fromZonedTime(istDatetime, "Asia/Kolkata");
        
        if (utcDate <= new Date()) {
          toast.error("Scheduled time must be in the future");
          setLoading(false);
          return;
        }
        scheduledAt = utcDate.toISOString();
      }

      const isScheduled = launchMode === "schedule";

      const { data: campaign, error: campaignError } = await supabase
        .from("ivr_campaigns")
        .insert({
          organization_id: currentOrganization.id,
          name,
          audio_opening_url: audioUrl,
          audio_thankyou_url: audioUrl,
          audio_not_interested_url: audioUrl,
          vobiz_from_number: vobizFrom,
          on_yes_action: "none",
          total_contacts: contacts.length,
          created_by: user.id,
          status: isScheduled ? "scheduled" : "draft",
          scheduled_at: scheduledAt,
        })
        .select("id")
        .single();

      if (campaignError) throw campaignError;

      const BATCH_SIZE = 500;
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE).map((c) => ({
          campaign_id: campaign.id,
          organization_id: currentOrganization.id,
          contact_name: c.name || null,
          contact_phone: c.phone,
          status: "pending",
        }));

        const { error: callsError } = await supabase.from("ivr_campaign_calls").insert(batch);
        if (callsError) throw callsError;
      }

      if (isScheduled) {
        toast.success(`Campaign scheduled for ${format(scheduleDate!, "dd MMM yyyy")} at ${scheduleTime} IST`);
      } else {
        toast.success(`Campaign created with ${contacts.length} contacts`);
      }

      resetForm();
      onSuccess();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    stopAudio();
    setStep(1);
    setName("");
    setSelectedAudioId("");
    setCsvFile(null);
    setContacts([]);
    setSelectedFromNumber("");
    setLaunchMode("now");
    setScheduleDate(undefined);
    setScheduleTime("10:00");
  };

  const canProceedStep2 = selectedAudioId && contacts.length > 0 && !!effectiveFromNumber;
  const canCreate = launchMode === "now" || (scheduleDate && scheduleTime);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Voice Broadcast — Step {step}/3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input placeholder="e.g. Workshop 15 March - Broadcast" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Select Audio Clip *</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedAudioId}
                  onValueChange={(val) => {
                    stopAudio();
                    setSelectedAudioId(val);
                  }}
                >
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose an audio clip" /></SelectTrigger>
                  <SelectContent>
                    {audioClips.map((clip) => (
                      <SelectItem key={clip.id} value={clip.id}>{clip.name}</SelectItem>
                    ))}
                    {audioClips.length === 0 && (
                      <SelectItem value="none" disabled>No clips found — upload in Audio Library first</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!selectedAudioId}
                  onClick={handlePlayPause}
                  className="shrink-0"
                >
                  {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label>Upload CSV (columns: name, phone) *</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCsvFile(file);
                    await parseCsv(file);
                  }
                }}
              />
            </div>
            {contacts.length > 0 && (
              <p className="text-sm text-muted-foreground">✅ {contacts.length} contacts loaded</p>
            )}

            <div>
              <Label>From Number *</Label>
              {fromNumbers.length <= 1 ? (
                <Input
                  value={fromNumbers[0] || ""}
                  disabled
                  placeholder="No VoBiz number configured"
                />
              ) : (
                <Select value={selectedFromNumber} onValueChange={setSelectedFromNumber}>
                  <SelectTrigger><SelectValue placeholder="Select a phone number" /></SelectTrigger>
                  <SelectContent>
                    {fromNumbers.map((num) => (
                      <SelectItem key={num} value={num}>{num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {fromNumbers.length === 0 && (
                <p className="text-xs text-destructive mt-1">Configure VoBiz integration in Settings first</p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-semibold">Review</h4>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Campaign:</span> {name}</p>
                <p><span className="text-muted-foreground">Audio:</span> {audioClips.find(a => a.id === selectedAudioId)?.name || "—"}</p>
                <p><span className="text-muted-foreground">Contacts:</span> {contacts.length}</p>
                <p><span className="text-muted-foreground">From Number:</span> {effectiveFromNumber || "—"}</p>
              </div>
            </div>

            {/* Launch Mode Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">When to run?</Label>
              <RadioGroup value={launchMode} onValueChange={(v) => setLaunchMode(v as "now" | "schedule")} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="launch-now" />
                  <Label htmlFor="launch-now" className="cursor-pointer font-normal">Run immediately after creation</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="schedule" id="launch-schedule" />
                  <Label htmlFor="launch-schedule" className="cursor-pointer font-normal">Schedule for later</Label>
                </div>
              </RadioGroup>
            </div>

            {launchMode === "schedule" && (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div>
                  <Label className="text-sm">Date (IST)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !scheduleDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduleDate ? format(scheduleDate, "dd MMM yyyy") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduleDate}
                        onSelect={setScheduleDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-sm">Time (IST)</Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                {scheduleDate && scheduleTime && (
                  <p className="text-xs text-muted-foreground">
                    Campaign will auto-start on {format(scheduleDate, "dd MMM yyyy")} at {scheduleTime} IST
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Each contact will receive a call that plays the selected audio and then hangs up automatically.
            </p>
          </div>
        )}

        <DialogFooter>
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !name) || (step === 2 && !canProceedStep2)}
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={loading || !canCreate}>
              {loading
                ? "Creating..."
                : launchMode === "schedule"
                  ? `Schedule Campaign (${contacts.length} contacts)`
                  : `Create & Run (${contacts.length} contacts)`
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}