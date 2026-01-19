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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Search, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { PaymentPlatformSelect, getPlatformFeeRate, getPlatformFeesHint } from "@/components/PaymentPlatformSelect";

interface Lead {
  id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  country: string | null;
}

interface AddBatchStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchName: string;
  onSuccess: () => void;
}

const CLASSES_ACCESS_OPTIONS = Array.from({ length: 15 }, (_, i) => ({
  value: (i + 1).toString(),
  label: i + 1 === 15 ? "All Classes" : `${i + 1} Class${i + 1 > 1 ? "es" : ""}`,
}));

export function AddBatchStudentDialog({
  open,
  onOpenChange,
  batchId,
  batchName,
  onSuccess,
}: AddBatchStudentDialogProps) {
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
  const [classesAccess, setClassesAccess] = useState("1");
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  
  // Payment detail fields
  const [noCostEmi, setNoCostEmi] = useState("");
  const [gstFees, setGstFees] = useState("");
  const [platformFees, setPlatformFees] = useState("");
  const [paymentPlatform, setPaymentPlatform] = useState("UPI (IDFC)");
  const [paymentRemarks, setPaymentRemarks] = useState("");

  // Auto-calculate Platform Fees and GST based on Cash Collected and Payment Platform
  const calculatePaymentDetails = (cashAmount: number, platform: string) => {
    const feeRate = getPlatformFeeRate(platform);
    const platformFeesAmount = cashAmount * feeRate;
    const gst = (cashAmount / 1.18) * 0.18;
    return { platformFees: platformFeesAmount, gst };
  };

  const handleCashReceivedChange = (value: string) => {
    setCashReceived(value);
    const cash = parseFloat(value) || 0;
    if (cash > 0) {
      const { platformFees, gst } = calculatePaymentDetails(cash, paymentPlatform);
      setPlatformFees(platformFees.toFixed(2));
      setGstFees(gst.toFixed(2));
    } else {
      setPlatformFees("");
      setGstFees("");
    }
  };

  const handlePaymentPlatformChange = (platform: string) => {
    setPaymentPlatform(platform);
    const cash = parseFloat(cashReceived) || 0;
    if (cash > 0) {
      const { platformFees } = calculatePaymentDetails(cash, platform);
      setPlatformFees(platformFees.toFixed(2));
    }
  };

  const handlePlatformFeesChange = (value: string) => {
    setPlatformFees(value);
  };

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
    setClassesAccess("1");
    setActiveTab("search");
    setNoCostEmi("");
    setGstFees("");
    setPlatformFees("");
    setPaymentPlatform("UPI (IDFC)");
    setPaymentRemarks("");
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
      
      // Validate payment platform if cash received
      if (cashNum > 0 && !paymentPlatform) {
        throw new Error("Payment Platform is required when cash is received");
      }
      
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
            company_name: "Batch",
            source: "batch_manual",
          })
          .select("id")
          .single();
        
        if (leadError) throw new Error(`Failed to create lead: ${leadError.message}`);
        leadId = newLead.id;
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Add student to batch via call_appointments
      const { data: appointmentData, error: appointmentError } = await supabase
        .from("call_appointments")
        .insert({
          lead_id: leadId,
          batch_id: batchId,
          closer_id: user?.id,
          status: "converted",
          scheduled_date: format(conversionDate, "yyyy-MM-dd"),
          scheduled_time: "00:00:00",
          offer_amount: offerNum,
          cash_received: cashNum,
          due_amount: dueNum,
          classes_access: parseInt(classesAccess),
          additional_comments: notes || null,
          // New payment detail fields
          no_cost_emi: parseFloat(noCostEmi) || 0,
          gst_fees: parseFloat(gstFees) || 0,
          platform_fees: parseFloat(platformFees) || 0,
          payment_platform: cashNum > 0 ? paymentPlatform : null,
          payment_remarks: paymentRemarks || null,
          conversion_date: format(conversionDate, "yyyy-MM-dd"),
        })
        .select("id")
        .single();
      
      if (appointmentError) throw new Error(`Failed to add student: ${appointmentError.message}`);
      
      // If there's initial cash received, create first EMI record
      if (cashNum > 0 && appointmentData) {
        await supabase.from("emi_payments").insert({
          appointment_id: appointmentData.id,
          emi_number: 1,
          amount: cashNum,
          payment_date: format(conversionDate, "yyyy-MM-dd"),
          previous_cash_received: 0,
          previous_classes_access: 0,
          new_classes_access: parseInt(classesAccess),
          created_by: user?.id,
          // New payment detail fields
          no_cost_emi: parseFloat(noCostEmi) || 0,
          gst_fees: parseFloat(gstFees) || 0,
          platform_fees: parseFloat(platformFees) || 0,
          payment_platform: paymentPlatform,
          remarks: paymentRemarks || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-students"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
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
    
    const cashNum = parseFloat(cashReceived) || 0;
    if (cashNum > 0 && !paymentPlatform) {
      toast({ title: "Error", description: "Payment Platform is required when cash is received", variant: "destructive" });
      return;
    }
    
    addStudentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Add Student</DialogTitle>
          <DialogDescription>
            Add a student to {batchName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 min-h-0">
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
          <div className="space-y-4 pt-4 border-t mt-4">
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
                <Label>Cash Collected (₹)</Label>
                <Input type="number" value={cashReceived} onChange={(e) => handleCashReceivedChange(e.target.value)} placeholder="0" />
              </div>
            </div>
            
            {/* Payment Detail Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>No Cost EMI (₹)</Label>
                <Input type="number" value={noCostEmi} onChange={(e) => setNoCostEmi(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Platform Fees (₹)</Label>
                <Input type="number" value={platformFees} onChange={(e) => handlePlatformFeesChange(e.target.value)} placeholder="0" />
                {getPlatformFeesHint(paymentPlatform) && (
                  <p className="text-xs text-muted-foreground">{getPlatformFeesHint(paymentPlatform)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>GST Fees (₹)</Label>
                <Input type="number" value={gstFees} onChange={(e) => setGstFees(e.target.value)} placeholder="0" />
                <p className="text-xs text-muted-foreground">Cash ÷ 1.18 × 0.18</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Platform {parseFloat(cashReceived) > 0 ? "*" : ""}</Label>
                <PaymentPlatformSelect
                  value={paymentPlatform}
                  onValueChange={handlePaymentPlatformChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Classes Access</Label>
                <Select value={classesAccess} onValueChange={setClassesAccess}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select classes" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES_ACCESS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Payment Remarks (optional)</Label>
              <Textarea value={paymentRemarks} onChange={(e) => setPaymentRemarks(e.target.value)} placeholder="Any payment-related notes..." rows={2} />
            </div>
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." rows={2} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 mt-4">
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
