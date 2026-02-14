import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, X, Pencil, HandCoins } from "lucide-react";
import { UpdateEmiDialog } from "@/components/UpdateEmiDialog";
import { AddBatchStudentDialog } from "@/components/AddBatchStudentDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Batch, BatchStudent } from "./hooks/useBatchesData";

interface BatchDialogsProps {
  isManager: boolean;
  isCloser: boolean;
  isAdmin: boolean;
  selectedBatch: Batch;
  batches: Batch[] | undefined;
  // Transfer
  editingStudent: BatchStudent | null;
  setEditingStudent: (s: BatchStudent | null) => void;
  newBatchId: string;
  setNewBatchId: (id: string) => void;
  transferMutation: { isPending: boolean; mutate: (data: { appointmentId: string; newBatchId: string }) => void };
  // Refund
  refundingStudent: BatchStudent | null;
  setRefundingStudent: (s: BatchStudent | null) => void;
  refundNotes: string;
  setRefundNotes: (notes: string) => void;
  markRefundedMutation: { isPending: boolean; mutate: (data: { appointmentId: string; refundReason: string }) => void };
  // Notes
  notesStudent: BatchStudent | null;
  setNotesStudent: (s: BatchStudent | null) => void;
  notesText: string;
  setNotesText: (text: string) => void;
  followUpDate: Date | undefined;
  setFollowUpDate: (d: Date | undefined) => void;
  payAfterEarning: boolean;
  setPayAfterEarning: (v: boolean) => void;
  isFollowUpDateOpen: boolean;
  setIsFollowUpDateOpen: (open: boolean) => void;
  updateNotesMutation: { isPending: boolean; mutate: (data: { appointmentId: string; notes: string; nextFollowUpDate: string | null; payAfterEarning: boolean }) => void };
  // View Notes
  viewingNotesStudent: BatchStudent | null;
  setViewingNotesStudent: (s: BatchStudent | null) => void;
  // Discontinued
  discontinuingStudent: BatchStudent | null;
  setDiscontinuingStudent: (s: BatchStudent | null) => void;
  discontinuedNotes: string;
  setDiscontinuedNotes: (notes: string) => void;
  markDiscontinuedMutation: { isPending: boolean; mutate: (data: { appointmentId: string; discontinuedReason: string }) => void };
  // Delete student
  deletingStudent: BatchStudent | null;
  setDeletingStudent: (s: BatchStudent | null) => void;
  deleteStudentMutation: { isPending: boolean; mutate: (id: string) => void };
  // EMI
  emiStudent: BatchStudent | null;
  setEmiStudent: (s: BatchStudent | null) => void;
  // Add student
  isAddStudentOpen: boolean;
  setIsAddStudentOpen: (open: boolean) => void;
  // QueryClient callbacks
  onEmiSuccess: () => void;
  onAddStudentSuccess: () => void;
}

