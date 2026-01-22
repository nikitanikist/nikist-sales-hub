import { useState, useEffect } from "react";
import { getCountryInfo } from "@/lib/countryUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, RefreshCw, MoreVertical, Ban, Edit, MessageSquare, Users, Trash2, Link2, Calendar, Upload, RotateCcw, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { ScheduleCallDialog } from "@/components/ScheduleCallDialog";
import { LeadsFilterSheet, LeadsFilters } from "@/components/LeadsFilterSheet";
import { ImportCustomersDialog } from "@/components/ImportCustomersDialog";

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  contacted: "bg-yellow-500",
  qualified: "bg-purple-500",
  proposal: "bg-indigo-500",
  negotiation: "bg-orange-500",
  won: "bg-green-500",
  lost: "bg-red-500",
};

// Helper function to format phone display and extract country info
const formatPhoneDisplay = (phone: string | null, country: string | null) => {
  if (!phone) return { display: "-", countryInfo: null };
  
  // If country is provided, use it directly
  if (country) {
    const countryInfo = getCountryInfo(country);
    const cleanPhone = phone.replace(/\D/g, '');
    return { 
      display: `+${country}-${cleanPhone}`, 
      countryInfo 
    };
  }
  
  // If phone already has country code prefix, parse it
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Try to extract country code from formatted phone like "+91 80191 18888"
  if (phone.startsWith('+')) {
    const match = phone.match(/^\+(\d{1,3})/);
    if (match) {
      const dialCode = match[1];
      const countryInfo = getCountryInfo(dialCode);
      const digits = cleanPhone.slice(dialCode.length);
      return { 
        display: `+${dialCode}-${digits}`, 
        countryInfo 
      };
    }
  }
  
  // Check if cleanPhone starts with common country codes
  if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
    const countryInfo = getCountryInfo('91');
    return { 
      display: `+91-${cleanPhone.slice(2)}`, 
      countryInfo 
    };
  }
  
  // Fallback - assume India for 10-digit numbers
  if (cleanPhone.length === 10) {
    const countryInfo = getCountryInfo('91');
    return { 
      display: `+91-${cleanPhone}`, 
      countryInfo 
    };
  }
  
  return { display: phone, countryInfo: null };
};

