import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgClosers, useOrgIntegrations } from "@/hooks/useOrgClosers";
import { toast } from "sonner";
import { getCountryInfo } from "@/lib/countryUtils";
import type { LeadsFilters } from "@/components/LeadsFilterSheet";

export const statusColors: Record<string, string> = {
  new: "bg-sky-100 text-sky-700 border-sky-200",
  contacted: "bg-violet-100 text-violet-700 border-violet-200",
  qualified: "bg-amber-100 text-amber-700 border-amber-200",
  proposal: "bg-pink-100 text-pink-700 border-pink-200",
  negotiation: "bg-orange-100 text-orange-700 border-orange-200",
  won: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-red-100 text-red-700 border-red-200",
};

export const formatPhoneDisplay = (phone: string | null, country: string | null) => {
  if (!phone) return { display: "-", countryInfo: null };
  
  if (country) {
    const countryInfo = getCountryInfo(country);
    const cleanPhone = phone.replace(/\D/g, '');
    return { display: `+${country}-${cleanPhone}`, countryInfo };
  }
  
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (phone.startsWith('+')) {
    const match = phone.match(/^\+(\d{1,3})/);
    if (match) {
      const dialCode = match[1];
      const countryInfo = getCountryInfo(dialCode);
      const digits = cleanPhone.slice(dialCode.length);
      return { display: `+${dialCode}-${digits}`, countryInfo };
    }
  }
  
  if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
    const countryInfo = getCountryInfo('91');
    return { display: `+91-${cleanPhone.slice(2)}`, countryInfo };
  }
  
  if (cleanPhone.length === 10) {
    const countryInfo = getCountryInfo('91');
    return { display: `+91-${cleanPhone}`, countryInfo };
  }
  
  return { display: phone, countryInfo: null };
};

interface UseLeadsDataOptions {
  filters: LeadsFilters;
  searchQuery: string;
  editingLead: any;
  resetEditState: () => void;
  resetRefundDialog: () => void;
}

