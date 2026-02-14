import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Plus, Edit, Trash2, ArrowLeft, Users, Loader2, Search, Eye, BarChart3 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import { 
  UpcomingPaymentsCalendar, 
  ActionRequiredCards, 
  WeekSummaryCard, 
  ReceivablesAgingTable, 
  StudentListDialog 
} from "@/components/batch-insights";
import { useFuturesData, type FuturesBatch, type FuturesStudent } from "./hooks/useFuturesData";
import { useFuturesFilters } from "./hooks/useFuturesFilters";
import FuturesStudentsTab from "./FuturesStudentsTab";
import FuturesDialogs from "./FuturesDialogs";

const FuturesMentorship = () => {
  const { isAdmin, isManager } = useUserRole();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const { format: formatOrg } = useOrgTimezone();
  
  const [selectedBatch, setSelectedBatch] = useState<FuturesBatch | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<FuturesBatch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<FuturesBatch | null>(null);

  // Dialog state
  const [refundingStudent, setRefundingStudent] = useState<FuturesStudent | null>(null);
  const [refundNotes, setRefundNotes] = useState<string>("");
  const [notesStudent, setNotesStudent] = useState<FuturesStudent | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [payAfterEarning, setPayAfterEarning] = useState(false);
  const [emiStudent, setEmiStudent] = useState<FuturesStudent | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [discontinuingStudent, setDiscontinuingStudent] = useState<FuturesStudent | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<FuturesStudent | null>(null);
  const [viewingNotesStudent, setViewingNotesStudent] = useState<FuturesStudent | null>(null);

  // Business Insights tab state
  const [activeTab, setActiveTab] = useState<string>("students");
  const [showStudentListDialog, setShowStudentListDialog] = useState(false);
  const [studentListTitle, setStudentListTitle] = useState("");
  const [studentListSubtitle, setStudentListSubtitle] = useState("");
  const [studentListData, setStudentListData] = useState<FuturesStudent[]>([]);

  const data = useFuturesData(selectedBatch, expandedStudentId);
  const filters = useFuturesFilters(data.batchStudents, data.batches, selectedBatch);

  const handleCloseForm = () => {
    setIsCreateOpen(false);
    setEditingBatch(null);
    data.handleCloseForm();
  };

  const handleSubmit = () => {
    data.handleSubmit(editingBatch);
    // handleCloseForm is called by the mutation onSuccess via data.handleCloseForm
  };

  const openEditDialog = (batch: FuturesBatch) => {
    data.openEditDialog(batch);
    setEditingBatch(batch);
  };

  const handleOpenStudentList = (title: string, subtitle: string, students: FuturesStudent[]) => {
    setStudentListTitle(title);
    setStudentListSubtitle(subtitle);
    setStudentListData(students);
    setShowStudentListDialog(true);
  };

  // Handle mutation onSuccess side effects
  const handleRefundMutate = (mutateData: { id: string; reason: string }) => {
    data.refundMutation.mutate(mutateData, {
      onSuccess: () => {
        setRefundingStudent(null);
        setRefundNotes("");
      }
    });
  };

  const handleNotesMutate = (mutateData: { id: string; notes: string; nextFollowUpDate: string | null; payAfterEarning: boolean }) => {
    data.notesMutation.mutate(mutateData, {
      onSuccess: () => {
        setNotesStudent(null);
        setNotesText("");
        setFollowUpDate(undefined);
        setPayAfterEarning(false);
      }
    });
  };

  const handleDiscontinueMutate = (id: string) => {
    data.discontinueMutation.mutate(id, {
      onSuccess: () => setDiscontinuingStudent(null)
    });
  };

  const handleDeleteStudentMutate = (id: string) => {
    data.deleteStudentMutation.mutate(id, {
      onSuccess: () => setDeletingStudent(null)
    });
  };

  const handleDeleteBatchMutate = (id: string) => {
    data.deleteMutation.mutate(id, {
      onSuccess: () => setDeletingBatch(null)
    });
  };

  // Organization loading/empty state
  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  if (!currentOrganization) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No Organization Selected"
        description="Please select an organization to view futures mentorship data."
      />
    );
  }

  // Batch List View
  if (!selectedBatch) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageIntro
          icon={TrendingUp}
          tagline="Futures Program"
          description="Manage mentorship students and payments."
          variant="emerald"
        />

        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto h-11 sm:h-10">
              <Plus className="h-4 w-4 mr-2" />
              Add Batch
            </Button>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg sm:text-xl">Batches</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search batches..."
                  value={filters.batchSearchQuery}
                  onChange={(e) => filters.setBatchSearchQuery(e.target.value)}
                  className="pl-8 h-11 sm:h-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {data.batchesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch Name</TableHead>
                        <TableHead>Event Dates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Students</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filters.filteredBatches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No batches found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filters.filteredBatches.map((batch) => (
                          <TableRow 
                            key={batch.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedBatch(batch)}
                          >
                            <TableCell className="font-medium">{batch.name}</TableCell>
                            <TableCell>{batch.event_dates || "TBD"}</TableCell>
                            <TableCell>{filters.getBatchStatusBadge(batch.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                {batch.students_count}
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(batch)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => setDeletingBatch(batch)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {filters.filteredBatches.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No batches found</p>
                  ) : (
                    filters.filteredBatches.map((batch) => (
                      <div 
                        key={batch.id}
                        className="p-4 rounded-lg border bg-card cursor-pointer active:bg-muted/50"
                        onClick={() => setSelectedBatch(batch)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{batch.name}</p>
                            <p className="text-sm text-muted-foreground">{batch.event_dates || "TBD"}</p>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(batch)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingBatch(batch)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          {filters.getBatchStatusBadge(batch.status)}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {batch.students_count} students
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Batch Dialog */}
        <Dialog open={isCreateOpen || !!editingBatch} onOpenChange={(open) => !open && handleCloseForm()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBatch ? "Edit Batch" : "Create New Batch"}</DialogTitle>
              <DialogDescription>
                {editingBatch ? "Update the batch details" : "Add a new futures mentorship batch"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  value={data.formName}
                  onChange={(e) => data.setFormName(e.target.value)}
                  placeholder="e.g., Future Mentorship Batch 10"
                />
              </div>
              <div className="space-y-2">
                <Label>Event Dates</Label>
                <Input
                  value={data.formEventDates}
                  onChange={(e) => data.setFormEventDates(e.target.value)}
                  placeholder="e.g., 15-16 Feb 2025"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={data.formStatus} onValueChange={data.setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseForm}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={data.createMutation.isPending || data.updateMutation.isPending}>
                {(data.createMutation.isPending || data.updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingBatch ? "Save Changes" : "Create Batch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingBatch} onOpenChange={(open) => !open && setDeletingBatch(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Batch</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingBatch?.name}"? This action cannot be undone and will remove all students in this batch.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingBatch && handleDeleteBatchMutate(deletingBatch.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Batch Detail View
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Responsive Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" onClick={() => setSelectedBatch(null)} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{selectedBatch.name}</h1>
            <p className="text-sm text-muted-foreground">Event Dates: {selectedBatch.event_dates || "TBD"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isManager) && (
            <Button onClick={() => setAddStudentOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          )}
        </div>
      </div>

      {/* Business Insights Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">
            <Eye className="h-4 w-4 mr-1 sm:mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-xs sm:text-sm py-2">
            <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="students" className="text-xs sm:text-sm py-2">
            <Users className="h-4 w-4 mr-1 sm:mr-2" />
            Students
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <WeekSummaryCard
            thisWeekTotal={filters.insights.thisWeekTotal}
            thisWeekStudentCount={filters.insights.thisWeekStudentCount}
            collectionRate={filters.insights.collectionRate}
            totalReceivables={filters.insights.totalReceivables}
          />
          
          <UpcomingPaymentsCalendar
            upcomingPayments={filters.insights.upcomingPayments}
            onDateClick={(date, students) => handleOpenStudentList(
              `Students Due on ${formatOrg(date, "dd MMM yyyy")}`,
              `${students.length} students with follow-up scheduled`,
              students as FuturesStudent[]
            )}
          />
          
          <ActionRequiredCards
            studentsWithoutFollowUp={filters.insights.studentsWithoutFollowUp}
            studentsWithoutFollowUpAmount={filters.insights.studentsWithoutFollowUpAmount}
            overdueFollowUps={filters.insights.overdueFollowUps}
            overdueFollowUpsAmount={filters.insights.overdueFollowUpsAmount}
            onViewNoFollowUp={() => handleOpenStudentList(
              "Students Without Follow-up Date",
              "These students have pending dues but no follow-up date set",
              filters.insights.studentsWithoutFollowUp as FuturesStudent[]
            )}
            onViewOverdue={() => handleOpenStudentList(
              "Overdue Follow-ups",
              "Follow-up date has passed but student still has pending dues",
              filters.insights.overdueFollowUps as FuturesStudent[]
            )}
          />
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <ReceivablesAgingTable
            receivablesAging={filters.insights.receivablesAging}
            onBracketClick={(bracket, students) => handleOpenStudentList(
              `Receivables: ${bracket}`,
              `Students with dues in this aging bracket`,
              students as FuturesStudent[]
            )}
          />
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-4">
          <FuturesStudentsTab
            batchStudents={data.batchStudents}
            filteredStudents={filters.filteredStudents}
            studentEmiPayments={data.studentEmiPayments}
            studentsLoading={data.studentsLoading}
            emiLoading={data.emiLoading}
            expandedStudentId={expandedStudentId}
            closerBreakdown={filters.closerBreakdown}
            allStudentsTotals={filters.allStudentsTotals}
            todayFollowUpCount={filters.todayFollowUpCount}
            searchQuery={filters.searchQuery}
            setSearchQuery={filters.setSearchQuery}
            isFilterOpen={filters.isFilterOpen}
            setIsFilterOpen={filters.setIsFilterOpen}
            dateFrom={filters.dateFrom}
            setDateFrom={filters.setDateFrom}
            dateTo={filters.dateTo}
            setDateTo={filters.setDateTo}
            statusFilter={filters.statusFilter}
            setStatusFilter={filters.setStatusFilter}
            isDateFromOpen={filters.isDateFromOpen}
            setIsDateFromOpen={filters.setIsDateFromOpen}
            isDateToOpen={filters.isDateToOpen}
            setIsDateToOpen={filters.setIsDateToOpen}
            filterRefunded={filters.filterRefunded}
            setFilterRefunded={filters.setFilterRefunded}
            filterDiscontinued={filters.filterDiscontinued}
            setFilterDiscontinued={filters.setFilterDiscontinued}
            filterFullPayment={filters.filterFullPayment}
            setFilterFullPayment={filters.setFilterFullPayment}
            filterRemaining={filters.filterRemaining}
            setFilterRemaining={filters.setFilterRemaining}
            filterTodayFollowUp={filters.filterTodayFollowUp}
            setFilterTodayFollowUp={filters.setFilterTodayFollowUp}
            filterPAE={filters.filterPAE}
            setFilterPAE={filters.setFilterPAE}
            activeFilterCount={filters.activeFilterCount}
            clearAllFilters={filters.clearAllFilters}
            exportStudentsCSV={filters.exportStudentsCSV}
            getStatusBadge={filters.getStatusBadge}
            formatOrg={filters.formatOrg}
            isAdmin={isAdmin}
            setExpandedStudentId={setExpandedStudentId}
            setEmiStudent={setEmiStudent}
            setNotesStudent={setNotesStudent}
            setNotesText={setNotesText}
            setFollowUpDate={setFollowUpDate}
            setPayAfterEarning={setPayAfterEarning}
            setRefundingStudent={setRefundingStudent}
            setDiscontinuingStudent={setDiscontinuingStudent}
            setDeletingStudent={setDeletingStudent}
            setViewingNotesStudent={setViewingNotesStudent}
            setAddStudentOpen={setAddStudentOpen}
          />
        </TabsContent>
      </Tabs>

      <FuturesDialogs
        selectedBatch={selectedBatch}
        queryClient={data.queryClient}
        emiStudent={emiStudent}
        setEmiStudent={setEmiStudent}
        addStudentOpen={addStudentOpen}
        setAddStudentOpen={setAddStudentOpen}
        refundingStudent={refundingStudent}
        setRefundingStudent={setRefundingStudent}
        refundNotes={refundNotes}
        setRefundNotes={setRefundNotes}
        refundMutation={{ mutate: handleRefundMutate }}
        notesStudent={notesStudent}
        setNotesStudent={setNotesStudent}
        notesText={notesText}
        setNotesText={setNotesText}
        followUpDate={followUpDate}
        setFollowUpDate={setFollowUpDate}
        payAfterEarning={payAfterEarning}
        setPayAfterEarning={setPayAfterEarning}
        notesMutation={{ mutate: handleNotesMutate, isPending: data.notesMutation.isPending }}
        viewingNotesStudent={viewingNotesStudent}
        setViewingNotesStudent={setViewingNotesStudent}
        discontinuingStudent={discontinuingStudent}
        setDiscontinuingStudent={setDiscontinuingStudent}
        discontinueMutation={{ mutate: handleDiscontinueMutate }}
        deletingStudent={deletingStudent}
        setDeletingStudent={setDeletingStudent}
        deleteStudentMutation={{ mutate: handleDeleteStudentMutate }}
        formatOrg={filters.formatOrg}
      />

      {/* Student List Dialog for Insights */}
      <StudentListDialog
        open={showStudentListDialog}
        onOpenChange={setShowStudentListDialog}
        title={studentListTitle}
        subtitle={studentListSubtitle}
        students={studentListData}
        totalAmount={studentListData.reduce((sum, s) => sum + (s.due_amount || 0), 0)}
        onEditNotes={(student) => {
          setShowStudentListDialog(false);
          const futuresStudent = studentListData.find(s => s.id === student.id);
          if (futuresStudent) {
            setNotesStudent(futuresStudent);
            setNotesText(futuresStudent.notes || "");
            setFollowUpDate(futuresStudent.next_follow_up_date ? new Date(futuresStudent.next_follow_up_date) : undefined);
            setPayAfterEarning(futuresStudent.pay_after_earning || false);
          }
        }}
        showFollowUpDate
      />
    </div>
  );
};

export default FuturesMentorship;
