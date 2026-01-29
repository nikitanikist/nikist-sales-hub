import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, RefreshCw, Pencil, Trash2, Package, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { QuickCreateFunnelDialog } from "@/components/QuickCreateFunnelDialog";
import { TableEmptyState } from "@/components/TableEmptyState";
import { EmptySelectContent } from "@/components/EmptySelectContent";
import { TableSkeleton, MobileCardSkeleton } from "@/components/skeletons";

interface Product {
  id: string;
  funnel_id: string;
  product_name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  mango_id: string | null;
  funnel?: {
    funnel_name: string;
  };
}

interface Funnel {
  id: string;
  funnel_name: string;
}

const Products = () => {
  const queryClient = useQueryClient();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFunnel, setSelectedFunnel] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [quickCreateFunnelOpen, setQuickCreateFunnelOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    funnel_id: "",
    product_name: "",
    description: "",
    price: 0,
    is_active: true,
    workshop_id: "",
  });

  // Fetch products with funnel details
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ["products", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await (supabase as any)
        .from("products")
        .select(`
          *,
          funnel:funnels!products_funnel_id_fkey(funnel_name)
        `)
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!currentOrganization,
  });

  // Fetch funnels for dropdown
  const { data: funnels = [] } = useQuery({
    queryKey: ["funnels", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await (supabase as any)
        .from("funnels")
        .select("id, funnel_name")
        .eq("organization_id", currentOrganization.id)
        .order("funnel_name");

      if (error) throw error;
      return data as Funnel[];
    },
    enabled: !!currentOrganization,
  });

  // Fetch workshops for linking
  const { data: workshops = [] } = useQuery({
    queryKey: ["workshops", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await (supabase as any)
        .from("workshops")
        .select("id, title")
        .eq("organization_id", currentOrganization.id)
        .order("title");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  // Fetch user counts per product using database aggregation
  const { data: productUserCounts = [] } = useQuery({
    queryKey: ["product-user-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_product_user_counts");
      if (error) throw error;
      return data as { product_id: string; user_count: number }[];
    },
  });

  // Create product mutation
  const createMutation = useMutation({
    mutationFn: async (newProduct: typeof formData) => {
      if (!currentOrganization) throw new Error("No organization selected");
      
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("products")
        .insert([{ ...newProduct, created_by: user?.id, organization_id: currentOrganization.id }])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", currentOrganization?.id] });
      toast({ title: "Success", description: "Product created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create product",
        variant: "destructive" 
      });
    },
  });

  // Update product mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("products")
        .update(updates)
        .eq("id", id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", currentOrganization?.id] });
      toast({ title: "Success", description: "Product updated successfully" });
      setIsDialogOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update product",
        variant: "destructive" 
      });
    },
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", currentOrganization?.id] });
      toast({ title: "Success", description: "Product deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete product",
        variant: "destructive" 
      });
    },
  });

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFunnel = selectedFunnel === "all" || product.funnel_id === selectedFunnel;
    return matchesSearch && matchesFunnel;
  });

  const getUserCount = (productId: string) => {
    const countData = productUserCounts.find((item) => item.product_id === productId);
    return countData?.user_count || 0;
  };

  // Real-time updates
  useEffect(() => {
    if (!currentOrganization) return;
    
    const channel = supabase
      .channel('products-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_assignments'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["product-user-counts"] });
          queryClient.invalidateQueries({ queryKey: ["products", currentOrganization.id] });
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
        icon={Package}
        title="No Organization Selected"
        description="Please select an organization to view products."
      />
    );
  }

  const resetForm = () => {
    setFormData({
      funnel_id: "",
      product_name: "",
      description: "",
      price: 0,
      is_active: true,
      workshop_id: "",
    });
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      funnel_id: product.funnel_id,
      product_name: product.product_name,
      description: product.description || "",
      price: product.price,
      is_active: product.is_active,
      workshop_id: (product as any).workshop_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete.id);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const handleSubmit = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.funnel_id) {
      errors.funnel_id = "Please select a funnel";
    }
    if (!formData.product_name.trim()) {
      errors.product_name = "Product name is required";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast({ 
        title: "Validation Error", 
        description: "Please fill in all required fields",
        variant: "destructive" 
      });
      return;
    }

    setFormErrors({});
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleFunnelCreated = (funnelId: string) => {
    setFormData({ ...formData, funnel_id: funnelId });
    setFormErrors({ ...formErrors, funnel_id: "" });
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Products</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">All Products</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-11 sm:h-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
                <SelectTrigger className="flex-1 sm:w-[180px] h-11 sm:h-10">
                  <SelectValue placeholder="Filter by funnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Funnels</SelectItem>
                  {funnels.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      {funnel.funnel_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={() => refetch()} className="h-11 w-11 sm:h-10 sm:w-10">
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  resetForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="h-11 sm:h-10">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Product</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                    <DialogDescription>
                      {editingProduct ? "Update the product details below." : "Fill in the details to create a new product."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="funnel">Funnel <span className="text-destructive">*</span></Label>
                      <Select 
                        value={formData.funnel_id} 
                        onValueChange={(value) => {
                          setFormData({ ...formData, funnel_id: value });
                          if (formErrors.funnel_id) setFormErrors({ ...formErrors, funnel_id: "" });
                        }}
                      >
                        <SelectTrigger className={`h-11 sm:h-10 ${formErrors.funnel_id ? "border-destructive" : ""}`}>
                          <SelectValue placeholder="Select a funnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {funnels.length === 0 ? (
                            <EmptySelectContent 
                              entityName="Funnel" 
                              onCreateClick={() => setQuickCreateFunnelOpen(true)}
                            />
                          ) : (
                            <>
                              {funnels.map((funnel) => (
                                <SelectItem key={funnel.id} value={funnel.id}>
                                  {funnel.funnel_name}
                                </SelectItem>
                              ))}
                              <div className="border-t mt-1 pt-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full justify-start text-primary"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setQuickCreateFunnelOpen(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Create New Funnel
                                </Button>
                              </div>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {formErrors.funnel_id && (
                        <p className="text-sm text-destructive">{formErrors.funnel_id}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product_name">Product Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="product_name"
                        value={formData.product_name}
                        onChange={(e) => {
                          setFormData({ ...formData, product_name: e.target.value });
                          if (formErrors.product_name) setFormErrors({ ...formErrors, product_name: "" });
                        }}
                        placeholder="e.g., Premium Membership"
                        className={`h-11 sm:h-10 ${formErrors.product_name ? "border-destructive" : ""}`}
                      />
                      {formErrors.product_name && (
                        <p className="text-sm text-destructive">{formErrors.product_name}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Product description..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="price">Price (₹) *</Label>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        className="h-11 sm:h-10"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>

                    {editingProduct && (
                      <div className="border-t pt-4 mt-4">
                        <Label className="text-sm font-medium mb-3 block">Quick Actions</Label>
                        <div className="space-y-2">
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
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto h-11 sm:h-10">
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="w-full sm:w-auto h-11 sm:h-10">
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingProduct ? "Update Product" : "Create Product"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isLoading ? (
            <>
              <div className="hidden sm:block">
                <TableSkeleton columns={7} rows={5} />
              </div>
              <div className="sm:hidden">
                <MobileCardSkeleton count={3} />
              </div>
            </>
          ) : (
            <>
            {/* Desktop Table View */}
            <div className="hidden sm:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Funnel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Total Users</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product, index) => (
                      <TableRow key={product.id} className="animate-list-item" style={{ animationDelay: `${index * 30}ms` }}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.product_name}</div>
                            {product.mango_id && (
                              <div className="text-xs text-muted-foreground/60 mt-0.5">
                                {product.mango_id}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{product.funnel?.funnel_name || "N/A"}</TableCell>
                        <TableCell>
                        {Number(product.price || 0) === 0 ? (
                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">
                              Free
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-violet-100 text-violet-700 border-violet-200">
                              Paid
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {getUserCount(product.id)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{Number(product.price).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            product.is_active 
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            {product.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(product)}
                            >
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
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No products found</div>
              ) : (
                filteredProducts.map((product) => (
                  <div key={product.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.product_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{product.funnel?.funnel_name || "N/A"}</p>
                        {product.mango_id && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{product.mango_id}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                          product.is_active 
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        )}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-muted/50 rounded-md p-2">
                        {Number(product.price || 0) === 0 ? (
                          <div className="text-sm font-semibold text-emerald-600">Free</div>
                        ) : (
                          <div className="text-sm font-semibold">₹{Number(product.price).toLocaleString("en-IN")}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground">Price</div>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <div className="text-sm font-semibold">{getUserCount(product.id)}</div>
                        <div className="text-[10px] text-muted-foreground">Users</div>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        {Number(product.price || 0) === 0 ? (
                          <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">Free</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 border-violet-200">Paid</span>
                        )}
                        <div className="text-[10px] text-muted-foreground">Type</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-1 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteClick(product)}>
                        <Trash2 className="h-4 w-4" />
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
        title="Delete Product"
        itemName={productToDelete?.product_name}
        isDeleting={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />

      {/* Quick Create Funnel Dialog */}
      <QuickCreateFunnelDialog
        open={quickCreateFunnelOpen}
        onOpenChange={setQuickCreateFunnelOpen}
        onSuccess={handleFunnelCreated}
      />
    </div>
  );
};

export default Products;
