import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GraduationCap, Plus, Edit, Trash2, Calendar, Users, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { PageIntro } from "@/components/PageIntro";
import type { Batch } from "./hooks/useBatchesData";

interface BatchListViewProps {
  isManager: boolean;
  isCloser: boolean;
  batches: Batch[] | undefined;
  batchesLoading: boolean;
  filteredBatches: Batch[];
  batchSearchQuery: string;
  setBatchSearchQuery: (q: string) => void;
  // Form state
  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;
  editingBatch: Batch | null;
  deletingBatch: Batch | null;
  setDeletingBatch: (batch: Batch | null) => void;
  formName: string;
  setFormName: (name: string) => void;
  formStartDate: Date | undefined;
  setFormStartDate: (date: Date | undefined) => void;
  formIsActive: boolean;
  setFormIsActive: (active: boolean) => void;
  isDatePopoverOpen: boolean;
  setIsDatePopoverOpen: (open: boolean) => void;
  // Handlers
  handleCloseForm: () => void;
  handleOpenEdit: (batch: Batch) => void;
  handleSubmit: () => void;
  onSelectBatch: (batch: Batch) => void;
  // Mutations
  createMutation: { isPending: boolean };
  updateMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean; mutate: (id: string) => void };
}

const BatchListView: React.FC<BatchListViewProps> = ({
  isManager, isCloser, batches, batchesLoading, filteredBatches,
  batchSearchQuery, setBatchSearchQuery,
  isCreateOpen, setIsCreateOpen, editingBatch, deletingBatch, setDeletingBatch,
  formName, setFormName, formStartDate, setFormStartDate,
  formIsActive, setFormIsActive, isDatePopoverOpen, setIsDatePopoverOpen,
  handleCloseForm, handleOpenEdit, handleSubmit, onSelectBatch,
  createMutation, updateMutation, deleteMutation,
}) => {
  const { getToday, format: formatOrg } = useOrgTimezone();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageIntro
        icon={GraduationCap}
        tagline="Batch Overview"
        description="Track student progress and EMI collections."
        variant="violet"
      />

      {!isManager && !isCloser && (
        <div className="flex justify-end">
          <Dialog open={isCreateOpen || !!editingBatch} onOpenChange={(open) => { if (!open) handleCloseForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)} size="sm" className="sm:h-10 w-fit">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Batch</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBatch ? "Edit Batch" : "Create New Batch"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Batch Name <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g., Batch 1 - Jan 3" value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Start Date <span className="text-red-500">*</span></Label>
                  <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formStartDate && "text-muted-foreground")}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {formStartDate ? format(formStartDate, "dd MMM yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={formStartDate} onSelect={(date) => { setFormStartDate(date); setIsDatePopoverOpen(false); }} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseForm}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingBatch ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search batches..." value={batchSearchQuery} onChange={(e) => setBatchSearchQuery(e.target.value)} className="pl-10" />
          </div>
          
          {batchesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !batches?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No batches created yet</p>
              <p className="text-sm">Click "Add Batch" to create your first batch</p>
            </div>
          ) : !filteredBatches.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No batches match your search</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  {!isManager && !isCloser && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow key={batch.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectBatch(batch)}>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell>{formatOrg(batch.start_date, "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {(() => {
                        const today = getToday();
                        const batchDate = formatOrg(batch.start_date, "yyyy-MM-dd");
                        const isLive = batchDate <= today;
                        return isLive ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Live</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Upcoming</Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {batch.students_count || 0}
                      </div>
                    </TableCell>
                    {!isManager && !isCloser && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(batch)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeletingBatch(batch)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!isManager && !isCloser && (
        <AlertDialog open={!!deletingBatch} onOpenChange={(open) => { if (!open) setDeletingBatch(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Batch</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingBatch?.name}"? 
                This will remove the batch but students will remain with no batch assigned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingBatch && deleteMutation.mutate(deletingBatch.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default BatchListView;
