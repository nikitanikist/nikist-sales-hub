import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Filter, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Funnel {
  id: string;
  funnel_name: string;
  amount: number;
  total_leads: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const Funnels = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [formData, setFormData] = useState({
    funnel_name: "",
    amount: "",
    total_leads: "0",
    workshop_id: "",
    product_id: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: funnels = [], refetch, isLoading } = useQuery({
    queryKey: ["funnels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnels")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Funnel[];
    },
  });

  // Fetch workshops for linking
  const { data: workshops = [] } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("id, title")
        .order("title");

      if (error) throw error;
      return data;
    },
  });

  // Fetch products for linking
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, funnel_id")
        .eq("is_active", true)
        .order("product_name");

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newFunnel: { funnel_name: string; amount: number; total_leads: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("funnels")
        .insert([{ ...newFunnel, created_by: user?.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
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
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
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
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      toast({ title: "Success", description: "Funnel deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredFunnels = funnels.filter((funnel) =>
    funnel.funnel_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      amount: funnel.amount.toString(),
      total_leads: funnel.total_leads.toString(),
      workshop_id: (funnel as any).workshop_id || "",
      product_id: (funnel as any).product_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this funnel?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Active Funnels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search funnels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Funnel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingFunnel ? "Edit Funnel" : "Add New Funnel"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="funnel_name">Funnel Name</Label>
                    <Input
                      id="funnel_name"
                      value={formData.funnel_name}
                      onChange={(e) => setFormData({ ...formData, funnel_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
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
                    />
                  </div>

                  {editingFunnel && (
                    <div className="border-t pt-4 mt-4">
                      <Label className="text-sm font-medium mb-3 block">Quick Actions</Label>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="workshop_link" className="text-xs">Link to Workshop</Label>
                          <Select value={formData.workshop_id} onValueChange={(value) => setFormData({ ...formData, workshop_id: value })}>
                            <SelectTrigger>
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
                            <SelectTrigger>
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

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingFunnel ? "Update" : "Create"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading funnels...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funnel Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Total Leads</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFunnels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                        <TableCell>{funnel.total_leads}</TableCell>
                        <TableCell>₹{Number(funnel.amount || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell>{format(new Date(funnel.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(funnel)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(funnel.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Funnels;
