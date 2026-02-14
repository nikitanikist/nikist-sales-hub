import { useState } from "react";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { ScheduleCallDialog } from "@/components/ScheduleCallDialog";
import { LeadsFilterSheet, LeadsFilters } from "@/components/LeadsFilterSheet";
import { ImportCustomersDialog } from "@/components/ImportCustomersDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { TableSkeleton, MobileCardSkeleton } from "@/components/skeletons";
import { PageIntro } from "@/components/PageIntro";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";

import { useLeadsData } from "./hooks/useLeadsData";
import { useLeadsFilters } from "./hooks/useLeadsFilters";
import { LeadsTable } from "./LeadsTable";
import { LeadsToolbar } from "./LeadsToolbar";
import { EditCustomerDialog, RefundDialog } from "./LeadsDialogs";

const Leads = () => {
  // --- UI State ---
  const [isOpen, setIsOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkshops, setSelectedWorkshops] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [connectWorkshopFunnel, setConnectWorkshopFunnel] = useState(false);
  const [selectedConvertedFromWorkshop, setSelectedConvertedFromWorkshop] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { isManager, isAdmin } = useUserRole();

  // Schedule Call
  const [scheduleCallOpen, setScheduleCallOpen] = useState(false);
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<any>(null);
  const [selectedCloser, setSelectedCloser] = useState<any>(null);

  // Filter Sheet
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<LeadsFilters>({
    dateFrom: undefined, dateTo: undefined,
    productIds: [], workshopIds: [],
    country: "all", status: "all",
  });

  // Import
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Refund
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedLeadForRefund, setSelectedLeadForRefund] = useState<any>(null);
  const [selectedAppointmentForRefund, setSelectedAppointmentForRefund] = useState<any>(null);
  const [refundReason, setRefundReason] = useState("");
  const [leadAppointments, setLeadAppointments] = useState<any[]>([]);
  const [refundMode, setRefundMode] = useState<'appointment' | 'assignment'>('appointment');
  const [leadAssignmentsForRefund, setLeadAssignmentsForRefund] = useState<any[]>([]);
  const [selectedAssignmentForRefund, setSelectedAssignmentForRefund] = useState<any>(null);

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<any>(null);

  const resetEditState = () => {
    setIsOpen(false);
    setEditingLead(null);
    setSelectedWorkshops([]);
    setSelectedProducts([]);
    setConnectWorkshopFunnel(false);
    setSelectedConvertedFromWorkshop(null);
  };

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

  // --- Data ---
  const {
    currentOrganization, orgLoading,
    leadsCount, searchResults, leadAssignments, allLeads,
    profiles, workshops, funnels, products, salesClosers, integrations,
    isLoading,
    saveMutation, deleteMutation, markRefundMutation, markAssignmentRefundMutation, undoRefundMutation,
    fetchLeadAppointments, fetchLeadAssignmentsForRefund,
    refreshData, invalidateOnImportSuccess,
  } = useLeadsData({
    filters, searchQuery, editingLead,
    resetEditState, resetRefundDialog,
  });

  // --- Filters & Pagination ---
  const {
    hasActiveFilters, groupedAssignmentsArray, paginatedAssignments, totalPages, startIndex, endIndex,
  } = useLeadsFilters({
    leadAssignments, allLeads, searchResults, searchQuery,
    filters, currentPage, itemsPerPage,
  });

  // --- Handlers ---
  const handleSearchChange = (value: string) => { setSearchQuery(value); setCurrentPage(1); };
  const handleFiltersChange = (newFilters: LeadsFilters) => { setFilters(newFilters); setCurrentPage(1); };

  const handleEdit = (lead: any, assignments: any[]) => {
    setEditingLead(lead);
    const workshopIds = assignments.filter((a: any) => a.workshop_id).map((a: any) => a.workshop_id);
    const productIds = assignments.filter((a: any) => a.product_id).map((a: any) => a.product_id);
    const existingConvertedFrom = assignments.find((a: any) => a.product_id && a.converted_from_workshop_id)?.converted_from_workshop_id;
    setSelectedWorkshops(workshopIds);
    setSelectedProducts(productIds);
    setConnectWorkshopFunnel(assignments.some((a: any) => a.is_connected));
    setSelectedConvertedFromWorkshop(existingConvertedFrom || null);
    setIsOpen(true);
  };

  const handleAddCustomer = () => {
    setEditingLead(null);
    setSelectedWorkshops([]);
    setSelectedProducts([]);
    setConnectWorkshopFunnel(false);
    setSelectedConvertedFromWorkshop(null);
    setIsOpen(true);
  };

  const handleMarkAsRefund = async (lead: any, assignment?: any) => {
    if (assignment && assignment.id && !assignment.id.startsWith('consolidated-')) {
      setRefundMode('assignment');
      setSelectedLeadForRefund(lead);
      setLeadAssignmentsForRefund([assignment]);
      setSelectedAssignmentForRefund(assignment);
      setRefundReason("");
      setRefundDialogOpen(true);
      return;
    }

    const appointments = await fetchLeadAppointments(lead.id);
    if (appointments.length > 0) {
      setRefundMode('appointment');
      setSelectedLeadForRefund(lead);
      setLeadAppointments(appointments);
      setSelectedAppointmentForRefund(appointments.length === 1 ? appointments[0] : null);
      setRefundReason("");
      setRefundDialogOpen(true);
    } else {
      const assignments = await fetchLeadAssignmentsForRefund(lead.id);
      if (assignments.length === 0) { toast.error("No active assignments found for this customer"); return; }
      setRefundMode('assignment');
      setSelectedLeadForRefund(lead);
      setLeadAssignmentsForRefund(assignments);
      setSelectedAssignmentForRefund(assignments.length === 1 ? assignments[0] : null);
      setRefundReason("");
      setRefundDialogOpen(true);
    }
  };

  const handleConfirmRefund = () => {
    if (!refundReason.trim()) { toast.error("Please provide a refund reason"); return; }
    if (refundMode === 'appointment') {
      if (!selectedAppointmentForRefund) { toast.error("Please select an appointment to refund"); return; }
      markRefundMutation.mutate({ appointmentId: selectedAppointmentForRefund.id, reason: refundReason.trim() });
    } else {
      if (!selectedAssignmentForRefund) { toast.error("Please select an assignment to refund"); return; }
      markAssignmentRefundMutation.mutate({ assignmentId: selectedAssignmentForRefund.id, reason: refundReason.trim() });
    }
  };

  const handleDeleteClick = (lead: any) => { setLeadToDelete(lead); setDeleteDialogOpen(true); };
  const handleConfirmDelete = () => {
    if (leadToDelete) {
      deleteMutation.mutate(leadToDelete.id, {
        onSuccess: () => { setDeleteDialogOpen(false); setLeadToDelete(null); },
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

    let convertedFromId = selectedConvertedFromWorkshop;
    if (!convertedFromId && selectedProducts.length > 0 && selectedWorkshops.length > 0) {
      const selectedWorkshopData = workshops?.filter(w => selectedWorkshops.includes(w.id)) || [];
      if (selectedWorkshopData.length > 0) {
        const sorted = [...selectedWorkshopData].sort((a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        );
        convertedFromId = sorted[0].id;
      }
    }

    saveMutation.mutate({
      leadData, workshopIds: selectedWorkshops, productIds: selectedProducts,
      isConnected: connectWorkshopFunnel, previousAssignedTo: editingLead?.assigned_to,
      convertedFromWorkshopId: convertedFromId,
    });
  };

  // --- Render ---
  if (orgLoading) return <OrganizationLoadingState />;
  if (!currentOrganization) {
    return <EmptyState icon={Users} title="No Organization Selected" description="Please select an organization to view customers." />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageIntro icon={Users} tagline="Customer Hub" description="Manage leads, track conversions, and grow relationships." variant="violet" />

      <Card className="w-fit">
        <CardContent className="py-2 sm:py-3 px-3 sm:px-4 flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">{hasActiveFilters ? "Filtered Customers" : "Total Customers"}</p>
            <p className="text-xl sm:text-2xl font-semibold">{hasActiveFilters ? groupedAssignmentsArray.length : (leadsCount ?? 0)}</p>
          </div>
        </CardContent>
      </Card>

      <LeadsToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        hasActiveFilters={hasActiveFilters}
        onOpenFilter={() => setIsFilterOpen(true)}
        onRefresh={refreshData}
        onImport={() => setIsImportOpen(true)}
        onAddCustomer={handleAddCustomer}
        isAdmin={isAdmin}
        isManager={isManager}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <>
              <div className="hidden sm:block p-4"><TableSkeleton columns={8} rows={5} /></div>
              <div className="sm:hidden p-4"><MobileCardSkeleton count={4} /></div>
            </>
          ) : (
            <LeadsTable
              paginatedAssignments={paginatedAssignments}
              isManager={isManager}
              salesClosers={salesClosers}
              integrations={integrations}
              onEdit={handleEdit}
              onScheduleCall={(lead, closer) => { setSelectedLeadForCall(lead); setSelectedCloser(closer); setScheduleCallOpen(true); }}
              onMarkRefund={handleMarkAsRefund}
              onUndoRefund={(id) => undoRefundMutation.mutate(id)}
              onDelete={handleDeleteClick}
            />
          )}
        </CardContent>
      </Card>

      {!isLoading && groupedAssignmentsArray.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, groupedAssignmentsArray.length)} of {groupedAssignmentsArray.length} customers
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Previous</Button>
            <div className="text-sm">Page {currentPage} of {totalPages}</div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        </div>
      )}

      <EditCustomerDialog
        isOpen={isOpen} onOpenChange={setIsOpen} editingLead={editingLead}
        workshops={workshops} products={products} funnels={funnels} profiles={profiles}
        selectedWorkshops={selectedWorkshops} setSelectedWorkshops={setSelectedWorkshops}
        selectedProducts={selectedProducts} setSelectedProducts={setSelectedProducts}
        connectWorkshopFunnel={connectWorkshopFunnel} setConnectWorkshopFunnel={setConnectWorkshopFunnel}
        selectedConvertedFromWorkshop={selectedConvertedFromWorkshop} setSelectedConvertedFromWorkshop={setSelectedConvertedFromWorkshop}
        onSubmit={handleSubmit} isPending={saveMutation.isPending}
      />

      <ScheduleCallDialog open={scheduleCallOpen} onOpenChange={setScheduleCallOpen} lead={selectedLeadForCall} closer={selectedCloser} />

      <LeadsFilterSheet open={isFilterOpen} onOpenChange={setIsFilterOpen} filters={filters} onFiltersChange={handleFiltersChange} products={products || []} workshops={workshops || []} />

      <ImportCustomersDialog
        open={isImportOpen} onOpenChange={setIsImportOpen}
        workshops={workshops || []} products={products || []} salesClosers={salesClosers || []}
        onSuccess={invalidateOnImportSuccess}
      />

      <RefundDialog
        open={refundDialogOpen} onOpenChange={setRefundDialogOpen}
        refundMode={refundMode} selectedLeadForRefund={selectedLeadForRefund}
        leadAppointments={leadAppointments} selectedAppointmentForRefund={selectedAppointmentForRefund}
        setSelectedAppointmentForRefund={setSelectedAppointmentForRefund}
        leadAssignmentsForRefund={leadAssignmentsForRefund} selectedAssignmentForRefund={selectedAssignmentForRefund}
        setSelectedAssignmentForRefund={setSelectedAssignmentForRefund}
        refundReason={refundReason} setRefundReason={setRefundReason}
        onConfirm={handleConfirmRefund}
        isPending={markRefundMutation.isPending || markAssignmentRefundMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}
        title="Delete Customer" itemName={leadToDelete?.contact_name}
        isDeleting={deleteMutation.isPending} onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default Leads;