export function useLeadsData({ filters, searchQuery, editingLead, resetEditState, resetRefundDialog }: UseLeadsDataOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  const { data: salesClosers } = useOrgClosers();
  const { data: integrations = [] } = useOrgIntegrations();

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-leads"] });
        queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
        queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_assignments' }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: leadsCount } = useQuery({
    queryKey: ["leads-count", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return 0;
      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentOrganization,
  });

  const { data: searchResults, isLoading: isLoadingSearch } = useQuery({
    queryKey: ["search-leads", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return null;
      const { data, error } = await supabase.rpc("search_leads", {
        search_query: searchQuery.trim()
      });
      if (error) throw error;
      return data;
    },
    enabled: searchQuery.trim().length > 0,
  });

  const { data: leadAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["lead-assignments", currentOrganization?.id, filters.productIds, filters.workshopIds],
    queryFn: async () => {
      if (!currentOrganization) return [];
      let query = supabase
        .from("lead_assignments")
        .select(`
          *,
          lead:leads(
            id, contact_name, company_name, email, phone, country, status, updated_at, created_at, assigned_to, previous_assigned_to,
            assigned_profile:profiles!leads_assigned_to_fkey(id, full_name),
            previous_assigned_profile:profiles!leads_previous_assigned_to_fkey(id, full_name)
          ),
          workshop:workshops!lead_assignments_workshop_id_fkey(id, title),
          converted_from_workshop:workshops!lead_assignments_converted_from_workshop_id_fkey(id, title),
          funnel:funnels(id, funnel_name),
          product:products(id, product_name, price)
        `)
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (filters.productIds.length > 0) {
        query = query.in("product_id", filters.productIds);
      }
      if (filters.workshopIds.length > 0) {
        query = query.in("workshop_id", filters.workshopIds);
      }
      if (filters.productIds.length === 0 && filters.workshopIds.length === 0) {
        query = query.limit(1000);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: allLeads, isLoading: isLoadingLeads } = useQuery({
    queryKey: ["all-leads", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          assigned_profile:profiles!leads_assigned_to_fkey(id, full_name),
          previous_assigned_profile:profiles!leads_previous_assigned_to_fkey(id, full_name)
        `)
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name")
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const { data: workshops } = useQuery({
    queryKey: ["workshops", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("workshops")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: funnels } = useQuery({
    queryKey: ["funnels", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("funnels")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("funnel_name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: products } = useQuery({
    queryKey: ["products", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          funnel:funnels!products_funnel_id_fkey(id, funnel_name)
        `)
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("product_name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const isLoading = isLoadingAssignments || isLoadingLeads || isLoadingSearch;

  // --- Mutations ---

  const saveMutation = useMutation({
    mutationFn: async ({ leadData, workshopIds, productIds, isConnected, previousAssignedTo, convertedFromWorkshopId }: any) => {
      let leadId = editingLead?.id;
      if (editingLead) {
        const updateData = { ...leadData };
        if (previousAssignedTo && previousAssignedTo !== leadData.assigned_to) {
          updateData.previous_assigned_to = previousAssignedTo;
        }
        const { error } = await supabase.from("leads").update(updateData).eq("id", leadId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("leads")
          .insert([{ ...leadData, created_by: user?.id }])
          .select()
          .single();
        if (error) throw error;
        leadId = data.id;
      }

      const { error: deleteError } = await supabase.from("lead_assignments").delete().eq("lead_id", leadId);
      if (deleteError) throw deleteError;

      const assignments: any[] = [];
      const productToFunnelMap = new Map<string, string>();
      productIds.forEach((productId: string) => {
        const product = products?.find((p: any) => p.id === productId);
        if (product?.funnel_id) productToFunnelMap.set(productId, product.funnel_id);
      });

      if (isConnected && workshopIds.length > 0 && productIds.length > 0) {
        const firstProduct = productIds[0];
        const firstFunnelId = productToFunnelMap.get(firstProduct);
        assignments.push({
          lead_id: leadId, workshop_id: workshopIds[0], product_id: firstProduct,
          funnel_id: firstFunnelId, is_connected: true, created_by: user?.id,
          converted_from_workshop_id: convertedFromWorkshopId || null,
        });
        for (let i = 1; i < workshopIds.length; i++) {
          assignments.push({ lead_id: leadId, workshop_id: workshopIds[i], product_id: null, funnel_id: null, is_connected: false, created_by: user?.id });
        }
        for (let i = 1; i < productIds.length; i++) {
          const productId = productIds[i];
          const funnelId = productToFunnelMap.get(productId);
          assignments.push({
            lead_id: leadId, product_id: productId, funnel_id: funnelId, workshop_id: null,
            is_connected: false, created_by: user?.id, converted_from_workshop_id: convertedFromWorkshopId || null,
          });
        }
      } else {
        workshopIds.forEach((wId: string) => {
          assignments.push({ lead_id: leadId, workshop_id: wId, product_id: null, funnel_id: null, is_connected: false, created_by: user?.id });
        });
        productIds.forEach((productId: string) => {
          const funnelId = productToFunnelMap.get(productId);
          assignments.push({
            lead_id: leadId, product_id: productId, funnel_id: funnelId, workshop_id: null,
            is_connected: false, created_by: user?.id, converted_from_workshop_id: convertedFromWorkshopId || null,
          });
        });
      }

      if (assignments.length > 0) {
        const { error: insertError } = await supabase.from("lead_assignments").insert(assignments);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      toast.success(editingLead ? "Customer updated successfully" : "Customer created successfully");
      resetEditState();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      toast.success("Customer deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ leadId, assignedTo, currentAssignedTo }: { leadId: string; assignedTo: string; currentAssignedTo: string | null }) => {
      const updateData: any = { assigned_to: assignedTo };
      if (currentAssignedTo && currentAssignedTo !== assignedTo) {
        updateData.previous_assigned_to = currentAssignedTo;
      }
      const { error } = await supabase.from("leads").update(updateData).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      toast.success("Customer assigned successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const fetchLeadAppointments = async (leadId: string) => {
    const { data, error } = await supabase
      .from("call_appointments")
      .select("id, status, scheduled_date, scheduled_time, refund_reason")
      .eq("lead_id", leadId)
      .neq("status", "refunded");
    if (error) { toast.error("Failed to fetch appointments"); return []; }
    return data || [];
  };

  const fetchLeadAssignmentsForRefund = async (leadId: string) => {
    const { data, error } = await supabase
      .from("lead_assignments")
      .select(`
        id, is_refunded, refund_reason,
        workshop:workshops!lead_assignments_workshop_id_fkey(id, title),
        product:products(id, product_name, price)
      `)
      .eq("lead_id", leadId)
      .eq("is_refunded", false);
    if (error) { toast.error("Failed to fetch assignments"); return []; }
    return data || [];
  };

  const markRefundMutation = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason: string }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({ status: "refunded" as any, refund_reason: reason })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      queryClient.invalidateQueries({ queryKey: ["workshop-calls"] });
      toast.success("Marked as refunded successfully");
      resetRefundDialog();
    },
    onError: (error: any) => {
      toast.error("Failed to mark as refunded: " + error.message);
    },
  });

  const markAssignmentRefundMutation = useMutation({
    mutationFn: async ({ assignmentId, reason }: { assignmentId: string; reason: string }) => {
      const { error } = await supabase
        .from("lead_assignments")
        .update({ is_refunded: true, refund_reason: reason, refunded_at: new Date().toISOString() })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      queryClient.invalidateQueries({ queryKey: ["workshop-calls"] });
      toast.success("Marked as refunded successfully");
      resetRefundDialog();
    },
    onError: (error: any) => {
      toast.error("Failed to mark as refunded: " + error.message);
    },
  });

  const undoRefundMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("lead_assignments")
        .update({ is_refunded: false, refund_reason: null, refunded_at: null })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Refund undone successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to undo refund: " + error.message);
    },
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["all-leads"] });
  };

  const invalidateOnImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["all-leads"] });
    queryClient.invalidateQueries({ queryKey: ["leads-count"] });
  };

  return {
    // Organization
    currentOrganization,
    orgLoading,
    // Data
    leadsCount,
    searchResults,
    leadAssignments,
    allLeads,
    profiles,
    workshops,
    funnels,
    products,
    salesClosers,
    integrations,
    isLoading,
    // Mutations
    saveMutation,
    deleteMutation,
    assignMutation,
    markRefundMutation,
    markAssignmentRefundMutation,
    undoRefundMutation,
    // Helpers
    fetchLeadAppointments,
    fetchLeadAssignmentsForRefund,
    refreshData,
    invalidateOnImportSuccess,
  };
}
