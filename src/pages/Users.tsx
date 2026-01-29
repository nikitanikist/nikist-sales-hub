import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Users as UsersIcon, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PERMISSION_KEYS, PERMISSION_LABELS, PERMISSION_GROUPS, getDefaultPermissionsForRole, PermissionKey } from "@/lib/permissions";
import { useOrganization } from "@/hooks/useOrganization";
import { cn } from "@/lib/utils";

interface UserWithRole {
  id: string;
  membership_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_org_admin: boolean;
  role_created_at: string;
}

const Users = () => {
  const { currentOrganization } = useOrganization();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "sales_rep",
    password: "",
  });
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<PermissionKey, boolean>>({} as Record<PermissionKey, boolean>);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const queryClient = useQueryClient();

  // Query organization members for current org only
  const { data: users, isLoading } = useQuery({
    queryKey: ["org-users", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];

      // Fetch organization members for current org only
      const { data: members, error } = await supabase
        .from("organization_members")
        .select(`
          id,
          user_id,
          role,
          is_org_admin,
          created_at
        `)
        .eq("organization_id", currentOrganization.id);

      if (error) throw error;

      // Get profile details for these members
      const userIds = members?.map(m => m.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Map to expected format
      return (members || []).map(m => {
        const profile = profiles?.find(p => p.id === m.user_id);
        return {
          id: m.user_id,
          membership_id: m.id,
          full_name: profile?.full_name || "",
          email: profile?.email || "",
          phone: profile?.phone || null,
          role: m.role,
          is_org_admin: m.is_org_admin || false,
          role_created_at: m.created_at,
        };
      });
    },
    enabled: !!currentOrganization,
  });

  // Fetch permissions when editing a user
  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!editingUser) {
        setUserPermissions({} as Record<PermissionKey, boolean>);
        return;
      }

      setIsLoadingPermissions(true);
      try {
        const { data: perms, error } = await supabase
          .from("user_permissions")
          .select("permission_key, is_enabled")
          .eq("user_id", editingUser.id);

        if (error) throw error;

        // If user has stored permissions, use them
        if (perms && perms.length > 0) {
          const permMap: Record<PermissionKey, boolean> = {} as Record<PermissionKey, boolean>;
          Object.values(PERMISSION_KEYS).forEach(key => {
            const perm = perms.find(p => p.permission_key === key);
            permMap[key] = perm ? perm.is_enabled : false;
          });
          setUserPermissions(permMap);
        } else {
          // Fall back to role defaults
          setUserPermissions(getDefaultPermissionsForRole(editingUser.role));
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        // Fall back to role defaults
        setUserPermissions(getDefaultPermissionsForRole(editingUser.role));
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    fetchUserPermissions();
  }, [editingUser]);

  // Reset permissions to role defaults
  const handleResetToDefaults = () => {
    setUserPermissions(getDefaultPermissionsForRole(formData.role));
    toast.info("Permissions reset to role defaults");
  };

  // Update permissions when role changes in edit mode
  const handleRoleChange = (newRole: string) => {
    setFormData({ ...formData, role: newRole });
    // Also update permissions to new role defaults
    setUserPermissions(getDefaultPermissionsForRole(newRole));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error("Name, email, and password are required");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!currentOrganization) {
      toast.error("No organization selected");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create",
          organization_id: currentOrganization.id,
          email: formData.email.trim(),
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          password: formData.password,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${formData.full_name} has been added successfully`);
      setFormData({ full_name: "", email: "", phone: "", role: "sales_rep", password: "" });
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["org-users", currentOrganization.id] });
    } catch (error: any) {
      toast.error(error.message || "Failed to add user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser || !currentOrganization) return;

    if (!formData.full_name.trim() || !formData.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get enabled permissions as array
      const enabledPermissions = Object.entries(userPermissions)
        .filter(([_, enabled]) => enabled)
        .map(([key]) => key);

      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "update",
          user_id: editingUser.id,
          organization_id: currentOrganization.id,
          membership_id: editingUser.membership_id,
          email: formData.email.trim(),
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          password: formData.password.trim() || undefined,
          permissions: enabledPermissions,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${formData.full_name} has been updated successfully`);
      setFormData({ full_name: "", email: "", phone: "", role: "sales_rep", password: "" });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      setUserPermissions({} as Record<PermissionKey, boolean>);
      queryClient.invalidateQueries({ queryKey: ["org-users", currentOrganization.id] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId || !currentOrganization) return;

    // Find the user to get their membership_id
    const userToDelete = users?.find(u => u.id === deleteUserId);
    if (!userToDelete) return;

    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "delete",
          user_id: deleteUserId,
          organization_id: currentOrganization.id,
          membership_id: userToDelete.membership_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("User removed from organization successfully");
      setDeleteUserId(null);
      queryClient.invalidateQueries({ queryKey: ["org-users", currentOrganization.id] });
    } catch (error: any) {
      toast.error(error.message || "Failed to remove user");
    }
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      password: "",
    });
    setIsEditDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "sales_rep":
        return "bg-sky-100 text-sky-700 border-sky-200";
      case "manager":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "sales_rep":
        return "Closer";
      case "manager":
        return "Manager";
      case "viewer":
        return "Viewer";
      default:
        return role;
    }
  };

  const togglePermission = (key: PermissionKey) => {
    setUserPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage users in {currentOrganization?.name || "your organization"}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto h-11 sm:h-10">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  placeholder="Enter full name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="h-11 sm:h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-11 sm:h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="Enter phone number (optional)"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-11 sm:h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="sales_rep">Closer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password (min 6 characters)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="h-11 sm:h-10"
                />
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto h-11 sm:h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto h-11 sm:h-10">
                  {isSubmitting ? "Adding..." : "Add User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg sm:text-xl">Organization Users</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Users with access to {currentOrganization?.name || "this organization"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : (
            <>
            {/* Desktop Table View */}
            <div className="hidden sm:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users && users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">{user.email}</div>
                            {user.phone && <div className="text-sm text-muted-foreground">{user.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", getRoleBadgeColor(user.role))}>
                            {getRoleLabel(user.role)}
                          </span>
                        </TableCell>
                        <TableCell>{format(new Date(user.role_created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteUserId(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex flex-col items-center justify-center text-center py-8">
                          <div className="rounded-full bg-muted p-4 mb-4">
                            <UsersIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold text-lg mb-1">No users found</h3>
                          <p className="text-sm text-muted-foreground max-w-sm mb-4">
                            Add team members to get started with your organization.
                          </p>
                          <Button onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add User
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {users && users.length > 0 ? (
                users.map((user) => (
                  <div key={user.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                      </div>
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", getRoleBadgeColor(user.role))}>
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground">
                        Added {format(new Date(user.role_created_at), "dd MMM yyyy")}
                      </p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteUserId(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <UsersIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium mb-1">No users found</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add team members to get started.
                  </p>
                  <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              )}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingUser(null);
          setUserPermissions({} as Record<PermissionKey, boolean>);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Full Name *</Label>
              <Input
                id="edit_full_name"
                placeholder="Enter full name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                className="h-11 sm:h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="h-11 sm:h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_phone">Phone</Label>
              <Input
                id="edit_phone"
                placeholder="Enter phone number (optional)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-11 sm:h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_role">Role *</Label>
              <Select value={formData.role} onValueChange={handleRoleChange}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sales_rep">Closer</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_password">New Password</Label>
              <Input
                id="edit_password"
                type="password"
                placeholder="Leave blank to keep current password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={6}
                className="h-11 sm:h-10"
              />
              <p className="text-xs text-muted-foreground">Leave blank to keep the current password</p>
            </div>

            <Separator className="my-4" />

            {/* Menu Access Permissions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Menu Access</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Control which menu items this user can see
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToDefaults}
                  className="h-8"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>

              {formData.role === 'admin' ? (
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-sm text-muted-foreground text-center">
                    Admins have access to all menu items
                  </p>
                </div>
              ) : isLoadingPermissions ? (
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-sm text-muted-foreground text-center">
                    Loading permissions...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label} className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </Label>
                      <div className="space-y-1">
                        {group.permissions.map((permKey) => (
                          <div
                            key={permKey}
                            className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm">{PERMISSION_LABELS[permKey]}</span>
                            <Switch
                              checked={userPermissions[permKey] ?? false}
                              onCheckedChange={() => togglePermission(permKey)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto h-11 sm:h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto h-11 sm:h-10">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user from organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user's access to {currentOrganization?.name || "this organization"}. The user account will still exist and may have access to other organizations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Users;
