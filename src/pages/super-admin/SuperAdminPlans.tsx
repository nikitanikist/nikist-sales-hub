import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Save } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  is_active: boolean;
  is_custom: boolean;
  display_order: number;
}

interface PlanLimit {
  id: string;
  plan_id: string;
  limit_key: string;
  limit_value: number;
}

interface PlanFeature {
  id: string;
  plan_id: string;
  feature_key: string;
  feature_value: string;
}

const LIMIT_LABELS: Record<string, string> = {
  whatsapp_numbers: "WhatsApp Numbers",
  team_members: "Team Members",
  whatsapp_groups: "WhatsApp Groups",
  campaigns_per_month: "Campaigns / Month",
  recipients_per_campaign: "Recipients / Campaign",
  dynamic_links: "Dynamic Links",
};

const FEATURE_LABELS: Record<string, string> = {
  analytics: "Analytics Level",
  community_creation: "Community Creation",
  data_export: "Data Export",
  support: "Support Channel",
  custom_branding: "Custom Branding",
  api_access: "API Access",
};

const SuperAdminPlans = () => {
  const { isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [limits, setLimits] = useState<PlanLimit[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit states
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editLimits, setEditLimits] = useState<Record<string, number>>({});
  const [editFeatures, setEditFeatures] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showNewPlanDialog, setShowNewPlanDialog] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", slug: "", description: "", monthly_price: 0, yearly_price: 0 });

  useEffect(() => {
    if (!orgLoading && !isSuperAdmin) { navigate("/"); return; }
    if (isSuperAdmin) fetchAll();
  }, [isSuperAdmin, orgLoading]);

  const fetchAll = async () => {
    setIsLoading(true);
    const [plansRes, limitsRes, featuresRes] = await Promise.all([
      supabase.from("billing_plans").select("*").order("display_order"),
      supabase.from("plan_limits").select("*"),
      supabase.from("plan_features").select("*"),
    ]);
    setPlans((plansRes.data || []) as Plan[]);
    setLimits((limitsRes.data || []) as PlanLimit[]);
    setFeatures((featuresRes.data || []) as PlanFeature[]);
    setIsLoading(false);
  };

  const selectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setEditingPlan({ ...plan });
    const planLimits = limits.filter((l) => l.plan_id === plan.id);
    const planFeatures = features.filter((f) => f.plan_id === plan.id);
    setEditLimits(Object.fromEntries(planLimits.map((l) => [l.limit_key, l.limit_value])));
    setEditFeatures(Object.fromEntries(planFeatures.map((f) => [f.feature_key, f.feature_value])));
  };

  const savePlanChanges = async () => {
    if (!editingPlan || !selectedPlan) return;
    setSaving(true);
    try {
      // Update plan basics
      await supabase.from("billing_plans").update({
        name: editingPlan.name,
        description: editingPlan.description,
        monthly_price: editingPlan.monthly_price,
        yearly_price: editingPlan.yearly_price,
        is_active: editingPlan.is_active,
      }).eq("id", selectedPlan.id);

      // Upsert limits
      for (const [key, value] of Object.entries(editLimits)) {
        const existing = limits.find((l) => l.plan_id === selectedPlan.id && l.limit_key === key);
        if (existing) {
          await supabase.from("plan_limits").update({ limit_value: value }).eq("id", existing.id);
        } else {
          await supabase.from("plan_limits").insert({ plan_id: selectedPlan.id, limit_key: key, limit_value: value });
        }
      }

      // Upsert features
      for (const [key, value] of Object.entries(editFeatures)) {
        const existing = features.find((f) => f.plan_id === selectedPlan.id && f.feature_key === key);
        if (existing) {
          await supabase.from("plan_features").update({ feature_value: value }).eq("id", existing.id);
        } else {
          await supabase.from("plan_features").insert({ plan_id: selectedPlan.id, feature_key: key, feature_value: value });
        }
      }

      toast.success("Plan updated");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const createNewPlan = async () => {
    if (!newPlan.name || !newPlan.slug) { toast.error("Name and slug required"); return; }
    try {
      const { error } = await supabase.from("billing_plans").insert({
        name: newPlan.name,
        slug: newPlan.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        description: newPlan.description || null,
        monthly_price: newPlan.monthly_price,
        yearly_price: newPlan.yearly_price,
        display_order: plans.length + 1,
      });
      if (error) throw error;
      toast.success("Plan created");
      setShowNewPlanDialog(false);
      setNewPlan({ name: "", slug: "", description: "", monthly_price: 0, yearly_price: 0 });
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
  };

  if (orgLoading || isLoading) return <div className="space-y-4"><div className="skeleton-shimmer h-40 rounded" /></div>;
  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <Button onClick={() => setShowNewPlanDialog(true)}><Plus className="mr-2 h-4 w-4" />Add Plan</Button>
      </div>

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${selectedPlan?.id === plan.id ? "ring-2 ring-primary" : ""}`}
            onClick={() => selectPlan(plan)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                <Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? "Active" : "Off"}</Badge>
              </div>
              {plan.description && <CardDescription className="text-xs">{plan.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{plan.monthly_price.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <p className="text-xs text-muted-foreground mt-1">₹{plan.yearly_price.toLocaleString()}/yr</p>
              <p className="text-xs text-muted-foreground mt-2">{limits.filter((l) => l.plan_id === plan.id).length} limits · {features.filter((f) => f.plan_id === plan.id).length} features</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit panel */}
      {selectedPlan && editingPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Edit className="h-4 w-4" />Edit: {selectedPlan.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pricing">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="limits">Limits</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
              </TabsList>

              <TabsContent value="pricing" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Plan Name</Label>
                    <Input value={editingPlan.name} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Price (₹)</Label>
                    <Input type="number" value={editingPlan.monthly_price} onChange={(e) => setEditingPlan({ ...editingPlan, monthly_price: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Yearly Price (₹)</Label>
                    <Input type="number" value={editingPlan.yearly_price} onChange={(e) => setEditingPlan({ ...editingPlan, yearly_price: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={editingPlan.description || ""} onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editingPlan.is_active} onCheckedChange={(v) => setEditingPlan({ ...editingPlan, is_active: v })} />
                  <Label>Active</Label>
                </div>
              </TabsContent>

              <TabsContent value="limits" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Set resource limits for this plan. Use -1 for unlimited.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(LIMIT_LABELS).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        value={editLimits[key] ?? ""}
                        onChange={(e) => setEditLimits({ ...editLimits, [key]: Number(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="features" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Configure feature flags and values for this plan.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input
                        value={editFeatures[key] ?? ""}
                        onChange={(e) => setEditFeatures({ ...editFeatures, [key]: e.target.value })}
                        placeholder="e.g. basic, true, email"
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-6">
              <Button onClick={savePlanChanges} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Plan Dialog */}
      <Dialog open={showNewPlanDialog} onOpenChange={setShowNewPlanDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Plan</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Plan Name</Label><Input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-") })} placeholder="Enterprise Plus" /></div>
            <div className="space-y-2"><Label>Slug</Label><Input value={newPlan.slug} onChange={(e) => setNewPlan({ ...newPlan, slug: e.target.value })} placeholder="enterprise-plus" /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={newPlan.description} onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Monthly (₹)</Label><Input type="number" value={newPlan.monthly_price} onChange={(e) => setNewPlan({ ...newPlan, monthly_price: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Yearly (₹)</Label><Input type="number" value={newPlan.yearly_price} onChange={(e) => setNewPlan({ ...newPlan, yearly_price: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPlanDialog(false)}>Cancel</Button>
            <Button onClick={createNewPlan}>Create Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminPlans;
