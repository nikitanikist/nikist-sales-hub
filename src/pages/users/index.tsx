import { Plus, Users as UsersIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageIntro } from "@/components/PageIntro";
import { useUsersData } from "./hooks/useUsersData";
import UsersTable from "./UsersTable";
import UsersDialogs from "./UsersDialogs";

const Users = () => {
  const {
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
  } = useUsersData();

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <PageIntro
        icon={UsersIcon}
        tagline="Team Members"
        description="Manage access and roles for your organization."
        variant="violet"
      />

      <div className="flex justify-end">
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
          <UsersTable
            users={users}
            isLoading={isLoading}
            onEdit={openEditDialog}
            onDelete={setDeleteUserId}
            onAdd={() => setIsAddDialogOpen(true)}
          />
        </CardContent>
      </Card>

      <UsersDialogs
        isEditDialogOpen={isEditDialogOpen}
        setIsEditDialogOpen={setIsEditDialogOpen}
        editingUser={editingUser}
        setEditingUser={setEditingUser}
        formData={formData}
        setFormData={setFormData}
        userPermissions={userPermissions}
        setUserPermissions={setUserPermissions}
        isLoadingPermissions={isLoadingPermissions}
        isSubmitting={isSubmitting}
        handleEditUser={handleEditUser}
        handleRoleChange={handleRoleChange}
        handleResetToDefaults={handleResetToDefaults}
        togglePermission={togglePermission}
        deleteUserId={deleteUserId}
        setDeleteUserId={setDeleteUserId}
        handleDeleteUser={handleDeleteUser}
        orgName={currentOrganization?.name || "this organization"}
      />
    </div>
  );
};

export default Users;
