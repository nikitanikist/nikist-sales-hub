import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const changes: { id: string; old_status: string; new_status: string }[] = [];

    // 1. Expired trials
    const { data: expiredTrials } = await supabase
      .from("organization_subscriptions")
      .select("id, status, organization_id")
      .eq("status", "trial")
      .lt("trial_ends_at", now);

    for (const sub of expiredTrials || []) {
      await supabase.from("organization_subscriptions").update({ status: "expired" }).eq("id", sub.id);
      changes.push({ id: sub.id, old_status: "trial", new_status: "expired" });

      // Notification
      await supabase.from("subscription_notifications").insert({
        organization_id: sub.organization_id,
        notification_type: "trial_expired",
        title: "Trial Expired",
        message: "Trial period has ended. Subscription marked as expired.",
      });
    }

    // 2. Active → past_due (period ended, no recent payment)
    const { data: pastDueSubs } = await supabase
      .from("organization_subscriptions")
      .select("id, status, organization_id, current_period_end")
      .eq("status", "active")
      .lt("current_period_end", now);

    for (const sub of pastDueSubs || []) {
      // Check if there's a recent payment
      const { count } = await supabase
        .from("subscription_payments")
        .select("id", { count: "exact", head: true })
        .eq("subscription_id", sub.id)
        .eq("payment_status", "completed")
        .gte("payment_date", sub.current_period_end);

      if (!count || count === 0) {
        await supabase.from("organization_subscriptions").update({ status: "past_due" }).eq("id", sub.id);
        changes.push({ id: sub.id, old_status: "active", new_status: "past_due" });

        await supabase.from("subscription_notifications").insert({
          organization_id: sub.organization_id,
          notification_type: "past_due",
          title: "Subscription Past Due",
          message: "Payment period ended without a recorded payment.",
        });
      }
    }

    // 3. Past due > 30 days → expired
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: longPastDue } = await supabase
      .from("organization_subscriptions")
      .select("id, status, organization_id")
      .eq("status", "past_due")
      .lt("current_period_end", thirtyDaysAgo);

    for (const sub of longPastDue || []) {
      await supabase.from("organization_subscriptions").update({ status: "expired" }).eq("id", sub.id);
      changes.push({ id: sub.id, old_status: "past_due", new_status: "expired" });
    }

    // 4. Trial expiring in 3 days notifications
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: soonExpiring } = await supabase
      .from("organization_subscriptions")
      .select("id, organization_id, trial_ends_at")
      .eq("status", "trial")
      .gt("trial_ends_at", now)
      .lte("trial_ends_at", in3Days);

    for (const sub of soonExpiring || []) {
      // Check if we already sent this notification
      const { count } = await supabase
        .from("subscription_notifications")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", sub.organization_id)
        .eq("notification_type", "trial_expiring_soon");

      if (!count || count === 0) {
        await supabase.from("subscription_notifications").insert({
          organization_id: sub.organization_id,
          notification_type: "trial_expiring_soon",
          title: "Trial Expiring Soon",
          message: "Trial period ends in 3 days or less.",
        });
      }
    }

    // Log all status changes to audit
    for (const change of changes) {
      await supabase.from("subscription_audit_log").insert({
        subscription_id: change.id,
        action: "status_changed",
        old_value: { status: change.old_status },
        new_value: { status: change.new_status, auto: true },
        performed_by: null,
      });
    }

    return new Response(
      JSON.stringify({ success: true, changes: changes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
