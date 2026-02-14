import { useMemo } from "react";
import type { LeadsFilters } from "@/components/LeadsFilterSheet";

interface UseLeadsFiltersOptions {
  leadAssignments: any[] | undefined;
  allLeads: any[] | undefined;
  searchResults: any[] | null | undefined;
  searchQuery: string;
  filters: LeadsFilters;
  currentPage: number;
  itemsPerPage: number;
}

export function useLeadsFilters({
  leadAssignments,
  allLeads,
  searchResults,
  searchQuery,
  filters,
  currentPage,
  itemsPerPage,
}: UseLeadsFiltersOptions) {

  const hasActiveFilters = 
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined ||
    filters.productIds.length > 0 ||
    filters.workshopIds.length > 0 ||
    filters.country !== "all" ||
    filters.status !== "all";

  const hasBothProductAndWorkshopFilters = filters.productIds.length > 0 && filters.workshopIds.length > 0;
  const hasProductOrWorkshopFilter = filters.productIds.length > 0 || filters.workshopIds.length > 0;
  const isUsingServerSearch = searchQuery.trim().length > 0 && searchResults;

  // Group assignments by email for customer-level filtering
  const assignmentsByEmail = useMemo(() => {
    return leadAssignments?.reduce((acc, assignment) => {
      const email = assignment.lead?.email;
      if (!email) return acc;
      if (!acc[email]) acc[email] = [];
      acc[email].push(assignment);
      return acc;
    }, {} as Record<string, any[]>);
  }, [leadAssignments]);

  const filteredAssignments = useMemo(() => {
    return leadAssignments?.filter((assignment) => {
      const query = searchQuery.toLowerCase();
      const lead = assignment.lead;
      const email = lead?.email;
      
      const matchesSearch = 
        lead?.contact_name?.toLowerCase().includes(query) ||
        lead?.email?.toLowerCase().includes(query) ||
        lead?.phone?.toLowerCase().includes(query);

      const leadDate = lead?.created_at ? new Date(lead.created_at) : null;
      const matchesDateFrom = !filters.dateFrom || (leadDate && leadDate >= filters.dateFrom);
      const matchesDateTo = !filters.dateTo || (leadDate && leadDate <= new Date(filters.dateTo.getTime() + 86400000));

      // Product/Workshop filter at CUSTOMER level
      const customerAssignments = email ? (assignmentsByEmail?.[email] || []) : [];
      const matchesProduct = filters.productIds.length === 0 || 
        customerAssignments.some((a: any) => a.product_id && filters.productIds.includes(a.product_id));
      const matchesWorkshop = filters.workshopIds.length === 0 || 
        customerAssignments.some((a: any) => a.workshop_id && filters.workshopIds.includes(a.workshop_id));
      const matchesProductWorkshop = email ? (matchesProduct && matchesWorkshop) : false;

      const matchesCountry = filters.country === "all" || lead?.country === filters.country;
      const matchesStatus = filters.status === "all" || 
        (filters.status === "active" && lead?.status !== "lost") ||
        (filters.status === "inactive" && lead?.status === "lost") ||
        (filters.status === "revoked" && lead?.status === "lost");

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesProductWorkshop && matchesCountry && matchesStatus;
    });
  }, [leadAssignments, searchQuery, filters, assignmentsByEmail]);

  const filteredLeads = useMemo(() => {
    return allLeads?.filter((lead) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        lead.contact_name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.phone?.toLowerCase().includes(query);

      const leadDate = lead.created_at ? new Date(lead.created_at) : null;
      const matchesDateFrom = !filters.dateFrom || (leadDate && leadDate >= filters.dateFrom);
      const matchesDateTo = !filters.dateTo || (leadDate && leadDate <= new Date(filters.dateTo.getTime() + 86400000));
      const matchesCountry = filters.country === "all" || lead.country === filters.country;
      const matchesStatus = filters.status === "all" || 
        (filters.status === "active" && lead.status !== "lost") ||
        (filters.status === "inactive" && lead.status === "lost") ||
        (filters.status === "revoked" && lead.status === "lost");

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesCountry && matchesStatus;
    });
  }, [allLeads, searchQuery, filters]);

  const groupedAssignments = useMemo(() => {
    // Server search mode
    if (isUsingServerSearch) {
      const grouped: Record<string, any> = {};
      searchResults!.forEach((result: any) => {
        const leadId = result.id;
        if (!leadId) return;
        if (!grouped[leadId]) {
          grouped[leadId] = {
            lead: {
              id: result.id, contact_name: result.contact_name, company_name: result.company_name,
              email: result.email, phone: result.phone, country: result.country, status: result.status,
              notes: result.notes, workshop_name: result.workshop_name, source: result.source,
              created_at: result.created_at, updated_at: result.updated_at, assigned_to: result.assigned_to,
              assigned_profile: result.assigned_to_name ? { id: result.assigned_to, full_name: result.assigned_to_name } : null,
            },
            assignments: [],
          };
        }
        if (result.assignment_id) {
          grouped[leadId].assignments.push({
            id: result.assignment_id, workshop_id: result.workshop_id,
            workshop: result.workshop_title ? { id: result.workshop_id, title: result.workshop_title } : null,
            product_id: result.product_id,
            product: result.product_name ? { id: result.product_id, product_name: result.product_name, price: result.product_price } : null,
            funnel_id: result.funnel_id,
            funnel: result.funnel_name ? { id: result.funnel_id, funnel_name: result.funnel_name } : null,
            is_connected: result.is_connected, is_refunded: result.is_refunded,
            refund_reason: result.refund_reason, refunded_at: result.refunded_at,
          });
        }
      });
      return grouped;
    }

    // Consolidated view (both product + workshop filters)
    if (hasBothProductAndWorkshopFilters) {
      const byEmail: Record<string, any> = {};
      filteredAssignments?.forEach((assignment) => {
        const email = assignment.lead?.email;
        if (!email) return;
        if (!byEmail[email]) {
          byEmail[email] = { lead: assignment.lead, matchingAssignments: [] };
        }
        if (assignment.workshop_id && filters.workshopIds.includes(assignment.workshop_id)) {
          byEmail[email].matchingAssignments.push(assignment);
        }
        if (assignment.product_id && filters.productIds.includes(assignment.product_id)) {
          const alreadyAdded = byEmail[email].matchingAssignments.some((a: any) => a.id === assignment.id);
          if (!alreadyAdded) byEmail[email].matchingAssignments.push(assignment);
        }
      });
      
      const result: Record<string, any> = {};
      Object.entries(byEmail).forEach(([email, data]) => {
        if (data.matchingAssignments.length > 0) {
          data.matchingAssignments.forEach((assignment: any, idx: number) => {
            const key = `${email}-${assignment.id || idx}`;
            result[key] = { lead: data.lead, assignments: [assignment] };
          });
        }
      });
      return result;
    }

    // Normal mode
    const grouped: Record<string, any> = {};
    filteredAssignments?.forEach((assignment) => {
      const leadId = assignment.lead?.id;
      if (!leadId) return;
      if (!grouped[leadId]) {
        grouped[leadId] = { lead: assignment.lead, assignments: [] };
      }
      grouped[leadId].assignments.push(assignment);
    });

    // Merge leads without assignments
    if (!hasProductOrWorkshopFilter && !isUsingServerSearch) {
      filteredLeads?.forEach((lead) => {
        if (!grouped[lead.id]) {
          grouped[lead.id] = {
            lead: { ...lead, assigned_to: lead.assigned_to },
            assignments: [],
          };
        }
      });
    }

    return grouped;
  }, [isUsingServerSearch, searchResults, hasBothProductAndWorkshopFilters, filteredAssignments, filteredLeads, filters, hasProductOrWorkshopFilter]);

  const groupedAssignmentsArray = useMemo(() => {
    return Object.values(groupedAssignments || {}).sort((a: any, b: any) => {
      const dateA = new Date(a.lead?.created_at || 0).getTime();
      const dateB = new Date(b.lead?.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [groupedAssignments]);

  const totalPages = Math.ceil(groupedAssignmentsArray.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAssignments = groupedAssignmentsArray.slice(startIndex, endIndex);

  return {
    hasActiveFilters,
    groupedAssignmentsArray,
    paginatedAssignments,
    totalPages,
    startIndex,
    endIndex,
  };
}
