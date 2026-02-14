import { useState } from "react";
import { Calendar } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { WorkshopCallsDialog } from "@/components/WorkshopCallsDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useWorkshopsData, CallCategory } from "./hooks/useWorkshopsData";
import WorkshopFormDialog from "./WorkshopFormDialog";
import WorkshopTable from "./WorkshopTable";

const Workshops = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [callsDialogOpen, setCallsDialogOpen] = useState(false);
  const [selectedWorkshopTitle, setSelectedWorkshopTitle] = useState<string>("");
  const [selectedCallCategory, setSelectedCallCategory] = useState<CallCategory>("converted");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workshopToDelete, setWorkshopToDelete] = useState<any>(null);

  const { isManager } = useUserRole();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  const {
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
    queryClient,
  } = useWorkshopsData(searchQuery);

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

  const handleEditClick = (workshop: any) => {
    setEditingWorkshop(workshop);
    setIsOpen(true);
  };

  const handleDeleteClick = (workshop: any) => {
    setWorkshopToDelete(workshop);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (workshopToDelete) {
      deleteMutation.mutate(workshopToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setWorkshopToDelete(null);
        },
      });
    }
  };

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
        <WorkshopFormDialog
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          editingWorkshop={editingWorkshop}
          setEditingWorkshop={setEditingWorkshop}
          isManager={isManager}
          leads={leads}
          funnels={funnels}
          funnelsLoading={funnelsLoading}
          products={products}
          productsLoading={productsLoading}
          tags={tags}
          tagsLoading={tagsLoading}
          currentOrganization={currentOrganization}
          createMutation={createMutation}
          updateMutation={updateMutation}
          createFunnelMutation={createFunnelMutation}
          createProductMutation={createProductMutation}
          handleSubmit={handleSubmit}
          queryClient={queryClient}
        />
      </div>

      <WorkshopTable
        filteredWorkshops={filteredWorkshops}
        isLoading={isLoading}
        error={error}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        expandedRows={expandedRows}
        onToggleExpand={toggleRowExpand}
        isManager={isManager}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onRefresh={handleRefresh}
        openCallsDialog={openCallsDialog}
        formatOrg={formatOrg}
      />

      <WorkshopCallsDialog
        open={callsDialogOpen}
        onOpenChange={setCallsDialogOpen}
        workshopTitle={selectedWorkshopTitle}
        category={selectedCallCategory}
      />

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
