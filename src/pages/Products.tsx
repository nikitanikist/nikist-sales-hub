import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, RefreshCw, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFunnel, setSelectedFunnel] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
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
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select(`
          *,
          funnel:funnels!products_funnel_id_fkey(funnel_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch funnels for dropdown
  const { data: funnels = [] } = useQuery({
    queryKey: ["funnels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funnels")
        .select("id, funnel_name")
        .order("funnel_name");

      if (error) throw error;
      return data as Funnel[];
    },
  });

  // Fetch workshops for linking
  const { data: workshops = [] } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workshops")
        .select("id, title")
        .order("title");

      if (error) throw error;
      return data;
    },
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
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("products")
        .insert([{ ...newProduct, created_by: user?.id }])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = () => {
    if (!formData.funnel_id || !formData.product_name) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill in all required fields",
        variant: "destructive" 
      });
      return;
    }

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
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
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="funnel">Funnel *</Label>
                      <Select value={formData.funnel_id} onValueChange={(value) => setFormData({ ...formData, funnel_id: value })}>
                        <SelectTrigger className="h-11 sm:h-10">
                          <SelectValue placeholder="Select a funnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {funnels.map((funnel) => (
                            <SelectItem key={funnel.id} value={funnel.id}>
                              {funnel.funnel_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="product_name">Product Name *</Label>
                      <Input
                        id="product_name"
                        value={formData.product_name}
                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                        placeholder="e.g., Insider Crypto Club"
                        className="h-11 sm:h-10"
                      />
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
                    <Button onClick={handleSubmit} className="w-full sm:w-auto h-11 sm:h-10">
                      {editingProduct ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading products...</div>
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
                    filteredProducts.map((product) => (
                      <TableRow key={product.id}>
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
                            <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200">
                              Free
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-blue-200">
                              Paid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{getUserCount(product.id)}</TableCell>
                        <TableCell className="text-right">
                          ₹{Number(product.price).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.is_active ? "default" : "secondary"}>
                            {product.is_active ? "Active" : "Inactive"}
                          </Badge>
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
                              onClick={() => handleDelete(product.id)}
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
                        <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                          {product.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-muted/50 rounded-md p-2">
                        {Number(product.price || 0) === 0 ? (
                          <div className="text-sm font-semibold text-green-600">Free</div>
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
                          <Badge variant="secondary" className="bg-green-500/10 text-green-700 text-[10px] px-1">Free</Badge>
                        ) : (
                          <Badge variant="default" className="bg-blue-500/10 text-blue-700 text-[10px] px-1">Paid</Badge>
                        )}
                        <div className="text-[10px] text-muted-foreground">Type</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-1 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDelete(product.id)}>
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
    </div>
  );
};

export default Products;
