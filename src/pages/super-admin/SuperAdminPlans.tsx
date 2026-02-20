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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Save } from "lucide-react";
import { toast } from "sonner";
import { PERMISSION_GROUPS, PERMISSION_LABELS, type PermissionKey } from "@/lib/permissions";

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
  currency: string;
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

const CURRENCY_MAP: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const LIMIT_LABELS: Record<string, string> = {
  whatsapp_numbers: "WhatsApp Numbers",
  team_members: "Team Members",
  whatsapp_groups: "WhatsApp Groups",
  campaigns_per_month: "Campaigns / Month",
  recipients_per_campaign: "Recipients / Campaign",
  dynamic_links: "Dynamic Links",
};

// Core modules that can be toggled per plan
const MODULE_FEATURES = [
  { key: "module_sales_funnel", label: "One-to-One Sales Funnel" },
  { key: "module_cohort", label: "Cohort Management" },
  { key: "module_workshops", label: "Workshops" },
  { key: "module_daily_money_flow", label: "Daily Money Flow" },
];

// Integration toggles
const INTEGRATION_FEATURES = [
  { key: "integration_calendly", label: "Calendly" },
  { key: "integration_aisensy", label: "WhatsApp (AISensy)" },
  { key: "integration_pabbly", label: "Pabbly Webhook" },
  { key: "integration_workshop_notifications", label: "Workshop Notifications" },
];

// Additional features with special input types
const ADDITIONAL_FEATURES = {
  toggles: [
    { key: "community_creation", label: "Community Creation" },
    { key: "data_export", label: "Data Export" },
    { key: "custom_branding", label: "Custom Branding" },
    { key: "api_access", label: "API Access" },
  ],
  dropdowns: [
    { key: "analytics", label: "Analytics Level", options: ["basic", "standard", "advanced"] },
    { key: "support", label: "Support Channel", options: ["email", "chat", "priority", "dedicated"] },
  ],
  numbers: [
    { key: "onboarding_minutes", label: "Onboarding Minutes" },
  ],
};