const Leads = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkshops, setSelectedWorkshops] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [connectWorkshopFunnel, setConnectWorkshopFunnel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isManager, isAdmin } = useUserRole();

  // Schedule Call Dialog State
  const [scheduleCallOpen, setScheduleCallOpen] = useState(false);
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<any>(null);
  const [selectedCloser, setSelectedCloser] = useState<any>(null);

  // Filter Sheet State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<LeadsFilters>({
    dateFrom: undefined,
    dateTo: undefined,
    productIds: [],
    workshopIds: [],
    country: "all",
    status: "all",
  });

  // Import Dialog State
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Refund Dialog State
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedLeadForRefund, setSelectedLeadForRefund] = useState<any>(null);
  const [selectedAppointmentForRefund, setSelectedAppointmentForRefund] = useState<any>(null);
  const [refundReason, setRefundReason] = useState("");
  const [leadAppointments, setLeadAppointments] = useState<any[]>([]);
  const [refundMode, setRefundMode] = useState<'appointment' | 'assignment'>('appointment');
  const [leadAssignmentsForRefund, setLeadAssignmentsForRefund] = useState<any[]>([]);
  const [selectedAssignmentForRefund, setSelectedAssignmentForRefund] = useState<any>(null);

  // Check if any filters are active
  const hasActiveFilters = 
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined ||
    filters.productIds.length > 0 ||
    filters.workshopIds.length > 0 ||
    filters.country !== "all" ||
    filters.status !== "all";

  // Query for exact total count (same as Dashboard)
  const { data: leadsCount } = useQuery({
    queryKey: ["leads-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Real-time subscription for leads and assignments
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

  // Server-side search results (used when searchQuery is not empty)
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
    queryKey: ["lead-assignments", filters.productIds, filters.workshopIds],
    queryFn: async () => {
      let query = supabase
        .from("lead_assignments")
        .select(`
          *,
          lead:leads(
            id,
            contact_name,
            company_name,
            email,
            phone,
            country,
            status,
            updated_at,
            created_at,
            assigned_to,
            previous_assigned_to,
            assigned_profile:profiles!leads_assigned_to_fkey(id, full_name),
            previous_assigned_profile:profiles!leads_previous_assigned_to_fkey(id, full_name)
          ),
          workshop:workshops(id, title),
          funnel:funnels(id, funnel_name),
          product:products(id, product_name, price)
        `)
        .order("created_at", { ascending: false });

      // Apply server-side filters when product or workshop filters are active
      // This ensures ALL matching assignments are returned regardless of the default row limit
      if (filters.productIds.length > 0) {
        query = query.in("product_id", filters.productIds);
      }
      if (filters.workshopIds.length > 0) {
        query = query.in("workshop_id", filters.workshopIds);
      }
      
      // If no filters are active, limit to most recent for performance
      if (filters.productIds.length === 0 && filters.workshopIds.length === 0) {
        query = query.limit(1000);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: allLeads, isLoading: isLoadingLeads } = useQuery({
    queryKey: ["all-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          assigned_profile:profiles!leads_assigned_to_fkey(id, full_name),
          previous_assigned_profile:profiles!leads_previous_assigned_to_fkey(id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingAssignments || isLoadingLeads || isLoadingSearch;

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch sales closers (profiles with sales_rep or admin roles)
  const { data: salesClosers } = useQuery({
    queryKey: ["sales-closers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          profile:profiles!user_roles_user_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .in("role", ["sales_rep", "admin"]);

      if (error) throw error;
      return data?.map((r: any) => r.profile).filter(Boolean) || [];
    },
  });

  const { data: workshops } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("*")
        .order("title");

      if (error) throw error;
      return data;
    },
  });

  const { data: funnels } = useQuery({
    queryKey: ["funnels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnels")
        .select("*")
        .order("funnel_name");

      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          funnel:funnels!products_funnel_id_fkey(id, funnel_name)
        `)
        .eq("is_active", true)
        .order("product_name");

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ leadData, workshopIds, productIds, isConnected, previousAssignedTo }: any) => {
      // Upsert lead basic info
      let leadId = editingLead?.id;
      if (editingLead) {
        // If assigned_to is changing, track the previous assignee
        const updateData = { ...leadData };
        if (previousAssignedTo && previousAssignedTo !== leadData.assigned_to) {
          updateData.previous_assigned_to = previousAssignedTo;
        }
        
        const { error } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", leadId);
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

      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from("lead_assignments")
        .delete()
        .eq("lead_id", leadId);
      if (deleteError) throw deleteError;

      // Create new assignments
      const assignments = [];
      
      // Map product IDs to their funnel IDs
      const productToFunnelMap = new Map<string, string>();
      productIds.forEach((productId: string) => {
        const product = products?.find(p => p.id === productId);
        if (product?.funnel_id) {
          productToFunnelMap.set(productId, product.funnel_id);
        }
      });
      
      if (isConnected && workshopIds.length > 0 && productIds.length > 0) {
        // Create connected pair
        const firstProduct = productIds[0];
        const firstFunnelId = productToFunnelMap.get(firstProduct);
        assignments.push({
          lead_id: leadId,
          workshop_id: workshopIds[0],
          product_id: firstProduct,
          funnel_id: firstFunnelId,
          is_connected: true,
          created_by: user?.id,
        });
        
        // Add remaining workshops as separate assignments
        for (let i = 1; i < workshopIds.length; i++) {
          assignments.push({
            lead_id: leadId,
            workshop_id: workshopIds[i],
            product_id: null,
            funnel_id: null,
            is_connected: false,
            created_by: user?.id,
          });
        }
        
        // Add remaining products as separate assignments
        for (let i = 1; i < productIds.length; i++) {
          const productId = productIds[i];
          const funnelId = productToFunnelMap.get(productId);
          assignments.push({
            lead_id: leadId,
            product_id: productId,
            funnel_id: funnelId,
            workshop_id: null,
            is_connected: false,
            created_by: user?.id,
          });
        }
      } else {
        // Create separate assignments
        workshopIds.forEach((wId: string) => {
          assignments.push({
            lead_id: leadId,
            workshop_id: wId,
            product_id: null,
            funnel_id: null,
            is_connected: false,
            created_by: user?.id,
          });
        });
        
        productIds.forEach((productId: string) => {
          const funnelId = productToFunnelMap.get(productId);
          assignments.push({
            lead_id: leadId,
            product_id: productId,
            funnel_id: funnelId,
            workshop_id: null,
            is_connected: false,
            created_by: user?.id,
          });
        });
      }

      if (assignments.length > 0) {
        const { error: insertError } = await supabase
          .from("lead_assignments")
          .insert(assignments);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      toast.success(editingLead ? "Customer updated successfully" : "Customer created successfully");
      setIsOpen(false);
      setEditingLead(null);
      setSelectedWorkshops([]);
      setSelectedProducts([]);
      setConnectWorkshopFunnel(false);
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
      // If there's a current assignee and it's different from the new one, save it as previous
      const updateData: any = { assigned_to: assignedTo };
      if (currentAssignedTo && currentAssignedTo !== assignedTo) {
        updateData.previous_assigned_to = currentAssignedTo;
      }
      
      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", leadId);
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

  // Fetch lead appointments for refund
  const fetchLeadAppointments = async (leadId: string) => {
    const { data, error } = await supabase
      .from("call_appointments")
      .select("id, status, scheduled_date, scheduled_time, refund_reason")
      .eq("lead_id", leadId)
      .neq("status", "refunded");
    
    if (error) {
      toast.error("Failed to fetch appointments");
      return [];
    }
    return data || [];
  };

  const markRefundMutation = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason: string }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({ 
          status: "refunded" as any,
          refund_reason: reason 
        })
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
        .update({ 
          is_refunded: true,
          refund_reason: reason,
          refunded_at: new Date().toISOString()
        })
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

  const resetRefundDialog = () => {
    setRefundDialogOpen(false);
    setSelectedLeadForRefund(null);
    setSelectedAppointmentForRefund(null);
    setRefundReason("");
    setLeadAppointments([]);
    setRefundMode('appointment');
    setLeadAssignmentsForRefund([]);
    setSelectedAssignmentForRefund(null);
  };

  // Fetch lead assignments for refund (when no call appointments exist)
  const fetchLeadAssignmentsForRefund = async (leadId: string) => {
    const { data, error } = await supabase
      .from("lead_assignments")
      .select(`
        id, 
        is_refunded, 
        refund_reason,
        workshop:workshops(id, title),
        product:products(id, product_name, price)
      `)
      .eq("lead_id", leadId)
      .eq("is_refunded", false);
    
    if (error) {
      toast.error("Failed to fetch assignments");
      return [];
    }
    return data || [];
  };

  // Row-specific refund: pass the specific assignment to refund directly
  const handleMarkAsRefund = async (lead: any, assignment?: any) => {
    // If a specific assignment is provided, refund it directly
    if (assignment && assignment.id && !assignment.id.startsWith('consolidated-')) {
      setRefundMode('assignment');
      setSelectedLeadForRefund(lead);
      setLeadAssignmentsForRefund([assignment]);
      setSelectedAssignmentForRefund(assignment);
      setRefundReason("");
      setRefundDialogOpen(true);
      return;
    }
    
    // Fallback: First try to find call appointments
    const appointments = await fetchLeadAppointments(lead.id);
    
    if (appointments.length > 0) {
      // Has call appointments - use appointment refund flow
      setRefundMode('appointment');
      setSelectedLeadForRefund(lead);
      setLeadAppointments(appointments);
      
      if (appointments.length === 1) {
        setSelectedAppointmentForRefund(appointments[0]);
      } else {
        setSelectedAppointmentForRefund(null);
      }
      
      setRefundReason("");
      setRefundDialogOpen(true);
    } else {
      // No call appointments - use assignment refund flow
      const assignments = await fetchLeadAssignmentsForRefund(lead.id);
      
      if (assignments.length === 0) {
        toast.error("No active assignments found for this customer");
        return;
      }
      
      setRefundMode('assignment');
      setSelectedLeadForRefund(lead);
      setLeadAssignmentsForRefund(assignments);
      
      if (assignments.length === 1) {
        setSelectedAssignmentForRefund(assignments[0]);
      } else {
        setSelectedAssignmentForRefund(null);
      }
      
      setRefundReason("");
      setRefundDialogOpen(true);
    }
  };
  
  // Undo refund mutation
  const undoRefundMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("lead_assignments")
        .update({ 
          is_refunded: false,
          refund_reason: null,
          refunded_at: null
        })
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

  const handleConfirmRefund = () => {
    if (!refundReason.trim()) {
      toast.error("Please provide a refund reason");
      return;
    }
    
    if (refundMode === 'appointment') {
      if (!selectedAppointmentForRefund) {
        toast.error("Please select an appointment to refund");
        return;
      }
      markRefundMutation.mutate({
        appointmentId: selectedAppointmentForRefund.id,
        reason: refundReason.trim(),
      });
    } else {
      if (!selectedAssignmentForRefund) {
        toast.error("Please select an assignment to refund");
        return;
      }
      markAssignmentRefundMutation.mutate({
        assignmentId: selectedAssignmentForRefund.id,
        reason: refundReason.trim(),
      });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const leadData = {
      company_name: editingLead?.company_name || formData.get("contact_name") || "Customer",
      contact_name: formData.get("contact_name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      country: formData.get("country"),
      status: formData.get("status"),
      value: formData.get("value") ? Number(formData.get("value")) : null,
      notes: formData.get("notes"),
      assigned_to: formData.get("assigned_to") === "none" ? null : (formData.get("assigned_to") || null),
    };

    saveMutation.mutate({
      leadData,
      workshopIds: selectedWorkshops,
      productIds: selectedProducts,
      isConnected: connectWorkshopFunnel,
      previousAssignedTo: editingLead?.assigned_to,
    });
  };

  // Group all assignments by customer EMAIL for customer-level product/workshop filtering
  // This ensures customers with multiple lead records (one for workshop, one for product) are matched correctly
  const assignmentsByEmail = leadAssignments?.reduce((acc, assignment) => {
    const email = assignment.lead?.email;
    if (!email) return acc;
    if (!acc[email]) acc[email] = [];
    acc[email].push(assignment);
    return acc;
  }, {} as Record<string, typeof leadAssignments>);

  // Helper to check if a customer (by email) matches product/workshop filters across ALL their assignments
  const customerMatchesProductWorkshopFilters = (email: string) => {
    const customerAssignments = assignmentsByEmail?.[email] || [];
    
    const matchesProduct = filters.productIds.length === 0 || 
      customerAssignments.some(a => a.product_id && filters.productIds.includes(a.product_id));
    
    const matchesWorkshop = filters.workshopIds.length === 0 || 
      customerAssignments.some(a => a.workshop_id && filters.workshopIds.includes(a.workshop_id));
    
    return matchesProduct && matchesWorkshop;
  };

  const filteredAssignments = leadAssignments?.filter((assignment) => {
    const query = searchQuery.toLowerCase();
    const lead = assignment.lead;
    const email = lead?.email;
    
    // Search filter
    const matchesSearch = 
      lead?.contact_name?.toLowerCase().includes(query) ||
      lead?.email?.toLowerCase().includes(query) ||
      lead?.phone?.toLowerCase().includes(query);

    // Date filter
    const leadDate = lead?.created_at ? new Date(lead.created_at) : null;
    const matchesDateFrom = !filters.dateFrom || (leadDate && leadDate >= filters.dateFrom);
    const matchesDateTo = !filters.dateTo || (leadDate && leadDate <= new Date(filters.dateTo.getTime() + 86400000)); // Add 1 day to include the end date

    // Product/Workshop filter at CUSTOMER level (check across all customer's assignments by email)
    const matchesProductWorkshop = email ? customerMatchesProductWorkshopFilters(email) : false;

    // Country filter
    const matchesCountry = filters.country === "all" || lead?.country === filters.country;

    // Status filter (Active/Inactive/Revoked mapping)
    const matchesStatus = filters.status === "all" || 
      (filters.status === "active" && lead?.status !== "lost") ||
      (filters.status === "inactive" && lead?.status === "lost") ||
      (filters.status === "revoked" && lead?.status === "lost"); // For now map revoked to lost until we add revoked status

    return matchesSearch && matchesDateFrom && matchesDateTo && matchesProductWorkshop && matchesCountry && matchesStatus;
  });

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: LeadsFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  // Filter all leads by search query and filters
  const filteredLeads = allLeads?.filter((lead) => {
    const query = searchQuery.toLowerCase();
    
    // Search filter
    const matchesSearch = 
      lead.contact_name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query);

    // Date filter
    const leadDate = lead.created_at ? new Date(lead.created_at) : null;
    const matchesDateFrom = !filters.dateFrom || (leadDate && leadDate >= filters.dateFrom);
    const matchesDateTo = !filters.dateTo || (leadDate && leadDate <= new Date(filters.dateTo.getTime() + 86400000));

    // Country filter
    const matchesCountry = filters.country === "all" || lead.country === filters.country;

    // Status filter
    const matchesStatus = filters.status === "all" || 
      (filters.status === "active" && lead.status !== "lost") ||
      (filters.status === "inactive" && lead.status === "lost") ||
      (filters.status === "revoked" && lead.status === "lost");

    return matchesSearch && matchesDateFrom && matchesDateTo && matchesCountry && matchesStatus;
  });

  // Check if both product AND workshop filters are active - for consolidated view
  const hasBothProductAndWorkshopFilters = filters.productIds.length > 0 && filters.workshopIds.length > 0;

  // Use server-side search results when search query is present
  const isUsingServerSearch = searchQuery.trim().length > 0 && searchResults;

  // Group assignments by customer EMAIL for consolidated display when both filters are active
  const groupedAssignments = (() => {
    // When using server-side search, convert searchResults to the expected format
    if (isUsingServerSearch) {
      const grouped: Record<string, any> = {};
      
      searchResults.forEach((result: any) => {
        const leadId = result.id;
        if (!leadId) return;
        
        if (!grouped[leadId]) {
          grouped[leadId] = {
            lead: {
              id: result.id,
              contact_name: result.contact_name,
              company_name: result.company_name,
              email: result.email,
              phone: result.phone,
              country: result.country,
              status: result.status,
              notes: result.notes,
              workshop_name: result.workshop_name,
              source: result.source,
              created_at: result.created_at,
              updated_at: result.updated_at,
              assigned_to: result.assigned_to,
              assigned_profile: result.assigned_to_name ? { id: result.assigned_to, full_name: result.assigned_to_name } : null,
            },
            assignments: [],
          };
        }
        
        // Add assignment if it exists
        if (result.assignment_id) {
          grouped[leadId].assignments.push({
            id: result.assignment_id,
            workshop_id: result.workshop_id,
            workshop: result.workshop_title ? { id: result.workshop_id, title: result.workshop_title } : null,
            product_id: result.product_id,
            product: result.product_name ? { id: result.product_id, product_name: result.product_name, price: result.product_price } : null,
            funnel_id: result.funnel_id,
            funnel: result.funnel_name ? { id: result.funnel_id, funnel_name: result.funnel_name } : null,
            is_connected: result.is_connected,
            is_refunded: result.is_refunded,
            refund_reason: result.refund_reason,
            refunded_at: result.refunded_at,
          });
        }
      });
      
      return grouped;
    }
    
    if (hasBothProductAndWorkshopFilters) {
      // When both filters are active, show SEPARATE rows for each matching assignment
      // This ensures refund status is per-row, not merged
      const byEmail: Record<string, any> = {};
      
      filteredAssignments?.forEach((assignment) => {
        const email = assignment.lead?.email;
        if (!email) return;
        
        if (!byEmail[email]) {
          byEmail[email] = {
            lead: assignment.lead,
            matchingAssignments: [],
          };
        }
        
        // Add matching workshop assignments
        if (assignment.workshop_id && filters.workshopIds.includes(assignment.workshop_id)) {
          byEmail[email].matchingAssignments.push(assignment);
        }
        
        // Add matching product assignments (avoid duplicates if same assignment)
        if (assignment.product_id && filters.productIds.includes(assignment.product_id)) {
          const alreadyAdded = byEmail[email].matchingAssignments.some((a: any) => a.id === assignment.id);
          if (!alreadyAdded) {
            byEmail[email].matchingAssignments.push(assignment);
          }
        }
      });
      
      // Convert to grouped format - each assignment is a separate row
      const result: Record<string, any> = {};
      Object.entries(byEmail).forEach(([email, data]) => {
        const leadId = data.lead?.id;
        if (!leadId || data.matchingAssignments.length === 0) return;
        
        // Use email as key to group by customer, with all matching assignments as separate rows
        result[email] = {
          lead: data.lead,
          assignments: data.matchingAssignments,
        };
      });
      
      return result;
    } else {
      // Normal view: group by lead_id and show each assignment as separate row
      return filteredAssignments?.reduce((acc: any, assignment) => {
        const leadId = assignment.lead?.id;
        if (!leadId) return acc;
        
        if (!acc[leadId]) {
          acc[leadId] = {
            lead: assignment.lead,
            assignments: [],
          };
        }
        acc[leadId].assignments.push(assignment);
        return acc;
      }, {});
    }
  })();

  // Add leads without assignments ONLY when product/workshop filters are NOT active AND not using server search
  const hasProductOrWorkshopFilter = filters.productIds.length > 0 || filters.workshopIds.length > 0;
  
  if (!hasProductOrWorkshopFilter && !isUsingServerSearch) {
    filteredLeads?.forEach((lead) => {
      if (!groupedAssignments?.[lead.id]) {
        if (!groupedAssignments) return;
        groupedAssignments[lead.id] = {
          lead: {
            ...lead,
            assigned_to: lead.assigned_to,
          },
          assignments: [],
        };
      }
    });
  }

  // Paginate grouped assignments - sort by newest first
  const groupedAssignmentsArray = Object.values(groupedAssignments || {}).sort((a: any, b: any) => {
    const dateA = new Date(a.lead?.created_at || 0).getTime();
    const dateB = new Date(b.lead?.created_at || 0).getTime();
    return dateB - dateA;
  });
  const totalPages = Math.ceil(groupedAssignmentsArray.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAssignments = groupedAssignmentsArray.slice(startIndex, endIndex);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Customer Count Card */}
      <Card className="w-fit">
        <CardContent className="py-2 sm:py-3 px-3 sm:px-4 flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {hasActiveFilters ? "Filtered Customers" : "Total Customers"}
            </p>
            <p className="text-xl sm:text-2xl font-semibold">
              {hasActiveFilters ? groupedAssignmentsArray.length : (leadsCount ?? 0)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Header with Search */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or email"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setIsFilterOpen(true)}
              className="relative"
            >
              <Filter className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-primary rounded-full" />
              )}
            </Button>
            <Button variant="outline" size="icon" onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
              queryClient.invalidateQueries({ queryKey: ["all-leads"] });
            }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={() => setIsImportOpen(true)} className="hidden sm:flex">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" size="icon" onClick={() => setIsImportOpen(true)} className="sm:hidden">
                <Upload className="h-4 w-4" />
              </Button>
            )}
            {!isManager && (
              <Button onClick={() => {
                setEditingLead(null);
                setSelectedWorkshops([]);
                setSelectedProducts([]);
                setConnectWorkshopFunnel(false);
                setIsOpen(true);
              }} className="hidden sm:flex">
                Add Customer
              </Button>
            )}
            {!isManager && (
              <Button onClick={() => {
                setEditingLead(null);
                setSelectedWorkshops([]);
                setSelectedProducts([]);
                setConnectWorkshopFunnel(false);
                setIsOpen(true);
              }} size="icon" className="sm:hidden">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Workshop</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Last Transaction Date</TableHead>
                  <TableHead>Status</TableHead>
                  {!isManager && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssignments.map((group: any) => {
                  const lead = group.lead;
                  
                  // If no assignments, show lead with empty assignment columns
                  if (group.assignments.length === 0) {
                    return (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{lead.contact_name}</div>
                            {(() => {
                              const { countryInfo } = formatPhoneDisplay(lead.phone, lead.country);
                              return countryInfo ? (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-base">{countryInfo.flag}</span>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-muted/50 border-muted-foreground/20">
                                    {countryInfo.name}
                                  </Badge>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm text-blue-600">{formatPhoneDisplay(lead.phone, lead.country).display}</div>
                            <div className="text-sm text-blue-600">{lead.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                        <div className="text-sm">{lead.assigned_profile?.full_name || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                            ACTIVE
                          </Badge>
                        </TableCell>
                        {!isManager && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-background border shadow-lg z-50">
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setEditingLead(lead);
                                    setSelectedWorkshops([]);
                                    setSelectedProducts([]);
                                    setConnectWorkshopFunnel(false);
                                    setIsOpen(true);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit details
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="cursor-pointer">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Schedule Call
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="bg-background border shadow-lg z-50">
                                    {salesClosers?.map((closer: any) => {
                                      const isAdesh = closer.email?.toLowerCase() === "aadeshnikist@gmail.com";
                                      return (
                                        <DropdownMenuItem
                                          key={closer.id}
                                          className={isAdesh ? "cursor-pointer" : "cursor-not-allowed opacity-50"}
                                          disabled={!isAdesh}
                                          onClick={() => {
                                            if (!isAdesh) return;
                                            setSelectedLeadForCall(lead);
                                            setSelectedCloser(closer);
                                            setScheduleCallOpen(true);
                                          }}
                                        >
                                          <span className="flex items-center gap-2">
                                            {closer.full_name}
                                            {!isAdesh && <span className="text-xs text-muted-foreground">(Calendly)</span>}
                                          </span>
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-amber-600 cursor-pointer"
                                  onClick={() => handleMarkAsRefund(lead)}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Mark as Refund
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 cursor-pointer"
                                  onClick={() => deleteMutation.mutate(lead.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  }
                  
                  return group.assignments.map((assignment: any) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{lead.contact_name}</div>
                          {(() => {
                            const { countryInfo } = formatPhoneDisplay(lead.phone, lead.country);
                            return countryInfo ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-base">{countryInfo.flag}</span>
                                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-muted/50 border-muted-foreground/20">
                                  {countryInfo.name}
                                </Badge>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-blue-600">{formatPhoneDisplay(lead.phone, lead.country).display}</div>
                          <div className="text-sm text-blue-600">{lead.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{assignment.workshop?.title || "-"}</span>
                          {assignment.is_connected && (
                            <Link2 className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.product ? (
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium">{assignment.product.product_name}</div>
                            <div className="text-xs text-muted-foreground">{assignment.funnel?.funnel_name}</div>
                            <div className="text-xs text-primary">₹{assignment.product.price?.toLocaleString('en-IN')}</div>
                          </div>
                        ) : (
                          <span className="text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-sm">{lead.assigned_profile?.full_name || "-"}</div>
                          {lead.previous_assigned_profile?.full_name && (
                            <div className="text-xs text-muted-foreground">
                              Previously: {lead.previous_assigned_profile.full_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.is_refunded ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                            REFUNDED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                            ACTIVE
                          </Badge>
                        )}
                      </TableCell>
                      {!isManager && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-background border shadow-lg z-50">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  setEditingLead(lead);
                                  const workshopIds = group.assignments
                                    .filter((a: any) => a.workshop_id)
                                    .map((a: any) => a.workshop_id);
                                  const productIds = group.assignments
                                    .filter((a: any) => a.product_id)
                                    .map((a: any) => a.product_id);
                                  setSelectedWorkshops(workshopIds);
                                  setSelectedProducts(productIds);
                                  setConnectWorkshopFunnel(group.assignments.some((a: any) => a.is_connected));
                                  setIsOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit details
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="cursor-pointer">
                                  <Calendar className="mr-2 h-4 w-4" />
                                  Schedule Call
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="bg-background border shadow-lg z-50">
                                  {salesClosers?.map((closer: any) => {
                                    const isAdesh = closer.email?.toLowerCase() === "aadeshnikist@gmail.com";
                                    return (
                                      <DropdownMenuItem
                                        key={closer.id}
                                        className={isAdesh ? "cursor-pointer" : "cursor-not-allowed opacity-50"}
                                        disabled={!isAdesh}
                                        onClick={() => {
                                          if (!isAdesh) return;
                                          setSelectedLeadForCall(lead);
                                          setSelectedCloser(closer);
                                          setScheduleCallOpen(true);
                                        }}
                                      >
                                        <span className="flex items-center gap-2">
                                          {closer.full_name}
                                          {!isAdesh && <span className="text-xs text-muted-foreground">(Calendly)</span>}
                                        </span>
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              {/* Row-specific refund: check this specific assignment, not group */}
                              {!assignment.is_refunded && !assignment.id?.startsWith('consolidated-') ? (
                                <DropdownMenuItem
                                  className="text-amber-600 cursor-pointer"
                                  onClick={() => handleMarkAsRefund(lead, assignment)}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Mark as Refund
                                </DropdownMenuItem>
                              ) : assignment.is_refunded && !assignment.id?.startsWith('consolidated-') ? (
                                <DropdownMenuItem
                                  className="text-green-600 cursor-pointer"
                                  onClick={() => undoRefundMutation.mutate(assignment.id)}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Undo Refund
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 cursor-pointer"
                                onClick={() => deleteMutation.mutate(lead.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete customer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3 p-4">
                {paginatedAssignments.map((group: any) => {
                  const lead = group.lead;
                  
                  if (group.assignments.length === 0) {
                    return (
                      <div key={lead.id} className="p-4 rounded-lg border bg-card space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="font-medium">{lead.contact_name}</div>
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">
                            ACTIVE
                          </Badge>
                        </div>
                        <div className="text-xs text-blue-600 space-y-0.5">
                          {lead.email && <div className="truncate">{lead.email}</div>}
                          {lead.phone && <div>{formatPhoneDisplay(lead.phone, lead.country).display}</div>}
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                          <span>{lead.assigned_profile?.full_name || "-"}</span>
                          <span>{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}</span>
                        </div>
                      </div>
                    );
                  }
                  
                  return group.assignments.map((assignment: any) => (
                    <div key={assignment.id} className="p-4 rounded-lg border bg-card space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{lead.contact_name}</div>
                          {assignment.workshop?.title && (
                            <div className="text-xs text-muted-foreground truncate">{assignment.workshop.title}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {assignment.is_refunded ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs">
                              REFUNDED
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">
                              ACTIVE
                            </Badge>
                          )}
                          {!isManager && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 bg-background border shadow-lg z-50">
                                <DropdownMenuItem
                                  className="cursor-pointer text-sm"
                                  onClick={() => {
                                    setEditingLead(lead);
                                    const workshopIds = group.assignments.filter((a: any) => a.workshop_id).map((a: any) => a.workshop_id);
                                    const productIds = group.assignments.filter((a: any) => a.product_id).map((a: any) => a.product_id);
                                    setSelectedWorkshops(workshopIds);
                                    setSelectedProducts(productIds);
                                    setConnectWorkshopFunnel(group.assignments.some((a: any) => a.is_connected));
                                    setIsOpen(true);
                                  }}
                                >
                                  <Edit className="mr-2 h-3 w-3" />
                                  Edit
                                </DropdownMenuItem>
                                {!assignment.is_refunded && !assignment.id?.startsWith('consolidated-') && (
                                  <DropdownMenuItem
                                    className="text-amber-600 cursor-pointer text-sm"
                                    onClick={() => handleMarkAsRefund(lead, assignment)}
                                  >
                                    <RotateCcw className="mr-2 h-3 w-3" />
                                    Mark Refund
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-blue-600 space-y-0.5">
                        {lead.email && <div className="truncate">{lead.email}</div>}
                        {lead.phone && <div>{formatPhoneDisplay(lead.phone, lead.country).display}</div>}
                      </div>
                      {assignment.product && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{assignment.product.product_name}</span>
                          <span className="font-medium text-primary">₹{assignment.product.price?.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t">
                        <span>{lead.assigned_profile?.full_name || "-"}</span>
                        <span>{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}</span>
                      </div>
                    </div>
                  ));
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {!isLoading && groupedAssignmentsArray.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, groupedAssignmentsArray.length)} of {groupedAssignmentsArray.length} customers
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? "Edit Customer Details" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Customer Name</Label>
                  <Input
                    id="contact_name"
                    name="contact_name"
                    defaultValue={editingLead?.contact_name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    defaultValue={editingLead?.country}
                    placeholder="e.g., INDIA, USA"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingLead?.email}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={editingLead?.phone}
                    placeholder="+91-9876543210"
                  />
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <Label>Workshops & Products</Label>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Select Workshops</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                    {workshops?.map((workshop) => (
                      <div key={workshop.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`workshop-${workshop.id}`}
                          checked={selectedWorkshops.includes(workshop.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedWorkshops([...selectedWorkshops, workshop.id]);
                            } else {
                              setSelectedWorkshops(selectedWorkshops.filter(id => id !== workshop.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`workshop-${workshop.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {workshop.title}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Select Products</Label>
                  <div className="space-y-3 max-h-64 overflow-y-auto p-2 border rounded-md">
                    {funnels?.map((funnel) => {
                      const funnelProducts = products?.filter(p => p.funnel_id === funnel.id);
                      if (!funnelProducts || funnelProducts.length === 0) return null;
                      return (
                        <div key={funnel.id} className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {funnel.funnel_name}
                          </div>
                          <div className="grid grid-cols-2 gap-2 pl-2">
                            {funnelProducts.map((product) => (
                              <div key={product.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`product-${product.id}`}
                                  checked={selectedProducts.includes(product.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedProducts([...selectedProducts, product.id]);
                                    } else {
                                      setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`product-${product.id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {product.product_name} <span className="text-xs text-muted-foreground">(₹{product.price?.toLocaleString('en-IN')})</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="connect"
                    checked={connectWorkshopFunnel}
                    onCheckedChange={(checked) => setConnectWorkshopFunnel(checked as boolean)}
                  />
                  <Label htmlFor="connect" className="text-sm cursor-pointer">
                    Connect first workshop with first product (e.g., Free Workshop + Free Product)
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Select name="assigned_to" defaultValue={editingLead?.assigned_to || "none"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a closer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Value (₹)</Label>
                  <Input
                    id="value"
                    name="value"
                    type="number"
                    step="0.01"
                    defaultValue={editingLead?.value}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editingLead?.status || "new"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingLead?.notes}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : (editingLead ? "Update" : "Create") + " Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Call Dialog */}
      <ScheduleCallDialog
        open={scheduleCallOpen}
        onOpenChange={setScheduleCallOpen}
        lead={selectedLeadForCall}
        closer={selectedCloser}
      />

      {/* Filter Sheet */}
      <LeadsFilterSheet
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        products={products || []}
        workshops={workshops || []}
      />

      {/* Import Customers Dialog */}
      <ImportCustomersDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        workshops={workshops || []}
        products={products || []}
        salesClosers={salesClosers || []}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
          queryClient.invalidateQueries({ queryKey: ["all-leads"] });
          queryClient.invalidateQueries({ queryKey: ["leads-count"] });
        }}
      />

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Refunded</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              You are about to mark {refundMode === 'appointment' ? 'a call' : 'an assignment'} for <span className="font-medium text-foreground">{selectedLeadForRefund?.contact_name}</span> as refunded.
            </div>
            
            {/* Appointment mode */}
            {refundMode === 'appointment' && leadAppointments.length > 1 && (
              <div className="space-y-2">
                <Label>Select Appointment</Label>
                <Select
                  value={selectedAppointmentForRefund?.id || ""}
                  onValueChange={(value) => {
                    const apt = leadAppointments.find(a => a.id === value);
                    setSelectedAppointmentForRefund(apt);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an appointment to refund" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadAppointments.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        {apt.scheduled_date ? new Date(apt.scheduled_date).toLocaleDateString() : "No date"} - {apt.scheduled_time || "No time"} ({apt.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {refundMode === 'appointment' && leadAppointments.length === 1 && selectedAppointmentForRefund && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <div><span className="font-medium">Date:</span> {selectedAppointmentForRefund.scheduled_date ? new Date(selectedAppointmentForRefund.scheduled_date).toLocaleDateString() : "No date"}</div>
                <div><span className="font-medium">Time:</span> {selectedAppointmentForRefund.scheduled_time || "No time"}</div>
                <div><span className="font-medium">Status:</span> {selectedAppointmentForRefund.status}</div>
              </div>
            )}
            
            {/* Assignment mode */}
            {refundMode === 'assignment' && leadAssignmentsForRefund.length > 1 && (
              <div className="space-y-2">
                <Label>Select Assignment to Refund</Label>
                <Select
                  value={selectedAssignmentForRefund?.id || ""}
                  onValueChange={(value) => {
                    const assignment = leadAssignmentsForRefund.find(a => a.id === value);
                    setSelectedAssignmentForRefund(assignment);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an assignment to refund" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadAssignmentsForRefund.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.workshop?.title || assignment.product?.product_name || "Unknown"} 
                        {assignment.product?.price ? ` - ₹${assignment.product.price}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {refundMode === 'assignment' && leadAssignmentsForRefund.length === 1 && selectedAssignmentForRefund && (
              <div className="p-3 bg-muted rounded-md text-sm">
                {selectedAssignmentForRefund.workshop && (
                  <div><span className="font-medium">Workshop:</span> {selectedAssignmentForRefund.workshop.title}</div>
                )}
                {selectedAssignmentForRefund.product && (
                  <>
                    <div><span className="font-medium">Product:</span> {selectedAssignmentForRefund.product.product_name}</div>
                    <div><span className="font-medium">Price:</span> ₹{selectedAssignmentForRefund.product.price}</div>
                  </>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Refund Reason <span className="text-red-500">*</span></Label>
              <Textarea
                id="refund-reason"
                placeholder="Enter the reason for refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmRefund}
              disabled={
                (markRefundMutation.isPending || markAssignmentRefundMutation.isPending) || 
                !refundReason.trim() || 
                (refundMode === 'appointment' && !selectedAppointmentForRefund) ||
                (refundMode === 'assignment' && !selectedAssignmentForRefund)
              }
              className="bg-amber-600 hover:bg-amber-700"
            >
              {(markRefundMutation.isPending || markAssignmentRefundMutation.isPending) ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
