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
import { PaymentPlatformSelect } from "@/components/PaymentPlatformSelect";

interface HighFutureEmiPayment {
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

interface UpdateHighFutureEmiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  offerAmount: number;
  cashReceived: number;
  dueAmount: number;
  customerName: string;
  onSuccess: () => void;
}

export function UpdateHighFutureEmiDialog({
  open,
  onOpenChange,
  studentId,
  offerAmount,
  cashReceived,
  dueAmount,
  customerName,
  onSuccess,
}: UpdateHighFutureEmiDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [emiAmount, setEmiAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newOfferAmount, setNewOfferAmount] = useState<number>(offerAmount);
  const [isEditingOfferAmount, setIsEditingOfferAmount] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Local state for immediate UI updates
  const [displayCashReceived, setDisplayCashReceived] = useState(cashReceived);
  const [displayDueAmount, setDisplayDueAmount] = useState(dueAmount);
  
  // State for editing/deleting individual EMIs
  const [editingEmi, setEditingEmi] = useState<HighFutureEmiPayment | null>(null);
  const [editEmiAmount, setEditEmiAmount] = useState<string>("");
  const [editEmiDate, setEditEmiDate] = useState<Date>(new Date());
  const [isEditDatePopoverOpen, setIsEditDatePopoverOpen] = useState(false);
  const [deletingEmi, setDeletingEmi] = useState<HighFutureEmiPayment | null>(null);
  const [isProcessingEmi, setIsProcessingEmi] = useState(false);
  
  // New payment detail fields for Add EMI form
  const [newNoCostEmi, setNewNoCostEmi] = useState("");
  const [newGstFees, setNewGstFees] = useState("");
  const [newPlatformFees, setNewPlatformFees] = useState("");
  const [newPaymentPlatform, setNewPaymentPlatform] = useState("UPI (IDFC)");
  const [newRemarks, setNewRemarks] = useState("");
  
  // New payment detail fields for Edit EMI dialog
  const [editNoCostEmi, setEditNoCostEmi] = useState("");
  const [editGstFees, setEditGstFees] = useState("");
  const [editPlatformFees, setEditPlatformFees] = useState("");
  const [editPaymentPlatform, setEditPaymentPlatform] = useState("UPI (IDFC)");
  const [editRemarks, setEditRemarks] = useState("");

  // Auto-calculate Platform Fees and GST based on Cash Collected
  const calculatePaymentDetails = (cashAmount: number) => {
    const platformFees = cashAmount * 0.025; // 2.5% of cash collected
    const gst = (cashAmount / 1.18) * 0.18; // GST extracted from GST-inclusive amount
    return { platformFees, gst };
  };

  // Handler for new EMI amount change
  const handleEmiAmountChange = (value: string) => {
    setEmiAmount(value);
    const cash = parseFloat(value) || 0;
    if (cash > 0) {
      const { platformFees, gst } = calculatePaymentDetails(cash);
      setNewPlatformFees(platformFees.toFixed(2));
      setNewGstFees(gst.toFixed(2));
    } else {
      setNewPlatformFees("");
      setNewGstFees("");
    }
  };

  // Handler for edit EMI amount change
  const handleEditEmiAmountChange = (value: string) => {
    setEditEmiAmount(value);
    const cash = parseFloat(value) || 0;
    if (cash > 0) {
      const { platformFees, gst } = calculatePaymentDetails(cash);
      setEditPlatformFees(platformFees.toFixed(2));
      setEditGstFees(gst.toFixed(2));
    } else {
      setEditPlatformFees("");
      setEditGstFees("");
    }
  };

  // Handler for new EMI platform fees change - recalculates GST
  const handleNewPlatformFeesChange = (value: string) => {
    setNewPlatformFees(value);
    const cash = parseFloat(emiAmount) || 0;
    if (cash > 0) {
      const gst = (cash / 1.18) * 0.18;
      setNewGstFees(gst.toFixed(2));
    }
  };

  // Handler for edit EMI platform fees change - recalculates GST
  const handleEditPlatformFeesChange = (value: string) => {
    setEditPlatformFees(value);
    const cash = parseFloat(editEmiAmount) || 0;
    if (cash > 0) {
      const gst = (cash / 1.18) * 0.18;
      setEditGstFees(gst.toFixed(2));
    }
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmiAmount("");
      setPaymentDate(new Date());
      setDisplayCashReceived(cashReceived);
      setDisplayDueAmount(dueAmount);
      setNewOfferAmount(offerAmount);
      setIsEditingOfferAmount(false);
      // Reset new EMI fields
      setNewNoCostEmi("");
      setNewGstFees("");
      setNewPlatformFees("");
      setNewPaymentPlatform("UPI (IDFC)");
      setNewRemarks("");
    }
  }, [open, cashReceived, dueAmount, offerAmount]);

  // Fetch EMI payments for this student
  const { data: emiPayments, isLoading: isLoadingEmi } = useQuery({
    queryKey: ["high-future-emi-payments", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("high_future_emi_payments")
        .select("*")
        .eq("student_id", studentId)
        .order("emi_number", { ascending: true });
      if (error) throw error;
      return data as HighFutureEmiPayment[];
    },
    enabled: open,
  });

  // Fetch offer amount history
  const { data: offerAmountHistory } = useQuery({
    queryKey: ["high-future-offer-history", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("high_future_offer_amount_history")
        .select("*")
        .eq("student_id", studentId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Calculate totals
  const effectiveOfferAmount = newOfferAmount;
  const remaining = Math.max(0, effectiveOfferAmount - displayCashReceived);
  const paymentProgress = effectiveOfferAmount > 0 ? (displayCashReceived / effectiveOfferAmount) * 100 : 0;
  const isFullyPaid = remaining === 0;
  const nextEmiNumber = (emiPayments?.length || 0) + 1;
  const hasOfferAmountChange = newOfferAmount !== offerAmount;

  // Recalculate student after EMI changes
  const recalculateStudent = async (emiPaymentsList: HighFutureEmiPayment[]) => {
    const totalEmiPayments = emiPaymentsList.reduce((sum, emi) => sum + Number(emi.amount), 0);
    const newCashReceived = totalEmiPayments;
    const newDue = Math.max(0, offerAmount - newCashReceived);
    
    const { error } = await supabase
      .from("high_future_students")
      .update({ cash_received: newCashReceived, due_amount: newDue })
      .eq("id", studentId);
    
    if (error) throw error;
    return { newCashReceived, newDue };
  };

  // Handle delete EMI
  const handleDeleteEmi = async () => {
    if (!deletingEmi) return;
    
    setIsProcessingEmi(true);
    try {
      const { error: deleteError } = await supabase
        .from("high_future_emi_payments")
        .delete()
        .eq("id", deletingEmi.id);
      
      if (deleteError) throw deleteError;
      
      const remainingEmis = (emiPayments || []).filter(e => e.id !== deletingEmi.id);
      const { newCashReceived, newDue } = await recalculateStudent(remainingEmis);
      
      setDisplayCashReceived(newCashReceived);
      setDisplayDueAmount(newDue);
      
      queryClient.invalidateQueries({ queryKey: ["high-future-emi-payments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["high-future-students"] });
      queryClient.invalidateQueries({ queryKey: ["high-future-emi"] });
      
      toast({ title: "EMI Deleted", description: `EMI ${deletingEmi.emi_number} has been removed` });
      setDeletingEmi(null);
      onSuccess();
    } catch (error) {
      toast({ title: "Delete Failed", description: error instanceof Error ? error.message : "Failed to delete EMI", variant: "destructive" });
    } finally {
      setIsProcessingEmi(false);
    }
  };

  // Handle update EMI
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
        .from("high_future_emi_payments")
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
      
      queryClient.invalidateQueries({ queryKey: ["high-future-emi-payments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["high-future-students"] });
      queryClient.invalidateQueries({ queryKey: ["high-future-emi"] });
      
      toast({ title: "EMI Updated", description: `EMI ${editingEmi.emi_number} updated to ₹${newAmount.toLocaleString("en-IN")}` });
      setEditingEmi(null);
      onSuccess();
    } catch (error) {
      toast({ title: "Update Failed", description: error instanceof Error ? error.message : "Failed to update EMI", variant: "destructive" });
    } finally {
      setIsProcessingEmi(false);
    }
  };

  // Save all changes
  const handleSaveAll = async (options: { closeAfterSuccess: boolean }) => {
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

      // Save EMI if present
      if (hasEmiToSave) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        const { error: emiError } = await supabase
          .from("high_future_emi_payments")
          .insert({
            student_id: studentId,
            emi_number: nextEmiNumber,
            amount: amount,
            payment_date: format(paymentDate, "yyyy-MM-dd"),
            previous_cash_received: cashReceived,
            created_by: currentUser?.id,
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

      // Update student record
      const updatePayload: Record<string, unknown> = {};
      
      if (offerAmountChanged) {
        const { data: { user } } = await supabase.auth.getUser();
        
        await supabase.from("high_future_offer_amount_history").insert({
          student_id: studentId,
          previous_amount: offerAmount,
          new_amount: newOfferAmount,
          changed_by: user?.id,
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
          .from("high_future_students")
          .update(updatePayload)
          .eq("id", studentId);

        if (updateError) throw new Error(`Failed to update student: ${updateError.message}`);
      }

      if (hasEmiToSave) {
        setDisplayCashReceived(newCashReceived);
        setDisplayDueAmount(newDueAmount);
      }

      queryClient.invalidateQueries({ queryKey: ["high-future-emi-payments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["high-future-offer-history", studentId] });
      queryClient.invalidateQueries({ queryKey: ["high-future-students"] });
      queryClient.invalidateQueries({ queryKey: ["high-future-emi"] });

      toast({ title: "Saved Successfully", description: messages.join(". ") });
      setEmiAmount("");
      setPaymentDate(new Date());
      // Reset new EMI fields
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
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Payment Summary
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Offer Amount</p>
                <p className="text-lg font-semibold">
                  ₹{effectiveOfferAmount.toLocaleString("en-IN")}
                  {hasOfferAmountChange && (
                    <span className="text-sm text-amber-600 ml-2">(was ₹{offerAmount.toLocaleString("en-IN")})</span>
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

          {/* Update Offer Amount */}
          <div className="space-y-3 rounded-lg border p-4 bg-amber-50/50 border-amber-200">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-amber-700">Update Offer Amount</h4>
              {!isEditingOfferAmount ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditingOfferAmount(true)}>Edit Offer</Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => { setIsEditingOfferAmount(false); setNewOfferAmount(offerAmount); }}>Cancel</Button>
              )}
            </div>
            
            {!isEditingOfferAmount ? (
              <p className="text-lg font-semibold">Current: ₹{offerAmount.toLocaleString("en-IN")}</p>
            ) : (
              <>
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>New Offer Amount (₹)</Label>
                    <Input
                      type="number"
                      value={newOfferAmount}
                      onChange={(e) => setNewOfferAmount(parseFloat(e.target.value) || 0)}
                      autoFocus
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Original: ₹{offerAmount.toLocaleString("en-IN")}</p>
                    {hasOfferAmountChange && (
                      <p className="text-amber-600 font-medium">New Due: ₹{Math.max(0, newOfferAmount - displayCashReceived).toLocaleString("en-IN")}</p>
                    )}
                  </div>
                </div>
                {newOfferAmount < displayCashReceived && (
                  <p className="text-red-500 text-sm">Warning: Cannot be less than cash received</p>
                )}
              </>
            )}
          </div>

          {/* Offer Amount History */}
          {offerAmountHistory && offerAmountHistory.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Offer Amount History</h4>
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
                        <td className="px-4 py-2 text-muted-foreground">-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EMI Payment History */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">EMI Payment History</h4>
            {isLoadingEmi ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : emiPayments && emiPayments.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">EMI #</th>
                      <th className="text-left px-3 py-2 font-medium">Cash Collected</th>
                      <th className="text-left px-3 py-2 font-medium">No Cost EMI</th>
                      <th className="text-left px-3 py-2 font-medium">GST</th>
                      <th className="text-left px-3 py-2 font-medium">Platform Fees</th>
                      <th className="text-left px-3 py-2 font-medium">Platform</th>
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">Remarks</th>
                      <th className="text-left px-3 py-2 font-medium">Updated By</th>
                      <th className="text-left px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emiPayments.map((emi) => (
                      <tr key={emi.id} className="border-t">
                        <td className="px-3 py-2">EMI {emi.emi_number}</td>
                        <td className="px-3 py-2 text-green-600">₹{Number(emi.amount).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2">₹{Number(emi.no_cost_emi || 0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2">₹{Number(emi.gst_fees || 0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2">₹{Number(emi.platform_fees || 0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-muted-foreground">{emi.payment_platform || "-"}</td>
                        <td className="px-3 py-2">{format(new Date(emi.payment_date), "dd MMM yyyy")}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[150px] truncate" title={emi.remarks || ""}>
                          {emi.remarks || "-"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">-</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
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
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeletingEmi(emi)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Add EMI {nextEmiNumber} Payment
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cash Collected (₹)</Label>
                  <Input
                    type="number"
                    placeholder={`Max ₹${remaining.toLocaleString("en-IN")}`}
                    value={emiAmount}
                    onChange={(e) => handleEmiAmountChange(e.target.value)}
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
                        onSelect={(date) => { if (date) setPaymentDate(date); setIsDatePopoverOpen(false); }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>No Cost EMI (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newNoCostEmi}
                    onChange={(e) => setNewNoCostEmi(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Platform Fees (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newPlatformFees}
                    onChange={(e) => handleNewPlatformFeesChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">2.5% of Cash</p>
                </div>
                <div className="space-y-2">
                  <Label>GST Fees (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newGstFees}
                    onChange={(e) => setNewGstFees(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Cash ÷ 1.18 × 0.18</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Platform *</Label>
                <PaymentPlatformSelect
                  value={newPaymentPlatform}
                  onValueChange={setNewPaymentPlatform}
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks (optional)</Label>
                <Textarea
                  placeholder="Any payment-related notes..."
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  rows={2}
                />
              </div>
              <Button 
                onClick={() => handleSaveAll({ closeAfterSuccess: false })} 
                disabled={isSaving || isLoadingEmi || !emiAmount || !newPaymentPlatform}
                className="w-full"
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Add EMI {nextEmiNumber}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => setShowConfirmation(true)} disabled={isSaving}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Update</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to update the payment status for <strong>{customerName}</strong>?</p>
              {emiAmount && parseFloat(emiAmount) > 0 && (
                <p className="text-sm">• Adding EMI payment of ₹{parseFloat(emiAmount).toLocaleString("en-IN")}</p>
              )}
              {newOfferAmount !== offerAmount && (
                <p className="text-sm">• Updating offer amount from ₹{offerAmount.toLocaleString("en-IN")} to ₹{newOfferAmount.toLocaleString("en-IN")}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirmation(false); handleSaveAll({ closeAfterSuccess: true }); }}>
              Confirm Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit EMI Dialog */}
      <AlertDialog open={!!editingEmi} onOpenChange={(open) => !open && setEditingEmi(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit EMI {editingEmi?.emi_number}</AlertDialogTitle>
            <AlertDialogDescription>Update the details for this EMI payment.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cash Collected (₹)</Label>
                <Input type="number" value={editEmiAmount} onChange={(e) => handleEditEmiAmountChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Popover open={isEditDatePopoverOpen} onOpenChange={setIsEditDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(editEmiDate, "dd MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editEmiDate}
                      onSelect={(date) => { if (date) setEditEmiDate(date); setIsEditDatePopoverOpen(false); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>No Cost EMI (₹)</Label>
                <Input type="number" value={editNoCostEmi} onChange={(e) => setEditNoCostEmi(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Platform Fees (₹)</Label>
                <Input type="number" value={editPlatformFees} onChange={(e) => handleEditPlatformFeesChange(e.target.value)} />
                <p className="text-xs text-muted-foreground">2.5% of Cash</p>
              </div>
              <div className="space-y-2">
                <Label>GST Fees (₹)</Label>
                <Input type="number" value={editGstFees} onChange={(e) => setEditGstFees(e.target.value)} />
                <p className="text-xs text-muted-foreground">18% of (Cash - Fees)</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Platform *</Label>
              <PaymentPlatformSelect
                value={editPaymentPlatform}
                onValueChange={setEditPaymentPlatform}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks (optional)</Label>
              <Textarea
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateEmi} disabled={isProcessingEmi || !editPaymentPlatform}>
              {isProcessingEmi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete EMI Confirmation */}
      <AlertDialog open={!!deletingEmi} onOpenChange={(open) => !open && setDeletingEmi(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete EMI {deletingEmi?.emi_number}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this EMI payment of ₹{Number(deletingEmi?.amount || 0).toLocaleString("en-IN")}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmi} disabled={isProcessingEmi} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isProcessingEmi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}