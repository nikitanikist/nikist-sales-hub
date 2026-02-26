import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateBroadcast } from "@/hooks/useCreateBroadcast";
import { WorkshopSelector } from "./components/WorkshopSelector";
import { CsvUploader } from "./components/CsvUploader";
import { ArrowLeft, ArrowRight, Rocket, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Contact {
  name: string;
  phone: string;
  lead_id?: string;
}

export function CreateBroadcastDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<"workshop" | "csv">("workshop");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [workshopId, setWorkshopId] = useState<string>("");
  const [workshopName, setWorkshopName] = useState<string>("");
  const [campaignName, setCampaignName] = useState<string>("");
  const [workshopTime, setWorkshopTime] = useState<string>("7 PM");
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  const createBroadcast = useCreateBroadcast();
  const navigate = useNavigate();

  const reset = () => {
    setStep(1);
    setSource("workshop");
    setContacts([]);
    setWorkshopId("");
    setWorkshopName("");
    setCampaignName("");
    setWorkshopTime("7 PM");
    setWhatsappTemplate("");
    setScheduleMode("now");
    setScheduledAt("");
  };

  const handleSubmit = async () => {
    const result = await createBroadcast.mutateAsync({
      name: campaignName || `Calling Broadcast - ${format(new Date(), "dd MMM yyyy")}`,
      workshop_id: workshopId || undefined,
      workshop_name: workshopName || undefined,
      workshop_time: workshopTime || undefined,
      whatsapp_template_id: whatsappTemplate || undefined,
      scheduled_at: scheduleMode === "schedule" ? scheduledAt : undefined,
      contacts,
    });
    onOpenChange(false);
    reset();
    if (result?.id) {
      navigate(`/calling/campaigns/${result.id}`);
    }
  };

  const canProceed = () => {
    if (step === 1) return contacts.length > 0;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) return scheduleMode === "now" || (scheduleMode === "schedule" && scheduledAt);
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Calling Broadcast — Step {step}/4</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 1 && (
            <div className="space-y-4">
              <RadioGroup value={source} onValueChange={(v) => setSource(v as any)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="workshop" id="src-workshop" />
                  <Label htmlFor="src-workshop">Select Workshop</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="csv" id="src-csv" />
                  <Label htmlFor="src-csv">Upload CSV</Label>
                </div>
              </RadioGroup>

              {source === "workshop" ? (
                <WorkshopSelector onWorkshopSelected={(ws) => {
                  setWorkshopId(ws.id);
                  setWorkshopName(ws.title);
                  setCampaignName(`Workshop Reminder - ${ws.title}`);
                  setContacts(ws.contacts);
                }} />
              ) : (
                <CsvUploader onContactsParsed={(c) => {
                  setContacts(c);
                  if (!campaignName) setCampaignName(`Calling Broadcast - ${format(new Date(), "dd MMM")}`);
                }} />
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Campaign Name</Label>
                <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Workshop Reminder - Feb 26" />
              </div>
              <div>
                <Label>Workshop Name</Label>
                <Input value={workshopName} onChange={(e) => setWorkshopName(e.target.value)} placeholder="e.g. Crypto Masterclass" />
              </div>
              <div>
                <Label>Workshop Time</Label>
                <Input value={workshopTime} onChange={(e) => setWorkshopTime(e.target.value)} placeholder="e.g. 7 PM" />
              </div>
              <div>
                <Label>Bolna Agent</Label>
                <Select defaultValue="workshop_reminder">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workshop_reminder">Workshop Reminder Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted rounded-md p-3 text-sm">
                <p className="text-muted-foreground">Preview: Agent will say:</p>
                <p className="font-medium mt-1">"आज शाम {workshopTime} बजे {workshopName} है"</p>
                <p className="text-xs text-muted-foreground mt-1">{contacts.length} contacts will be called</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label>AiSensy WhatsApp Template (Optional)</Label>
                <Input value={whatsappTemplate} onChange={(e) => setWhatsappTemplate(e.target.value)} placeholder="Enter template name/ID for WhatsApp group link" />
                <p className="text-xs text-muted-foreground mt-1">This template is sent when a contact says they haven't joined the WhatsApp group</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <RadioGroup value={scheduleMode} onValueChange={(v) => setScheduleMode(v as any)} className="space-y-3">
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <RadioGroupItem value="now" id="mode-now" />
                  <Label htmlFor="mode-now" className="flex items-center gap-2 cursor-pointer">
                    <Rocket className="h-4 w-4" />
                    Start Now
                  </Label>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <RadioGroupItem value="schedule" id="mode-schedule" />
                  <Label htmlFor="mode-schedule" className="flex items-center gap-2 cursor-pointer">
                    <Calendar className="h-4 w-4" />
                    Schedule for later
                  </Label>
                </div>
              </RadioGroup>

              {scheduleMode === "schedule" && (
                <div>
                  <Label>Schedule Date & Time</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 4 ? (
            <Button disabled={!canProceed()} onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button disabled={!canProceed() || createBroadcast.isPending} onClick={handleSubmit}>
              {createBroadcast.isPending ? "Creating..." : "Initiate Calling"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
