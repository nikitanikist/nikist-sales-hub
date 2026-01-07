import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface EmiPayment {
  id: string;
  appointment_id: string;
  emi_number: number;
  amount: number;
  payment_date: string;
  created_at: string;
  created_by: string | null;
  previous_classes_access: number | null;
  new_classes_access: number | null;
  created_by_profile?: { full_name: string } | null;
}

interface UpdateEmiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  offerAmount: number;
  cashReceived: number;
  dueAmount: number;
  classesAccess: number | null;
  batchId: string | null;
  customerName: string;
  onSuccess: () => void;
}

const CLASSES_ACCESS_OPTIONS = [
  { value: 1, label: "1 Class" },
  { value: 2, label: "2 Classes" },
  { value: 3, label: "3 Classes" },
  { value: 4, label: "4 Classes" },
  { value: 5, label: "5 Classes" },
  { value: 6, label: "6 Classes" },
  { value: 7, label: "7 Classes" },
  { value: 8, label: "8 Classes" },
  { value: 9, label: "9 Classes" },
  { value: 10, label: "10 Classes" },
  { value: 11, label: "11 Classes" },
  { value: 12, label: "12 Classes" },
  { value: 13, label: "13 Classes" },
  { value: 14, label: "14 Classes" },
  { value: 15, label: "All Classes" },
];

