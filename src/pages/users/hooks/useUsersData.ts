import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PERMISSION_KEYS, getDefaultPermissionsForRole, PermissionKey } from "@/lib/permissions";
import { useOrganization } from "@/hooks/useOrganization";

export interface UserWithRole {
  id: string;
  membership_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_org_admin: boolean;
  role_created_at: string;
}

export function useUsersData() {
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

  const { data: users, isLoading } = useQuery({
    queryKey: ["org-users", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];

      const { data: members, error } = await supabase
        .from("organization_members")
        .select(`id, user_id, role, is_org_admin, created_at`)
        .eq("organization_id", currentOrganization.id);

      if (error) throw error;

      const userIds = members?.map(m => m.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);

      if (profilesError) throw profilesError;

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

        if (perms && perms.length > 0) {
          const permMap: Record<PermissionKey, boolean> = {} as Record<PermissionKey, boolean>;
          Object.values(PERMISSION_KEYS).forEach(key => {
            const perm = perms.find(p => p.permission_key === key);
            permMap[key] = perm ? perm.is_enabled : false;
          });
          setUserPermissions(permMap);
        } else {
          setUserPermissions(getDefaultPermissionsForRole(editingUser.role));
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        setUserPermissions(getDefaultPermissionsForRole(editingUser.role));
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    fetchUserPermissions();
  }, [editingUser]);

  const handleResetToDefaults = () => {
    setUserPermissions(getDefaultPermissionsForRole(formData.role));
    toast.info("Permissions reset to role defaults");
  };

  const handleRoleChange = (newRole: string) => {
    setFormData({ ...formData, role: newRole });
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

  const togglePermission = (key: PermissionKey) => {
    setUserPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return {
    currentOrganization,
    users,
    isLoading,
    isAddDialogOpen,
    setIsAddDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    deleteUserId,
    setDeleteUserId,
    isSubmitting,
    formData,
    setFormData,
    editingUser,
    setEditingUser,
    userPermissions,
    setUserPermissions,
    isLoadingPermissions,
    handleResetToDefaults,
    handleRoleChange,
    handleAddUser,
    handleEditUser,
    handleDeleteUser,
    openEditDialog,
    togglePermission,
  };
}

export const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case "admin": return "bg-violet-100 text-violet-700 border-violet-200";
    case "sales_rep": return "bg-sky-100 text-sky-700 border-sky-200";
    case "manager": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export const getRoleLabel = (role: string) => {
  switch (role) {
    case "admin": return "Admin";
    case "sales_rep": return "Closer";
    case "manager": return "Manager";
    case "viewer": return "Viewer";
    default: return role;
  }
};
