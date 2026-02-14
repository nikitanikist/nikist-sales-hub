import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Pencil, HandCoins } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { UpdateFuturesEmiDialog } from "@/components/UpdateFuturesEmiDialog";
import { AddFuturesStudentDialog } from "@/components/AddFuturesStudentDialog";
import type { FuturesStudent, FuturesBatch } from "./hooks/useFuturesData";
import type { QueryClient } from "@tanstack/react-query";

interface FuturesDialogsProps {
  selectedBatch: FuturesBatch;
  queryClient: QueryClient;
  // EMI
  emiStudent: FuturesStudent | null;
  setEmiStudent: (s: FuturesStudent | null) => void;
  // Add Student
  addStudentOpen: boolean;
  setAddStudentOpen: (open: boolean) => void;
  // Refund
  refundingStudent: FuturesStudent | null;
  setRefundingStudent: (s: FuturesStudent | null) => void;
  refundNotes: string;
  setRefundNotes: (t: string) => void;
  refundMutation: { mutate: (data: { id: string; reason: string }) => void };
  // Notes
  notesStudent: FuturesStudent | null;
  setNotesStudent: (s: FuturesStudent | null) => void;
  notesText: string;
  setNotesText: (t: string) => void;
  followUpDate: Date | undefined;
  setFollowUpDate: (d: Date | undefined) => void;
  payAfterEarning: boolean;
  setPayAfterEarning: (v: boolean) => void;
  notesMutation: { mutate: (data: { id: string; notes: string; nextFollowUpDate: string | null; payAfterEarning: boolean }) => void; isPending: boolean };
  // View Notes
  viewingNotesStudent: FuturesStudent | null;
  setViewingNotesStudent: (s: FuturesStudent | null) => void;
  // Discontinued
  discontinuingStudent: FuturesStudent | null;
  setDiscontinuingStudent: (s: FuturesStudent | null) => void;
  discontinueMutation: { mutate: (id: string) => void };
  // Delete Student
  deletingStudent: FuturesStudent | null;
  setDeletingStudent: (s: FuturesStudent | null) => void;
  deleteStudentMutation: { mutate: (id: string) => void };
  // Org timezone
  formatOrg: (date: string, fmt: string) => string;
}

