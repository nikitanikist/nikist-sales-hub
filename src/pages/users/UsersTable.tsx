import React from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserWithRole } from "./hooks/useUsersData";
import { getRoleBadgeColor, getRoleLabel } from "./hooks/useUsersData";

interface UsersTableProps {
  users: UserWithRole[] | undefined;
  isLoading: boolean;
  onEdit: (user: UserWithRole) => void;
  onDelete: (userId: string) => void;
  onAdd: () => void;
}

const UsersTable = React.memo(function UsersTable({
  users,
  isLoading,
  onEdit,
  onDelete,
  onAdd,
}: UsersTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
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
                <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
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
                      <Button variant="ghost" size="icon" onClick={() => onEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(user.id)}
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
                    <Button onClick={onAdd}>
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
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(user)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(user.id)}
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
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        )}
      </div>
    </>
  );
});

export default UsersTable;
