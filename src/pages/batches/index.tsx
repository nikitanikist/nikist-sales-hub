import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Eye, BarChart3, Users } from "lucide-react";
import { format } from "date-fns";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useBatchInsights } from "@/hooks/useBatchInsights";
import { 
  UpcomingPaymentsCalendar, 
  ActionRequiredCards, 
  WeekSummaryCard, 
  ReceivablesAgingTable, 
  StudentListDialog 
} from "@/components/batch-insights";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { useBatchesData } from "./hooks/useBatchesData";
import type { Batch, BatchStudent } from "./hooks/useBatchesData";
import { useBatchFilters } from "./hooks/useBatchFilters";
import BatchDetailHeader from "./BatchDetailHeader";
import BatchStudentsTab from "./BatchStudentsTab";
import BatchListView from "./BatchListView";
import BatchDialogs from "./BatchDialogs";

const Batches = () => {
  const { format: formatOrg } = useOrgTimezone();
  
  // Core UI state
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  
  // Dialog state
  const [editingStudent, setEditingStudent] = useState<BatchStudent | null>(null);
  const [newBatchId, setNewBatchId] = useState<string>("");
  const [refundingStudent, setRefundingStudent] = useState<BatchStudent | null>(null);
  const [refundNotes, setRefundNotes] = useState<string>("");
  const [notesStudent, setNotesStudent] = useState<BatchStudent | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [payAfterEarning, setPayAfterEarning] = useState(false);
  const [isFollowUpDateOpen, setIsFollowUpDateOpen] = useState(false);
  const [viewingNotesStudent, setViewingNotesStudent] = useState<BatchStudent | null>(null);
  const [discontinuingStudent, setDiscontinuingStudent] = useState<BatchStudent | null>(null);
  const [discontinuedNotes, setDiscontinuedNotes] = useState<string>("");
  const [deletingStudent, setDeletingStudent] = useState<BatchStudent | null>(null);
  const [emiStudent, setEmiStudent] = useState<BatchStudent | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  
  // Insights tab state
  const [activeTab, setActiveTab] = useState<string>("students");
  const [showStudentListDialog, setShowStudentListDialog] = useState(false);
  const [studentListTitle, setStudentListTitle] = useState("");
  const [studentListSubtitle, setStudentListSubtitle] = useState("");
  const [studentListData, setStudentListData] = useState<BatchStudent[]>([]);

  // Data hook
  const data = useBatchesData(selectedBatch, expandedStudentId);
  
  // Filters hook
  const filters = useBatchFilters(
    data.batchStudents,
    data.batchEmiPayments,
    data.batches,
    selectedBatch,
    data.isManager,
    data.isCloser
  );

  // Business insights
  const insights = useBatchInsights(data.batchStudents || []);

  const toggleStudentExpand = (studentId: string) => {
    setExpandedStudentId(prev => prev === studentId ? null : studentId);
  };

  const handleBackToBatches = () => {
    setSelectedBatch(null);
    setExpandedStudentId(null);
    filters.setSearchQuery("");
    setEmiStudent(null);
    filters.clearAllFilters();
  };

  const handleOpenStudentList = (title: string, subtitle: string, students: BatchStudent[]) => {
    setStudentListTitle(title);
    setStudentListSubtitle(subtitle);
    setStudentListData(students);
    setShowStudentListDialog(true);
  };

  // Mutation success callbacks that reset dialog state
  const handleTransferSuccess = () => {
    setEditingStudent(null);
    setNewBatchId("");
  };

  const handleRefundSuccess = () => {
    setRefundingStudent(null);
    setRefundNotes("");
  };

  const handleNotesSuccess = () => {
    setNotesStudent(null);
    setNotesText("");
    setFollowUpDate(undefined);
    setPayAfterEarning(false);
  };

  const handleDiscontinuedSuccess = () => {
    setDiscontinuingStudent(null);
    setDiscontinuedNotes("");
  };

  const handleDeleteStudentSuccess = () => {
    setDeletingStudent(null);
  };

  // Organization loading/empty states
  if (data.orgLoading) {
    return <OrganizationLoadingState />;
  }

  if (!data.currentOrganization) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No Organization Selected"
        description="Please select an organization to view batches."
      />
    );
  }

  // Batch detail view
  if (selectedBatch) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <BatchDetailHeader
          selectedBatch={selectedBatch}
          formatOrg={formatOrg}
          isAdmin={data.isAdmin}
          isManager={data.isManager}
          activeFilterCount={filters.activeFilterCount}
          filteredStudentsCount={filters.filteredStudents.length}
          batchStudentsCount={data.batchStudents?.length || 0}
          onBack={handleBackToBatches}
          onAddStudent={() => setIsAddStudentOpen(true)}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">
              <Eye className="h-4 w-4 mr-1 sm:mr-2" />Overview
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs sm:text-sm py-2">
              <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />Insights
            </TabsTrigger>
            <TabsTrigger value="students" className="text-xs sm:text-sm py-2">
              <Users className="h-4 w-4 mr-1 sm:mr-2" />Students
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <WeekSummaryCard
              thisWeekTotal={insights.thisWeekTotal}
              thisWeekStudentCount={insights.thisWeekStudentCount}
              collectionRate={insights.collectionRate}
              totalReceivables={insights.totalReceivables}
            />
            <UpcomingPaymentsCalendar
              upcomingPayments={insights.upcomingPayments}
              onDateClick={(date, students) => handleOpenStudentList(
                `Students Due on ${format(new Date(date), "dd MMM yyyy")}`,
                `${students.length} students with follow-up scheduled`,
                students as BatchStudent[]
              )}
            />
            <ActionRequiredCards
              studentsWithoutFollowUp={insights.studentsWithoutFollowUp}
              studentsWithoutFollowUpAmount={insights.studentsWithoutFollowUpAmount}
              overdueFollowUps={insights.overdueFollowUps}
              overdueFollowUpsAmount={insights.overdueFollowUpsAmount}
              onViewNoFollowUp={() => handleOpenStudentList(
                "Students Without Follow-up Date",
                "These students have pending dues but no follow-up date set",
                insights.studentsWithoutFollowUp as BatchStudent[]
              )}
              onViewOverdue={() => handleOpenStudentList(
                "Overdue Follow-ups",
                "Follow-up date has passed but student still has pending dues",
                insights.overdueFollowUps as BatchStudent[]
              )}
            />
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <ReceivablesAgingTable
              receivablesAging={insights.receivablesAging}
              onBracketClick={(bracket, students) => handleOpenStudentList(
                `Receivables: ${bracket}`,
                `Students with dues in this aging bracket`,
                students as BatchStudent[]
              )}
            />
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            <BatchStudentsTab
              isAdmin={data.isAdmin}
              isManager={data.isManager}
              isCloser={data.isCloser}
              batchStudents={data.batchStudents}
              filteredStudents={filters.filteredStudents}
              studentEmiPayments={data.studentEmiPayments}
              emiLoading={data.emiLoading}
              selectedBatch={selectedBatch}
              batches={data.batches}
              searchQuery={filters.searchQuery}
              setSearchQuery={filters.setSearchQuery}
              isFilterOpen={filters.isFilterOpen}
              setIsFilterOpen={filters.setIsFilterOpen}
              selectedClosers={filters.selectedClosers}
              selectedClasses={filters.selectedClasses}
              dateFrom={filters.dateFrom}
              setDateFrom={filters.setDateFrom}
              dateTo={filters.dateTo}
              setDateTo={filters.setDateTo}
              paymentTypeFilter={filters.paymentTypeFilter}
              setPaymentTypeFilter={filters.setPaymentTypeFilter}
              isDateFromOpen={filters.isDateFromOpen}
              setIsDateFromOpen={filters.setIsDateFromOpen}
              isDateToOpen={filters.isDateToOpen}
              setIsDateToOpen={filters.setIsDateToOpen}
              uniqueClosers={filters.uniqueClosers}
              uniqueClasses={filters.uniqueClasses}
              activeFilterCount={filters.activeFilterCount}
              clearAllFilters={filters.clearAllFilters}
              toggleCloser={filters.toggleCloser}
              toggleClass={filters.toggleClass}
              handleExportStudents={filters.handleExportStudents}
              allStudentsTotals={filters.allStudentsTotals}
              closerBreakdown={filters.closerBreakdown}
              totals={filters.totals}
              todayFollowUpCount={filters.todayFollowUpCount}
              filterTodayFollowUp={filters.filterTodayFollowUp}
              setFilterTodayFollowUp={filters.setFilterTodayFollowUp}
              filterRefunded={filters.filterRefunded}
              setFilterRefunded={filters.setFilterRefunded}
              filterDiscontinued={filters.filterDiscontinued}
              setFilterDiscontinued={filters.setFilterDiscontinued}
              filterFullPayment={filters.filterFullPayment}
              setFilterFullPayment={filters.setFilterFullPayment}
              filterRemaining={filters.filterRemaining}
              setFilterRemaining={filters.setFilterRemaining}
              filterPAE={filters.filterPAE}
              setFilterPAE={filters.setFilterPAE}
              expandedStudentId={expandedStudentId}
              toggleStudentExpand={toggleStudentExpand}
              studentsLoading={data.studentsLoading}
              onEditStudent={(student) => { setEditingStudent(student); setNewBatchId(selectedBatch.id); }}
              onRefundStudent={setRefundingStudent}
              onDiscontinueStudent={setDiscontinuingStudent}
              onNotesStudent={(student) => {
                setNotesStudent(student);
                setNotesText(student.additional_comments || "");
                setFollowUpDate(student.next_follow_up_date ? new Date(student.next_follow_up_date) : undefined);
                setPayAfterEarning(student.pay_after_earning || false);
              }}
              onViewNotesStudent={setViewingNotesStudent}
              onEmiStudent={setEmiStudent}
              onDeleteStudent={setDeletingStudent}
            />
          </TabsContent>
        </Tabs>

        <BatchDialogs
          isManager={data.isManager}
          isCloser={data.isCloser}
          isAdmin={data.isAdmin}
          selectedBatch={selectedBatch}
          batches={data.batches}
          editingStudent={editingStudent}
          setEditingStudent={setEditingStudent}
          newBatchId={newBatchId}
          setNewBatchId={setNewBatchId}
          transferMutation={data.transferMutation}
          refundingStudent={refundingStudent}
          setRefundingStudent={setRefundingStudent}
          refundNotes={refundNotes}
          setRefundNotes={setRefundNotes}
          markRefundedMutation={data.markRefundedMutation}
          notesStudent={notesStudent}
          setNotesStudent={setNotesStudent}
          notesText={notesText}
          setNotesText={setNotesText}
          followUpDate={followUpDate}
          setFollowUpDate={setFollowUpDate}
          payAfterEarning={payAfterEarning}
          setPayAfterEarning={setPayAfterEarning}
          isFollowUpDateOpen={isFollowUpDateOpen}
          setIsFollowUpDateOpen={setIsFollowUpDateOpen}
          updateNotesMutation={data.updateNotesMutation}
          viewingNotesStudent={viewingNotesStudent}
          setViewingNotesStudent={setViewingNotesStudent}
          discontinuingStudent={discontinuingStudent}
          setDiscontinuingStudent={setDiscontinuingStudent}
          discontinuedNotes={discontinuedNotes}
          setDiscontinuedNotes={setDiscontinuedNotes}
          markDiscontinuedMutation={data.markDiscontinuedMutation}
          deletingStudent={deletingStudent}
          setDeletingStudent={setDeletingStudent}
          deleteStudentMutation={data.deleteStudentMutation}
          emiStudent={emiStudent}
          setEmiStudent={setEmiStudent}
          isAddStudentOpen={isAddStudentOpen}
          setIsAddStudentOpen={setIsAddStudentOpen}
          onEmiSuccess={() => {
            data.queryClient.invalidateQueries({ queryKey: ["batch-students"] });
            data.queryClient.invalidateQueries({ queryKey: ["batch-student-emi"] });
            data.queryClient.invalidateQueries({ queryKey: ["batch-all-emi-payments"] });
          }}
          onAddStudentSuccess={() => {
            data.queryClient.invalidateQueries({ queryKey: ["batch-students"] });
            data.queryClient.invalidateQueries({ queryKey: ["batches"] });
          }}
        />

        <StudentListDialog
          open={showStudentListDialog}
          onOpenChange={setShowStudentListDialog}
          title={studentListTitle}
          subtitle={studentListSubtitle}
          students={studentListData.map(s => ({
            id: s.id,
            contact_name: s.contact_name,
            email: s.email,
            phone: s.phone,
            due_amount: s.due_amount || 0,
            next_follow_up_date: s.next_follow_up_date,
            closer_name: s.closer_name
          }))}
          totalAmount={studentListData.reduce((sum, s) => sum + (s.due_amount || 0), 0)}
          onEditNotes={(student) => {
            const batchStudent = studentListData.find(s => s.id === student.id);
            if (batchStudent) {
              setNotesStudent(batchStudent);
              setNotesText(batchStudent.additional_comments || "");
              setFollowUpDate(batchStudent.next_follow_up_date ? new Date(batchStudent.next_follow_up_date) : undefined);
              setPayAfterEarning(batchStudent.pay_after_earning || false);
              setShowStudentListDialog(false);
            }
          }}
        />
      </div>
    );
  }

  // Batch list view
  return (
    <BatchListView
      isManager={data.isManager}
      isCloser={data.isCloser}
      batches={data.batches}
      batchesLoading={data.batchesLoading}
      filteredBatches={filters.filteredBatches}
      batchSearchQuery={filters.batchSearchQuery}
      setBatchSearchQuery={filters.setBatchSearchQuery}
      isCreateOpen={data.isCreateOpen}
      setIsCreateOpen={data.setIsCreateOpen}
      editingBatch={data.editingBatch}
      deletingBatch={data.deletingBatch}
      setDeletingBatch={data.setDeletingBatch}
      formName={data.formName}
      setFormName={data.setFormName}
      formStartDate={data.formStartDate}
      setFormStartDate={data.setFormStartDate}
      formIsActive={data.formIsActive}
      setFormIsActive={data.setFormIsActive}
      isDatePopoverOpen={data.isDatePopoverOpen}
      setIsDatePopoverOpen={data.setIsDatePopoverOpen}
      handleCloseForm={data.handleCloseForm}
      handleOpenEdit={data.handleOpenEdit}
      handleSubmit={data.handleSubmit}
      onSelectBatch={setSelectedBatch}
      createMutation={data.createMutation}
      updateMutation={data.updateMutation}
      deleteMutation={data.deleteMutation}
    />
  );
};

export default Batches;
