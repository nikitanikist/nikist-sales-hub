import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { StatsCardsSkeleton } from "@/components/skeletons";
import AnalyticsDashboard from "@/components/super-admin/AnalyticsDashboard";
import { useSubscriptions } from "@/hooks/useSubscriptions";

const SuperAdminOverview = () => {
  const { isSuperAdmin, isLoading: orgLoading, refreshOrganizations } = useOrganization();
  const navigate = useNavigate();
  const [orgCount, setOrgCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgPlanId, setNewOrgPlanId] = useState("");
  const [newOrgTrial, setNewOrgTrial] = useState(true);

  const { plans } = useSubscriptions();

  useEffect(() => {
    if (plans.length > 0 && !newOrgPlanId) {
      const starter = plans.find((p) => p.slug === "starter");
      if (starter) setNewOrgPlanId(starter.id);
    }
  }, [plans, newOrgPlanId]);

  useEffect(() => {
    if (!orgLoading && !isSuperAdmin) {
      toast.error("Access denied. Super Admin privileges required.");
      navigate("/");
    }
  }, [isSuperAdmin, orgLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) fetchOrgCount();
  }, [isSuperAdmin]);

  const fetchOrgCount = async () => {
    setIsLoading(true);
    const { count } = await supabase.from("organizations").select("id", { count: "exact", head: true });
    setOrgCount(count || 0);
    setIsLoading(false);
  };

  const fetchAllModules = async () => {
    const { data } = await supabase.from("modules").select("*").order("display_order");
    return data || [];
  };

  const createOrganization = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("organizations")
        .insert({
          name: newOrgName.trim(),
          slug: newOrgSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        })
        .select()
        .single();
      if (error) throw error;

      const allModules = await fetchAllModules();
      if (allModules.length > 0) {
        await supabase.from("organization_modules").insert(
          allModules.map((m: any) => ({
            organization_id: data.id,
            module_id: m.id,
            is_enabled: true,
            enabled_at: new Date().toISOString(),
          }))
        );
      }

      if (newOrgPlanId) {
        const now = new Date();
        const selectedPlan = plans.find((p) => p.id === newOrgPlanId);
        const subPayload: any = {
          organization_id: data.id,
          plan_id: newOrgPlanId,
          status: newOrgTrial ? "trial" : "active",
          billing_cycle: "monthly",
          subscription_started_at: now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: new Date(now.getTime() + 30 * 86400000).toISOString(),
          current_price: selectedPlan ? selectedPlan.monthly_price : 0,
        };
        if (newOrgTrial) {
          subPayload.trial_started_at = now.toISOString();
          subPayload.trial_ends_at = new Date(now.getTime() + 30 * 86400000).toISOString();
        }
        const { data: subData, error: subError } = await supabase
          .from("organization_subscriptions")
          .insert(subPayload)
          .select()
          .single();
        if (!subError && subData) {
          await supabase.from("subscription_audit_log").insert({
            subscription_id: subData.id,
            action: "created",
            new_value: { plan_id: newOrgPlanId, status: subPayload.status, trial: newOrgTrial },
          });
        }
      }

      toast.success("Organization created successfully");
      setShowCreateDialog(false);
      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgTrial(true);
      fetchOrgCount();
      refreshOrganizations();
    } catch (error: any) {
      toast.error(error.message || "Failed to create organization");
    }
  };

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <StatsCardsSkeleton count={5} />
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Create Organization</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>Add a new organization to the platform</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                  }}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug</Label>
                <Input id="org-slug" value={newOrgSlug} onChange={(e) => setNewOrgSlug(e.target.value)} placeholder="acme-corp" />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={newOrgPlanId} onValueChange={setNewOrgPlanId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="trial-toggle">Start with 30-day trial?</Label>
                <Switch id="trial-toggle" checked={newOrgTrial} onCheckedChange={setNewOrgTrial} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={createOrganization}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AnalyticsDashboard totalOrgs={orgCount} />
    </div>
  );
};

export default SuperAdminOverview;
