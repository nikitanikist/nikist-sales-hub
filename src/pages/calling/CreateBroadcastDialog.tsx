import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreateBroadcast } from "@/hooks/useCreateBroadcast";
import { WorkshopSelector } from "./components/WorkshopSelector";
import { CsvUploader } from "./components/CsvUploader";
import { ArrowLeft, ArrowRight, Rocket, Calendar, Loader2, AlertCircle, Settings } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Contact {
  name: string;
  phone: string;
  lead_id?: string;
}

interface BolnaAgent {
  id: string;
  name: string;
}

interface AisensyAccount {
  id: string;
  name: string;
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
  const [aisensyIntegrationId, setAisensyIntegrationId] = useState<string>("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [bolnaAgentId, setBolnaAgentId] = useState<string>("");

  // Bolna agents state
  const [agents, setAgents] = useState<BolnaAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [bolnaNotConfigured, setBolnaNotConfigured] = useState(false);

  // AISensy accounts state
  const [aisensyAccounts, setAisensyAccounts] = useState<AisensyAccount[]>([]);
  const [aisensyLoading, setAisensyLoading] = useState(false);

  const createBroadcast = useCreateBroadcast();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();

  // Fetch Bolna agents when step 2 is reached
  useEffect(() => {
    if (step === 2 && agents.length === 0 && !agentsLoading && !agentsError) {
      fetchAgents();
    }
  }, [step]);

  // Fetch AISensy accounts when step 3 is reached
  useEffect(() => {
    if (step === 3 && aisensyAccounts.length === 0 && !aisensyLoading && currentOrganization) {
      fetchAisensyAccounts();
    }
  }, [step, currentOrganization]);

  const fetchAisensyAccounts = async () => {
    if (!currentOrganization) return;
    setAisensyLoading(true);
    try {
      const { data } = await supabase
        .from("organization_integrations")
        .select("id, integration_name")
        .eq("organization_id", currentOrganization.id)
        .eq("integration_type", "aisensy")
        .eq("is_active", true);

      const accounts = (data || []).map((d: any) => ({ id: d.id, name: d.integration_name }));
      setAisensyAccounts(accounts);
      if (accounts.length === 1 && !aisensyIntegrationId) {
        setAisensyIntegrationId(accounts[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch AISensy accounts:", err);
    } finally {
      setAisensyLoading(false);
    }
  };

  const fetchAgents = async () => {
    setAgentsLoading(true);
    setAgentsError(null);
    setBolnaNotConfigured(false);
    try {
      const { data, error } = await supabase.functions.invoke("list-bolna-agents");
      if (error) {
        setAgentsError("Failed to fetch agents. Please try again.");
        return;
      }
      if (data?.error === "bolna_not_configured") {
        setBolnaNotConfigured(true);
        return;
      }
      if (data?.agents && data.agents.length > 0) {
        setAgents(data.agents);
        if (!bolnaAgentId) {
          setBolnaAgentId(data.agents[0].id);
        }
      } else {
        setAgentsError("No agents found in your Bolna account.");
      }
    } catch (err) {
      setAgentsError("Failed to fetch agents.");
    } finally {
      setAgentsLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSource("workshop");
    setContacts([]);
    setWorkshopId("");
    setWorkshopName("");
    setCampaignName("");
    setWorkshopTime("7 PM");
    setWhatsappTemplate("");
    setAisensyIntegrationId("");
    setScheduleMode("now");
    setScheduledAt("");
    setBolnaAgentId("");
    setAgents([]);
    setAgentsLoading(false);
    setAgentsError(null);
    setBolnaNotConfigured(false);
    setAisensyAccounts([]);
    setAisensyLoading(false);
  };

  const handleSubmit = async () => {
    const result = await createBroadcast.mutateAsync({
      name: campaignName || `Calling Broadcast - ${format(new Date(), "dd MMM yyyy")}`,
      workshop_id: workshopId || undefined,
      workshop_name: workshopName || undefined,
      workshop_time: workshopTime || undefined,
      whatsapp_template_id: whatsappTemplate || undefined,
      aisensy_integration_id: aisensyIntegrationId || undefined,
      scheduled_at: scheduleMode === "schedule" ? scheduledAt : undefined,
      contacts,
      bolna_agent_id: bolnaAgentId || undefined,
    });
    onOpenChange(false);
    reset();
    if (result?.id) {
      navigate(`/calling/campaigns/${result.id}`);
    }
  };

  const canProceed = () => {
    if (step === 1) return contacts.length > 0;
    if (step === 2) return !!bolnaAgentId;
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
                {agentsLoading ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading agents from Bolna...
                  </div>
                ) : bolnaNotConfigured ? (
                  <Alert variant="destructive" className="mt-1">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>Bolna integration not configured.</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onClick={() => {
                          onOpenChange(false);
                          navigate("/settings?tab=integrations");
                        }}
                      >
                        <Settings className="h-3 w-3 mr-1" /> Go to Settings
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : agentsError ? (
                  <Alert variant="destructive" className="mt-1">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>{agentsError}</span>
                      <Button variant="outline" size="sm" className="ml-2" onClick={fetchAgents}>
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select value={bolnaAgentId} onValueChange={setBolnaAgentId}>
                    <SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                <Label>AISensy Account</Label>
                {aisensyLoading ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading AISensy accounts...
                  </div>
                ) : aisensyAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">No AISensy accounts configured. WhatsApp messages won't be sent.</p>
                ) : (
                  <Select value={aisensyIntegrationId} onValueChange={setAisensyIntegrationId}>
                    <SelectTrigger><SelectValue placeholder="Select AISensy account" /></SelectTrigger>
                    <SelectContent>
                      {aisensyAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>WhatsApp Template Name (Optional)</Label>
                <Input value={whatsappTemplate} onChange={(e) => setWhatsappTemplate(e.target.value)} placeholder="Enter template name for WhatsApp group link" />
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
