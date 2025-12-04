import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Phone, Mail, Check, Clock, AlertCircle, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type CallStatus = Database["public"]["Enums"]["call_status"];
type ReminderStatus = Database["public"]["Enums"]["reminder_status"];

interface AssignedLeadsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  closerId: string;
  closerName: string;
}

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: CallStatus;
  offer_amount: number | null;
  cash_received: number | null;
  due_amount: number | null;
  closer_remarks: string | null;
  additional_comments: string | null;
  lead: {
    id: string;
    contact_name: string;
    email: string;
    phone: string | null;
  } | null;
  reminders: {
    reminder_type: string;
    status: ReminderStatus | null;
    sent_at: string | null;
  }[];
}

const statusColors: Record<CallStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  rescheduled: "bg-yellow-100 text-yellow-800 border-yellow-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  no_show: "bg-gray-100 text-gray-800 border-gray-200",
};

const reminderTypeOrder = ["two_days", "one_day", "three_hours", "one_hour", "thirty_minutes", "ten_minutes"];
const reminderTypeLabels: Record<string, string> = {
  two_days: "2 Days",
  one_day: "1 Day",
  three_hours: "3 Hours",
  one_hour: "1 Hour",
  thirty_minutes: "30 Min",
  ten_minutes: "10 Min",
};

const AssignedLeadsDrawer = ({ isOpen, onClose, closerId, closerName }: AssignedLeadsDrawerProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    status: CallStatus;
    offer_amount: number;
    cash_received: number;
    closer_remarks: string;
  } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["closer-appointments", closerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_appointments")
        .select(`
          id,
          scheduled_date,
          scheduled_time,
          status,
          offer_amount,
          cash_received,
          due_amount,
          closer_remarks,
          additional_comments,
          lead:leads(id, contact_name, email, phone)
        `)
        .eq("closer_id", closerId)
        .order("scheduled_date", { ascending: false });

      if (error) throw error;

      // Fetch reminders for each appointment
      const appointmentsWithReminders = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: reminders } = await supabase
            .from("call_reminders")
            .select("reminder_type, status, sent_at")
            .eq("appointment_id", apt.id);
          
          return {
            ...apt,
            reminders: reminders || [],
          };
        })
      );

      return appointmentsWithReminders as Appointment[];
    },
    enabled: isOpen && !!closerId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; status: CallStatus; offer_amount: number; cash_received: number; closer_remarks: string }) => {
      const due_amount = Math.max(0, data.offer_amount - data.cash_received);
      
      const { error } = await supabase
        .from("call_appointments")
        .update({
          status: data.status,
          offer_amount: data.offer_amount,
          cash_received: data.cash_received,
          due_amount,
          closer_remarks: data.closer_remarks,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-appointments", closerId] });
      queryClient.invalidateQueries({ queryKey: ["sales-closers"] });
      toast({ title: "Updated", description: "Appointment details saved successfully" });
      setEditingId(null);
      setEditData(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingId(null);
      setEditData(null);
    } else {
      setExpandedId(id);
    }
  };

  const handleEdit = (apt: Appointment) => {
    setEditingId(apt.id);
    setEditData({
      status: apt.status,
      offer_amount: apt.offer_amount || 0,
      cash_received: apt.cash_received || 0,
      closer_remarks: apt.closer_remarks || "",
    });
  };

  const handleSave = () => {
    if (!editingId || !editData) return;
    updateMutation.mutate({ id: editingId, ...editData });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData(null);
  };

  const getReminderIcon = (status: ReminderStatus | null) => {
    switch (status) {
      case "sent":
        return <Check className="h-4 w-4 text-green-600" />;
      case "failed":
        return <X className="h-4 w-4 text-red-600" />;
      case "pending":
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assigned Leads - {closerName}</SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : appointments && appointments.length > 0 ? (
            <div className="space-y-2">
              {appointments.map((apt) => (
                <Collapsible
                  key={apt.id}
                  open={expandedId === apt.id}
                  onOpenChange={() => handleExpand(apt.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        {expandedId === apt.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{apt.lead?.contact_name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(apt.scheduled_date), "dd MMM yyyy")} at {apt.scheduled_time}
                          </p>
                        </div>
                      </div>
                      <Badge className={statusColors[apt.status]}>{apt.status}</Badge>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="p-4 border border-t-0 rounded-b-lg bg-muted/20 space-y-6">
                      {/* Contact Info - Read Only */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Details</h4>
                        <div className="flex flex-wrap gap-4">
                          {apt.lead?.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{apt.lead.email}</span>
                            </div>
                          )}
                          {apt.lead?.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{apt.lead.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reminder Timeline */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Reminder Timeline</h4>
                        <div className="flex flex-wrap gap-2">
                          {reminderTypeOrder.map((type) => {
                            const reminder = apt.reminders.find((r) => r.reminder_type === type);
                            return (
                              <div
                                key={type}
                                className="flex items-center gap-1 px-2 py-1 bg-background rounded border text-xs"
                              >
                                {reminder ? getReminderIcon(reminder.status) : <AlertCircle className="h-4 w-4 text-gray-400" />}
                                <span>{reminderTypeLabels[type]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Editable Fields */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Call Details</h4>
                        
                        {editingId === apt.id && editData ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                  value={editData.status}
                                  onValueChange={(value) => setEditData({ ...editData, status: value as CallStatus })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="no_show">No Show</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Offer Amount (₹)</Label>
                                <Input
                                  type="number"
                                  value={editData.offer_amount}
                                  onChange={(e) => setEditData({ ...editData, offer_amount: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Cash Received (₹)</Label>
                                <Input
                                  type="number"
                                  value={editData.cash_received}
                                  onChange={(e) => setEditData({ ...editData, cash_received: Number(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Due Amount (₹)</Label>
                                <Input
                                  type="number"
                                  value={Math.max(0, editData.offer_amount - editData.cash_received)}
                                  disabled
                                  className="bg-muted"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Closer Remarks</Label>
                              <Textarea
                                value={editData.closer_remarks}
                                onChange={(e) => setEditData({ ...editData, closer_remarks: e.target.value })}
                                placeholder="Add your remarks here..."
                                rows={3}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancel}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Offer:</span>{" "}
                                <span className="font-medium">₹{(apt.offer_amount || 0).toLocaleString("en-IN")}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Received:</span>{" "}
                                <span className="font-medium text-green-600">₹{(apt.cash_received || 0).toLocaleString("en-IN")}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Due:</span>{" "}
                                <span className="font-medium text-red-600">₹{(apt.due_amount || 0).toLocaleString("en-IN")}</span>
                              </div>
                            </div>
                            {apt.closer_remarks && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Remarks:</span>{" "}
                                <span>{apt.closer_remarks}</span>
                              </div>
                            )}
                            <Button size="sm" variant="outline" onClick={() => handleEdit(apt)}>
                              Edit Details
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No assigned leads found for this closer
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AssignedLeadsDrawer;
