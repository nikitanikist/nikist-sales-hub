import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Calendar, Search, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  planned: "bg-blue-500",
  confirmed: "bg-green-500",
  completed: "bg-gray-500",
  cancelled: "bg-red-500",
};

const Workshops = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // The ₹497 product ID for "One To One Strategy Call with Crypto Expert"
  const WORKSHOP_SALES_PRODUCT_ID = "b8709b0b-1160-4d73-b59b-2849490d2053";
  const PRODUCT_PRICE = 497;

  const { data: workshops, isLoading, refetch } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      const { data: workshopsData, error } = await supabase
        .from("workshops")
        .select("*")
        .is("product_id", null) // Hide workshops converted to products
        .order("start_date", { ascending: false });
      
      if (error) throw error;

      // Get registration counts using database aggregation for each workshop
      const registrationCounts = await Promise.all(
        workshopsData.map(async (workshop) => {
          const { count } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("workshop_name", workshop.title);
          return { workshopId: workshop.id, count: count || 0 };
        })
      );

      // Create a map of workshop_id -> registration count
      const registrationsByWorkshop = registrationCounts.reduce((acc, item) => {
        acc[item.workshopId] = item.count;
        return acc;
      }, {} as Record<string, number>);

      // Get sales counts for each workshop using the CORRECT logic:
      // Step 1: Get leads assigned to workshop (via workshop_id in lead_assignments)
      // Step 2: Count how many of those leads ALSO have the ₹497 product (in a SEPARATE row)
      const salesCounts = await Promise.all(
        workshopsData.map(async (workshop) => {
          // Get all lead_ids assigned to this workshop
          const { data: workshopLeads } = await supabase
            .from("lead_assignments")
            .select("lead_id")
            .eq("workshop_id", workshop.id);
          
          const leadIds = workshopLeads?.map(la => la.lead_id) || [];
          
          if (leadIds.length === 0) {
            return { workshopId: workshop.id, sales: 0 };
          }
          
          // Count how many of those leads ALSO have the ₹497 product (in a SEPARATE entry)
          const { count } = await supabase
            .from("lead_assignments")
            .select("lead_id", { count: "exact", head: true })
            .eq("product_id", WORKSHOP_SALES_PRODUCT_ID)
            .in("lead_id", leadIds);
          
          return { workshopId: workshop.id, sales: count || 0 };
        })
      );

      // Create a map of workshop_id -> sales count
      const salesByWorkshop = salesCounts.reduce((acc, item) => {
        acc[item.workshopId] = item.sales;
        return acc;
      }, {} as Record<string, number>);

      // Calculate metrics for each workshop
      const workshopsWithMetrics = workshopsData.map((workshop) => {
        const registrationCount = registrationsByWorkshop[workshop.id] || 0;
        const salesCount = salesByWorkshop[workshop.id] || 0;

        // Calculate revenue and P&L
        const totalRevenue = salesCount * PRODUCT_PRICE;
        const adSpend = Number(workshop.ad_spend || 0);
        const roughPL = totalRevenue - adSpend;

        return {
          ...workshop,
          sales_count: salesCount,
          total_revenue: totalRevenue,
          rough_pl: roughPL,
          registration_count: registrationCount,
        };
      });
      
      return workshopsWithMetrics;
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name")
        .order("company_name");

      if (error) throw error;
      return data;
    },
  });

  const { data: funnels, isLoading: funnelsLoading } = useQuery({
    queryKey: ["funnels-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnels")
        .select("id, funnel_name")
        .order("funnel_name");
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, funnel_id")
        .eq("is_active", true)
        .order("product_name");
      
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newWorkshop: any) => {
      const { error } = await supabase.from("workshops").insert([{
        ...newWorkshop,
        created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Workshop created successfully");
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("workshops").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Workshop updated successfully");
      setIsOpen(false);
      setEditingWorkshop(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workshops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Workshop deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const createFunnelMutation = useMutation({
    mutationFn: async (workshopData: any) => {
      const { data, error } = await supabase
        .from("funnels")
        .insert([{
          funnel_name: workshopData.title,
          amount: 0,
          is_free: workshopData.is_free || false,
          created_by: user?.id,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (newFunnel) => {
      // Update the workshop with the new funnel_id
      await supabase
        .from("workshops")
        .update({ funnel_id: newFunnel.id })
        .eq("id", editingWorkshop.id);
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      queryClient.invalidateQueries({ queryKey: ["funnels-list"] });
      toast.success("Funnel created and linked to workshop!");
      setEditingWorkshop({ ...editingWorkshop, funnel_id: newFunnel.id });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: { workshopTitle: string; funnelId: string }) => {
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert([{
          product_name: data.workshopTitle,
          funnel_id: data.funnelId,
          price: 0,
          is_active: true,
          created_by: user?.id,
        }])
        .select()
        .single();
      if (error) throw error;
      return newProduct;
    },
    onSuccess: async (newProduct) => {
      // Update the workshop with the new product_id
      await supabase
        .from("workshops")
        .update({ product_id: newProduct.id })
        .eq("id", editingWorkshop.id);
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      toast.success("Product created and linked to workshop!");
      setEditingWorkshop({ ...editingWorkshop, product_id: newProduct.id });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
      location: formData.get("location"),
      max_participants: formData.get("max_participants") ? Number(formData.get("max_participants")) : null,
      ad_spend: formData.get("ad_spend") ? Number(formData.get("ad_spend")) : 0,
      amount: formData.get("amount") ? Number(formData.get("amount")) : 0,
      lead_id:
        formData.get("lead_id") === "none" || formData.get("lead_id") === "" ? null : formData.get("lead_id"),
      funnel_id: formData.get("funnel_id") === "none" ? null : formData.get("funnel_id") || null,
      product_id:
        formData.get("product_id") === "none" ? null : formData.get("product_id") || null,
    };

    if (editingWorkshop) {
      updateMutation.mutate({ id: editingWorkshop.id, updates: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Workshops data refreshed");
  };

  const filteredWorkshops = workshops?.filter((workshop) => {
    const query = searchQuery.toLowerCase();
    return workshop.title.toLowerCase().includes(query);
  });

  // Sync selectedFunnelId when editingWorkshop changes
  useEffect(() => {
    setSelectedFunnelId(editingWorkshop?.funnel_id || null);
  }, [editingWorkshop]);

  // Real-time updates for leads and lead_assignments
  useEffect(() => {
    const channel = supabase
      .channel('workshops-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["workshops"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_assignments'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["workshops"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Workshops</h1>
          <p className="text-muted-foreground">Schedule and manage your workshops</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingWorkshop(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Workshop
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingWorkshop ? "Edit Workshop" : "Add New Workshop"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={editingWorkshop?.title}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingWorkshop?.description}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="datetime-local"
                      defaultValue={editingWorkshop?.start_date ? format(new Date(editingWorkshop.start_date), "yyyy-MM-dd'T'HH:mm") : ""}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      name="end_date"
                      type="datetime-local"
                      defaultValue={editingWorkshop?.end_date ? format(new Date(editingWorkshop.end_date), "yyyy-MM-dd'T'HH:mm") : ""}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      defaultValue={editingWorkshop?.location}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_participants">Max Participants</Label>
                    <Input
                      id="max_participants"
                      name="max_participants"
                      type="number"
                      defaultValue={editingWorkshop?.max_participants}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ad_spend">Ad Spend (₹)</Label>
                    <Input
                      id="ad_spend"
                      name="ad_spend"
                      type="number"
                      step="0.01"
                      defaultValue={editingWorkshop?.ad_spend || 0}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={editingWorkshop?.amount || 0}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="funnel_id">Associated Funnel</Label>
                    <Select 
                      name="funnel_id" 
                      value={selectedFunnelId ?? "none"}
                      onValueChange={(value) => setSelectedFunnelId(value === "none" ? null : value)}
                      disabled={funnelsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={funnelsLoading ? "Loading..." : "Select a funnel"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {funnels && funnels.length > 0 ? (
                          funnels.map((funnel) => (
                            <SelectItem key={funnel.id} value={funnel.id}>
                              {funnel.funnel_name}
                            </SelectItem>
                          ))
                        ) : null}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_id">Associated Product</Label>
                    <Select 
                      name="product_id" 
                      defaultValue={editingWorkshop?.product_id ?? undefined}
                      disabled={productsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={productsLoading ? "Loading..." : "Select a product"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {products && products.length > 0 ? (
                          products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.product_name}
                            </SelectItem>
                          ))
                        ) : null}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue={editingWorkshop?.status || "planned"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="lead_id">Related Lead (Optional)</Label>
                     <Select name="lead_id" defaultValue={editingWorkshop?.lead_id || "none"}>
                       <SelectTrigger>
                         <SelectValue placeholder="Select a lead" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none">None</SelectItem>
                        {leads?.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                 </div>
               </div>
               
               {editingWorkshop && (
                 <div className="border-t pt-4 mt-4">
                   <Label className="text-sm font-medium mb-3 block">Quick Actions</Label>
                   <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => createFunnelMutation.mutate(editingWorkshop)}
                        disabled={createFunnelMutation.isPending || editingWorkshop.funnel_id}
                      >
                        {editingWorkshop.funnel_id ? "Funnel Already Linked" : "Convert Workshop to Funnel"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => createProductMutation.mutate({ 
                          workshopTitle: editingWorkshop.title, 
                          funnelId: selectedFunnelId! 
                        })}
                        disabled={createProductMutation.isPending || !selectedFunnelId || editingWorkshop.product_id}
                      >
                        {editingWorkshop.product_id ? "Product Already Linked" : "Convert Workshop to Product"}
                      </Button>
                   </div>
                   {!selectedFunnelId && !editingWorkshop.product_id && (
                     <p className="text-xs text-muted-foreground mt-2">
                       👆 Select an associated funnel above to enable product creation
                     </p>
                   )}
                 </div>
               )}
               
               <DialogFooter>
                 <Button type="submit">
                   {editingWorkshop ? "Update" : "Create"} Workshop
                 </Button>
               </DialogFooter>
             </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Workshops</CardTitle>
              <CardDescription>Manage and track workshop performance</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workshops by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Workshop Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total Registrations</TableHead>
                  <TableHead className="text-right">Ad Spend</TableHead>
                  <TableHead className="text-right">Number of Workshop Sales</TableHead>
                  <TableHead className="text-right">Rough P&L</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkshops?.map((workshop) => (
                  <TableRow key={workshop.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {workshop.start_date ? format(new Date(workshop.start_date), "MMM dd, yyyy") : "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{workshop.title}</TableCell>
                    <TableCell>
                      {Number(workshop.amount || 0) === 0 ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200">
                          Free
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-blue-200">
                          Paid ₹{Number(workshop.amount).toLocaleString("en-IN")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {workshop.registration_count || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{Number(workshop.ad_spend || 0).toLocaleString("en-US", { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {workshop.sales_count || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={workshop.rough_pl >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        ₹{Number(workshop.rough_pl || 0).toLocaleString("en-US", { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingWorkshop(workshop);
                          setIsOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(workshop.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Workshops;