const BatchDialogs: React.FC<BatchDialogsProps> = ({
  isManager, isCloser, isAdmin, selectedBatch, batches,
  editingStudent, setEditingStudent, newBatchId, setNewBatchId, transferMutation,
  refundingStudent, setRefundingStudent, refundNotes, setRefundNotes, markRefundedMutation,
  notesStudent, setNotesStudent, notesText, setNotesText, followUpDate, setFollowUpDate,
  payAfterEarning, setPayAfterEarning, isFollowUpDateOpen, setIsFollowUpDateOpen, updateNotesMutation,
  viewingNotesStudent, setViewingNotesStudent,
  discontinuingStudent, setDiscontinuingStudent, discontinuedNotes, setDiscontinuedNotes, markDiscontinuedMutation,
  deletingStudent, setDeletingStudent, deleteStudentMutation,
  emiStudent, setEmiStudent,
  isAddStudentOpen, setIsAddStudentOpen,
  onEmiSuccess, onAddStudentSuccess,
}) => {
  const handleTransferStudent = () => {
    if (!editingStudent || !newBatchId) return;
    transferMutation.mutate({ appointmentId: editingStudent.id, newBatchId });
    setEditingStudent(null);
    setNewBatchId("");
  };

  return (
    <>
      {/* Transfer Student Dialog */}
      {!isManager && !isCloser && (
        <Dialog open={!!editingStudent} onOpenChange={(open) => { if (!open) { setEditingStudent(null); setNewBatchId(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer Student to Different Batch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <p className="font-medium">{editingStudent?.contact_name}</p>
                <p className="text-sm text-muted-foreground">{editingStudent?.email}</p>
              </div>
              <div className="space-y-2">
                <Label>Select New Batch</Label>
                <Select value={newBatchId} onValueChange={setNewBatchId}>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {batches?.map(batch => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name} ({format(new Date(batch.start_date), "dd MMM yyyy")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditingStudent(null); setNewBatchId(""); }}>Cancel</Button>
              <Button onClick={handleTransferStudent} disabled={transferMutation.isPending || !newBatchId || newBatchId === selectedBatch?.id}>
                {transferMutation.isPending ? "Transferring..." : "Transfer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Refund Dialog */}
      {!isManager && !isCloser && (
        <AlertDialog open={!!refundingStudent} onOpenChange={(open) => { if (!open) { setRefundingStudent(null); setRefundNotes(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark as Refunded</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <div className="text-sm"><span className="font-medium">Student:</span> {refundingStudent?.contact_name}</div>
                  <div className="text-sm"><span className="font-medium">Email:</span> {refundingStudent?.email}</div>
                  <p className="text-muted-foreground mt-2">Are you sure you want to mark this student as refunded? This will:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Change status to "Refunded"</li>
                    <li>Be visible throughout the CRM</li>
                  </ul>
                  <div className="space-y-2 pt-2">
                    <Label className="text-foreground">Refund Reason <span className="text-destructive">*</span></Label>
                    <Textarea placeholder="Enter reason for refund..." value={refundNotes} onChange={(e) => setRefundNotes(e.target.value)} rows={3} className="resize-none" />
                    <p className="text-xs text-muted-foreground">Required</p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => refundingStudent && markRefundedMutation.mutate({ appointmentId: refundingStudent.id, refundReason: refundNotes.trim() })}
                className="bg-amber-600 text-white hover:bg-amber-700"
                disabled={markRefundedMutation.isPending || !refundNotes.trim()}
              >
                {markRefundedMutation.isPending ? "Updating..." : "Mark as Refunded"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Notes Dialog */}
      {!isManager && !isCloser && (
        <Dialog open={!!notesStudent} onOpenChange={(open) => { if (!open) { setNotesStudent(null); setNotesText(""); setFollowUpDate(undefined); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{notesStudent?.additional_comments ? "Edit Notes" : "Add Notes"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <p className="font-medium">{notesStudent?.contact_name}</p>
                <p className="text-sm text-muted-foreground">{notesStudent?.email}</p>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Enter notes here..." value={notesText} onChange={(e) => setNotesText(e.target.value)} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Next Follow-up Date</Label>
                <Popover open={isFollowUpDateOpen} onOpenChange={setIsFollowUpDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !followUpDate && "text-muted-foreground")}>
                      <Calendar className="mr-2 h-4 w-4" />
                      {followUpDate ? format(followUpDate, "dd MMM yyyy") : "Select follow-up date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={followUpDate} onSelect={(date) => { setFollowUpDate(date); setIsFollowUpDateOpen(false); }} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {followUpDate && (
                  <Button variant="ghost" size="sm" onClick={() => setFollowUpDate(undefined)} className="text-muted-foreground">
                    <X className="h-3 w-3 mr-1" /> Clear date
                  </Button>
                )}
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="pae-toggle-batches" className="flex items-center gap-2">
                      <HandCoins className="h-4 w-4 text-violet-600" />
                      Pay After Earning (PAE)
                    </Label>
                    <p className="text-xs text-muted-foreground">Student will pay remaining amount after earning from the course</p>
                  </div>
                  <Switch id="pae-toggle-batches" checked={payAfterEarning} onCheckedChange={setPayAfterEarning} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNotesStudent(null); setNotesText(""); setFollowUpDate(undefined); }}>Cancel</Button>
              <Button 
                onClick={() => notesStudent && updateNotesMutation.mutate({ 
                  appointmentId: notesStudent.id, 
                  notes: notesText,
                  nextFollowUpDate: followUpDate ? format(followUpDate, "yyyy-MM-dd") : null,
                  payAfterEarning
                })}
                disabled={updateNotesMutation.isPending}
              >
                {updateNotesMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View Notes Dialog */}
      <Dialog open={!!viewingNotesStudent} onOpenChange={(open) => { if (!open) setViewingNotesStudent(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Notes & Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="font-medium">{viewingNotesStudent?.contact_name}</p>
              <p className="text-sm text-muted-foreground">{viewingNotesStudent?.email}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Next Follow-up Date</Label>
              <p className="font-medium">
                {viewingNotesStudent?.next_follow_up_date 
                  ? format(new Date(viewingNotesStudent.next_follow_up_date), "dd MMM yyyy")
                  : "Not set"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Notes</Label>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md min-h-[60px]">
                {viewingNotesStudent?.additional_comments || "No notes added"}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewingNotesStudent(null)}>Close</Button>
            <Button onClick={() => {
              if (viewingNotesStudent) {
                setNotesStudent(viewingNotesStudent);
                setNotesText(viewingNotesStudent.additional_comments || "");
                setFollowUpDate(viewingNotesStudent.next_follow_up_date ? new Date(viewingNotesStudent.next_follow_up_date) : undefined);
                setPayAfterEarning(viewingNotesStudent.pay_after_earning || false);
                setViewingNotesStudent(null);
              }
            }}>
              <Pencil className="h-4 w-4 mr-2" />Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discontinued Dialog */}
      {!isManager && !isCloser && (
        <AlertDialog open={!!discontinuingStudent} onOpenChange={(open) => { if (!open) { setDiscontinuingStudent(null); setDiscontinuedNotes(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark as Discontinued</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <div className="text-sm"><span className="font-medium">Student:</span> {discontinuingStudent?.contact_name}</div>
                  <div className="text-sm"><span className="font-medium">Email:</span> {discontinuingStudent?.email}</div>
                  <p className="text-muted-foreground mt-2">Are you sure you want to mark this student as discontinued? This will:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Change status to "Discontinued"</li>
                    <li>Highlight the student in red</li>
                    <li>Be visible throughout the CRM</li>
                  </ul>
                  <div className="space-y-2 pt-2">
                    <Label className="text-foreground">Reason for Discontinuation <span className="text-destructive">*</span></Label>
                    <Textarea placeholder="Enter reason for discontinuation..." value={discontinuedNotes} onChange={(e) => setDiscontinuedNotes(e.target.value)} rows={3} className="resize-none" />
                    <p className="text-xs text-muted-foreground">Required</p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => discontinuingStudent && markDiscontinuedMutation.mutate({ appointmentId: discontinuingStudent.id, discontinuedReason: discontinuedNotes.trim() })}
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={markDiscontinuedMutation.isPending || !discontinuedNotes.trim()}
              >
                {markDiscontinuedMutation.isPending ? "Updating..." : "Mark as Discontinued"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Student Dialog (Admin Only) */}
      {isAdmin && (
        <AlertDialog open={!!deletingStudent} onOpenChange={(open) => !open && setDeletingStudent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Student</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingStudent?.contact_name}? 
                This will permanently remove the student and all their EMI payment records. 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deletingStudent && deleteStudentMutation.mutate(deletingStudent.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteStudentMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Update EMI Dialog */}
      {emiStudent && (
        <UpdateEmiDialog
          open={!!emiStudent}
          onOpenChange={(open) => !open && setEmiStudent(null)}
          appointmentId={emiStudent.id}
          offerAmount={emiStudent.offer_amount || 0}
          cashReceived={emiStudent.cash_received || 0}
          dueAmount={emiStudent.due_amount || 0}
          classesAccess={emiStudent.classes_access ?? null}
          batchId={selectedBatch?.id || null}
          customerName={emiStudent.contact_name}
          onSuccess={onEmiSuccess}
        />
      )}
      
      {/* Add Student Dialog */}
      {selectedBatch && (
        <AddBatchStudentDialog
          open={isAddStudentOpen}
          onOpenChange={setIsAddStudentOpen}
          batchId={selectedBatch.id}
          batchName={selectedBatch.name}
          onSuccess={onAddStudentSuccess}
        />
      )}
    </>
  );
};

export default BatchDialogs;
