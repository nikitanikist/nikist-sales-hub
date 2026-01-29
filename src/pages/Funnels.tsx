import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Filter, Plus, Pencil, Trash2, TrendingUp, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { TableEmptyState } from "@/components/TableEmptyState";

interface Funnel {
  id: string;
  funnel_name: string;
  amount: number | null;
  total_leads: number;
  created_at: string | null;
  updated_at: string;
  created_by: string | null;
}

const Funnels = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [funnelToDelete, setFunnelToDelete] = useState<Funnel | null>(null);
  const [formData, setFormData] = useState({
    funnel_name: "",
    amount: "",
    total_leads: "0",
    workshop_id: "",
    product_id: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  // Fetch lead assignments for counting leads per funnel
  const { data: leadAssignments = [] } = useQuery({
    queryKey: ["lead_assignments", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from("lead_assignments")
        .select("funnel_id, product_id, workshop_id, lead_id")
        .eq("organization_id", currentOrganization.id);

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: funnels = [], refetch, isLoading } = useQuery({
    queryKey: ["funnels", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from("funnels")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Funnel[];
    },
    enabled: !!currentOrganization,
  });

  // Fetch workshops for linking
  const { data: workshops = [] } = useQuery({
    queryKey: ["workshops-funnels", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from("workshops")
        .select("id, title, funnel_id")
        .eq("organization_id", currentOrganization.id)
        .order("title");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  // Fetch products for linking
  const { data: products = [] } = useQuery({
    queryKey: ["products-funnels", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, funnel_id")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("product_name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const createMutation = useMutation({
    mutationFn: async (newFunnel: { funnel_name: string; amount: number; total_leads: number }) => {
      if (!currentOrganization) throw new Error("No organization selected");
      
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("funnels")
        .insert([{ ...newFunnel, created_by: user?.id, organization_id: currentOrganization.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", currentOrganization?.id] });
      toast({ title: "Success", description: "Funnel created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; funnel_name: string; amount: number; total_leads: number }) => {
      const { data, error } = await supabase
        .from("funnels")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", currentOrganization?.id] });
      toast({ title: "Success", description: "Funnel updated successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funnels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", currentOrganization?.id] });
      toast({ title: "Success", description: "Funnel deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Real-time updates
  useEffect(() => {
    if (!currentOrganization) return;
    
    const channel = supabase
      .channel('funnels-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_assignments'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["funnels", currentOrganization.id] });
          queryClient.invalidateQueries({ queryKey: ["workshops-funnels", currentOrganization.id] });
          queryClient.invalidateQueries({ queryKey: ["lead_assignments", currentOrganization.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workshops'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["workshops-funnels", currentOrganization.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["products-funnels", currentOrganization.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentOrganization]);

  // Show loading state while organization is loading
  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  // Wait for organization to be available
  if (!currentOrganization) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No Organization Selected"
        description="Please select an organization to view funnels."
      />
    );
  }

  const filteredFunnels = funnels.filter((funnel) =>
    funnel.funnel_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getWorkshopCount = (funnelId: string) => {
    return workshops.filter((w: any) => w.funnel_id === funnelId).length;
  };

  const getProductCount = (funnelId: string) => {
    return products.filter((p: any) => p.funnel_id === funnelId).length;
  };

  const getLeadCount = (funnelId: string) => {
    // Count unique leads assigned to this funnel
    const uniqueLeads = new Set(
      leadAssignments
        .filter((la: any) => la.funnel_id === funnelId)
        .map((la: any) => la.lead_id)
    );
    return uniqueLeads.size;
  };

  const resetForm = () => {
    setFormData({ funnel_name: "", amount: "", total_leads: "0", workshop_id: "", product_id: "" });
    setEditingFunnel(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const funnelData: any = {
      funnel_name: formData.funnel_name,
      amount: parseFloat(formData.amount),
      total_leads: parseInt(formData.total_leads),
    };

    if (editingFunnel) {
      funnelData.workshop_id = formData.workshop_id || null;
      funnelData.product_id = formData.product_id || null;
      updateMutation.mutate({ id: editingFunnel.id, ...funnelData });
    } else {
      createMutation.mutate(funnelData);
    }
  };

  const handleEdit = (funnel: Funnel) => {
    setEditingFunnel(funnel);
    setFormData({
      funnel_name: funnel.funnel_name,
      amount: (funnel.amount ?? 0).toString(),
      total_leads: (funnel.total_leads ?? 0).toString(),
      workshop_id: (funnel as any).workshop_id || "",
      product_id: (funnel as any).product_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (funnel: Funnel) => {
    setFunnelToDelete(funnel);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (funnelToDelete) {
      deleteMutation.mutate(funnelToDelete.id);
      setDeleteDialogOpen(false);
      setFunnelToDelete(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-6">
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Active Funnels</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search funnels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-11 sm:h-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => refetch()} className="h-11 w-11 sm:h-10 sm:w-10">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-10 sm:w-10">
                <Filter className="h-4 w-4" />
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="h-11 sm:h-10">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Funnel</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingFunnel ? "Edit Funnel" : "Add New Funnel"}</DialogTitle>
                    <DialogDescription>
                      {editingFunnel ? "Update the funnel details below." : "Create a new funnel to organize your products and workshops."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="funnel_name">Funnel Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="funnel_name"
                        value={formData.funnel_name}
                        onChange={(e) => setFormData({ ...formData, funnel_name: e.target.value })}
                        required
                        className="h-11 sm:h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (₹) <span className="text-destructive">*</span></Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                        className="h-11 sm:h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="total_leads">Total Leads</Label>
                      <Input
                        id="total_leads"
                        type="number"
                        value={formData.total_leads}
                        onChange={(e) => setFormData({ ...formData, total_leads: e.target.value })}
                        required
                        className="h-11 sm:h-10"
                      />
                    </div>

                    {editingFunnel && (
                      <div className="border-t pt-4 mt-4">
                        <Label className="text-sm font-medium mb-3 block">Quick Actions</Label>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="workshop_link" className="text-xs">Link to Workshop</Label>
                            <Select value={formData.workshop_id} onValueChange={(value) => setFormData({ ...formData, workshop_id: value })}>
                              <SelectTrigger className="h-11 sm:h-10">
                                <SelectValue placeholder="Select a workshop" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {workshops.map((workshop: any) => (
                                  <SelectItem key={workshop.id} value={workshop.id}>
                                    {workshop.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="product_link" className="text-xs">Link to Product</Label>
                            <Select value={formData.product_id} onValueChange={(value) => setFormData({ ...formData, product_id: value })}>
                              <SelectTrigger className="h-11 sm:h-10">
                                <SelectValue placeholder="Select a product" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {products.filter((p: any) => p.funnel_id === editingFunnel.id).map((product: any) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.product_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button type="submit" className="flex-1 h-11 sm:h-10" disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingFunnel ? "Update Funnel" : "Create Funnel"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-11 sm:h-10">
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading funnels...</div>
          ) : (
            <>
            {/* Desktop Table View */}
            <div className="hidden sm:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funnel Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Total Workshops</TableHead>
                    <TableHead>Total Products</TableHead>
                    <TableHead>Total Leads</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFunnels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No funnels found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFunnels.map((funnel) => (
                      <TableRow key={funnel.id}>
                        <TableCell className="font-medium">{funnel.funnel_name}</TableCell>
                        <TableCell>
                          {Number(funnel.amount || 0) === 0 ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200">
                              Free
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-blue-200">
                              Paid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{getWorkshopCount(funnel.id)}</TableCell>
                        <TableCell>{getProductCount(funnel.id)}</TableCell>
                        <TableCell>{getLeadCount(funnel.id)}</TableCell>
                        <TableCell>{funnel.created_at ? format(new Date(funnel.created_at), "MMM dd, yyyy") : "N/A"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(funnel)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(funnel)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {filteredFunnels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No funnels found</div>
              ) : (
                filteredFunnels.map((funnel) => (
                  <div key={funnel.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{funnel.funnel_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {funnel.created_at ? format(new Date(funnel.created_at), "MMM dd, yyyy") : "N/A"}
                        </p>
                      </div>
                      {Number(funnel.amount || 0) === 0 ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200 text-xs">
                          Free
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-blue-200 text-xs">
                          Paid
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-muted/50 rounded-md p-2">
                        <div className="text-sm font-semibold">{getWorkshopCount(funnel.id)}</div>
                        <div className="text-[10px] text-muted-foreground">Workshops</div>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <div className="text-sm font-semibold">{getProductCount(funnel.id)}</div>
                        <div className="text-[10px] text-muted-foreground">Products</div>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <div className="text-sm font-semibold">{getLeadCount(funnel.id)}</div>
                        <div className="text-[10px] text-muted-foreground">Leads</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-1 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(funnel)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteClick(funnel)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Funnel"
        itemName={funnelToDelete?.funnel_name}
        isDeleting={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default Funnels;
