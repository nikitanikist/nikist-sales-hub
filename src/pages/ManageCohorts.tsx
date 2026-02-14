import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, GraduationCap, Loader2, Users, TrendingUp, Rocket, Star, Zap, Target, Award, BookOpen, FolderOpen, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { useUserRole } from "@/hooks/useUserRole";
import { PageIntro } from "@/components/PageIntro";

interface CohortType {
  id: string;
  name: string;
  slug: string;
  route: string;
  icon: string | null;
  display_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
}

// Available icons for cohort types
const AVAILABLE_ICONS = [
  { value: "Users", label: "Users", icon: Users },
  { value: "GraduationCap", label: "Graduation Cap", icon: GraduationCap },
  { value: "TrendingUp", label: "Trending Up", icon: TrendingUp },
  { value: "Rocket", label: "Rocket", icon: Rocket },
  { value: "Star", label: "Star", icon: Star },
  { value: "Zap", label: "Zap", icon: Zap },
  { value: "Target", label: "Target", icon: Target },
  { value: "Award", label: "Award", icon: Award },
  { value: "BookOpen", label: "Book Open", icon: BookOpen },
];

const getIconComponent = (iconName: string | null) => {
  const found = AVAILABLE_ICONS.find(i => i.value === iconName);
  return found?.icon || Users;
};

const ManageCohorts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<CohortType | null>(null);
  const [deletingCohort, setDeletingCohort] = useState<CohortType | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("Users");
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch cohort types
  const { data: cohortTypes, isLoading } = useQuery({
    queryKey: ["cohort-types-manage", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from("cohort_types")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as CohortType[];
    },
    enabled: !!currentOrganization,
  });

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; icon: string; is_active: boolean }) => {
      if (!currentOrganization) throw new Error("No organization");
      
      const slug = generateSlug(data.name);
      const route = `/cohorts/${slug}`;
      const maxOrder = cohortTypes?.reduce((max, ct) => Math.max(max, ct.display_order || 0), 0) || 0;
      
      const { error } = await supabase
        .from("cohort_types")
        .insert({
          organization_id: currentOrganization.id,
          name: data.name,
          slug,
          route,
          icon: data.icon,
          is_active: data.is_active,
          display_order: maxOrder + 1,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-types"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-types-manage"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Cohort type created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error creating cohort type", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; icon: string; is_active: boolean }) => {
      const slug = generateSlug(data.name);
      const route = `/cohorts/${slug}`;
      
      const { error } = await supabase
        .from("cohort_types")
        .update({
          name: data.name,
          slug,
          route,
          icon: data.icon,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-types"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-types-manage"] });
      setEditingCohort(null);
      resetForm();
      toast({ title: "Cohort type updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error updating cohort type", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cohort_types")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-types"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-types-manage"] });
      setDeletingCohort(null);
      toast({ title: "Cohort type deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting cohort type", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormIcon("Users");
    setFormIsActive(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formName,
      icon: formIcon,
      is_active: formIsActive,
    });
  };

  const handleUpdate = () => {
    if (!editingCohort) return;
    updateMutation.mutate({
      id: editingCohort.id,
      name: formName,
      icon: formIcon,
      is_active: formIsActive,
    });
  };

  const openEdit = (cohort: CohortType) => {
    setFormName(cohort.name);
    setFormIcon(cohort.icon || "Users");
    setFormIsActive(cohort.is_active ?? true);
    setEditingCohort(cohort);
  };

  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  if (!currentOrganization) {
    return (
      <EmptyState 
        icon={FolderOpen}
        title="No organization" 
        description="Please select an organization to continue." 
      />
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState 
        icon={Lock}
        title="Access Denied" 
        description="Only administrators can manage cohort types."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        icon={GraduationCap}
        tagline="Cohort Management"
        description="Organize and track your learning cohorts."
        variant="violet"
      />

      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Cohort Type
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !cohortTypes?.length ? (
        <EmptyState
          icon={GraduationCap}
          title="No cohort types yet"
          description="Create your first cohort type to organize your batches and students."
          actionLabel="Create Cohort Type"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cohortTypes.map((cohort) => {
            const IconComponent = getIconComponent(cohort.icon);
            return (
              <Card key={cohort.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{cohort.name}</CardTitle>
                        <CardDescription className="text-xs">{cohort.route}</CardDescription>
                      </div>
                    </div>
                    {!cohort.is_active && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Inactive</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(cohort)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setDeletingCohort(cohort)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Cohort Type</DialogTitle>
            <DialogDescription>Add a new cohort category to organize your batches</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Premium Mentorship, Beginner Course"
              />
              {formName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Route: /cohorts/{generateSlug(formName)}
                </p>
              )}
            </div>
            <div>
              <Label>Icon</Label>
              <Select value={formIcon} onValueChange={setFormIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ICONS.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>
                      <div className="flex items-center gap-2">
                        <icon.icon className="h-4 w-4" />
                        <span>{icon.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreate} 
              disabled={!formName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCohort} onOpenChange={() => setEditingCohort(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cohort Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Premium Mentorship"
              />
              {formName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Route: /cohorts/{generateSlug(formName)}
                </p>
              )}
            </div>
            <div>
              <Label>Icon</Label>
              <Select value={formIcon} onValueChange={setFormIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ICONS.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>
                      <div className="flex items-center gap-2">
                        <icon.icon className="h-4 w-4" />
                        <span>{icon.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCohort(null)}>Cancel</Button>
            <Button 
              onClick={handleUpdate} 
              disabled={!formName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingCohort} onOpenChange={() => setDeletingCohort(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cohort Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCohort?.name}"? This will also delete all batches and students associated with this cohort type. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCohort && deleteMutation.mutate(deletingCohort.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageCohorts;
