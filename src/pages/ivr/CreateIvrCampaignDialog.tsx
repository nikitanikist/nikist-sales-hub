import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
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

  // Step 1
  const [name, setName] = useState("");

  // Step 2 - Audio + CSV
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<{ name?: string; phone: string }[]>([]);

  // Load audio library (all clips, no type filter)
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

  // Load VoBiz integration for from_number
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
      const vobizFrom = vobizConfig?.from_number || "";

      if (!audioUrl) {
        toast.error("Please select an audio clip");
        setLoading(false);
        return;
      }
      if (!vobizFrom) {
        toast.error("VoBiz integration not configured");
        setLoading(false);
        return;
      }
      if (contacts.length === 0) {
        toast.error("No contacts loaded");
        setLoading(false);
        return;
      }

      // Create campaign — broadcast mode (no speech, no WhatsApp)
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
        })
        .select("id")
        .single();

      if (campaignError) throw campaignError;

      // Insert calls in batches
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

      toast.success(`Campaign created with ${contacts.length} contacts`);
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setName("");
    setSelectedAudioId("");
    setCsvFile(null);
    setContacts([]);
  };

  const canProceedStep2 = selectedAudioId && contacts.length > 0;

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
              <Select value={selectedAudioId} onValueChange={setSelectedAudioId}>
                <SelectTrigger><SelectValue placeholder="Choose an audio clip" /></SelectTrigger>
                <SelectContent>
                  {audioClips.map((clip) => (
                    <SelectItem key={clip.id} value={clip.id}>{clip.name}</SelectItem>
                  ))}
                  {audioClips.length === 0 && (
                    <SelectItem value="none" disabled>No clips found — upload in Audio Library first</SelectItem>
                  )}
                </SelectContent>
              </Select>
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
              </div>
            </div>
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
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Creating..." : `Create & Run (${contacts.length} contacts)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
