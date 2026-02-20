import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/skeletons";
import SubscriptionManager from "@/components/super-admin/SubscriptionManager";
import UsageTracker from "@/components/super-admin/UsageTracker";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { PERMISSION_GROUPS, PERMISSION_LABELS, type PermissionKey } from "@/lib/permissions";

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  member_count?: number;
}

interface OrganizationMember {
  id: string;
  user_id: string;
  role: string;
  is_org_admin: boolean;
  created_at: string;
  profile?: { full_name: string; email: string };
}

interface Module {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_premium: boolean;
  display_order: number;
}

interface OrganizationModule {
  id: string;
  module_id: string;
  is_enabled: boolean;
  modules: Module;
}

const PLAN_BADGE_COLORS: Record<string, string> = {
  starter: "bg-muted text-muted-foreground",
  growth: "bg-info/10 text-info",
  pro: "bg-primary/10 text-primary",
  enterprise: "bg-warning/10 text-warning-foreground",
};

const STATUS_DOTS: Record<string, string> = {
  active: "bg-success",
  trial: "bg-warning",
  past_due: "bg-destructive",
  cancelled: "bg-muted-foreground",
  expired: "bg-muted-foreground",
};

const INTEGRATION_SLUGS = [
  { slug: "calendly", label: "Calendly" },
  { slug: "aisensy", label: "WhatsApp (AISensy)" },
  { slug: "pabbly", label: "Pabbly Webhook" },
  { slug: "workshop_notifications", label: "Workshop Notifications" },
];

