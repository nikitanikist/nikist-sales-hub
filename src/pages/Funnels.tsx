import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, RefreshCw, Filter, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";

interface Funnel {
  id: string;
  funnel_name: string;
  total_leads: number;
  amount: number;
  created_at: string;
}

const Funnels = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [formData, setFormData] = useState({
    funnel_name: "",
    amount: "",
    total_leads: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: funnels, isLoading } = useQuery({
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
      toast({ title: "Funnel created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ 
        title: "Error creating funnel", 
        description: error.message,
        variant: "destructive" 
      });
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
      toast({ title: "Funnel updated successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ 
        title: "Error updating funnel", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funnels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      toast({ title: "Funnel deleted successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error deleting funnel", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const funnelData = {
      funnel_name: formData.funnel_name,
      amount: parseFloat(formData.amount),
      total_leads: parseInt(formData.total_leads),
    };

    if (editingFunnel) {
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
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this funnel?")) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({ funnel_name: "", amount: "", total_leads: "" });
    setEditingFunnel(null);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["funnels"] });
    toast({ title: "Refreshed funnels data" });
  };

  const filteredFunnels = funnels?.filter((funnel) =>
    funnel.funnel_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Active Funnels</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Funnels List</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search funnels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
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
                    <div className="space-y-2">
                      <Label htmlFor="funnel_name">Funnel Name</Label>
                      <Input
                        id="funnel_name"
                        value={formData.funnel_name}
                        onChange={(e) => setFormData({ ...formData, funnel_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount ($)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_leads">Total Leads</Label>
                      <Input
                        id="total_leads"
                        type="number"
                        value={formData.total_leads}
                        onChange={(e) => setFormData({ ...formData, total_leads: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      {editingFunnel ? "Update Funnel" : "Create Funnel"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading funnels...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funnel Name</TableHead>
                  <TableHead>Total Leads</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFunnels?.map((funnel) => (
                  <TableRow key={funnel.id}>
                    <TableCell className="font-medium">{funnel.funnel_name}</TableCell>
                    <TableCell>{funnel.total_leads}</TableCell>
                    <TableCell>${funnel.amount.toLocaleString()}</TableCell>
                    <TableCell>{format(new Date(funnel.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(funnel)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(funnel.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredFunnels?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No funnels found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Funnels;
