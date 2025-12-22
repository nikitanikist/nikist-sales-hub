import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { format } from "date-fns";
import { Phone, Mail, Calendar, Clock, User } from "lucide-react";

type CallCategory = 
  | "converted" 
  | "not_converted" 
  | "rescheduled_remaining" 
  | "rescheduled_done" 
  | "booking_amount" 
  | "remaining";

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
};

const categoryColors: Record<CallCategory, string> = {
  converted: "bg-green-500",
  not_converted: "bg-red-500",
  rescheduled_remaining: "bg-orange-500",
  rescheduled_done: "bg-teal-500",
  booking_amount: "bg-purple-500",
  remaining: "bg-blue-500",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  pending: "Pending",
  not_decided: "Not Decided",
  so_so: "So-So",
  converted_beginner: "Converted (Beginner)",
  converted_intermediate: "Converted (Intermediate)",
  converted_advance: "Converted (Advance)",
  not_converted: "Not Converted",
  booking_amount: "Booking Amount",
  reschedule: "Reschedule",
  refunded: "Refunded",
};

export function WorkshopCallsDialog({
  open,
  onOpenChange,
  workshopTitle,
  category,
}: WorkshopCallsDialogProps) {
  const { data: calls, isLoading } = useQuery({
    queryKey: ["workshop-calls", workshopTitle, category],
    queryFn: async () => {
      // First get leads for this workshop
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, contact_name, email, phone")
        .eq("workshop_name", workshopTitle);

      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) return [];

      const leadIds = leads.map((l) => l.id);
      const leadMap = leads.reduce((acc, lead) => {
        acc[lead.id] = lead;
        return acc;
      }, {} as Record<string, typeof leads[0]>);

      // Build status filter based on category
      type CallStatus = "scheduled" | "converted_beginner" | "converted_intermediate" | "converted_advance" | "booking_amount" | "not_converted" | "not_decided" | "so_so" | "reschedule" | "pending" | "refunded";
      
      let statusFilter: CallStatus[] = [];
      let wasRescheduledFilter: boolean | null = null;

      switch (category) {
        case "converted":
          statusFilter = ["converted_beginner", "converted_intermediate", "converted_advance"];
          break;
        case "not_converted":
          statusFilter = ["not_converted"];
          break;
        case "rescheduled_remaining":
          statusFilter = ["reschedule"];
          break;
        case "rescheduled_done":
          // Calls that were rescheduled but now have a completion status
          statusFilter = ["converted_beginner", "converted_intermediate", "converted_advance", "not_converted", "booking_amount", "refunded"];
          wasRescheduledFilter = true;
          break;
        case "booking_amount":
          statusFilter = ["booking_amount"];
          break;
        case "remaining":
          statusFilter = ["scheduled", "pending", "not_decided", "so_so"];
          break;
      }

      // Fetch call appointments
      let query = supabase
        .from("call_appointments")
        .select(`
          id,
          lead_id,
          scheduled_date,
          scheduled_time,
          status,
          was_rescheduled,
          offer_amount,
          cash_received,
          closer:profiles!call_appointments_closer_id_fkey(full_name)
        `)
        .in("lead_id", leadIds)
        .in("status", statusFilter)
        .order("scheduled_date", { ascending: false });

      // Add was_rescheduled filter if needed
      if (wasRescheduledFilter !== null) {
        query = query.eq("was_rescheduled", wasRescheduledFilter);
      }

      const { data: appointments, error: appointmentsError } = await query;

      if (appointmentsError) throw appointmentsError;

      // Merge lead info into appointments
      return (appointments || []).map((apt) => ({
        ...apt,
        lead: leadMap[apt.lead_id],
      }));
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Closer</TableHead>
                {(category === "converted" || category === "rescheduled_done") && (
                  <>
                    <TableHead className="text-right">Offer</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {call.lead?.contact_name || "Unknown"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {call.lead?.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <a 
                            href={`tel:${call.lead.phone}`} 
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {call.lead.phone}
                          </a>
                        </div>
                      )}
                      {call.lead?.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <a 
                            href={`mailto:${call.lead.email}`} 
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {call.lead.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(call.scheduled_date), "MMM dd, yyyy")}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {call.scheduled_time}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {statusLabels[call.status] || call.status}
                    </Badge>
                    {call.was_rescheduled && category !== "rescheduled_remaining" && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        Was Rescheduled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {call.closer?.full_name || "Unassigned"}
                  </TableCell>
                  {(category === "converted" || category === "rescheduled_done") && (
                    <>
                      <TableCell className="text-right">
                        ₹{Number(call.offer_amount || 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        ₹{Number(call.cash_received || 0).toLocaleString("en-IN")}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No calls found in this category for this workshop.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
