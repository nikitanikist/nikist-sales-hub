import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Phone, Mail, Calendar, Clock, User, RotateCcw } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

type CallCategory = 
  | "converted" 
  | "not_converted" 
  | "rescheduled_remaining" 
  | "rescheduled_done" 
  | "booking_amount" 
  | "remaining"
  | "all_booked"
  | "refunded"
  | "rejoin"
  | "cross_workshop";

interface WorkshopCallsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopTitle: string;
  category: CallCategory;
}

const categoryLabels: Record<CallCategory, string> = {
  converted: "Converted Calls",
  not_converted: "Not Converted Calls",
  rescheduled_remaining: "Rescheduled Remaining",
  rescheduled_done: "Rescheduled Done",
  booking_amount: "Booking Amount",
  remaining: "Remaining Calls",
  all_booked: "All Booked Calls",
  refunded: "Refunded Calls",
  rejoin: "Rejoin Calls",
  cross_workshop: "Cross-Workshop Payments",
};

const categoryColors: Record<CallCategory, string> = {
  converted: "bg-green-500",
  not_converted: "bg-red-500",
  rescheduled_remaining: "bg-orange-500",
  rescheduled_done: "bg-teal-500",
  booking_amount: "bg-purple-500",
  remaining: "bg-blue-500",
  all_booked: "bg-slate-500",
  refunded: "bg-amber-500",
  rejoin: "bg-amber-600",
  cross_workshop: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  pending: "Pending",
  not_decided: "Not Decided",
  so_so: "So-So",
  converted_beginner: "Converted (Beginner)",
  converted_intermediate: "Converted (Intermediate)",
  converted_advance: "Converted (Advance)",
  converted: "Converted",
  not_converted: "Not Converted",
  booking_amount: "Booking Amount",
  reschedule: "Reschedule",
  refunded: "Refunded",
};

interface WorkshopCall {
  id: string;
  lead_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  was_rescheduled: boolean;
  offer_amount: number;
  cash_received: number;
  closer_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  original_workshop_title: string | null;
  payment_workshop_title: string | null;
}

interface WorkshopSalesLead {
  id: string;
  lead_id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string | null;
  closer_name: string | null;
  has_call_appointment: boolean;
  call_appointment_id: string | null;
  is_assignment_refunded: boolean;
  assignment_id: string | null;
}

