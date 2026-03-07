import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [description, setDescription] = useState("");

  // Step 2 - Audio
  const [openingAudioId, setOpeningAudioId] = useState("");
  const [thankyouAudioId, setThankyouAudioId] = useState("");
  const [notInterestedAudioId, setNotInterestedAudioId] = useState("");

  // Step 3 - Contacts CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<{ name?: string; phone: string }[]>([]);

  // Step 4 - WhatsApp template
  const [templateName, setTemplateName] = useState("");
  const [fromNumber, setFromNumber] = useState("");

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
      const openingUrl = getAudioUrl(openingAudioId);
      const thankyouUrl = getAudioUrl(thankyouAudioId);
      const notIntUrl = getAudioUrl(notInterestedAudioId);
      const vobizFrom = fromNumber || vobizConfig?.from_number || "";

      if (!openingUrl || !thankyouUrl || !notIntUrl) {
        toast.error("Please select all required audio clips");
        setLoading(false);
        return;
      }
      if (!vobizFrom) {
        toast.error("VoBiz from number required");
        setLoading(false);
        return;
      }
      if (contacts.length === 0) {
        toast.error("No contacts loaded");
        setLoading(false);
        return;
      }

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("ivr_campaigns")
        .insert({
          organization_id: currentOrganization.id,
          name,
          description,
          audio_opening_url: openingUrl,
          audio_thankyou_url: thankyouUrl,
          audio_not_interested_url: notIntUrl,
          vobiz_from_number: vobizFrom,
          on_yes_action: templateName ? "send_whatsapp" : "none",
          on_yes_template_name: templateName || null,
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
    setDescription("");
    setOpeningAudioId("");
    setThankyouAudioId("");
    setNotInterestedAudioId("");
    setCsvFile(null);
    setContacts([]);
    setTemplateName("");
    setFromNumber("");
  };

  const openingClips = audioClips.filter((a) => a.audio_type === "opening");
  const thankyouClips = audioClips.filter((a) => a.audio_type === "thankyou");
  const notIntClips = audioClips.filter((a) => a.audio_type === "not_interested");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New IVR Campaign — Step {step}/4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input placeholder="e.g. Workshop 15 March - IVR" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Optional notes" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <AudioSelect label="Opening Message *" clips={openingClips} value={openingAudioId} onChange={setOpeningAudioId} />
            <AudioSelect label="Thank You (on Yes) *" clips={thankyouClips} value={thankyouAudioId} onChange={setThankyouAudioId} />
            <AudioSelect label="Not Interested (on No) *" clips={notIntClips} value={notInterestedAudioId} onChange={setNotInterestedAudioId} />
            {audioClips.length === 0 && (
              <p className="text-sm text-destructive">No audio clips found. Please upload audio in the Audio Library first.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Upload CSV (columns: name, phone)</Label>
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

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <Label>WhatsApp Template Name (optional)</Label>
              <Input placeholder="e.g. workshop_invite_v2" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Leave blank to skip WhatsApp on "yes"</p>
            </div>
            <div>
              <Label>VoBiz From Number</Label>
              <Input placeholder={vobizConfig?.from_number || "+917971543257"} value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} />
              {vobizConfig?.from_number && <p className="text-xs text-muted-foreground mt-1">Default: {vobizConfig.from_number}</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !name}>Next</Button>
          ) : (
            <Button onClick={handleCreate} disabled={loading || contacts.length === 0}>
              {loading ? "Creating..." : `Create Campaign (${contacts.length} contacts)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AudioSelect({ label, clips, value, onChange }: { label: string; clips: IvrAudioClip[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select audio clip" /></SelectTrigger>
        <SelectContent>
          {clips.map((clip) => (
            <SelectItem key={clip.id} value={clip.id}>{clip.name}</SelectItem>
          ))}
          {clips.length === 0 && (
            <SelectItem value="none" disabled>No clips of this type</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