export function UpdateEmiDialog({
  open,
  onOpenChange,
  appointmentId,
  offerAmount,
  cashReceived,
  dueAmount,
  classesAccess,
  batchId,
  customerName,
  onSuccess,
}: UpdateEmiDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [emiAmount, setEmiAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [newClassesAccess, setNewClassesAccess] = useState<number | null>(classesAccess);
  const [newBatchId, setNewBatchId] = useState<string | null>(batchId);
  const [isSaving, setIsSaving] = useState(false);
  const [newOfferAmount, setNewOfferAmount] = useState<number>(offerAmount);
  const [isEditingOfferAmount, setIsEditingOfferAmount] = useState(false);
  
  // Local state for immediate UI updates
  const [displayCashReceived, setDisplayCashReceived] = useState(cashReceived);
  const [displayDueAmount, setDisplayDueAmount] = useState(dueAmount);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmiAmount("");
      setPaymentDate(new Date());
      setNewClassesAccess(classesAccess);
      setNewBatchId(batchId);
      setDisplayCashReceived(cashReceived);
      setDisplayDueAmount(dueAmount);
      setNewOfferAmount(offerAmount);
      setIsEditingOfferAmount(false);
    }
  }, [open, classesAccess, batchId, cashReceived, dueAmount, offerAmount]);

  // Fetch EMI payments for this appointment
  const { data: emiPayments, isLoading: isLoadingEmi } = useQuery({
    queryKey: ["emi-payments", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emi_payments")
        .select("*, created_by_profile:profiles!created_by(full_name)")
        .eq("appointment_id", appointmentId)
        .order("emi_number", { ascending: true });
      if (error) throw error;
      return data as EmiPayment[];
    },
    enabled: open,
  });

  // Fetch offer amount history for this appointment
  const { data: offerAmountHistory, isLoading: isLoadingOfferHistory } = useQuery({
    queryKey: ["offer-amount-history", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offer_amount_history")
        .select("*, changed_by_profile:profiles!changed_by(full_name)")
        .eq("appointment_id", appointmentId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch batches for dropdown
  const { data: batches } = useQuery({
    queryKey: ["batches-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select("id, name, start_date")
        .eq("is_active", true)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Calculate totals using newOfferAmount for real-time preview
  const effectiveOfferAmount = newOfferAmount;
  const remaining = Math.max(0, effectiveOfferAmount - displayCashReceived);
  const paymentProgress = effectiveOfferAmount > 0 ? (displayCashReceived / effectiveOfferAmount) * 100 : 0;
  const isFullyPaid = remaining === 0;
  const nextEmiNumber = (emiPayments?.length || 0) + 1;
  const hasOfferAmountChange = newOfferAmount !== offerAmount;

  // Unified save handler - saves both EMI and course access
  const handleSaveAll = async (options: { closeAfterSuccess: boolean }) => {
    const amount = parseFloat(emiAmount);
    const hasEmiToSave = !isNaN(amount) && amount > 0;
    const hasCourseAccessChanges = newClassesAccess !== classesAccess || newBatchId !== batchId;
    const offerAmountChanged = newOfferAmount !== offerAmount;

    // Check if there's anything to save
    if (!hasEmiToSave && !hasCourseAccessChanges && !offerAmountChanged) {
      toast({ 
        title: "Nothing to save", 
        description: "No changes detected",
      });
      return;
    }

    // Validate offer amount
    if (offerAmountChanged && newOfferAmount < displayCashReceived) {
      toast({ 
        title: "Invalid Offer Amount", 
        description: `Offer amount cannot be less than cash already received (₹${displayCashReceived.toLocaleString("en-IN")})`, 
        variant: "destructive" 
      });
      return;
    }

    // Validate EMI amount if present
    if (hasEmiToSave) {
      if (amount > remaining) {
        toast({ 
          title: "Amount Exceeds Due", 
          description: `EMI amount cannot exceed remaining due of ₹${remaining.toLocaleString("en-IN")}`, 
          variant: "destructive" 
        });
        return;
      }
    }

    setIsSaving(true);
    
    try {
      let newCashReceived = displayCashReceived;
      let newDueAmount = displayDueAmount;
      const messages: string[] = [];

      // Save EMI if present
      if (hasEmiToSave) {
        console.log("Adding EMI:", { appointmentId, amount, date: paymentDate, nextEmiNumber });
        
        // Get current user for audit
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        // Insert EMI payment with class access and cash tracking
        const { data: insertedData, error: emiError } = await supabase
          .from("emi_payments")
          .insert({
            appointment_id: appointmentId,
            emi_number: nextEmiNumber,
            amount: amount,
            payment_date: format(paymentDate, "yyyy-MM-dd"),
            previous_classes_access: classesAccess,
            new_classes_access: newClassesAccess,
            previous_cash_received: cashReceived,
            created_by: currentUser?.id,
          })
          .select()
          .single();

        if (emiError) {
          console.error("EMI Insert Error:", emiError);
          throw new Error(`Failed to add EMI: ${emiError.message}`);
        }
        
        console.log("EMI Inserted:", insertedData);

        // Calculate new values
        newCashReceived = displayCashReceived + amount;
        newDueAmount = Math.max(0, offerAmount - newCashReceived);

        messages.push(`EMI ${nextEmiNumber} recorded: ₹${amount.toLocaleString("en-IN")} on ${format(paymentDate, "dd MMM yyyy")}`);
      }

      // Update call_appointments with EMI amounts and/or course access
      const updatePayload: Record<string, unknown> = {};
      
      // Handle offer amount change first (recalculates due)
      if (offerAmountChanged) {
        // Get current user for audit
        const { data: { user } } = await supabase.auth.getUser();
        
        // Insert into offer_amount_history for audit trail
        const { error: historyError } = await supabase
          .from("offer_amount_history")
          .insert({
            appointment_id: appointmentId,
            previous_amount: offerAmount,
            new_amount: newOfferAmount,
            changed_by: user?.id,
          });
        
        if (historyError) {
          console.error("Offer history insert error:", historyError);
        }
        
        updatePayload.offer_amount = newOfferAmount;
        // Recalculate due based on new offer amount
        newDueAmount = Math.max(0, newOfferAmount - newCashReceived);
        updatePayload.due_amount = newDueAmount;
        messages.push(`Offer amount updated to ₹${newOfferAmount.toLocaleString("en-IN")}`);
      }
      
      if (hasEmiToSave) {
        updatePayload.cash_received = newCashReceived;
        // Only update due_amount if not already set by offer change
        if (!offerAmountChanged) {
          updatePayload.due_amount = newDueAmount;
        }
      }
      
      if (hasCourseAccessChanges) {
        updatePayload.classes_access = newClassesAccess;
        updatePayload.batch_id = newBatchId;
        messages.push("Course access updated");
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from("call_appointments")
          .update(updatePayload)
          .eq("id", appointmentId);

        if (updateError) {
          throw new Error(`Failed to update appointment: ${updateError.message}`);
        }
      }

      // Update local display values immediately
      if (hasEmiToSave) {
        setDisplayCashReceived(newCashReceived);
        setDisplayDueAmount(newDueAmount);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["emi-payments", appointmentId] });
      queryClient.invalidateQueries({ queryKey: ["emi-payments-inline", appointmentId] });
      queryClient.invalidateQueries({ queryKey: ["offer-amount-history", appointmentId] });
      queryClient.invalidateQueries({ queryKey: ["closer-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["batch-students"] });
      queryClient.invalidateQueries({ queryKey: ["workshop-metrics"] });

      // Show success toast
      toast({ 
        title: "Saved Successfully", 
        description: messages.join(". "),
      });

      // Reset EMI form fields
      setEmiAmount("");
      setPaymentDate(new Date());
      
      onSuccess();

      if (options.closeAfterSuccess) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Save error:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to save changes", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update EMI & Course Access</DialogTitle>
          <DialogDescription>
            Manage EMI payments and course access for {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Payment Summary
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Offer Amount</p>
                <p className="text-lg font-semibold">
                  ₹{effectiveOfferAmount.toLocaleString("en-IN")}
                  {hasOfferAmountChange && (
                    <span className="text-sm text-amber-600 ml-2">
                      (was ₹{offerAmount.toLocaleString("en-IN")})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Received</p>
                <p className="text-lg font-semibold text-green-600">₹{displayCashReceived.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining Due</p>
                <p className={cn("text-lg font-semibold", isFullyPaid ? "text-green-600" : "text-red-600")}>
                  ₹{remaining.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Payment Progress</span>
                <span>{Math.round(paymentProgress)}%</span>
              </div>
              <Progress value={paymentProgress} className="h-2" />
            </div>
            {isFullyPaid && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-md px-3 py-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Fully Paid</span>
              </div>
            )}
          </div>

          {/* Update Offer Amount - Collapsible */}
          <div className="space-y-3 rounded-lg border p-4 bg-amber-50/50 border-amber-200">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-amber-700">
                Update Offer Amount
              </h4>
              {!isEditingOfferAmount ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditingOfferAmount(true)}
                >
                  Edit Offer
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setIsEditingOfferAmount(false);
                    setNewOfferAmount(offerAmount);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
            
            {!isEditingOfferAmount ? (
              <p className="text-lg font-semibold">
                Current: ₹{offerAmount.toLocaleString("en-IN")}
              </p>
            ) : (
              <>
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>New Offer Amount (₹)</Label>
                    <Input
                      type="number"
                      placeholder="Enter new offer amount"
                      value={newOfferAmount}
                      onChange={(e) => setNewOfferAmount(parseFloat(e.target.value) || 0)}
                      autoFocus
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Original: ₹{offerAmount.toLocaleString("en-IN")}</p>
                    {hasOfferAmountChange && (
                      <p className="text-amber-600 font-medium">
                        New Due: ₹{Math.max(0, newOfferAmount - displayCashReceived).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>
                {newOfferAmount < displayCashReceived && (
                  <p className="text-red-500 text-sm">
                    Warning: Offer amount cannot be less than cash already received (₹{displayCashReceived.toLocaleString("en-IN")})
                  </p>
                )}
              </>
            )}
          </div>

          {/* Offer Amount Change History */}
          {offerAmountHistory && offerAmountHistory.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Offer Amount Change History
              </h4>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-left px-4 py-2 font-medium">Previous</th>
                      <th className="text-left px-4 py-2 font-medium">New</th>
                      <th className="text-left px-4 py-2 font-medium">Changed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerAmountHistory.map((record: any) => (
                      <tr key={record.id} className="border-t">
                        <td className="px-4 py-2">{format(new Date(record.changed_at), "dd MMM yyyy, hh:mm a")}</td>
                        <td className="px-4 py-2 text-red-600">₹{Number(record.previous_amount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2 text-green-600">₹{Number(record.new_amount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2 text-muted-foreground">{record.changed_by_profile?.full_name || "Unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EMI Payment History */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              EMI Payment History
            </h4>
            {isLoadingEmi ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : emiPayments && emiPayments.length > 0 ? (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">EMI #</th>
                      <th className="text-left px-4 py-2 font-medium">Amount</th>
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-left px-4 py-2 font-medium">Classes</th>
                      <th className="text-left px-4 py-2 font-medium">Updated By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emiPayments.map((emi) => (
                      <tr key={emi.id} className="border-t">
                        <td className="px-4 py-2">EMI {emi.emi_number}</td>
                        <td className="px-4 py-2 text-green-600">₹{Number(emi.amount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2">{format(new Date(emi.payment_date), "dd MMM yyyy")}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {emi.previous_classes_access && emi.new_classes_access && emi.previous_classes_access !== emi.new_classes_access
                            ? `${emi.previous_classes_access} → ${emi.new_classes_access}`
                            : emi.new_classes_access || emi.previous_classes_access || "-"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {emi.created_by_profile?.full_name || "Unknown"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">No EMI payments recorded yet</p>
            )}
          </div>

          {/* Add New EMI */}
          {!isFullyPaid && (
            <div className="space-y-3 rounded-lg border p-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Add EMI {nextEmiNumber} Payment
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder={`Max ₹${remaining.toLocaleString("en-IN")}`}
                    value={emiAmount}
                    onChange={(e) => setEmiAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(paymentDate, "dd MMM yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={paymentDate}
                        onSelect={(date) => {
                          if (date) setPaymentDate(date);
                          setIsDatePopoverOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button 
                onClick={() => handleSaveAll({ closeAfterSuccess: false })} 
                disabled={isSaving || isLoadingEmi || !emiAmount}
                className="w-full"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add EMI {nextEmiNumber}
              </Button>
            </div>
          )}

          {/* Course Access */}
          <div className="space-y-3 rounded-lg border p-4">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Course Access
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classes Access</Label>
                <Select
                  value={newClassesAccess?.toString() || ""}
                  onValueChange={(value) => setNewClassesAccess(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select classes" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES_ACCESS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Batch</Label>
                <Select
                  value={newBatchId || ""}
                  onValueChange={(value) => setNewBatchId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches?.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name} - {format(new Date(batch.start_date), "dd MMM")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button 
            onClick={() => handleSaveAll({ closeAfterSuccess: true })}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
