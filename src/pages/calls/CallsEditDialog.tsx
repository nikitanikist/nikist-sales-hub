import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface CallsEditDialogProps {
  editingAppointment: any;
  setEditingAppointment: (apt: any) => void;
  onSave: () => void;
  isPending: boolean;
}

const CallsEditDialog = React.memo(function CallsEditDialog({
  editingAppointment,
  setEditingAppointment,
  onSave,
  isPending,
}: CallsEditDialogProps) {
  return (
    <Dialog open={!!editingAppointment} onOpenChange={(open) => !open && setEditingAppointment(null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Appointment</DialogTitle>
        </DialogHeader>

        {editingAppointment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduled_date">Date</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={editingAppointment.scheduled_date}
                  onChange={(e) => setEditingAppointment({ ...editingAppointment, scheduled_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="scheduled_time">Time</Label>
                <Input
                  id="scheduled_time"
                  type="time"
                  value={editingAppointment.scheduled_time}
                  onChange={(e) => setEditingAppointment({ ...editingAppointment, scheduled_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={editingAppointment.status}
                onValueChange={(value) => setEditingAppointment({ ...editingAppointment, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="offer_amount">Offer Amount</Label>
                <Input
                  id="offer_amount"
                  type="number"
                  value={editingAppointment.offer_amount}
                  onChange={(e) => setEditingAppointment({ ...editingAppointment, offer_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="cash_received">Cash Received</Label>
                <Input
                  id="cash_received"
                  type="number"
                  value={editingAppointment.cash_received}
                  onChange={(e) => setEditingAppointment({ ...editingAppointment, cash_received: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="due_amount">Due Amount</Label>
                <Input
                  id="due_amount"
                  type="number"
                  value={editingAppointment.offer_amount - editingAppointment.cash_received}
                  disabled
                />
              </div>
            </div>

            <div>
              <Label htmlFor="closer_remarks">Closer Remarks</Label>
              <Textarea
                id="closer_remarks"
                value={editingAppointment.closer_remarks || ''}
                onChange={(e) => setEditingAppointment({ ...editingAppointment, closer_remarks: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="additional_comments">Additional Comments</Label>
              <Textarea
                id="additional_comments"
                value={editingAppointment.additional_comments || ''}
                onChange={(e) => setEditingAppointment({ ...editingAppointment, additional_comments: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setEditingAppointment(null)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default CallsEditDialog;
