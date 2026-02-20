import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PaymentHistoryProps {
  subscriptionId: string;
  organizationId: string;
  organizationName: string;
}

const PAYMENT_TYPES = ["setup_fee", "subscription", "addon", "refund"] as const;
const PAYMENT_METHODS = ["manual", "bank_transfer", "upi", "cash", "other"] as const;

const PaymentHistory = ({ subscriptionId, organizationId, organizationName }: PaymentHistoryProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<string>("subscription");
  const [paymentMethod, setPaymentMethod] = useState<string>("manual");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  const { data: payments = [], refetch } = useQuery({
    queryKey: ["subscription-payments", subscriptionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const recordPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("subscription_payments").insert({
        subscription_id: subscriptionId,
        organization_id: organizationId,
        amount: parseFloat(amount),
        payment_type: paymentType,
        payment_method: paymentMethod,
        payment_reference: reference || null,
        payment_date: paymentDate,
        notes: notes || null,
      });
      if (error) throw error;

      // Audit log
      await supabase.from("subscription_audit_log").insert({
        subscription_id: subscriptionId,
        action: "payment_recorded",
        new_value: { amount: parseFloat(amount), type: paymentType, method: paymentMethod },
      });

      toast.success("Payment recorded");
      setShowDialog(false);
      setAmount("");
      setReference("");
      setNotes("");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "default";
      case "pending": return "secondary";
      case "failed": return "destructive";
      case "refunded": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-4 border-t pt-6 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Payment History</h3>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Record Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>Record a manual payment for {organizationName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₹) *</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {PAYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reference (Invoice/Transaction ID)</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={recordPayment} disabled={saving}>{saving ? "Saving..." : "Record"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{format(new Date(p.payment_date), "PP")}</TableCell>
                <TableCell className="font-medium data-text">₹{p.amount.toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{p.payment_type.replace("_", " ")}</Badge></TableCell>
                <TableCell>{p.payment_method?.replace("_", " ") || "—"}</TableCell>
                <TableCell><Badge variant={statusColor(p.payment_status) as any}>{p.payment_status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{p.payment_reference || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default PaymentHistory;
