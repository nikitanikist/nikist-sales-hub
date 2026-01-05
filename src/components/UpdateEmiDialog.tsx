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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmiAmount("");
      setPaymentDate(new Date());
      setNewClassesAccess(classesAccess);
      setNewBatchId(batchId);
    }
  }, [open, classesAccess, batchId]);

  // Fetch EMI payments for this appointment
  const { data: emiPayments, isLoading: isLoadingEmi } = useQuery({
    queryKey: ["emi-payments", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emi_payments")
        .select("*")
        .eq("appointment_id", appointmentId)
        .order("emi_number", { ascending: true });
      if (error) throw error;
      return data as EmiPayment[];
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

  // Calculate totals
  const totalEmiReceived = emiPayments?.reduce((sum, emi) => sum + Number(emi.amount), 0) || 0;
  const totalReceived = cashReceived; // This already includes EMIs from DB
  const remaining = Math.max(0, offerAmount - totalReceived);
  const paymentProgress = offerAmount > 0 ? (totalReceived / offerAmount) * 100 : 0;
  const isFullyPaid = remaining === 0;
  const nextEmiNumber = (emiPayments?.length || 0) + 1;

  // Add EMI mutation
  const addEmiMutation = useMutation({
    mutationFn: async (data: { amount: number; paymentDate: Date }) => {
      console.log("Adding EMI:", { appointmentId, amount: data.amount, date: data.paymentDate, nextEmiNumber });
      
      // Insert EMI payment
      const { data: insertedData, error: emiError } = await supabase
        .from("emi_payments")
        .insert({
          appointment_id: appointmentId,
          emi_number: nextEmiNumber,
          amount: data.amount,
          payment_date: format(data.paymentDate, "yyyy-MM-dd"),
        })
        .select()
        .single();

      if (emiError) {
        console.error("EMI Insert Error:", emiError);
        throw emiError;
      }
      
      console.log("EMI Inserted:", insertedData);

      // Update appointment cash_received and due_amount
      const newCashReceived = totalReceived + data.amount;
      const newDueAmount = Math.max(0, offerAmount - newCashReceived);

      const { error: updateError } = await supabase
        .from("call_appointments")
        .update({
          cash_received: newCashReceived,
          due_amount: newDueAmount,
        })
        .eq("id", appointmentId);

      if (updateError) throw updateError;

      return { newCashReceived, newDueAmount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emi-payments", appointmentId] });
      queryClient.invalidateQueries({ queryKey: ["emi-payments-inline", appointmentId] });
      queryClient.invalidateQueries({ queryKey: ["closer-appointments"] });
      toast({ title: "EMI Added", description: `EMI ${nextEmiNumber} payment recorded successfully` });
      setEmiAmount("");
      setPaymentDate(new Date());
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update course access mutation
  const updateCourseAccessMutation = useMutation({
    mutationFn: async (data: { classesAccess: number | null; batchId: string | null }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({
          classes_access: data.classesAccess,
          batch_id: data.batchId,
        })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-appointments"] });
      toast({ title: "Updated", description: "Course access updated successfully" });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddEmi = () => {
    const amount = parseFloat(emiAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid EMI amount", variant: "destructive" });
      return;
    }
    if (amount > remaining) {
      toast({ title: "Amount Exceeds Due", description: `EMI amount cannot exceed remaining due of ₹${remaining.toLocaleString("en-IN")}`, variant: "destructive" });
      return;
    }
    addEmiMutation.mutate({ amount, paymentDate });
  };

  const handleSaveCourseAccess = () => {
    updateCourseAccessMutation.mutate({ classesAccess: newClassesAccess, batchId: newBatchId });
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
                <p className="text-lg font-semibold">₹{offerAmount.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Received</p>
                <p className="text-lg font-semibold text-green-600">₹{totalReceived.toLocaleString("en-IN")}</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {emiPayments.map((emi) => (
                      <tr key={emi.id} className="border-t">
                        <td className="px-4 py-2">EMI {emi.emi_number}</td>
                        <td className="px-4 py-2 text-green-600">₹{Number(emi.amount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2">{format(new Date(emi.payment_date), "dd MMM yyyy")}</td>
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
                onClick={handleAddEmi} 
                disabled={addEmiMutation.isPending || !emiAmount}
                className="w-full"
              >
                {addEmiMutation.isPending ? (
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
            onClick={handleSaveCourseAccess}
            disabled={updateCourseAccessMutation.isPending}
          >
            {updateCourseAccessMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
