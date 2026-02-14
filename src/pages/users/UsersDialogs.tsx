import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { PERMISSION_LABELS, PERMISSION_GROUPS, PermissionKey } from "@/lib/permissions";

interface UsersDialogsProps {
  // Edit dialog
  isEditDialogOpen: boolean;
  setIsEditDialogOpen: (open: boolean) => void;
  editingUser: any;
  setEditingUser: (user: any) => void;
  formData: { full_name: string; email: string; phone: string; role: string; password: string };
  setFormData: (data: any) => void;
  userPermissions: Record<PermissionKey, boolean>;
  setUserPermissions: (perms: Record<PermissionKey, boolean>) => void;
  isLoadingPermissions: boolean;
  isSubmitting: boolean;
  handleEditUser: (e: React.FormEvent) => void;
  handleRoleChange: (role: string) => void;
  handleResetToDefaults: () => void;
  togglePermission: (key: PermissionKey) => void;
  // Delete dialog
  deleteUserId: string | null;
  setDeleteUserId: (id: string | null) => void;
  handleDeleteUser: () => void;
  orgName: string;
}

const UsersDialogs = React.memo(function UsersDialogs({
  isEditDialogOpen,
  setIsEditDialogOpen,
  editingUser,
  setEditingUser,
  formData,
  setFormData,
  userPermissions,
  setUserPermissions,
  isLoadingPermissions,
  isSubmitting,
  handleEditUser,
  handleRoleChange,
  handleResetToDefaults,
  togglePermission,
  deleteUserId,
  setDeleteUserId,
  handleDeleteUser,
  orgName,
}: UsersDialogsProps) {
  return (
    <>
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
              This will remove the user's access to {orgName}. The user account will still exist and may have access to other organizations.
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
    </>
  );
});

export default UsersDialogs;
