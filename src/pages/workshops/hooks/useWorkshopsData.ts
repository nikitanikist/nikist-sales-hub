import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useWorkshopTags } from "@/hooks/useWorkshopTags";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { fromOrgTime } from "@/lib/timezoneUtils";

export type CallCategory = 
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

export const statusColors: Record<string, string> = {
  planned: "bg-sky-100 text-sky-700 border-sky-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

// The ₹497 product ID for "One To One Strategy Call with Crypto Expert"
export const WORKSHOP_SALES_PRODUCT_ID = "b8709b0b-1160-4d73-b59b-2849490d2053";
export const PRODUCT_PRICE = 497;

export function useWorkshopsData(searchQuery: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { tags, tagsLoading, defaultTag } = useWorkshopTags();
  const { format: formatOrg } = useOrgTimezone();

  const { data: workshops, isLoading, error, refetch } = useQuery({
    queryKey: ["workshops", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      console.log("Fetching workshops...");
      const { data: workshopsData, error } = await supabase
        .from("workshops")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .is("product_id", null)
        .order("start_date", { ascending: false })
        .limit(1000);
      
      if (error) {
        console.error("Error fetching workshops:", error);
        throw error;
      }
      console.log("Workshops data:", workshopsData);

      const { data: metricsData, error: metricsError } = await supabase.rpc("get_workshop_metrics");
      
      if (metricsError) {
        console.error("Error fetching workshop metrics:", metricsError);
      }
      console.log("Metrics data:", metricsData);

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
          fresh_sales_count: Number(item.fresh_sales_count) || 0,
          fresh_converted: Number(item.fresh_converted) || 0,
          fresh_not_converted: Number(item.fresh_not_converted) || 0,
          fresh_remaining: Number(item.fresh_remaining) || 0,
          fresh_rescheduled_remaining: Number(item.fresh_rescheduled_remaining) || 0,
          fresh_rescheduled_done: Number(item.fresh_rescheduled_done) || 0,
          fresh_booking_amount: Number(item.fresh_booking_amount) || 0,
          fresh_offer_amount: Number(item.fresh_offer_amount) || 0,
          fresh_cash_received: Number(item.fresh_cash_received) || 0,
          rejoin_sales_count: Number(item.rejoin_sales_count) || 0,
          rejoin_converted: Number(item.rejoin_converted) || 0,
          rejoin_not_converted: Number(item.rejoin_not_converted) || 0,
          rejoin_remaining: Number(item.rejoin_remaining) || 0,
          rejoin_rescheduled_remaining: Number(item.rejoin_rescheduled_remaining) || 0,
          rejoin_rescheduled_done: Number(item.rejoin_rescheduled_done) || 0,
          rejoin_booking_amount: Number(item.rejoin_booking_amount) || 0,
          rejoin_offer_amount: Number(item.rejoin_offer_amount) || 0,
          rejoin_cash_received: Number(item.rejoin_cash_received) || 0,
          cross_workshop_count: Number(item.cross_workshop_count) || 0,
        };
        return acc;
      }, {} as Record<string, any>);

      const workshopsWithMetrics = workshopsData.map((workshop) => {
        const metrics = metricsMap[workshop.id] || {
          registrations: 0, sales: 0, converted_calls: 0, not_converted_calls: 0,
          rescheduled_remaining: 0, rescheduled_done: 0, remaining_calls: 0, booking_amount_calls: 0,
          total_offer_amount: 0, total_cash_received: 0, total_calls_booked: 0, refunded_calls: 0,
          fresh_sales_count: 0, fresh_converted: 0, fresh_not_converted: 0, fresh_remaining: 0,
          fresh_rescheduled_remaining: 0, fresh_rescheduled_done: 0, fresh_booking_amount: 0,
          fresh_offer_amount: 0, fresh_cash_received: 0,
          rejoin_sales_count: 0, rejoin_converted: 0, rejoin_not_converted: 0, rejoin_remaining: 0,
          rejoin_rescheduled_remaining: 0, rejoin_rescheduled_done: 0, rejoin_booking_amount: 0,
          rejoin_offer_amount: 0, rejoin_cash_received: 0, cross_workshop_count: 0,
        };
        const registrationCount = metrics.registrations;
        const salesCount = metrics.sales;
        const freshRevenue = metrics.fresh_sales_count * PRODUCT_PRICE;
        const rejoinRevenue = metrics.rejoin_sales_count * PRODUCT_PRICE;
        const totalRevenue = freshRevenue + rejoinRevenue;
        const adSpend = Number(workshop.ad_spend || 0);
        const roughPL = totalRevenue - adSpend;
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
          cross_workshop_count: metrics.cross_workshop_count,
        };
      });
      
      console.log("Workshops with metrics:", workshopsWithMetrics);
      return workshopsWithMetrics;
    },
    enabled: !!currentOrganization,
  });

  // Real-time subscription for workshops
  useEffect(() => {
    if (!currentOrganization) return;

    const channel = supabase
      .channel('workshops-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workshops',
          filter: `organization_id=eq.${currentOrganization.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["workshops"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentOrganization]);

  // Real-time updates for leads, lead_assignments, call_appointments, and workshops
  useEffect(() => {
    const channel = supabase
      .channel('workshops-deps-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ["workshops"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_assignments' }, () => {
        queryClient.invalidateQueries({ queryKey: ["workshops"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_appointments' }, () => {
        queryClient.invalidateQueries({ queryKey: ["workshops"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workshops' }, () => {
        queryClient.invalidateQueries({ queryKey: ["workshops"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
      
      const workshopData = {
        ...newWorkshop,
        created_by: user?.id,
        organization_id: currentOrganization.id,
        tag_id: newWorkshop.tag_id || defaultTag?.id || null,
      };
      
      const { data: workshop, error } = await supabase.from("workshops").insert([workshopData]).select().single();
      if (error) throw error;
      
      // Trigger community creation (non-blocking)
      try {
        console.log('Triggering WhatsApp community creation for workshop:', workshop.id);
        const { data: communityResult, error: communityError } = await supabase.functions.invoke('create-whatsapp-community', {
          body: {
            workshopId: workshop.id,
            workshopName: workshop.title,
            organizationId: currentOrganization.id
          }
        });
        
        if (communityError) {
          console.error('Community creation failed:', communityError);
        } else if (communityResult?.success) {
          console.log('WhatsApp community created:', communityResult);
          toast.success("WhatsApp community created and linked to workshop");
        } else if (communityResult?.skipped) {
          console.log('Community creation skipped:', communityResult.reason);
        } else {
          console.warn('Community creation unsuccessful:', communityResult);
        }
      } catch (err) {
        console.error('Error calling create-whatsapp-community:', err);
      }
      
      return workshop;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Workshop created successfully");
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
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: assignmentsError } = await supabase
        .from("lead_assignments")
        .delete()
        .eq("workshop_id", id);
      if (assignmentsError) throw assignmentsError;
      
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
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    editingWorkshop: any,
    selectedTagId: string | null,
    callbacks: { onSuccess: () => void }
  ) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const timezone = currentOrganization?.timezone || 'Asia/Kolkata';
    
    const startDateInput = formData.get("start_date") as string;
    const endDateInput = formData.get("end_date") as string;
    
    const startDateUTC = startDateInput 
      ? fromOrgTime(new Date(startDateInput), timezone).toISOString() 
      : null;
    const endDateUTC = endDateInput 
      ? fromOrgTime(new Date(endDateInput), timezone).toISOString() 
      : null;
    
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      start_date: startDateUTC,
      end_date: endDateUTC,
      location: formData.get("location"),
      max_participants: formData.get("max_participants") ? Number(formData.get("max_participants")) : null,
      ad_spend: formData.get("ad_spend") ? Number(formData.get("ad_spend")) : 0,
      amount: formData.get("amount") ? Number(formData.get("amount")) : 0,
      lead_id:
        formData.get("lead_id") === "none" || formData.get("lead_id") === "" ? null : formData.get("lead_id"),
      funnel_id: formData.get("funnel_id") === "none" ? null : formData.get("funnel_id") || null,
      product_id:
        formData.get("product_id") === "none" ? null : formData.get("product_id") || null,
      tag_id: selectedTagId === "none" || selectedTagId === null ? null : selectedTagId,
    };

    if (editingWorkshop) {
      updateMutation.mutate({ id: editingWorkshop.id, updates: data }, { onSuccess: callbacks.onSuccess });
    } else {
      createMutation.mutate(data, { onSuccess: callbacks.onSuccess });
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Workshops data refreshed");
  };

  const filteredWorkshops = useMemo(() => {
    return workshops?.filter((workshop) => {
      const query = searchQuery.toLowerCase();
      return workshop.title.toLowerCase().includes(query);
    });
  }, [workshops, searchQuery]);

  return {
    workshops,
    filteredWorkshops,
    isLoading,
    error,
    leads,
    funnels,
    funnelsLoading,
    products,
    productsLoading,
    tags,
    tagsLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    createFunnelMutation,
    createProductMutation,
    handleSubmit,
    handleRefresh,
    formatOrg,
    currentOrganization,
    queryClient,
  };
}
