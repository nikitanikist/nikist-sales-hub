import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, ArrowLeft, ArrowRight, Rocket, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Contact {
  name: string;
  phone: string;
  context: Record<string, string>;
  rawColumns: Record<string, string>;
}

interface CreateAgentCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateAgentCampaignDialog({ open, onOpenChange, onCreated }: CreateAgentCampaignDialogProps) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [creating, setCreating] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["bolna-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-bolna-agents");
      if (error) throw error;
      if (data?.error === "bolna_not_configured") return [];
      return data?.agents || [];
    },
    enabled: open,
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
          setCsvError("CSV must have at least a header row and one data row.");
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("number") || h.includes("contact_number"));

        // Priority-based name detection
        const exactNameMatches = ["lead_name", "contact_name", "customer_name"];
        const excludeNameColumns = ["class_name", "event_name", "workshop_name", "batch_name", "course_name"];
        let nameIdx = headers.findIndex((h) => exactNameMatches.includes(h));
        if (nameIdx === -1) {
          nameIdx = headers.findIndex((h) => h.includes("name") && !excludeNameColumns.includes(h));
        }

        if (phoneIdx === -1) {
          setCsvError("CSV must have a column containing 'phone' or 'number'.");
          return;
        }

        const parsed: Contact[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          const phone = cols[phoneIdx] || "";
          if (!phone) continue;

          // Store ALL non-phone columns as context (including name column)
          const context: Record<string, string> = {};
          const rawColumns: Record<string, string> = {};
          headers.forEach((h, idx) => {
            if (cols[idx]) {
              rawColumns[h] = cols[idx];
              if (idx !== phoneIdx) {
                context[h] = cols[idx];
              }
            }
          });

          parsed.push({
            name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
            phone: phone.startsWith("+") ? phone : `+91${phone.replace(/^91/, "")}`,
            context,
            rawColumns,
          });
        }

        if (parsed.length === 0) {
          setCsvError("No valid contacts found in CSV.");
          return;
        }

        setCsvHeaders(headers);
        setContacts(parsed);
        setStep(3);
      } catch {
        setCsvError("Failed to parse CSV file.");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleCreate = async (runNow: boolean) => {
    if (!currentOrganization || !user || !selectedAgent || contacts.length === 0) return;
    setCreating(true);

    try {
      const name = campaignName || `${selectedAgent.name} - ${new Date().toLocaleDateString()}`;

      // Create campaign
      const { data: campaign, error: campErr } = await supabase
        .from("calling_agent_campaigns")
        .insert({
          organization_id: currentOrganization.id,
          created_by: user.id,
          name,
          bolna_agent_id: selectedAgent.id,
          bolna_agent_name: selectedAgent.name,
          total_contacts: contacts.length,
          status: "draft",
        })
        .select()
        .single();

      if (campErr || !campaign) throw campErr || new Error("Failed to create campaign");

      // Insert calls
      const callRows = contacts.map((c) => ({
        campaign_id: (campaign as any).id,
        organization_id: currentOrganization.id,
        contact_name: c.name || null,
        contact_phone: c.phone,
        context_details: Object.keys(c.context).length > 0 ? c.context : null,
        status: "pending",
      }));

      const { error: callsErr } = await supabase.from("calling_agent_calls").insert(callRows);
      if (callsErr) throw callsErr;

      if (runNow) {
        const { error: startErr } = await supabase.functions.invoke("start-calling-agent-campaign", {
          body: { campaign_id: (campaign as any).id },
        });
        if (startErr) {
          toast.error("Campaign created but failed to start. You can retry from the detail page.");
        } else {
          toast.success("Campaign started!");
        }
      } else {
        toast.success("Campaign created as draft.");
      }

      resetState();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setSelectedAgent(null);
    setContacts([]);
    setCsvHeaders([]);
    setCampaignName("");
    setCsvError("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Start Calling Agent</DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </DialogHeader>

        {/* Step 1: Select Agent */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            <Label>Select AI Agent</Label>
            {agentsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading agents...</div>
            ) : agents.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />No agents found. Configure Bolna in Settings.</div>
            ) : (
              <Select onValueChange={(v) => {
                const agent = agents.find((a: any) => a.id === v);
                if (agent) setSelectedAgent({ id: agent.id, name: agent.name });
              }}>
                <SelectTrigger><SelectValue placeholder="Choose an agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <DialogFooter>
              <Button disabled={!selectedAgent} onClick={() => setStep(2)}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Upload CSV */}
        {step === 2 && (
          <div className="space-y-4 py-4">
            <Label>Upload CSV with Contacts</Label>
            <p className="text-sm text-muted-foreground">CSV should have columns: phone/number, name (optional), and any extra context columns.</p>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload CSV</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            {csvError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />{csvError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Review & Launch */}
        {step === 3 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={`${selectedAgent?.name || "Agent"} - ${new Date().toLocaleDateString()}`}
              />
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedAgent?.name}</Badge>
              <Badge variant="secondary">{contacts.length} contacts</Badge>
            </div>

            <div className="rounded-md border max-h-48 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvHeaders.map((h) => (
                      <TableHead key={h} className="capitalize whitespace-nowrap">{h.replace(/_/g, " ")}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.slice(0, 10).map((c, i) => (
                    <TableRow key={i}>
                      {csvHeaders.map((h) => (
                        <TableCell key={h} className="text-sm whitespace-nowrap">{c.rawColumns[h] || "-"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {contacts.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={csvHeaders.length} className="text-center text-sm text-muted-foreground">
                        ...and {contacts.length - 10} more
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => { setContacts([]); setStep(2); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button variant="secondary" onClick={() => handleCreate(false)} disabled={creating}>
                Save as Draft
              </Button>
              <Button onClick={() => handleCreate(true)} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                Run Now
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
