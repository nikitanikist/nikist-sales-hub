import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, Search, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface Lead {
  id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  country: string | null;
}

interface AddFuturesStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchName: string;
  onSuccess: () => void;
}

export function AddFuturesStudentDialog({
  open,
  onOpenChange,
  batchId,
  batchName,
  onSuccess,
}: AddFuturesStudentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"search" | "new">("search");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Form state
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("India");
  const [conversionDate, setConversionDate] = useState<Date>(new Date());
  const [offerAmount, setOfferAmount] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const resetForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedLead(null);
    setCustomerName("");
    setEmail("");
    setPhone("");
    setCountry("India");
    setConversionDate(new Date());
    setOfferAmount("");
    setCashReceived("");
    setNotes("");
    setActiveTab("search");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Search for existing leads
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, contact_name, email, phone, country")
        .or(`email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);
      
      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      toast({ title: "Search failed", description: error instanceof Error ? error.message : "Error searching leads", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const selectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setCustomerName(lead.contact_name);
    setEmail(lead.email);
    setPhone(lead.phone || "");
    setCountry(lead.country || "India");
  };

  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async () => {
      const offerNum = parseFloat(offerAmount) || 0;
      const cashNum = parseFloat(cashReceived) || 0;
      const dueNum = Math.max(0, offerNum - cashNum);
      
      let leadId = selectedLead?.id;
      
      // If adding new customer, create lead first
      if (!leadId && activeTab === "new") {
        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert({
            contact_name: customerName,
            email: email,
            phone: phone || null,
            country: country,
            company_name: "Futures Mentorship",
            source: "futures_mentorship",
          })
          .select("id")
          .single();
        
        if (leadError) throw new Error(`Failed to create lead: ${leadError.message}`);
        leadId = newLead.id;
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Add student to futures batch
      const { error: studentError } = await supabase
        .from("futures_mentorship_students")
        .insert({
          batch_id: batchId,
          lead_id: leadId,
          conversion_date: format(conversionDate, "yyyy-MM-dd"),
          offer_amount: offerNum,
          cash_received: cashNum,
          due_amount: dueNum,
          notes: notes || null,
          created_by: user?.id,
        });
      
      if (studentError) throw new Error(`Failed to add student: ${studentError.message}`);
      
      // If there's initial cash received, create first EMI record
      if (cashNum > 0) {
        await supabase.from("futures_emi_payments").insert({
          student_id: (await supabase
            .from("futures_mentorship_students")
            .select("id")
            .eq("batch_id", batchId)
            .eq("lead_id", leadId)
            .single()).data?.id,
          emi_number: 1,
          amount: cashNum,
          payment_date: format(conversionDate, "yyyy-MM-dd"),
          previous_cash_received: 0,
          created_by: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-students"] });
      queryClient.invalidateQueries({ queryKey: ["futures-batches"] });
      toast({ title: "Student added", description: `${customerName || selectedLead?.contact_name} has been added to ${batchName}` });
      handleClose();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (activeTab === "search" && !selectedLead) {
      toast({ title: "Error", description: "Please select a customer", variant: "destructive" });
      return;
    }
    
    if (activeTab === "new" && (!customerName.trim() || !email.trim())) {
      toast({ title: "Error", description: "Customer name and email are required", variant: "destructive" });
      return;
    }
    
    addStudentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Student</DialogTitle>
          <DialogDescription>
            Add a student to {batchName}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "new")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search Existing</TabsTrigger>
            <TabsTrigger value="new">Add New</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by email or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {searchResults.map((lead) => (
                  <div
                    key={lead.id}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 flex items-center justify-between",
                      selectedLead?.id === lead.id && "bg-primary/10"
                    )}
                    onClick={() => selectLead(lead)}
                  >
                    <div>
                      <p className="font-medium">{lead.contact_name}</p>
                      <p className="text-sm text-muted-foreground">{lead.email}</p>
                      {lead.phone && <p className="text-sm text-muted-foreground">{lead.phone}</p>}
                    </div>
                    {selectedLead?.id === lead.id && <Check className="h-5 w-5 text-primary" />}
                  </div>
                ))}
              </div>
            )}
            
            {selectedLead && (
              <div className="bg-muted/30 rounded-md p-3">
                <p className="text-sm font-medium">Selected: {selectedLead.contact_name}</p>
                <p className="text-sm text-muted-foreground">{selectedLead.email}</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="new" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            </div>
          </TabsContent>
        </Tabs>

        {/* Common fields for both tabs */}
        <div className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conversion Date</Label>
              <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(conversionDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={conversionDate}
                    onSelect={(d) => { if (d) setConversionDate(d); setIsDatePopoverOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Batch</Label>
              <Input value={batchName} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Offer Amount (₹)</Label>
              <Input type="number" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Cash Received (₹)</Label>
              <Input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addStudentMutation.isPending}>
            {addStudentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
