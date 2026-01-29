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
import { Plus, Pencil, Trash2, Calendar, Search, RefreshCw, Filter, ChevronDown, ChevronRight, Phone, IndianRupee, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WorkshopCallsDialog } from "@/components/WorkshopCallsDialog";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { TableSkeleton, MobileCardSkeleton } from "@/components/skeletons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

type CallCategory = 
  | "converted" 
  | "not_converted" 
  | "rescheduled_remaining" 
  | "rescheduled_done" 
  | "booking_amount" 
  | "remaining"
  | "all_booked"
  | "refunded"
  | "rejoin"
  | "cross_workshop";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workshopToDelete, setWorkshopToDelete] = useState<any>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isManager } = useUserRole();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

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
    queryKey: ["workshops", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      console.log("Fetching workshops...");
      const { data: workshopsData, error } = await supabase
        .from("workshops")
        .select("*")
        .eq("organization_id", currentOrganization.id)
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
          refunded_calls: Number(item.refunded_calls) || 0,
          // Fresh sales breakdown
          fresh_sales_count: Number(item.fresh_sales_count) || 0,
          fresh_converted: Number(item.fresh_converted) || 0,
          fresh_not_converted: Number(item.fresh_not_converted) || 0,
          fresh_remaining: Number(item.fresh_remaining) || 0,
          fresh_rescheduled_remaining: Number(item.fresh_rescheduled_remaining) || 0,
          fresh_rescheduled_done: Number(item.fresh_rescheduled_done) || 0,
          fresh_booking_amount: Number(item.fresh_booking_amount) || 0,
          fresh_offer_amount: Number(item.fresh_offer_amount) || 0,
          fresh_cash_received: Number(item.fresh_cash_received) || 0,
          // Rejoin sales breakdown
          rejoin_sales_count: Number(item.rejoin_sales_count) || 0,
          rejoin_converted: Number(item.rejoin_converted) || 0,
          rejoin_not_converted: Number(item.rejoin_not_converted) || 0,
          rejoin_remaining: Number(item.rejoin_remaining) || 0,
          rejoin_rescheduled_remaining: Number(item.rejoin_rescheduled_remaining) || 0,
          rejoin_rescheduled_done: Number(item.rejoin_rescheduled_done) || 0,
          rejoin_booking_amount: Number(item.rejoin_booking_amount) || 0,
          rejoin_offer_amount: Number(item.rejoin_offer_amount) || 0,
          rejoin_cash_received: Number(item.rejoin_cash_received) || 0,
          // Cross-workshop payments
          cross_workshop_count: Number(item.cross_workshop_count) || 0,
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
        refunded_calls: number;
        fresh_sales_count: number;
        fresh_converted: number;
        fresh_not_converted: number;
        fresh_remaining: number;
        fresh_rescheduled_remaining: number;
        fresh_rescheduled_done: number;
        fresh_booking_amount: number;
        fresh_offer_amount: number;
        fresh_cash_received: number;
        rejoin_sales_count: number;
        rejoin_converted: number;
        rejoin_not_converted: number;
        rejoin_remaining: number;
        rejoin_rescheduled_remaining: number;
        rejoin_rescheduled_done: number;
        rejoin_booking_amount: number;
        rejoin_offer_amount: number;
        rejoin_cash_received: number;
        cross_workshop_count: number;
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
          refunded_calls: 0,
          fresh_sales_count: 0,
          fresh_converted: 0,
          fresh_not_converted: 0,
          fresh_remaining: 0,
          fresh_rescheduled_remaining: 0,
          fresh_rescheduled_done: 0,
          fresh_booking_amount: 0,
          fresh_offer_amount: 0,
          fresh_cash_received: 0,
          rejoin_sales_count: 0,
          rejoin_converted: 0,
          rejoin_not_converted: 0,
          rejoin_remaining: 0,
          rejoin_rescheduled_remaining: 0,
          rejoin_rescheduled_done: 0,
          rejoin_booking_amount: 0,
          rejoin_offer_amount: 0,
          rejoin_cash_received: 0,
          cross_workshop_count: 0,
        };
        const registrationCount = metrics.registrations;
        const salesCount = metrics.sales;

        // Calculate fresh revenue
        const freshRevenue = metrics.fresh_sales_count * PRODUCT_PRICE;
        // Calculate rejoin revenue (credited to this workshop as original)
        const rejoinRevenue = metrics.rejoin_sales_count * PRODUCT_PRICE;
        // Total workshop revenue
        const totalRevenue = freshRevenue + rejoinRevenue;
        const adSpend = Number(workshop.ad_spend || 0);
        const roughPL = totalRevenue - adSpend;

        // Calculate total P&L including high ticket from both fresh and rejoin
        const totalCashReceived = metrics.fresh_cash_received + metrics.rejoin_cash_received;
        const totalPL = totalRevenue + totalCashReceived - adSpend;

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
          refunded_calls: metrics.refunded_calls,
          // Fresh breakdown
          fresh_sales_count: metrics.fresh_sales_count,
          fresh_converted: metrics.fresh_converted,
          fresh_not_converted: metrics.fresh_not_converted,
          fresh_remaining: metrics.fresh_remaining,
          fresh_rescheduled_remaining: metrics.fresh_rescheduled_remaining,
          fresh_rescheduled_done: metrics.fresh_rescheduled_done,
          fresh_booking_amount: metrics.fresh_booking_amount,
          fresh_revenue: freshRevenue,
          fresh_offer_amount: metrics.fresh_offer_amount,
          fresh_cash_received: metrics.fresh_cash_received,
          // Rejoin breakdown
          rejoin_sales_count: metrics.rejoin_sales_count,
          rejoin_converted: metrics.rejoin_converted,
          rejoin_not_converted: metrics.rejoin_not_converted,
          rejoin_remaining: metrics.rejoin_remaining,
          rejoin_rescheduled_remaining: metrics.rejoin_rescheduled_remaining,
          rejoin_rescheduled_done: metrics.rejoin_rescheduled_done,
          rejoin_booking_amount: metrics.rejoin_booking_amount,
          rejoin_revenue: rejoinRevenue,
          rejoin_offer_amount: metrics.rejoin_offer_amount,
          rejoin_cash_received: metrics.rejoin_cash_received,
          // Cross-workshop
          cross_workshop_count: metrics.cross_workshop_count,
        };
      });
      
      console.log("Workshops with metrics:", workshopsWithMetrics);
      return workshopsWithMetrics;
    },
    enabled: !!currentOrganization,
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name")
        .eq("organization_id", currentOrganization.id)
        .order("company_name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: funnels, isLoading: funnelsLoading } = useQuery({
    queryKey: ["funnels-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("funnels")
        .select("id, funnel_name")
        .eq("organization_id", currentOrganization.id)
        .order("funnel_name");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, funnel_id")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("product_name");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization,
  });

  const createMutation = useMutation({
    mutationFn: async (newWorkshop: any) => {
      if (!currentOrganization) throw new Error("No organization selected");
      const { error } = await supabase.from("workshops").insert([{
        ...newWorkshop,
        created_by: user?.id,
        organization_id: currentOrganization.id,
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
      // First, delete all lead_assignments for this workshop to avoid constraint violation
      const { error: assignmentsError } = await supabase
        .from("lead_assignments")
        .delete()
        .eq("workshop_id", id);
      
      if (assignmentsError) throw assignmentsError;
      
      // Then delete the workshop
      const { error } = await supabase.from("workshops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Workshop deleted successfully");
      setDeleteDialogOpen(false);
      setWorkshopToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleDeleteClick = (workshop: any) => {
    setWorkshopToDelete(workshop);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (workshopToDelete) {
      deleteMutation.mutate(workshopToDelete.id);
    }
  };

  const createFunnelMutation = useMutation({
    mutationFn: async (workshopData: any) => {
      if (!currentOrganization) throw new Error("No organization selected");
      const { data, error } = await supabase
        .from("funnels")
        .insert([{
          funnel_name: workshopData.title,
          amount: 0,
          is_free: workshopData.is_free || false,
          created_by: user?.id,
          organization_id: currentOrganization.id,
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
      if (!currentOrganization) throw new Error("No organization selected");
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert([{
          product_name: data.workshopTitle,
          funnel_id: data.funnelId,
          price: 0,
          is_active: true,
          created_by: user?.id,
          organization_id: currentOrganization.id,
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

  // Organization loading and empty states
  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  if (!currentOrganization) {
    return (
      <EmptyState
        icon={Calendar}
        title="No Organization Selected"
        description="Please select an organization to view workshops."
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-3">
        {!isManager && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingWorkshop(null)} className="w-full sm:w-auto h-11 sm:h-10">
                <Plus className="mr-2 h-4 w-4" />
                Add Workshop
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingWorkshop ? "Edit Workshop" : "Add New Workshop"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-2">
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
                        ) : (
                          <div className="py-3 px-2 text-center text-sm text-muted-foreground">
                            No funnels available. Create one in the Funnels page first.
                          </div>
                        )}
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
                        ) : (
                          <div className="py-3 px-2 text-center text-sm text-muted-foreground">
                            No products available. Create one in the Products page first.
                          </div>
                        )}
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
               
               <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
                 <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                   {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   {editingWorkshop ? "Update Workshop" : "Create Workshop"}
                 </Button>
               </DialogFooter>
             </form>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">All Workshops</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Manage and track workshop performance</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh} className="h-10 w-10 sm:h-9 sm:w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workshops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 sm:h-10"
            />
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {error && (
            <div className="text-center py-4 text-red-500 bg-red-50 rounded-md mb-4 text-sm">
              Error loading workshops: {error.message}
            </div>
          )}
          {isLoading ? (
            <>
              <div className="hidden sm:block">
                <TableSkeleton columns={8} rows={5} />
              </div>
              <div className="sm:hidden">
                <MobileCardSkeleton count={3} />
              </div>
            </>
          ) : (
            <>
            {/* Desktop Table View */}
            <div className="hidden sm:block">
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
                  {!isManager && <TableHead className="text-right">P&L</TableHead>}
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
                            <span className={(workshop.total_pl || 0) >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                              ₹{Number(workshop.total_pl || 0).toLocaleString("en-IN")}
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
                              onClick={() => handleDeleteClick(workshop)}
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
                            <div className="space-y-6">
                              {/* Fresh Call Statistics */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <Phone className="h-4 w-4" />
                                  Fresh Calls (Paid During This Workshop)
                                </div>
                                <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
                                  <div 
                                    className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-2 border-slate-300 dark:border-slate-600 cursor-pointer hover:border-slate-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "all_booked"); }}
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
                                    <div className="text-xs text-muted-foreground">Resch. Remaining</div>
                                  </div>
                                  <div 
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_done"); }}
                                  >
                                    <div className="text-2xl font-bold text-teal-500">{workshop.rescheduled_done || 0}</div>
                                    <div className="text-xs text-muted-foreground">Resch. Done</div>
                                  </div>
                                  <div 
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-purple-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "booking_amount"); }}
                                  >
                                    <div className="text-2xl font-bold text-purple-600">{workshop.booking_amount_calls || 0}</div>
                                    <div className="text-xs text-muted-foreground">Booking Amount</div>
                                  </div>
                                  <div 
                                    className="bg-background rounded-lg p-3 border cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "refunded"); }}
                                  >
                                    <div className="text-2xl font-bold text-amber-600">{workshop.refunded_calls || 0}</div>
                                    <div className="text-xs text-muted-foreground">Refunded</div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Rejoin Calls Section */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                                  <Phone className="h-4 w-4" />
                                  Rejoin Calls (Originated Here, Paid in Later Workshop)
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                                  <div 
                                    className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border-2 border-amber-300 dark:border-amber-700 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
                                  >
                                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{workshop.rejoin_sales_count || 0}</div>
                                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Total Rejoin</div>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border border-amber-200">
                                    <div className="text-lg font-bold text-green-600">{workshop.rejoin_converted || 0}</div>
                                    <div className="text-xs text-muted-foreground">Converted</div>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border border-amber-200">
                                    <div className="text-lg font-bold text-red-500">{workshop.rejoin_not_converted || 0}</div>
                                    <div className="text-xs text-muted-foreground">Not Converted</div>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border border-amber-200">
                                    <div className="text-lg font-bold text-blue-500">{workshop.rejoin_remaining || 0}</div>
                                    <div className="text-xs text-muted-foreground">Remaining</div>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border border-amber-200">
                                    <div className="text-lg font-bold text-orange-500">{workshop.rejoin_rescheduled_remaining || 0}</div>
                                    <div className="text-xs text-muted-foreground">Resch. Remaining</div>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border border-amber-200">
                                    <div className="text-lg font-bold text-teal-500">{workshop.rejoin_rescheduled_done || 0}</div>
                                    <div className="text-xs text-muted-foreground">Resch. Done</div>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border border-amber-200">
                                    <div className="text-lg font-bold text-purple-600">{workshop.rejoin_booking_amount || 0}</div>
                                    <div className="text-xs text-muted-foreground">Booking Amount</div>
                                  </div>
                                </div>
                              </div>

                              {/* Cross-Workshop Payments */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                                  <Phone className="h-4 w-4" />
                                  Cross-Workshop Payments (Paid Here, Credited to Original Workshop)
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div 
                                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border-2 border-gray-300 dark:border-gray-600 cursor-pointer hover:border-gray-400 hover:shadow-sm transition-all"
                                    onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "cross_workshop"); }}
                                  >
                                    <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{workshop.cross_workshop_count || 0}</div>
                                    <div className="text-xs text-gray-500 font-medium">Cross-Workshop Payments</div>
                                    <div className="text-xs text-gray-400 mt-1">Revenue credited to their original workshop</div>
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
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Fresh Revenue */}
                                    <div className="bg-background rounded-lg p-3 border">
                                      <div className="text-lg font-bold text-foreground">
                                        ₹{Number(workshop.fresh_revenue || 0).toLocaleString("en-IN")}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Fresh Workshop Revenue (₹497 × {workshop.fresh_sales_count})</div>
                                    </div>
                                    {/* Rejoin Revenue */}
                                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200">
                                      <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                                        ₹{Number(workshop.rejoin_revenue || 0).toLocaleString("en-IN")}
                                      </div>
                                      <div className="text-xs text-amber-600">Rejoin Revenue (₹497 × {workshop.rejoin_sales_count || 0})</div>
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
                                      <div className="text-xs text-muted-foreground">Total Cash Collected</div>
                                    </div>
                                    <div className="bg-background rounded-lg p-3 border">
                                      <div className={`text-lg font-bold ${(workshop.rough_pl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ₹{Number(workshop.rough_pl || 0).toLocaleString("en-IN")}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Workshop P&L (Total Revenue - Ad Spend)</div>
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
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {filteredWorkshops?.map((workshop) => {
                const isExpanded = expandedRows.has(workshop.id);
                return (
                  <div
                    key={workshop.id}
                    className="rounded-lg border bg-card overflow-hidden"
                  >
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => toggleRowExpand(workshop.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{workshop.title}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {workshop.start_date ? format(new Date(workshop.start_date), "MMM dd, yyyy") : "N/A"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {Number(workshop.amount || 0) === 0 ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200 text-xs">
                              Free
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-blue-200 text-xs">
                              ₹{Number(workshop.amount).toLocaleString("en-IN")}
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center mt-3">
                        <div className="bg-muted/50 rounded-md p-2">
                          <div className="text-sm font-semibold">{workshop.registration_count || 0}</div>
                          <div className="text-[10px] text-muted-foreground">Registrations</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2">
                          <div className="text-sm font-semibold">{workshop.sales_count || 0}</div>
                          <div className="text-[10px] text-muted-foreground">Sales</div>
                        </div>
                        {!isManager && (
                          <div className="bg-muted/50 rounded-md p-2">
                            <div className={`text-sm font-semibold ${(workshop.total_pl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ₹{Number(workshop.total_pl || 0).toLocaleString("en-IN")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">P&L</div>
                          </div>
                        )}
                      </div>
                      
                      {!isManager && (
                        <div className="flex justify-end gap-1 mt-3 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
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
                            className="h-8 w-8 p-0"
                            onClick={() => handleDeleteClick(workshop)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Mobile Expanded Content */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30 p-4 space-y-4">
                        {/* Fresh Calls */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Fresh Calls
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            <div 
                              className="bg-background rounded-md p-2 text-center border cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "all_booked"); }}
                            >
                              <div className="text-sm font-bold">{workshop.total_calls_booked || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Booked</div>
                            </div>
                            <div 
                              className="bg-background rounded-md p-2 text-center border cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "converted"); }}
                            >
                              <div className="text-sm font-bold text-green-600">{workshop.converted_calls || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Converted</div>
                            </div>
                            <div 
                              className="bg-background rounded-md p-2 text-center border cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "not_converted"); }}
                            >
                              <div className="text-sm font-bold text-red-500">{workshop.not_converted_calls || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Not Conv.</div>
                            </div>
                            <div 
                              className="bg-background rounded-md p-2 text-center border cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "remaining"); }}
                            >
                              <div className="text-sm font-bold text-blue-500">{workshop.remaining_calls || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Remaining</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div 
                              className="bg-background rounded-md p-2 text-center border cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_remaining"); }}
                            >
                              <div className="text-sm font-bold text-orange-500">{workshop.rescheduled_remaining || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Resch. Rem</div>
                            </div>
                            <div 
                              className="bg-background rounded-md p-2 text-center border cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_done"); }}
                            >
                              <div className="text-sm font-bold text-teal-500">{workshop.rescheduled_done || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Resch. Done</div>
                            </div>
                            <div 
                              className="bg-background rounded-md p-2 text-center border cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "booking_amount"); }}
                            >
                              <div className="text-sm font-bold text-purple-600">{workshop.booking_amount_calls || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Booking</div>
                            </div>
                            <div 
                              className="bg-background rounded-md p-2 text-center border cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "refunded"); }}
                            >
                              <div className="text-sm font-bold text-amber-600">{workshop.refunded_calls || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Refunded</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Rejoin Calls */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Rejoin Calls
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            <div 
                              className="bg-amber-50 dark:bg-amber-900/20 rounded-md p-2 text-center border border-amber-200 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
                            >
                              <div className="text-sm font-bold text-amber-700">{workshop.rejoin_sales_count || 0}</div>
                              <div className="text-[10px] text-amber-600">Total</div>
                            </div>
                            <div className="bg-background rounded-md p-2 text-center border border-amber-200">
                              <div className="text-sm font-bold text-green-600">{workshop.rejoin_converted || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Converted</div>
                            </div>
                            <div className="bg-background rounded-md p-2 text-center border border-amber-200">
                              <div className="text-sm font-bold text-red-500">{workshop.rejoin_not_converted || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Not Conv.</div>
                            </div>
                            <div className="bg-background rounded-md p-2 text-center border border-amber-200">
                              <div className="text-sm font-bold text-blue-500">{workshop.rejoin_remaining || 0}</div>
                              <div className="text-[10px] text-muted-foreground">Remaining</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Revenue Breakdown - Hidden for managers */}
                        {!isManager && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <IndianRupee className="h-3 w-3" /> Revenue
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-background rounded-md p-2 border">
                                <div className="text-sm font-bold">₹{Number(workshop.fresh_revenue || 0).toLocaleString("en-IN")}</div>
                                <div className="text-[10px] text-muted-foreground">Fresh Revenue</div>
                              </div>
                              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-md p-2 border border-amber-200">
                                <div className="text-sm font-bold text-amber-700">₹{Number(workshop.rejoin_revenue || 0).toLocaleString("en-IN")}</div>
                                <div className="text-[10px] text-amber-600">Rejoin Revenue</div>
                              </div>
                              <div className="bg-background rounded-md p-2 border">
                                <div className="text-sm font-bold text-green-600">₹{Number(workshop.total_cash_received || 0).toLocaleString("en-IN")}</div>
                                <div className="text-[10px] text-muted-foreground">Cash Collected</div>
                              </div>
                              <div className="bg-background rounded-md p-2 border">
                                <div className="text-sm font-bold">₹{Number(workshop.ad_spend || 0).toLocaleString("en-IN")}</div>
                                <div className="text-[10px] text-muted-foreground">Ad Spend</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Workshop"
        itemName={workshopToDelete?.title}
        isDeleting={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default Workshops;
