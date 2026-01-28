import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, Plus, Loader2, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { PaymentPlatformSelect, getPlatformFeeRate, getPlatformFeesHint } from "@/components/PaymentPlatformSelect";
import { useOrganization } from "@/hooks/useOrganization";

interface CohortEmiPayment {
  id: string;
  student_id: string;
  emi_number: number;
  amount: number;
  payment_date: string;
  created_at: string;
  created_by: string | null;
  created_by_profile?: { full_name: string } | null;
  no_cost_emi: number | null;
  gst_fees: number | null;
  platform_fees: number | null;
  payment_platform: string | null;
  remarks: string | null;
}

interface UpdateCohortEmiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  offerAmount: number;
  cashReceived: number;
  dueAmount: number;
  customerName: string;
  onSuccess: () => void;
}

export function UpdateCohortEmiDialog({
  open,
  onOpenChange,
  studentId,
  offerAmount,
  cashReceived,
  dueAmount,
  customerName,
  onSuccess,
}: UpdateCohortEmiDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  
  const [emiAmount, setEmiAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newOfferAmount, setNewOfferAmount] = useState<number>(offerAmount);
  const [isEditingOfferAmount, setIsEditingOfferAmount] = useState(false);
  
  const [displayCashReceived, setDisplayCashReceived] = useState(cashReceived);
  const [displayDueAmount, setDisplayDueAmount] = useState(dueAmount);
  
  const [editingEmi, setEditingEmi] = useState<CohortEmiPayment | null>(null);
  const [editEmiAmount, setEditEmiAmount] = useState<string>("");
  const [editEmiDate, setEditEmiDate] = useState<Date>(new Date());
  const [isEditDatePopoverOpen, setIsEditDatePopoverOpen] = useState(false);
  const [deletingEmi, setDeletingEmi] = useState<CohortEmiPayment | null>(null);
  const [isProcessingEmi, setIsProcessingEmi] = useState(false);
  
  const [newNoCostEmi, setNewNoCostEmi] = useState("");
  const [newGstFees, setNewGstFees] = useState("");
  const [newPlatformFees, setNewPlatformFees] = useState("");
  const [newPaymentPlatform, setNewPaymentPlatform] = useState("UPI (IDFC)");
  const [newRemarks, setNewRemarks] = useState("");
  
  const [editNoCostEmi, setEditNoCostEmi] = useState("");
  const [editGstFees, setEditGstFees] = useState("");
  const [editPlatformFees, setEditPlatformFees] = useState("");
  const [editPaymentPlatform, setEditPaymentPlatform] = useState("UPI (IDFC)");
  const [editRemarks, setEditRemarks] = useState("");

  const calculatePaymentDetails = (cashAmount: number, platform: string) => {
    const feeRate = getPlatformFeeRate(platform);
    const platformFees = cashAmount * feeRate;
    const gst = (cashAmount / 1.18) * 0.18;
    return { platformFees, gst };
  };

  const handleEmiAmountChange = (value: string) => {
    setEmiAmount(value);
    const cash = parseFloat(value) || 0;
    if (cash > 0) {
      const { platformFees, gst } = calculatePaymentDetails(cash, newPaymentPlatform);
      setNewPlatformFees(platformFees.toFixed(2));
      setNewGstFees(gst.toFixed(2));
    } else {
      setNewPlatformFees("");
      setNewGstFees("");
    }
  };

  const handleNewPaymentPlatformChange = (platform: string) => {
    setNewPaymentPlatform(platform);
    const cash = parseFloat(emiAmount) || 0;
    if (cash > 0) {
      const { platformFees } = calculatePaymentDetails(cash, platform);
      setNewPlatformFees(platformFees.toFixed(2));
    }
  };

  const handleEditEmiAmountChange = (value: string) => {
    setEditEmiAmount(value);
    const cash = parseFloat(value) || 0;
    if (cash > 0) {
      const { platformFees, gst } = calculatePaymentDetails(cash, editPaymentPlatform);
      setEditPlatformFees(platformFees.toFixed(2));
      setEditGstFees(gst.toFixed(2));
    } else {
      setEditPlatformFees("");
      setEditGstFees("");
    }
  };

  const handleEditPaymentPlatformChange = (platform: string) => {
    setEditPaymentPlatform(platform);
    const cash = parseFloat(editEmiAmount) || 0;
    if (cash > 0) {
      const { platformFees } = calculatePaymentDetails(cash, platform);
      setEditPlatformFees(platformFees.toFixed(2));
    }
  };

  const handleNewPlatformFeesChange = (value: string) => {
    setNewPlatformFees(value);
    const cash = parseFloat(emiAmount) || 0;
    if (cash > 0) {
      const gst = (cash / 1.18) * 0.18;
      setNewGstFees(gst.toFixed(2));
    }
  };

  const handleEditPlatformFeesChange = (value: string) => {
    setEditPlatformFees(value);
    const cash = parseFloat(editEmiAmount) || 0;
    if (cash > 0) {
      const gst = (cash / 1.18) * 0.18;
      setEditGstFees(gst.toFixed(2));
    }
  };

  useEffect(() => {
    if (open) {
      setEmiAmount("");
      setPaymentDate(new Date());
      setDisplayCashReceived(cashReceived);
      setDisplayDueAmount(dueAmount);
      setNewOfferAmount(offerAmount);
      setIsEditingOfferAmount(false);
      setNewNoCostEmi("");
      setNewGstFees("");
      setNewPlatformFees("");
      setNewPaymentPlatform("UPI (IDFC)");
      setNewRemarks("");
    }
  }, [open, cashReceived, dueAmount, offerAmount]);

  const { data: emiPayments, isLoading: isLoadingEmi } = useQuery({
    queryKey: ["cohort-emi-payments", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohort_emi_payments")
        .select("*")
        .eq("student_id", studentId)
        .order("emi_number", { ascending: true });
      if (error) throw error;
      
      const createdByIds = [...new Set((data || []).map(emi => emi.created_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (createdByIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", createdByIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p.full_name }), {} as Record<string, string>);
      }
      
      return (data || []).map(emi => ({
        ...emi,
        created_by_profile: emi.created_by ? { full_name: profilesMap[emi.created_by] || "Unknown" } : null
      })) as CohortEmiPayment[];
    },
    enabled: open,
  });

  const { data: offerAmountHistory } = useQuery({
    queryKey: ["cohort-offer-history", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohort_offer_amount_history")
        .select("*")
        .eq("student_id", studentId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const effectiveOfferAmount = newOfferAmount;
  const remaining = Math.max(0, effectiveOfferAmount - displayCashReceived);
  const paymentProgress = effectiveOfferAmount > 0 ? (displayCashReceived / effectiveOfferAmount) * 100 : 0;
  const isFullyPaid = remaining === 0;
  const nextEmiNumber = (emiPayments?.length || 0) + 1;
  const hasOfferAmountChange = newOfferAmount !== offerAmount;

  const recalculateStudent = async (emiPaymentsList: CohortEmiPayment[]) => {
    const totalEmiPayments = emiPaymentsList.reduce((sum, emi) => sum + Number(emi.amount), 0);
    const newCashReceived = totalEmiPayments;
    const newDue = Math.max(0, offerAmount - newCashReceived);
    
    const { error } = await supabase
      .from("cohort_students")
      .update({ cash_received: newCashReceived, due_amount: newDue })
      .eq("id", studentId);
    
    if (error) throw error;
    return { newCashReceived, newDue };
  };

  const handleDeleteEmi = async () => {
    if (!deletingEmi) return;
    
    setIsProcessingEmi(true);
    try {
      const { error: deleteError } = await supabase
        .from("cohort_emi_payments")
        .delete()
        .eq("id", deletingEmi.id);
      
      if (deleteError) throw deleteError;
      
      const remainingEmis = (emiPayments || []).filter(e => e.id !== deletingEmi.id);
      const { newCashReceived, newDue } = await recalculateStudent(remainingEmis);
      
      setDisplayCashReceived(newCashReceived);
      setDisplayDueAmount(newDue);
      
      queryClient.invalidateQueries({ queryKey: ["cohort-emi-payments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-students"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-emi"] });
      
      toast({ title: "EMI Deleted", description: `EMI ${deletingEmi.emi_number} has been removed` });
      setDeletingEmi(null);
      onSuccess();
    } catch (error) {
      toast({ title: "Delete Failed", description: error instanceof Error ? error.message : "Failed to delete EMI", variant: "destructive" });
    } finally {
      setIsProcessingEmi(false);
    }
  };

  const handleUpdateEmi = async () => {
    if (!editingEmi) return;
    
    const newAmount = parseFloat(editEmiAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    
    if (!editPaymentPlatform) {
      toast({ title: "Error", description: "Payment Platform is required", variant: "destructive" });
      return;
    }
    
    setIsProcessingEmi(true);
    try {
      const { error: updateError } = await supabase
        .from("cohort_emi_payments")
        .update({ 
          amount: newAmount, 
          payment_date: format(editEmiDate, "yyyy-MM-dd"),
          no_cost_emi: parseFloat(editNoCostEmi) || 0,
          gst_fees: parseFloat(editGstFees) || 0,
          platform_fees: parseFloat(editPlatformFees) || 0,
          payment_platform: editPaymentPlatform,
          remarks: editRemarks || null,
        })
        .eq("id", editingEmi.id);
      
      if (updateError) throw updateError;
      
      const updatedEmis = (emiPayments || []).map(e => 
        e.id === editingEmi.id ? { ...e, amount: newAmount } : e
      );
      const { newCashReceived, newDue } = await recalculateStudent(updatedEmis);
      
      setDisplayCashReceived(newCashReceived);
      setDisplayDueAmount(newDue);
      
      queryClient.invalidateQueries({ queryKey: ["cohort-emi-payments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-students"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-emi"] });
      
      toast({ title: "EMI Updated", description: `EMI ${editingEmi.emi_number} updated to ₹${newAmount.toLocaleString("en-IN")}` });
      setEditingEmi(null);
      onSuccess();
    } catch (error) {
      toast({ title: "Update Failed", description: error instanceof Error ? error.message : "Failed to update EMI", variant: "destructive" });
    } finally {
      setIsProcessingEmi(false);
    }
  };

  const handleSaveAll = async (options: { closeAfterSuccess: boolean }) => {
    if (!currentOrganization) {
      toast({ title: "Error", description: "No organization selected", variant: "destructive" });
      return;
    }
    
    const amount = parseFloat(emiAmount);
    const hasEmiToSave = !isNaN(amount) && amount > 0;
    const offerAmountChanged = newOfferAmount !== offerAmount;

    if (!hasEmiToSave && !offerAmountChanged) {
      toast({ title: "Nothing to save", description: "No changes detected" });
      return;
    }

    if (offerAmountChanged && newOfferAmount < displayCashReceived) {
      toast({ title: "Invalid Offer Amount", description: `Offer amount cannot be less than cash already received (₹${displayCashReceived.toLocaleString("en-IN")})`, variant: "destructive" });
      return;
    }

    if (hasEmiToSave && amount > remaining) {
      toast({ title: "Amount Exceeds Due", description: `EMI amount cannot exceed remaining due of ₹${remaining.toLocaleString("en-IN")}`, variant: "destructive" });
      return;
    }
    
    if (hasEmiToSave && !newPaymentPlatform) {
      toast({ title: "Error", description: "Payment Platform is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    
    try {
      let newCashReceived = displayCashReceived;
      let newDueAmount = displayDueAmount;
      const messages: string[] = [];

      if (hasEmiToSave) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        const { error: emiError } = await supabase
          .from("cohort_emi_payments")
          .insert({
            student_id: studentId,
            emi_number: nextEmiNumber,
            amount: amount,
            payment_date: format(paymentDate, "yyyy-MM-dd"),
            previous_cash_received: cashReceived,
            created_by: currentUser?.id,
            organization_id: currentOrganization.id,
            no_cost_emi: parseFloat(newNoCostEmi) || 0,
            gst_fees: parseFloat(newGstFees) || 0,
            platform_fees: parseFloat(newPlatformFees) || 0,
            payment_platform: newPaymentPlatform,
            remarks: newRemarks || null,
          });

        if (emiError) throw new Error(`Failed to add EMI: ${emiError.message}`);

        newCashReceived = displayCashReceived + amount;
        newDueAmount = Math.max(0, offerAmount - newCashReceived);
        messages.push(`EMI ${nextEmiNumber} recorded: ₹${amount.toLocaleString("en-IN")}`);
      }

      const updatePayload: Record<string, unknown> = {};
      
      if (offerAmountChanged) {
        const { data: { user } } = await supabase.auth.getUser();
        
        await supabase.from("cohort_offer_amount_history").insert({
          student_id: studentId,
          previous_amount: offerAmount,
          new_amount: newOfferAmount,
          changed_by: user?.id,
          organization_id: currentOrganization.id,
        });
        
        updatePayload.offer_amount = newOfferAmount;
        newDueAmount = Math.max(0, newOfferAmount - newCashReceived);
        updatePayload.due_amount = newDueAmount;
        messages.push(`Offer amount updated to ₹${newOfferAmount.toLocaleString("en-IN")}`);
      }
      
      if (hasEmiToSave) {
        updatePayload.cash_received = newCashReceived;
        if (!offerAmountChanged) {
          updatePayload.due_amount = newDueAmount;
        }
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from("cohort_students")
          .update(updatePayload)
          .eq("id", studentId);

        if (updateError) throw new Error(`Failed to update student: ${updateError.message}`);
      }

      if (hasEmiToSave) {
        setDisplayCashReceived(newCashReceived);
        setDisplayDueAmount(newDueAmount);
      }

      queryClient.invalidateQueries({ queryKey: ["cohort-emi-payments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-offer-history", studentId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-students"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-emi"] });

      toast({ title: "Saved Successfully", description: messages.join(". ") });
      setEmiAmount("");
      setPaymentDate(new Date());
      setNewNoCostEmi("");
      setNewGstFees("");
      setNewPlatformFees("");
      setNewPaymentPlatform("UPI (IDFC)");
      setNewRemarks("");
      onSuccess();

      if (options.closeAfterSuccess) {
        onOpenChange(false);
      }
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update EMI</DialogTitle>
          <DialogDescription>
            Manage EMI payments for {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Amount</span>
              <div className="flex items-center gap-2">
                {isEditingOfferAmount ? (
                  <Input
                    type="number"
                    value={newOfferAmount}
                    onChange={(e) => setNewOfferAmount(parseFloat(e.target.value) || 0)}
                    className="w-32 h-8"
                    autoFocus
                    onBlur={() => setIsEditingOfferAmount(false)}
                    onKeyDown={(e) => e.key === "Enter" && setIsEditingOfferAmount(false)}
                  />
                ) : (
                  <span 
                    className="font-semibold cursor-pointer hover:text-primary"
                    onClick={() => setIsEditingOfferAmount(true)}
                    title="Click to edit"
                  >
                    ₹{effectiveOfferAmount.toLocaleString("en-IN")}
                  </span>
                )}
                {hasOfferAmountChange && (
                  <span className="text-xs text-amber-600">(Changed from ₹{offerAmount.toLocaleString("en-IN")})</span>
                )}
              </div>
            </div>
            <Progress value={paymentProgress} className="h-2" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Paid</span>
                <p className="font-semibold text-green-600">₹{displayCashReceived.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Remaining</span>
                <p className={cn("font-semibold", isFullyPaid ? "text-green-600" : "text-orange-600")}>
                  {isFullyPaid ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Paid in Full
                    </span>
                  ) : (
                    `₹${remaining.toLocaleString("en-IN")}`
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* EMI History */}
          <div className="space-y-2">
            <h4 className="font-medium">Payment History</h4>
            {isLoadingEmi ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : emiPayments && emiPayments.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {emiPayments.map((emi) => (
                  <div key={emi.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">EMI {emi.emi_number}</span>
                        <span className="text-green-600 font-semibold">₹{Number(emi.amount).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(emi.payment_date), "dd MMM yyyy")} • {emi.payment_platform || "-"}
                        {emi.created_by_profile && ` • by ${emi.created_by_profile.full_name}`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingEmi(emi);
                          setEditEmiAmount(String(emi.amount));
                          setEditEmiDate(new Date(emi.payment_date));
                          setEditNoCostEmi(String(emi.no_cost_emi || 0));
                          setEditGstFees(String(emi.gst_fees || 0));
                          setEditPlatformFees(String(emi.platform_fees || 0));
                          setEditPaymentPlatform(emi.payment_platform || "UPI (IDFC)");
                          setEditRemarks(emi.remarks || "");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeletingEmi(emi)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded yet</p>
            )}
          </div>

          {/* Add New EMI */}
          {!isFullyPaid && (
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add EMI {nextEmiNumber}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    value={emiAmount}
                    onChange={(e) => handleEmiAmountChange(e.target.value)}
                    placeholder={`Max: ₹${remaining.toLocaleString("en-IN")}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(paymentDate, "dd MMM yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={paymentDate}
                        onSelect={(d) => { if (d) setPaymentDate(d); setIsDatePopoverOpen(false); }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>No Cost EMI (₹)</Label>
                  <Input type="number" value={newNoCostEmi} onChange={(e) => setNewNoCostEmi(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Platform Fees (₹)</Label>
                  <Input type="number" value={newPlatformFees} onChange={(e) => handleNewPlatformFeesChange(e.target.value)} placeholder="0" />
                  {getPlatformFeesHint(newPaymentPlatform) && (
                    <p className="text-xs text-muted-foreground">{getPlatformFeesHint(newPaymentPlatform)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>GST (₹)</Label>
                  <Input type="number" value={newGstFees} onChange={(e) => setNewGstFees(e.target.value)} placeholder="0" />
                  <p className="text-xs text-muted-foreground">Cash ÷ 1.18 × 0.18</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Platform *</Label>
                <PaymentPlatformSelect value={newPaymentPlatform} onValueChange={handleNewPaymentPlatformChange} />
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea value={newRemarks} onChange={(e) => setNewRemarks(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => handleSaveAll({ closeAfterSuccess: false })} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
          <Button onClick={() => handleSaveAll({ closeAfterSuccess: true })} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Edit EMI Dialog */}
      <Dialog open={!!editingEmi} onOpenChange={(open) => !open && setEditingEmi(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit EMI {editingEmi?.emi_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" value={editEmiAmount} onChange={(e) => handleEditEmiAmountChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover open={isEditDatePopoverOpen} onOpenChange={setIsEditDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(editEmiDate, "dd MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={editEmiDate}
                      onSelect={(d) => { if (d) setEditEmiDate(d); setIsEditDatePopoverOpen(false); }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>No Cost EMI</Label>
                <Input type="number" value={editNoCostEmi} onChange={(e) => setEditNoCostEmi(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Platform Fees</Label>
                <Input type="number" value={editPlatformFees} onChange={(e) => handleEditPlatformFeesChange(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>GST</Label>
                <Input type="number" value={editGstFees} onChange={(e) => setEditGstFees(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Platform</Label>
              <PaymentPlatformSelect value={editPaymentPlatform} onValueChange={handleEditPaymentPlatformChange} />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} placeholder="Optional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEmi(null)}>Cancel</Button>
            <Button onClick={handleUpdateEmi} disabled={isProcessingEmi}>
              {isProcessingEmi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete EMI Confirmation */}
      <AlertDialog open={!!deletingEmi} onOpenChange={(open) => !open && setDeletingEmi(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete EMI {deletingEmi?.emi_number}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment of ₹{Number(deletingEmi?.amount || 0).toLocaleString("en-IN")}? 
              This will recalculate the student's balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmi} className="bg-destructive hover:bg-destructive/90">
              {isProcessingEmi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
