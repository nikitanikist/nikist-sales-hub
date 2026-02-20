import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Calendar, Clock, IndianRupee, DollarSign, Euro, PoundSterling } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const CURRENCY_MAP: Record<string, { symbol: string; icon: typeof IndianRupee }> = {
  INR: { symbol: "₹", icon: IndianRupee },
  USD: { symbol: "$", icon: DollarSign },
  EUR: { symbol: "€", icon: Euro },
  GBP: { symbol: "£", icon: PoundSterling },
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  trial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
  past_due: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const MyPlan = () => {
  const { currentOrganization } = useOrganization();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["my-plan", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return null;
      const { data, error } = await supabase
        .from("organization_subscriptions")
        .select("*, billing_plans!organization_subscriptions_plan_id_fkey(*)")
        .eq("organization_id", currentOrganization.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="My Plan" subtitle="View your current subscription details" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No subscription found for this organization.
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = subscription.billing_plans as any;
  const currency = CURRENCY_MAP[plan?.currency || "INR"] || CURRENCY_MAP.INR;
  const CurrencyIcon = currency.icon;
  const status = subscription.status || "active";
  const billingCycle = subscription.billing_cycle || "monthly";
  const price = billingCycle === "yearly" ? plan?.yearly_price : plan?.monthly_price;

  const isTrial = status === "trial";
  const trialDaysRemaining = isTrial && subscription.trial_ends_at
    ? Math.max(0, differenceInDays(new Date(subscription.trial_ends_at), new Date()))
    : 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "dd MMM yyyy");
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader title="My Plan" subtitle="View your current subscription details" />

      {/* Plan Overview Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">{plan?.name || "Unknown Plan"}</CardTitle>
                {plan?.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1 ${STATUS_STYLES[status] || STATUS_STYLES.active}`}
            >
              {status.replace("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pricing */}
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-bold text-foreground">
              {currency.symbol}{price?.toLocaleString() ?? "0"}
            </span>
            <span className="text-muted-foreground text-sm">
              / {billingCycle === "yearly" ? "year" : "month"}
            </span>
          </div>

          {/* Trial Banner */}
          {isTrial && (
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
              <div className="flex items-center gap-2 text-warning">
                <Clock className="h-4 w-4" />
                <span className="font-medium text-sm">
                  Trial Period — {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} remaining
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Trial Started</span>
                  <p className="font-medium">{formatDate(subscription.trial_started_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Trial Ends</span>
                  <p className="font-medium">{formatDate(subscription.trial_ends_at)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailItem
              icon={Calendar}
              label="Billing Cycle"
              value={billingCycle === "yearly" ? "Yearly" : "Monthly"}
            />
            <DetailItem
              icon={Calendar}
              label="Current Period Start"
              value={formatDate(subscription.current_period_start)}
            />
            <DetailItem
              icon={Calendar}
              label="Current Period End"
              value={formatDate(subscription.current_period_end)}
            />
            <DetailItem
              icon={CurrencyIcon}
              label="Next Payment Due"
              value={formatDate(subscription.current_period_end)}
            />
            <DetailItem
              icon={Calendar}
              label="Subscription Started"
              value={formatDate(subscription.created_at)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const DetailItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border bg-card p-3.5">
    <div className="flex items-center gap-2 text-muted-foreground mb-1">
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <p className="text-sm font-semibold text-foreground">{value}</p>
  </div>
);

export default MyPlan;