export default function FuturesDialogs({
  selectedBatch,
  queryClient,
  emiStudent,
  setEmiStudent,
  addStudentOpen,
  setAddStudentOpen,
  refundingStudent,
  setRefundingStudent,
  refundNotes,
  setRefundNotes,
  refundMutation,
  notesStudent,
  setNotesStudent,
  notesText,
  setNotesText,
  followUpDate,
  setFollowUpDate,
  payAfterEarning,
  setPayAfterEarning,
  notesMutation,
  viewingNotesStudent,
  setViewingNotesStudent,
  discontinuingStudent,
  setDiscontinuingStudent,
  discontinueMutation,
  deletingStudent,
  setDeletingStudent,
  deleteStudentMutation,
  formatOrg,
}: FuturesDialogsProps) {
  const [isFollowUpDateOpen, setIsFollowUpDateOpen] = useState(false);

  return (
    <>
      {/* Update EMI Dialog */}
      {emiStudent && (
        <UpdateFuturesEmiDialog
          open={!!emiStudent}
          onOpenChange={(open) => !open && setEmiStudent(null)}
          studentId={emiStudent.id}
          offerAmount={emiStudent.offer_amount}
          cashReceived={emiStudent.cash_received}
          dueAmount={emiStudent.due_amount}
          customerName={emiStudent.contact_name}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["futures-students"] })}
        />
      )}

      {/* Add Student Dialog */}
      <AddFuturesStudentDialog
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
        batchId={selectedBatch.id}
        batchName={selectedBatch.name}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["futures-students"] })}
      />

      {/* Refund Dialog */}
      <AlertDialog open={!!refundingStudent} onOpenChange={(open) => !open && setRefundingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Refunded</AlertDialogTitle>
            <AlertDialogDescription>
              Mark {refundingStudent?.contact_name} as refunded. Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Refund reason..."
              value={refundNotes}
              onChange={(e) => setRefundNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => refundingStudent && refundMutation.mutate({ id: refundingStudent.id, reason: refundNotes })}
              disabled={!refundNotes.trim()}
            >
              Confirm Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notes Dialog with Follow-up Date */}
      <Dialog open={!!notesStudent} onOpenChange={(open) => !open && setNotesStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
            <DialogDescription>Update notes and follow-up date for {notesStudent?.contact_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Enter notes..."
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Next EMI Reminder Date</Label>
              <Popover open={isFollowUpDateOpen} onOpenChange={setIsFollowUpDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !followUpDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {followUpDate ? format(followUpDate, "dd MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={followUpDate}
                    onSelect={(d) => { setFollowUpDate(d); setIsFollowUpDateOpen(false); }}
                  />
                </PopoverContent>
              </Popover>
              {followUpDate && (
                <Button variant="ghost" size="sm" onClick={() => setFollowUpDate(undefined)}>
                  Clear date
                </Button>
              )}
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="pae-toggle" className="flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-violet-600" />
                    Pay After Earning (PAE)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Student will pay remaining amount after earning from the course
                  </p>
                </div>
                <Switch
                  id="pae-toggle"
                  checked={payAfterEarning}
                  onCheckedChange={setPayAfterEarning}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesStudent(null)}>Cancel</Button>
            <Button 
              onClick={() => notesStudent && notesMutation.mutate({ 
                id: notesStudent.id, 
                notes: notesText,
                nextFollowUpDate: followUpDate ? format(followUpDate, "yyyy-MM-dd") : null,
                payAfterEarning
              })}
              disabled={notesMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Notes Dialog (Read-only) */}
      <Dialog open={!!viewingNotesStudent} onOpenChange={(open) => !open && setViewingNotesStudent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notes & Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="font-medium">{viewingNotesStudent?.contact_name}</p>
              <p className="text-sm text-muted-foreground">{viewingNotesStudent?.email}</p>
            </div>
            
            <div className="space-y-1">
              <Label className="text-muted-foreground">Next Follow-up Date</Label>
              <p className="font-medium">
                {viewingNotesStudent?.next_follow_up_date 
                  ? formatOrg(viewingNotesStudent.next_follow_up_date, "dd MMM yyyy")
                  : "Not set"}
              </p>
            </div>
            
            <div className="space-y-1">
              <Label className="text-muted-foreground">Notes</Label>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md min-h-[60px]">
                {viewingNotesStudent?.notes || "No notes added"}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setViewingNotesStudent(null)}>
              Close
            </Button>
            <Button onClick={() => {
              if (viewingNotesStudent) {
                setNotesStudent(viewingNotesStudent);
                setNotesText(viewingNotesStudent.notes || "");
                setFollowUpDate(viewingNotesStudent.next_follow_up_date 
                  ? new Date(viewingNotesStudent.next_follow_up_date) 
                  : undefined);
                setPayAfterEarning(viewingNotesStudent.pay_after_earning || false);
                setViewingNotesStudent(null);
              }
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discontinued Dialog */}
      <AlertDialog open={!!discontinuingStudent} onOpenChange={(open) => !open && setDiscontinuingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Discontinued</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark {discontinuingStudent?.contact_name} as discontinued? This indicates the student is no longer continuing with the program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => discontinuingStudent && discontinueMutation.mutate(discontinuingStudent.id)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Student Dialog (Admin Only) */}
      <AlertDialog open={!!deletingStudent} onOpenChange={(open) => !open && setDeletingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {deletingStudent?.contact_name}? This will also delete all EMI payments and offer history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingStudent && deleteStudentMutation.mutate(deletingStudent.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