const SuperAdminOrganizations = () => {
  const { isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [orgModules, setOrgModules] = useState<OrganizationModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Feature overrides state
  const [disabledPermissions, setDisabledPermissions] = useState<string[]>([]);
  const [disabledIntegrations, setDisabledIntegrations] = useState<string[]>([]);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [savingOverrides, setSavingOverrides] = useState(false);

  // Add Member state
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<string>("admin");
  const [newMemberIsOrgAdmin, setNewMemberIsOrgAdmin] = useState(true);
  const [addingMember, setAddingMember] = useState(false);

  const { subscriptions } = useSubscriptions();

  useEffect(() => {
    if (!orgLoading && !isSuperAdmin) {
      toast.error("Access denied.");
      navigate("/");
    }
  }, [isSuperAdmin, orgLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchOrganizations();
      fetchAllModules();
    }
  }, [isSuperAdmin]);

  const fetchAllModules = async () => {
    const { data } = await supabase.from("modules").select("*").order("display_order");
    if (data) setAllModules(data as Module[]);
  };

  const fetchOrganizations = async () => {
    setIsLoading(true);
    const { data: orgs } = await supabase.from("organizations").select("*").order("name");
    if (!orgs) { setIsLoading(false); return; }
    const orgsWithCounts = await Promise.all(
      orgs.map(async (org) => {
        const { count } = await supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", org.id);
        return { ...org, member_count: count || 0 };
      })
    );
    setOrganizations(orgsWithCounts);
    setIsLoading(false);
  };

  const fetchOrgDetails = async (org: Organization) => {
    setSelectedOrg(org);
    const [membersRes, modulesRes, overridesRes] = await Promise.all([
      supabase.from("organization_members").select("id, user_id, role, is_org_admin, created_at").eq("organization_id", org.id),
      supabase.from("organization_modules").select("id, module_id, is_enabled, modules (*)").eq("organization_id", org.id),
      supabase.from("organization_feature_overrides").select("*").eq("organization_id", org.id).maybeSingle(),
    ]);

    const members = membersRes.data || [];
    const memberUserIds = members.map((m) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", memberUserIds);
    setOrgMembers(members.map((m) => ({ ...m, profile: profiles?.find((p) => p.id === m.user_id) })));
    setOrgModules((modulesRes.data || []) as OrganizationModule[]);
    
    if (overridesRes.data) {
      setOverrideId(overridesRes.data.id);
      setDisabledPermissions(overridesRes.data.disabled_permissions || []);
      setDisabledIntegrations(overridesRes.data.disabled_integrations || []);
    } else {
      setOverrideId(null);
      setDisabledPermissions([]);
      setDisabledIntegrations([]);
    }
  };

  const toggleOrgStatus = async (org: Organization) => {
    await supabase.from("organizations").update({ is_active: !org.is_active }).eq("id", org.id);
    toast.success(`Organization ${org.is_active ? "deactivated" : "activated"}`);
    fetchOrganizations();
    if (selectedOrg?.id === org.id) setSelectedOrg({ ...org, is_active: !org.is_active });
  };

  const toggleModule = async (moduleId: string) => {
    if (!selectedOrg) return;
    const existing = orgModules.find((om) => om.module_id === moduleId);
    if (existing) {
      await supabase.from("organization_modules").update({ is_enabled: !existing.is_enabled, enabled_at: !existing.is_enabled ? new Date().toISOString() : null }).eq("id", existing.id);
    } else {
      await supabase.from("organization_modules").insert({ organization_id: selectedOrg.id, module_id: moduleId, is_enabled: true, enabled_at: new Date().toISOString() });
    }
    const { data } = await supabase.from("organization_modules").select("id, module_id, is_enabled, modules (*)").eq("organization_id", selectedOrg.id);
    setOrgModules((data || []) as OrganizationModule[]);
    toast.success("Module updated");
  };

  const toggleOrgAdmin = async (member: OrganizationMember) => {
    await supabase.from("organization_members").update({ is_org_admin: !member.is_org_admin }).eq("id", member.id);
    setOrgMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, is_org_admin: !m.is_org_admin } : m)));
    toast.success("Member updated");
  };

  const resetAddMemberForm = () => {
    setNewUserName(""); setNewUserEmail(""); setNewUserPhone(""); setNewUserPassword("");
    setNewMemberRole(orgMembers.length === 0 ? "admin" : "viewer");
    setNewMemberIsOrgAdmin(orgMembers.length === 0);
  };

  const addMemberToOrg = async () => {
    if (!selectedOrg || !newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) { toast.error("Fill required fields"); return; }
    if (newUserPassword.length < 6) { toast.error("Password min 6 chars"); return; }
    setAddingMember(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create", organization_id: selectedOrg.id, email: newUserEmail.trim(), full_name: newUserName.trim(), phone: newUserPhone.trim() || null, password: newUserPassword, role: newMemberRole, is_org_admin: newMemberIsOrgAdmin },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User created and added");
      setShowAddMemberDialog(false);
      resetAddMemberForm();
      fetchOrgDetails(selectedOrg);
      fetchOrganizations();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally { setAddingMember(false); }
  };

  const togglePermission = (key: string) => {
    setDisabledPermissions((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const toggleIntegration = (slug: string) => {
    setDisabledIntegrations((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  };

  const saveFeatureOverrides = async () => {
    if (!selectedOrg) return;
    setSavingOverrides(true);
    try {
      const payload = { organization_id: selectedOrg.id, disabled_permissions: disabledPermissions, disabled_integrations: disabledIntegrations };
      if (overrideId) {
        await supabase.from("organization_feature_overrides").update(payload).eq("id", overrideId);
      } else {
        const { data } = await supabase.from("organization_feature_overrides").insert(payload).select().single();
        if (data) setOverrideId(data.id);
      }
      toast.success("Feature overrides saved");
    } catch { toast.error("Failed to save overrides"); }
    finally { setSavingOverrides(false); }
  };

  const getOrgSubscription = (orgId: string) => subscriptions.find((s) => s.organization_id === orgId);

  if (orgLoading || isLoading) {
    return <div className="space-y-6"><TableSkeleton columns={4} rows={5} /></div>;
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organizations</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organizations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">All Organizations</CardTitle>
            <CardDescription>Select to manage</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[70vh] overflow-y-auto">
              {organizations.map((org) => {
                const sub = getOrgSubscription(org.id);
                return (
                  <div
                    key={org.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedOrg?.id === org.id ? "bg-muted" : ""}`}
                    onClick={() => fetchOrgDetails(org)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                          {sub && <span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${STATUS_DOTS[sub.status] || "bg-muted-foreground"}`} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{org.name}</p>
                            {sub && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PLAN_BADGE_COLORS[sub.billing_plans?.slug || ""] || "bg-muted text-muted-foreground"}`}>
                                {sub.billing_plans?.name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {org.member_count} member{org.member_count !== 1 ? "s" : ""}
                            {sub?.status === "trial" && sub.trial_ends_at && (
                              <span className="text-warning ml-1">· {Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))}d left</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge variant={org.is_active ? "default" : "secondary"} className="text-[10px]">
                        {org.is_active ? "Active" : "Off"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Organization Details */}
        <Card className="lg:col-span-2">
          {selectedOrg ? (
            <Tabs defaultValue="details">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedOrg.name}
                      <Badge variant={selectedOrg.is_active ? "default" : "secondary"}>{selectedOrg.is_active ? "Active" : "Inactive"}</Badge>
                    </CardTitle>
                    <CardDescription>Slug: {selectedOrg.slug}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleOrgStatus(selectedOrg)}>
                    {selectedOrg.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="features">Features</TabsTrigger>
                  <TabsTrigger value="subscription">Subscription</TabsTrigger>
                  <TabsTrigger value="usage">Usage</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-muted-foreground">Created</Label><p className="font-medium">{format(new Date(selectedOrg.created_at), "PPP")}</p></div>
                    <div><Label className="text-muted-foreground">Members</Label><p className="font-medium">{orgMembers.length}</p></div>
                    <div><Label className="text-muted-foreground">Status</Label><p className="font-medium">{selectedOrg.is_active ? "Active" : "Inactive"}</p></div>
                    <div><Label className="text-muted-foreground">Modules</Label><p className="font-medium">{orgModules.filter((m) => m.is_enabled).length} / {allModules.length}</p></div>
                  </div>
                </TabsContent>

                {/* Members Tab */}
                <TabsContent value="members">
                  <div className="flex justify-end mb-4">
                    <Dialog open={showAddMemberDialog} onOpenChange={(open) => { setShowAddMemberDialog(open); if (open) resetAddMemberForm(); }}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Member</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Member to {selectedOrg.name}</DialogTitle>
                          <DialogDescription>Create a new user for this org{orgMembers.length === 0 && <span className="block mt-1 text-primary font-medium">This will be the primary admin</span>}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2"><Label>Full Name *</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" /></div>
                          <div className="space-y-2"><Label>Email *</Label><Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="john@example.com" /></div>
                          <div className="space-y-2"><Label>Phone</Label><Input type="tel" value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} placeholder="+91 9876543210" /></div>
                          <div className="space-y-2"><Label>Password *</Label><Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Min 6 characters" /></div>
                          <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-background z-50">{ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between"><Label>Organization Admin</Label><Switch checked={newMemberIsOrgAdmin} onCheckedChange={setNewMemberIsOrgAdmin} /></div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>Cancel</Button>
                          <Button onClick={addMemberToOrg} disabled={!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim() || addingMember}>{addingMember ? "Creating..." : "Create User"}</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Admin</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {orgMembers.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.profile?.full_name || "Unknown"}</TableCell>
                          <TableCell>{m.profile?.email || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                          <TableCell><Switch checked={m.is_org_admin} onCheckedChange={() => toggleOrgAdmin(m)} /></TableCell>
                        </TableRow>
                      ))}
                      {orgMembers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No members</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* Features Tab - Enhanced with 3 sections */}
                <TabsContent value="features">
                  <div className="space-y-6">
                    {/* Section A: Core Modules */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Core Modules</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {allModules.map((module) => {
                          const orgModule = orgModules.find((om) => om.module_id === module.id);
                          return (
                            <div key={module.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div><span className="text-sm font-medium">{module.name}</span>{module.description && <p className="text-xs text-muted-foreground">{module.description}</p>}</div>
                              <Switch checked={orgModule?.is_enabled ?? false} onCheckedChange={() => toggleModule(module.id)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section B: Sidebar Permissions */}
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Sidebar Permissions</h3>
                      <p className="text-xs text-muted-foreground mb-3">Disable specific sidebar sections for this organization. Disabled items won't appear for any user.</p>
                      <div className="space-y-4">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="text-xs font-medium text-muted-foreground mb-2">{group.label}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.permissions.map((perm) => (
                                <div key={perm} className="flex items-center justify-between p-2.5 border rounded-lg">
                                  <span className="text-sm">{PERMISSION_LABELS[perm as PermissionKey] || perm}</span>
                                  <Switch
                                    checked={!disabledPermissions.includes(perm)}
                                    onCheckedChange={() => togglePermission(perm)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section C: Integration Access */}
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Integration Access</h3>
                      <p className="text-xs text-muted-foreground mb-3">Control which integrations this organization can configure in Settings.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {INTEGRATION_SLUGS.map((int) => (
                          <div key={int.slug} className="flex items-center justify-between p-2.5 border rounded-lg">
                            <span className="text-sm">{int.label}</span>
                            <Switch
                              checked={!disabledIntegrations.includes(int.slug)}
                              onCheckedChange={() => toggleIntegration(int.slug)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button onClick={saveFeatureOverrides} disabled={savingOverrides}>
                      {savingOverrides ? "Saving..." : "Save Feature Overrides"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="subscription">
                  <SubscriptionManager organizationId={selectedOrg.id} organizationName={selectedOrg.name} />
                </TabsContent>

                <TabsContent value="usage">
                  <UsageTracker organizationId={selectedOrg.id} />
                </TabsContent>
              </CardContent>
            </Tabs>
          ) : (
            <CardContent className="flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an organization to view details</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminOrganizations;
