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
import { Plus, Pencil, Trash2, Calendar, Search, RefreshCw, Filter, ChevronDown, ChevronRight, Phone, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WorkshopCallsDialog } from "@/components/WorkshopCallsDialog";

type CallCategory = 
  | "converted" 
  | "not_converted" 
  | "rescheduled_remaining" 
  | "rescheduled_done" 
  | "booking_amount" 
  | "remaining";

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
const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [callsDialogOpen, setCallsDialogOpen] = useState(false);
  const [selectedWorkshopTitle, setSelectedWorkshopTitle] = useState<string>("");
  const [selectedCallCategory, setSelectedCallCategory] = useState<CallCategory>("converted");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isManager } = useUserRole();

  const openCallsDialog = (workshopTitle: string, category: CallCategory) => {
    setSelectedWorkshopTitle(workshopTitle);
    setSelectedCallCategory(category);
    setCallsDialogOpen(true);
  };

  const toggleRowExpand = (workshopId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workshopId)) {
        newSet.delete(workshopId);
      } else {
        newSet.add(workshopId);
      }
      return newSet;
    });
  };

  // The ₹497 product ID for "One To One Strategy Call with Crypto Expert"
  const WORKSHOP_SALES_PRODUCT_ID = "b8709b0b-1160-4d73-b59b-2849490d2053";
  const PRODUCT_PRICE = 497;

  const { data: workshops, isLoading, error, refetch } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      console.log("Fetching workshops...");
      const { data: workshopsData, error } = await supabase
        .from("workshops")
        .select("*")
        .is("product_id", null) // Hide workshops converted to products
        .order("start_date", { ascending: false });
      
      if (error) {
        console.error("Error fetching workshops:", error);
        throw error;
      }
      console.log("Workshops data:", workshopsData);

      // Get all workshop metrics from the database function (single efficient query)
      const { data: metricsData, error: metricsError } = await supabase.rpc("get_workshop_metrics");
      
      if (metricsError) {
        console.error("Error fetching workshop metrics:", metricsError);
        // Continue with empty metrics - workshops will still show but with 0 counts
      }
      console.log("Metrics data:", metricsData);

      // Create lookup maps for all metrics
      const metricsMap = (metricsData || []).reduce((acc, item) => {
        acc[item.workshop_id] = {
          registrations: Number(item.registration_count) || 0,
          sales: Number(item.sales_count) || 0,
          converted_calls: Number(item.converted_calls) || 0,
          not_converted_calls: Number(item.not_converted_calls) || 0,
          rescheduled_remaining: Number(item.rescheduled_remaining) || 0,
          rescheduled_done: Number(item.rescheduled_done) || 0,
          remaining_calls: Number(item.remaining_calls) || 0,
          booking_amount_calls: Number(item.booking_amount_calls) || 0,
          total_offer_amount: Number(item.total_offer_amount) || 0,
          total_cash_received: Number(item.total_cash_received) || 0,
          total_calls_booked: Number(item.total_calls_booked) || 0,
        };
        return acc;
      }, {} as Record<string, { 
        registrations: number; 
        sales: number;
        converted_calls: number;
        not_converted_calls: number;
        rescheduled_remaining: number;
        rescheduled_done: number;
        remaining_calls: number;
        booking_amount_calls: number;
        total_offer_amount: number;
        total_cash_received: number;
        total_calls_booked: number;
      }>);

      // Calculate metrics for each workshop
      const workshopsWithMetrics = workshopsData.map((workshop) => {
        const metrics = metricsMap[workshop.id] || { 
          registrations: 0, 
          sales: 0,
          converted_calls: 0,
          not_converted_calls: 0,
          rescheduled_remaining: 0,
          rescheduled_done: 0,
          remaining_calls: 0,
          booking_amount_calls: 0,
          total_offer_amount: 0,
          total_cash_received: 0,
          total_calls_booked: 0,
        };
        const registrationCount = metrics.registrations;
        const salesCount = metrics.sales;

        // Calculate revenue and P&L
        const totalRevenue = salesCount * PRODUCT_PRICE;
        const adSpend = Number(workshop.ad_spend || 0);
        const roughPL = totalRevenue - adSpend;

        // Calculate total P&L including high ticket
        const totalPL = totalRevenue + metrics.total_cash_received - adSpend;

        return {
          ...workshop,
          sales_count: salesCount,
          total_revenue: totalRevenue,
          rough_pl: roughPL,
          registration_count: registrationCount,
          converted_calls: metrics.converted_calls,
          not_converted_calls: metrics.not_converted_calls,
          rescheduled_remaining: metrics.rescheduled_remaining,
          rescheduled_done: metrics.rescheduled_done,
          remaining_calls: metrics.remaining_calls,
          booking_amount_calls: metrics.booking_amount_calls,
          total_offer_amount: metrics.total_offer_amount,
          total_cash_received: metrics.total_cash_received,
          total_pl: totalPL,
          total_calls_booked: metrics.total_calls_booked,
        };
      });
      
      console.log("Workshops with metrics:", workshopsWithMetrics);
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

  // Real-time updates for leads, lead_assignments, call_appointments, and workshops
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_appointments'
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
          table: 'workshops'
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
        {!isManager && (
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
        )}
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
          {error && (
            <div className="text-center py-4 text-red-500 bg-red-50 rounded-md mb-4">
              Error loading workshops: {error.message}
            </div>
          )}
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Workshop Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Registrations</TableHead>
                  {!isManager && <TableHead className="text-right">Ad Spend</TableHead>}
                  <TableHead className="text-right">Workshop Sales</TableHead>
                  {!isManager && <TableHead className="text-right">Rough P&L</TableHead>}
                  {!isManager && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkshops?.map((workshop) => {
                  const isExpanded = expandedRows.has(workshop.id);
                  const hasCallData = workshop.converted_calls > 0 || workshop.not_converted_calls > 0 || 
                                     workshop.remaining_calls > 0 || workshop.rescheduled_remaining > 0 ||
                                     workshop.rescheduled_done > 0 || workshop.booking_amount_calls > 0;
                  
                  return (
                    <>
                      <TableRow key={workshop.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpand(workshop.id)}>
                        <TableCell className="w-[40px]">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
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
                        {!isManager && (
                          <TableCell className="text-right">
                            ₹{Number(workshop.ad_spend || 0).toLocaleString("en-IN")}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          {workshop.sales_count || 0}
                        </TableCell>
                        {!isManager && (
                          <TableCell className="text-right">
                            <span className={workshop.rough_pl >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                              ₹{Number(workshop.rough_pl || 0).toLocaleString("en-IN")}
                            </span>
                          </TableCell>
                        )}
                        {!isManager && (
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                        )}
                      </TableRow>
                      
                      {/* Expanded Row with Call Statistics and Revenue */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={isManager ? 6 : 9} className="p-4">
                            <div className={`grid grid-cols-1 ${isManager ? '' : 'md:grid-cols-2'} gap-6`}>
                              {/* Call Statistics */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <Phone className="h-4 w-4" />
                                  Call Statistics
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  <div 
                                    className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-2 border-slate-300 dark:border-slate-600"
                                  >
                                    <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{workshop.total_calls_booked || 0}</div>
                                    <div className="text-xs text-muted-foreground font-medium">Total Calls Booked</div>
                                  </div>
                                  <div 
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-green-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "converted"); }}
                                  >
                                    <div className="text-2xl font-bold text-green-600">{workshop.converted_calls || 0}</div>
                                    <div className="text-xs text-muted-foreground">Converted</div>
                                  </div>
                                  <div
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-red-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "not_converted"); }}
                                  >
                                    <div className="text-2xl font-bold text-red-500">{workshop.not_converted_calls || 0}</div>
                                    <div className="text-xs text-muted-foreground">Not Converted</div>
                                  </div>
                                  <div 
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "remaining"); }}
                                  >
                                    <div className="text-2xl font-bold text-blue-500">{workshop.remaining_calls || 0}</div>
                                    <div className="text-xs text-muted-foreground">Remaining</div>
                                  </div>
                                  <div 
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-orange-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_remaining"); }}
                                  >
                                    <div className="text-2xl font-bold text-orange-500">{workshop.rescheduled_remaining || 0}</div>
                                    <div className="text-xs text-muted-foreground">Rescheduled Remaining</div>
                                  </div>
                                  <div 
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_done"); }}
                                  >
                                    <div className="text-2xl font-bold text-teal-500">{workshop.rescheduled_done || 0}</div>
                                    <div className="text-xs text-muted-foreground">Rescheduled Done</div>
                                  </div>
                                  <div 
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-purple-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "booking_amount"); }}
                                  >
                                    <div className="text-2xl font-bold text-purple-600">{workshop.booking_amount_calls || 0}</div>
                                    <div className="text-xs text-muted-foreground">Booking Amount</div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Revenue Breakdown - Hidden for managers */}
                              {!isManager && (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <IndianRupee className="h-4 w-4" />
                                    Revenue Breakdown
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-background rounded-lg p-3 border">
                                      <div className="text-lg font-bold text-foreground">
                                        ₹{Number(workshop.total_revenue || 0).toLocaleString("en-IN")}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Workshop Revenue (₹497 × {workshop.sales_count})</div>
                                    </div>
                                    <div className="bg-background rounded-lg p-3 border">
                                      <div className="text-lg font-bold text-foreground">
                                        ₹{Number(workshop.total_offer_amount || 0).toLocaleString("en-IN")}
                                      </div>
                                      <div className="text-xs text-muted-foreground">High Ticket Offer Amount</div>
                                    </div>
                                    <div className="bg-background rounded-lg p-3 border">
                                      <div className="text-lg font-bold text-green-600">
                                        ₹{Number(workshop.total_cash_received || 0).toLocaleString("en-IN")}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Cash Collected</div>
                                    </div>
                                    <div className="bg-background rounded-lg p-3 border">
                                      <div className={`text-lg font-bold ${(workshop.total_pl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ₹{Number(workshop.total_pl || 0).toLocaleString("en-IN")}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Total P&L (incl. High Ticket)</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Workshop Calls Dialog */}
      <WorkshopCallsDialog
        open={callsDialogOpen}
        onOpenChange={setCallsDialogOpen}
        workshopTitle={selectedWorkshopTitle}
        category={selectedCallCategory}
      />
    </div>
  );
};

export default Workshops;
