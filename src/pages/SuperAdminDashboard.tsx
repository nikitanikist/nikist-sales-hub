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
import { Building2, Users, Settings, Plus, Edit, Trash2, Shield, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { StatsCardsSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageIntro } from "@/components/PageIntro";

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
  profile?: {
    full_name: string;
    email: string;
  };
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

const SuperAdminDashboard = () => {
  const { isSuperAdmin, isLoading: orgLoading, refreshOrganizations } = useOrganization();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [orgModules, setOrgModules] = useState<OrganizationModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  
  // Add Member state - Create new user flow
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<string>("admin");
  const [newMemberIsOrgAdmin, setNewMemberIsOrgAdmin] = useState(true);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    if (!orgLoading && !isSuperAdmin) {
      toast.error("Access denied. Super Admin privileges required.");
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
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .order("display_order");
    
    if (!error && data) {
      setAllModules(data as Module[]);
    }
  };

  const fetchOrganizations = async () => {
    setIsLoading(true);
    try {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name");

      if (error) {
        console.error("Error fetching organizations:", error);
        toast.error("Failed to load organizations: " + error.message);
        setOrganizations([]);
        return;
      }

      if (!orgs || orgs.length === 0) {
        setOrganizations([]);
        return;
      }

      // Get member counts for each org
      const orgsWithCounts = await Promise.all(
        orgs.map(async (org) => {
          try {
            const { count, error: countError } = await supabase
              .from("organization_members")
              .select("*", { count: "exact", head: true })
              .eq("organization_id", org.id);

            if (countError) {
              console.warn(`Error fetching member count for ${org.name}:`, countError);
              return { ...org, member_count: 0 };
            }

            return { ...org, member_count: count || 0 };
          } catch (err) {
            console.warn(`Error fetching member count for ${org.name}:`, err);
            return { ...org, member_count: 0 };
          }
        })
      );

      setOrganizations(orgsWithCounts);
    } catch (error: any) {
      console.error("Error fetching organizations:", error);
      toast.error("Failed to load organizations: " + (error?.message || "Unknown error"));
      setOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrgDetails = async (org: Organization) => {
    setSelectedOrg(org);

    try {
      // Fetch members
      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select(`
          id,
          user_id,
          role,
          is_org_admin,
          created_at
        `)
        .eq("organization_id", org.id);

      if (membersError) throw membersError;

      // Fetch profiles for members
      const memberUserIds = (members || []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", memberUserIds);

      const membersWithProfiles = (members || []).map((member) => ({
        ...member,
        profile: profiles?.find((p) => p.id === member.user_id),
      }));

      setOrgMembers(membersWithProfiles);

      // Fetch organization modules
      const { data: modules, error: modulesError } = await supabase
        .from("organization_modules")
        .select(`
          id,
          module_id,
          is_enabled,
          modules (*)
        `)
        .eq("organization_id", org.id);

      if (modulesError) throw modulesError;
      setOrgModules((modules || []) as OrganizationModule[]);
    } catch (error) {
      console.error("Error fetching org details:", error);
      toast.error("Failed to load organization details");
    }
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

      // Enable all modules for the new organization
      if (allModules.length > 0) {
        const defaultModules = allModules.map((m) => ({
          organization_id: data.id,
          module_id: m.id,
          is_enabled: true,
          enabled_at: new Date().toISOString(),
        }));

        await supabase.from("organization_modules").insert(defaultModules);
      }

      toast.success("Organization created successfully");
      setShowCreateDialog(false);
      setNewOrgName("");
      setNewOrgSlug("");
      fetchOrganizations();
      refreshOrganizations();
    } catch (error: any) {
      console.error("Error creating organization:", error);
      toast.error(error.message || "Failed to create organization");
    }
  };

  const toggleOrgStatus = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ is_active: !org.is_active })
        .eq("id", org.id);

      if (error) throw error;

      toast.success(`Organization ${org.is_active ? "deactivated" : "activated"}`);
      fetchOrganizations();
      if (selectedOrg?.id === org.id) {
        setSelectedOrg({ ...org, is_active: !org.is_active });
      }
    } catch (error) {
      console.error("Error toggling org status:", error);
      toast.error("Failed to update organization status");
    }
  };

  const toggleModule = async (moduleId: string) => {
    if (!selectedOrg) return;

    const existingOrgModule = orgModules.find((om) => om.module_id === moduleId);

    try {
      if (existingOrgModule) {
        // Update existing record
        const { error } = await supabase
          .from("organization_modules")
          .update({ 
            is_enabled: !existingOrgModule.is_enabled,
            enabled_at: !existingOrgModule.is_enabled ? new Date().toISOString() : null
          })
          .eq("id", existingOrgModule.id);

        if (error) throw error;
      } else {
        // Insert new record for this org + module
        const { error } = await supabase
          .from("organization_modules")
          .insert({
            organization_id: selectedOrg.id,
            module_id: moduleId,
            is_enabled: true,
            enabled_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // Refresh modules for the selected org
      const { data: modules } = await supabase
        .from("organization_modules")
        .select(`
          id,
          module_id,
          is_enabled,
          modules (*)
        `)
        .eq("organization_id", selectedOrg.id);

      setOrgModules((modules || []) as OrganizationModule[]);
      toast.success("Module updated");
    } catch (error) {
      console.error("Error toggling module:", error);
      toast.error("Failed to update module");
    }
  };

  const toggleOrgAdmin = async (member: OrganizationMember) => {
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ is_org_admin: !member.is_org_admin })
        .eq("id", member.id);

      if (error) throw error;

      setOrgMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, is_org_admin: !m.is_org_admin } : m
        )
      );
      toast.success("Member updated");
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error("Failed to update member");
    }
  };

  const resetAddMemberForm = () => {
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPhone("");
    setNewUserPassword("");
    // Default to admin for first member, otherwise viewer
    const isFirstMember = orgMembers.length === 0;
    setNewMemberRole(isFirstMember ? "admin" : "viewer");
    setNewMemberIsOrgAdmin(isFirstMember);
  };

  const addMemberToOrg = async () => {
    if (!selectedOrg) {
      toast.error("No organization selected");
      return;
    }

    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      toast.error("Please fill in all required fields (Name, Email, Password)");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Password validation
    if (newUserPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setAddingMember(true);
    try {
      // Create the user and add to organization via edge function
      const { data, error: fnError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          organization_id: selectedOrg.id,
          email: newUserEmail.trim(),
          full_name: newUserName.trim(),
          phone: newUserPhone.trim() || null,
          password: newUserPassword,
          role: newMemberRole,
          is_org_admin: newMemberIsOrgAdmin,
        }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      toast.success("Client user created and added to organization successfully");
      setShowAddMemberDialog(false);
      resetAddMemberForm();
      fetchOrgDetails(selectedOrg);
      fetchOrganizations();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setAddingMember(false);
    }
  };

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
          <div className="skeleton-shimmer h-8 w-48 rounded" />
        </div>
        <StatsCardsSkeleton count={4} />
        <TableSkeleton columns={5} rows={5} />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        icon={Shield}
        tagline="System Overview"
        description="Monitor all organizations and platform health."
        variant="rose"
      />

      {/* Action Buttons */}
      <div className="flex justify-end">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Add a new organization to the platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setNewOrgSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-")
                    );
                  }}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug (URL-friendly)</Label>
                <Input
                  id="org-slug"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  placeholder="acme-corp"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createOrganization}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Organizations</CardTitle>
            <Check className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter((o) => o.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.reduce((acc, o) => acc + (o.member_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Organizations</CardTitle>
            <X className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter((o) => !o.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organizations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>Select an organization to manage</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedOrg?.id === org.id ? "bg-muted" : ""
                  }`}
                  onClick={() => fetchOrgDetails(org)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {org.member_count} member{org.member_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant={org.is_active ? "default" : "secondary"}>
                      {org.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
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
                      <Badge variant={selectedOrg.is_active ? "default" : "secondary"}>
                        {selectedOrg.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>Slug: {selectedOrg.slug}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleOrgStatus(selectedOrg)}
                    >
                      {selectedOrg.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="features">Features</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <p className="font-medium">
                        {format(new Date(selectedOrg.created_at), "PPP")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Members</Label>
                      <p className="font-medium">{orgMembers.length}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p className="font-medium">
                        {selectedOrg.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Modules Enabled</Label>
                      <p className="font-medium">
                        {orgModules.filter((m) => m.is_enabled).length} / {allModules.length}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="members">
                  <div className="flex justify-end mb-4">
                    <Dialog 
                      open={showAddMemberDialog} 
                      onOpenChange={(open) => {
                        setShowAddMemberDialog(open);
                        if (open) {
                          resetAddMemberForm();
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Member to {selectedOrg?.name}</DialogTitle>
                          <DialogDescription>
                            Create a new user account for this organization
                            {orgMembers.length === 0 && (
                              <span className="block mt-1 text-primary font-medium">
                                This will be the primary admin for this organization
                              </span>
                            )}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="new-user-name">Full Name *</Label>
                            <Input
                              id="new-user-name"
                              value={newUserName}
                              onChange={(e) => setNewUserName(e.target.value)}
                              placeholder="John Doe"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-user-email">Email *</Label>
                            <Input
                              id="new-user-email"
                              type="email"
                              value={newUserEmail}
                              onChange={(e) => setNewUserEmail(e.target.value)}
                              placeholder="john@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-user-phone">Phone Number</Label>
                            <Input
                              id="new-user-phone"
                              type="tel"
                              value={newUserPhone}
                              onChange={(e) => setNewUserPhone(e.target.value)}
                              placeholder="+91 9876543210"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-user-password">Password *</Label>
                            <Input
                              id="new-user-password"
                              type="password"
                              value={newUserPassword}
                              onChange={(e) => setNewUserPassword(e.target.value)}
                              placeholder="Minimum 6 characters"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                              <SelectTrigger className="bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background z-50">
                                {ROLE_OPTIONS.map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="org-admin-switch">Make Organization Admin</Label>
                            <Switch
                              id="org-admin-switch"
                              checked={newMemberIsOrgAdmin}
                              onCheckedChange={setNewMemberIsOrgAdmin}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowAddMemberDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={addMemberToOrg} 
                            disabled={!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim() || addingMember}
                          >
                            {addingMember ? "Creating..." : "Create User"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Org Admin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.profile?.full_name || "Unknown"}
                          </TableCell>
                          <TableCell>{member.profile?.email || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{member.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={member.is_org_admin}
                              onCheckedChange={() => toggleOrgAdmin(member)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {orgMembers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No members in this organization
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="features">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enable or disable modules for this organization
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {allModules.map((module) => {
                        const orgModule = orgModules.find(
                          (om) => om.module_id === module.id
                        );
                        const isEnabled = orgModule?.is_enabled ?? false;

                        return (
                          <div
                            key={module.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="space-y-1">
                              <span className="text-sm font-medium">{module.name}</span>
                              {module.description && (
                                <p className="text-xs text-muted-foreground">
                                  {module.description}
                                </p>
                              )}
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={() => toggleModule(module.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
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

export default SuperAdminDashboard;