const SuperAdminPlans = () => {
  const { isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [limits, setLimits] = useState<PlanLimit[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editLimits, setEditLimits] = useState<Record<string, number>>({});
  const [editFeatures, setEditFeatures] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showNewPlanDialog, setShowNewPlanDialog] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", slug: "", description: "", monthly_price: 0, yearly_price: 0, currency: "INR" });

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
      await supabase.from("billing_plans").update({
        name: editingPlan.name,
        description: editingPlan.description,
        monthly_price: editingPlan.monthly_price,
        yearly_price: editingPlan.yearly_price,
        is_active: editingPlan.is_active,
        currency: editingPlan.currency,
      }).eq("id", selectedPlan.id);

      for (const [key, value] of Object.entries(editLimits)) {
        const existing = limits.find((l) => l.plan_id === selectedPlan.id && l.limit_key === key);
        if (existing) {
          await supabase.from("plan_limits").update({ limit_value: value }).eq("id", existing.id);
        } else {
          await supabase.from("plan_limits").insert({ plan_id: selectedPlan.id, limit_key: key, limit_value: value });
        }
      }

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
        currency: newPlan.currency,
      });
      if (error) throw error;
      toast.success("Plan created");
      setShowNewPlanDialog(false);
      setNewPlan({ name: "", slug: "", description: "", monthly_price: 0, yearly_price: 0, currency: "INR" });
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
  };

  const getSymbol = (currency?: string) => CURRENCY_MAP[currency || "INR"] || "₹";

  const toggleFeature = (key: string) => {
    const current = editFeatures[key];
    setEditFeatures({ ...editFeatures, [key]: current === "true" ? "false" : "true" });
  };

  const isFeatureOn = (key: string) => editFeatures[key] === "true";

  if (orgLoading || isLoading) return <div className="space-y-4"><div className="skeleton-shimmer h-40 rounded" /></div>;
  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <Button onClick={() => setShowNewPlanDialog(true)}><Plus className="mr-2 h-4 w-4" />Add Plan</Button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const sym = getSymbol(plan.currency);
          return (
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
                <div className="text-2xl font-bold">{sym}{plan.monthly_price.toLocaleString("en-IN")}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <p className="text-xs text-muted-foreground mt-1">{sym}{plan.yearly_price.toLocaleString("en-IN")}/yr</p>
                <p className="text-xs text-muted-foreground mt-2">{limits.filter((l) => l.plan_id === plan.id).length} limits · {features.filter((f) => f.plan_id === plan.id).length} features</p>
              </CardContent>
            </Card>
          );
        })}
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

              {/* Pricing Tab */}
              <TabsContent value="pricing" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Plan Name</Label>
                    <Input value={editingPlan.name} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={editingPlan.currency || "INR"} onValueChange={(v) => setEditingPlan({ ...editingPlan, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CURRENCY_MAP).map(([code, sym]) => (
                          <SelectItem key={code} value={code}>{sym} {code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Price ({getSymbol(editingPlan.currency)})</Label>
                    <Input type="number" value={editingPlan.monthly_price} onChange={(e) => setEditingPlan({ ...editingPlan, monthly_price: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Yearly Price ({getSymbol(editingPlan.currency)})</Label>
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

              {/* Limits Tab */}
              <TabsContent value="limits" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Set resource limits for this plan. Use -1 for unlimited.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(LIMIT_LABELS).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input type="number" value={editLimits[key] ?? ""} onChange={(e) => setEditLimits({ ...editLimits, [key]: Number(e.target.value) })} placeholder="0" />
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Features Tab — Toggle-based */}
              <TabsContent value="features" className="space-y-6 mt-4">
                {/* Section A: Core Modules */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Core Modules</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MODULE_FEATURES.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                        <Label className="cursor-pointer">{label}</Label>
                        <Switch checked={isFeatureOn(key)} onCheckedChange={() => toggleFeature(key)} />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Section B: Sidebar Permissions */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Sidebar Permissions</h3>
                  <div className="space-y-4">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="text-xs font-medium text-muted-foreground mb-2">{group.label}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {group.permissions.map((perm) => {
                            const featureKey = `perm_${perm}`;
                            return (
                              <div key={featureKey} className="flex items-center justify-between rounded-lg border p-3">
                                <Label className="cursor-pointer">{PERMISSION_LABELS[perm as PermissionKey] || perm}</Label>
                                <Switch checked={isFeatureOn(featureKey)} onCheckedChange={() => toggleFeature(featureKey)} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Section C: Integration Access */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Integration Access</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INTEGRATION_FEATURES.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                        <Label className="cursor-pointer">{label}</Label>
                        <Switch checked={isFeatureOn(key)} onCheckedChange={() => toggleFeature(key)} />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Section D: Additional Features */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Additional Features</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ADDITIONAL_FEATURES.toggles.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                        <Label className="cursor-pointer">{label}</Label>
                        <Switch checked={isFeatureOn(key)} onCheckedChange={() => toggleFeature(key)} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {ADDITIONAL_FEATURES.dropdowns.map(({ key, label, options }) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <Select value={editFeatures[key] || ""} onValueChange={(v) => setEditFeatures({ ...editFeatures, [key]: v })}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {ADDITIONAL_FEATURES.numbers.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <Input type="number" value={editFeatures[key] || ""} onChange={(e) => setEditFeatures({ ...editFeatures, [key]: e.target.value })} placeholder="0" />
                      </div>
                    ))}
                  </div>
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
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={newPlan.currency} onValueChange={(v) => setNewPlan({ ...newPlan, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CURRENCY_MAP).map(([code, sym]) => (
                    <SelectItem key={code} value={code}>{sym} {code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Monthly ({getSymbol(newPlan.currency)})</Label><Input type="number" value={newPlan.monthly_price} onChange={(e) => setNewPlan({ ...newPlan, monthly_price: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Yearly ({getSymbol(newPlan.currency)})</Label><Input type="number" value={newPlan.yearly_price} onChange={(e) => setNewPlan({ ...newPlan, yearly_price: Number(e.target.value) })} /></div>
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
