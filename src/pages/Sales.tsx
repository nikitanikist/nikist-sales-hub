import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";

const Sales = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from("sales")
        .select("*, lead:leads(company_name), sales_rep:profiles(full_name)")
        .eq("organization_id", currentOrganization.id)
        .order("closed_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: leads } = useQuery({
    queryKey: ["won-leads", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name")
        .eq("organization_id", currentOrganization.id)
        .eq("status", "won")
        .order("company_name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const createMutation = useMutation({
    mutationFn: async (newSale: any) => {
      const { error } = await supabase.from("sales").insert([{
        ...newSale,
        sales_rep: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", currentOrganization?.id] });
      toast.success("Sale recorded successfully");
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("sales").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", currentOrganization?.id] });
      toast.success("Sale updated successfully");
      setIsOpen(false);
      setEditingSale(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", currentOrganization?.id] });
      toast.success("Sale deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      lead_id: formData.get("lead_id"),
      amount: Number(formData.get("amount")),
      closed_date: formData.get("closed_date"),
      description: formData.get("description"),
    };

    if (editingSale) {
      updateMutation.mutate({ id: editingSale.id, updates: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const totalRevenue = sales?.reduce((sum, sale) => sum + Number(sale.amount), 0) || 0;

  // Show loading state while organization is loading
  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  // Wait for organization to be available
  if (!currentOrganization) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No Organization Selected"
        description="Please select an organization to view sales."
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">Track your closed deals and revenue</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingSale(null)} className="w-full sm:w-auto h-11 sm:h-10">
              <Plus className="mr-2 h-4 w-4" />
              Record Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSale ? "Edit Sale" : "Record New Sale"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="lead_id">Lead</Label>
                  <Select name="lead_id" defaultValue={editingSale?.lead_id} required>
                    <SelectTrigger className="h-11 sm:h-10">
                      <SelectValue placeholder="Select a lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads?.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={editingSale?.amount}
                      required
                      className="h-11 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="closed_date">Close Date</Label>
                    <Input
                      id="closed_date"
                      name="closed_date"
                      type="date"
                      defaultValue={editingSale?.closed_date ? format(new Date(editingSale.closed_date), "yyyy-MM-dd") : ""}
                      required
                      className="h-11 sm:h-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingSale?.description}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full sm:w-auto h-11 sm:h-10">
                  {editingSale ? "Update" : "Record"} Sale
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <DollarSign className="h-5 w-5 text-success" />
            Total Revenue: <span className="text-base sm:text-xl">${totalRevenue.toLocaleString()}</span>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Sales History</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Close Date</TableHead>
                    <TableHead>Sales Rep</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales?.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.lead?.company_name}</TableCell>
                      <TableCell className="text-success font-semibold">
                        ${Number(sale.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>{format(new Date(sale.closed_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{sale.sales_rep?.full_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{sale.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSale(sale);
                            setIsOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(sale.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {sales?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No sales found</div>
              ) : (
                sales?.map((sale) => (
                  <div key={sale.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sale.lead?.company_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sale.sales_rep?.full_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-success font-semibold">${Number(sale.amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(sale.closed_date), "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                    
                    {sale.description && (
                      <p className="text-xs text-muted-foreground truncate mt-2 pt-2 border-t">{sale.description}</p>
                    )}
                    
                    <div className="flex justify-end gap-1 mt-2 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setEditingSale(sale);
                          setIsOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => deleteMutation.mutate(sale.id)}
                      >
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

export default Sales;