export function WorkshopCallsDialog({
  open,
  onOpenChange,
  workshopTitle,
  category,
}: WorkshopCallsDialogProps) {
  const { isManager, isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<WorkshopCall | WorkshopSalesLead | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundMode, setRefundMode] = useState<'appointment' | 'assignment'>('appointment');
  
  // Use different RPC for 'all_booked' category
  const { data: calls, isLoading } = useQuery({
    queryKey: ["workshop-calls", workshopTitle, category],
    queryFn: async () => {
      if (category === 'all_booked') {
        const { data, error } = await supabase.rpc('get_workshop_sales_leads', {
          p_workshop_title: workshopTitle,
        });
        if (error) throw error;
        return (data || []) as WorkshopSalesLead[];
      } else if (category === 'rejoin' || category === 'cross_workshop') {
        const { data, error } = await supabase.rpc('get_workshop_calls_by_category', {
          p_workshop_title: workshopTitle,
          p_category: category,
        });
        if (error) throw error;
        return (data || []) as WorkshopCall[];
      } else {
        const { data, error } = await supabase.rpc('get_workshop_calls_by_category', {
          p_workshop_title: workshopTitle,
          p_category: category,
        });
        if (error) throw error;
        return (data || []) as WorkshopCall[];
      }
    },
    enabled: open && !!workshopTitle,
  });

  const markRefundedMutation = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason: string }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({ 
          status: "refunded" as any,
          refund_reason: reason 
        })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop-calls"] });
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      queryClient.invalidateQueries({ queryKey: ["call-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      toast.success("Marked as refunded successfully");
      resetRefundDialog();
    },
    onError: (error: any) => {
      toast.error("Failed to mark as refunded: " + error.message);
    },
  });

  const markAssignmentRefundedMutation = useMutation({
    mutationFn: async ({ assignmentId, reason }: { assignmentId: string; reason: string }) => {
      const { error } = await supabase
        .from("lead_assignments")
        .update({ 
          is_refunded: true,
          refund_reason: reason,
          refunded_at: new Date().toISOString()
        })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop-calls"] });
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      toast.success("Marked as refunded successfully");
      resetRefundDialog();
    },
    onError: (error: any) => {
      toast.error("Failed to mark as refunded: " + error.message);
    },
  });

  const resetRefundDialog = () => {
    setRefundDialogOpen(false);
    setSelectedCall(null);
    setRefundReason("");
    setRefundMode('appointment');
  };

  const handleMarkAsRefunded = (call: WorkshopCall | WorkshopSalesLead) => {
    setSelectedCall(call);
    setRefundReason("");
    
    // Determine refund mode based on call type
    if ('has_call_appointment' in call) {
      const salesLead = call as WorkshopSalesLead;
      if (salesLead.has_call_appointment && salesLead.call_appointment_id) {
        setRefundMode('appointment');
      } else if (salesLead.assignment_id) {
        setRefundMode('assignment');
      }
    } else {
      setRefundMode('appointment');
    }
    
    setRefundDialogOpen(true);
  };

  const getAppointmentId = (call: WorkshopCall | WorkshopSalesLead): string | null => {
    if ('call_appointment_id' in call) {
      return call.call_appointment_id;
    }
    return call.id;
  };

  const getAssignmentId = (call: WorkshopSalesLead): string | null => {
    return call.assignment_id;
  };

  const handleConfirmRefund = () => {
    if (!selectedCall) return;
    if (!refundReason.trim()) {
      toast.error("Please provide a refund reason");
      return;
    }
    
    if (refundMode === 'appointment') {
      const appointmentId = getAppointmentId(selectedCall);
      if (!appointmentId) {
        toast.error("No call appointment found for this lead");
        return;
      }
      markRefundedMutation.mutate({
        appointmentId,
        reason: refundReason.trim(),
      });
    } else {
      const salesLead = selectedCall as WorkshopSalesLead;
      const assignmentId = getAssignmentId(salesLead);
      if (!assignmentId) {
        toast.error("No assignment found for this lead");
        return;
      }
      markAssignmentRefundedMutation.mutate({
        assignmentId,
        reason: refundReason.trim(),
      });
    }
  };

  // Check if we should show the action column (for non-refunded categories, non-manager users)
  const showActionColumn = category !== 'refunded' && category !== 'rejoin' && category !== 'cross_workshop' && !isManager;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className={`${categoryColors[category]} text-white`}>
                {calls?.length || 0}
              </Badge>
              {categoryLabels[category]} - {workshopTitle}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : calls && calls.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  {category === 'all_booked' ? (
                    <TableHead>Call Scheduled</TableHead>
                  ) : (
                    <TableHead>Scheduled</TableHead>
                  )}
                  <TableHead>Status</TableHead>
                  <TableHead>Closer</TableHead>
                  {category === 'rejoin' && (
                    <TableHead>Paid In Workshop</TableHead>
                  )}
                  {category === 'cross_workshop' && (
                    <TableHead>Original Workshop (Revenue Credited To)</TableHead>
                  )}
                  {(category === "converted" || category === "rescheduled_done" || category === "refunded" || category === "rejoin") && !isManager && (
                    <>
                      <TableHead className="text-right">Offer</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </>
                  )}
                  {showActionColumn && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => {
                  const isAllBookedCall = category === 'all_booked';
                  const salesLead = isAllBookedCall ? (call as WorkshopSalesLead) : null;
                  const regularCall = !isAllBookedCall ? (call as WorkshopCall) : null;
                  
                  return (
                    <TableRow key={call.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {call.contact_name || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {call.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <a 
                                href={`tel:${call.phone}`} 
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {call.phone}
                              </a>
                            </div>
                          )}
                          {call.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <a 
                                href={`mailto:${call.email}`} 
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {call.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isAllBookedCall && salesLead ? (
                          salesLead.has_call_appointment ? (
                            <div className="space-y-1">
                              {salesLead.scheduled_date && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {format(new Date(salesLead.scheduled_date), "MMM dd, yyyy")}
                                </div>
                              )}
                              {salesLead.scheduled_time && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {salesLead.scheduled_time}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                              No Call Scheduled
                            </Badge>
                          )
                        ) : regularCall ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(regularCall.scheduled_date), "MMM dd, yyyy")}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {regularCall.scheduled_time}
                            </div>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                      {isAllBookedCall && salesLead ? (
                          salesLead.has_call_appointment && salesLead.status ? (
                            <Badge variant="outline" className={salesLead.status === 'refunded' ? 'text-amber-600 border-amber-300' : ''}>
                              {statusLabels[salesLead.status] || salesLead.status}
                            </Badge>
                          ) : salesLead.is_assignment_refunded ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              Refunded
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )
                        ) : regularCall ? (
                          <>
                            <Badge variant="outline" className={regularCall.status === 'refunded' ? 'text-amber-600 border-amber-300' : ''}>
                              {statusLabels[regularCall.status] || regularCall.status}
                            </Badge>
                            {regularCall.was_rescheduled && category !== "rescheduled_remaining" && (
                              <Badge variant="secondary" className="ml-1 text-xs">
                                Was Rescheduled
                              </Badge>
                            )}
                          </>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {call.closer_name || "Unassigned"}
                      </TableCell>
                      {category === 'rejoin' && regularCall && (
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                            {regularCall.payment_workshop_title || "Unknown"}
                          </Badge>
                        </TableCell>
                      )}
                      {category === 'cross_workshop' && regularCall && (
                        <TableCell>
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                            {regularCall.original_workshop_title || "Unknown"}
                          </Badge>
                        </TableCell>
                      )}
                      {(category === "converted" || category === "rescheduled_done" || category === "refunded" || category === "rejoin") && !isManager && regularCall && (
                        <>
                          <TableCell className="text-right">
                            ₹{Number(regularCall.offer_amount || 0).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            ₹{Number(regularCall.cash_received || 0).toLocaleString("en-IN")}
                          </TableCell>
                        </>
                      )}
                      {showActionColumn && (
                        <TableCell className="text-right">
                          {category === 'all_booked' && salesLead ? (
                            // For all_booked category, show refund if:
                            // 1. Has call appointment and not already refunded via appointment, OR
                            // 2. No call appointment but has assignment and not already refunded via assignment
                            (() => {
                              const canRefundViaAppointment = salesLead.has_call_appointment && salesLead.call_appointment_id && salesLead.status !== 'refunded';
                              const canRefundViaAssignment = !salesLead.has_call_appointment && salesLead.assignment_id && !salesLead.is_assignment_refunded;
                              
                              if (canRefundViaAppointment || canRefundViaAssignment) {
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => handleMarkAsRefunded(salesLead)}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Refund
                                  </Button>
                                );
                              }
                              return null;
                            })()
                          ) : regularCall && regularCall.status !== 'refunded' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => handleMarkAsRefunded(regularCall)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Refund
                            </Button>
                          ) : null}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No calls found in this category for this workshop.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Reason Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Refunded</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              You are about to mark the call for <span className="font-medium text-foreground">{selectedCall?.contact_name}</span> as refunded.
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Refund Reason <span className="text-red-500">*</span></Label>
              <Textarea
                id="refund-reason"
                placeholder="Enter the reason for refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmRefund}
              disabled={(markRefundedMutation.isPending || markAssignmentRefundedMutation.isPending) || !refundReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {(markRefundedMutation.isPending || markAssignmentRefundedMutation.isPending) ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
