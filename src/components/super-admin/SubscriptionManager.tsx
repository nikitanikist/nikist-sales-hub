import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSubscriptions, type BillingPlan } from "@/hooks/useSubscriptions";
import PaymentHistory from "./PaymentHistory";

interface SubscriptionManagerProps {
  organizationId: string;
  organizationName: string;
}

const STATUS_OPTIONS = ["trial", "active", "past_due", "cancelled", "expired"];
const CYCLE_OPTIONS = ["monthly", "yearly"];

const SubscriptionManager = ({ organizationId, organizationName }: SubscriptionManagerProps) => {
  const { plans, refetch } = useSubscriptions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Form fields
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState("trial");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [customPrice, setCustomPrice] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [nextPayment, setNextPayment] = useState("");
  const [trialStart, setTrialStart] = useState("");
  const [trialEnd, setTrialEnd] = useState("");
  const [setupFee, setSetupFee] = useState("");
  const [setupFeePaid, setSetupFeePaid] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    fetchSubscription();
  }, [organizationId]);

  const fetchSubscription = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organization_subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!error && data) {
      setSubscription(data);
      setPlanId(data.plan_id);
      setStatus(data.status);
      setBillingCycle(data.billing_cycle);
      setCustomPrice(data.custom_price?.toString() || "");
      setPeriodStart(data.current_period_start?.split("T")[0] || "");
      setPeriodEnd(data.current_period_end?.split("T")[0] || "");
      setNextPayment(data.next_payment_due?.split("T")[0] || "");
      setTrialStart(data.trial_started_at?.split("T")[0] || "");
      setTrialEnd(data.trial_ends_at?.split("T")[0] || "");
      setSetupFee(data.setup_fee?.toString() || "0");
      setSetupFeePaid(data.setup_fee_paid || false);
      setAdminNotes(data.admin_notes || "");
    }
    setLoading(false);
  };

  const selectedPlan = plans.find((p) => p.id === planId);
  const displayPrice = customPrice
    ? parseFloat(customPrice)
    : selectedPlan
    ? billingCycle === "yearly"
      ? selectedPlan.yearly_price
      : selectedPlan.monthly_price
    : 0;

  const saveSubscription = async () => {
    setSaving(true);
    try {
      const payload: any = {
        organization_id: organizationId,
        plan_id: planId,
        status,
        billing_cycle: billingCycle,
        current_price: selectedPlan
          ? billingCycle === "yearly"
            ? selectedPlan.yearly_price
            : selectedPlan.monthly_price
          : 0,
        custom_price: customPrice ? parseFloat(customPrice) : null,
        current_period_start: periodStart || null,
        current_period_end: periodEnd || null,
        next_payment_due: nextPayment || null,
        trial_started_at: status === "trial" && trialStart ? trialStart : null,
        trial_ends_at: status === "trial" && trialEnd ? trialEnd : null,
        setup_fee: parseFloat(setupFee) || 0,
        setup_fee_paid: setupFeePaid,
        admin_notes: adminNotes || null,
      };

      const oldValues = subscription
        ? { plan_id: subscription.plan_id, status: subscription.status, billing_cycle: subscription.billing_cycle }
        : null;

      let subId: string;

      if (subscription) {
        const { error } = await supabase
          .from("organization_subscriptions")
          .update(payload)
          .eq("id", subscription.id);
        if (error) throw error;
        subId = subscription.id;
      } else {
        payload.subscription_started_at = new Date().toISOString();
        const { data, error } = await supabase
          .from("organization_subscriptions")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        subId = data.id;
      }

      // Audit log
      await supabase.from("subscription_audit_log").insert({
        subscription_id: subId,
        action: subscription ? "plan_changed" : "created",
        old_value: oldValues,
        new_value: { plan_id: planId, status, billing_cycle: billingCycle },
      });

      toast.success("Subscription saved");
      fetchSubscription();
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save subscription");
    } finally {
      setSaving(false);
    }
  };

  const cancelSubscription = async () => {
    if (!subscription) return;
    try {
      await supabase
        .from("organization_subscriptions")
        .update({ status: "cancelled", cancelled_reason: cancelReason })
        .eq("id", subscription.id);

      await supabase.from("subscription_audit_log").insert({
        subscription_id: subscription.id,
        action: "status_changed",
        old_value: { status: subscription.status },
        new_value: { status: "cancelled", cancelled_reason: cancelReason },
      });

      toast.success("Subscription cancelled");
      setShowCancelDialog(false);
      setCancelReason("");
      fetchSubscription();
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    }
  };

  if (loading) {
    return <div className="space-y-4"><div className="skeleton-shimmer h-40 rounded" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Plan & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Select plan" /></SelectTrigger>
            <SelectContent className="bg-background z-50">
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.monthly_price}/mo</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-background z-50">
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Billing Cycle</Label>
          <Select value={billingCycle} onValueChange={setBillingCycle}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-background z-50">
              {CYCLE_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Calculated Price</Label>
          <p className="text-lg font-semibold data-text">₹{displayPrice.toLocaleString()}/{billingCycle === "yearly" ? "yr" : "mo"}</p>
        </div>
        <div className="space-y-2">
          <Label>Custom Price Override</Label>
          <Input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Leave empty for standard pricing" />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Period Start</Label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Period End</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Next Payment Due</Label>
          <Input type="date" value={nextPayment} onChange={(e) => setNextPayment(e.target.value)} />
        </div>
      </div>

      {/* Trial dates */}
      {status === "trial" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Trial Start</Label>
            <Input type="date" value={trialStart} onChange={(e) => setTrialStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Trial End</Label>
            <Input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} />
          </div>
        </div>
      )}

      {/* Setup fee */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Setup Fee</Label>
          <Input type="number" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={setupFeePaid} onCheckedChange={setSetupFeePaid} />
          <Label>Setup Fee Paid</Label>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Admin Notes</Label>
        <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Internal notes about this subscription..." />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={saveSubscription} disabled={saving || !planId}>
          {saving ? "Saving..." : subscription ? "Save Changes" : "Create Subscription"}
        </Button>
        {subscription && subscription.status !== "cancelled" && (
          <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive">Cancel Subscription</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel Subscription</DialogTitle>
                <DialogDescription>Why is this subscription being cancelled?</DialogDescription>
              </DialogHeader>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Back</Button>
                <Button variant="destructive" onClick={cancelSubscription}>Confirm Cancel</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Payment History */}
      {subscription && (
        <PaymentHistory subscriptionId={subscription.id} organizationId={organizationId} organizationName={organizationName} />
      )}
    </div>
  );
};

export default SubscriptionManager;
