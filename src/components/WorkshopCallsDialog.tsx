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
import { useUserRole } from "@/hooks/useUserRole";

type CallCategory = 
  | "converted" 
  | "not_converted" 
  | "rescheduled_remaining" 
  | "rescheduled_done" 
  | "booking_amount" 
  | "remaining"
  | "all_booked";

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
};

const categoryColors: Record<CallCategory, string> = {
  converted: "bg-green-500",
  not_converted: "bg-red-500",
  rescheduled_remaining: "bg-orange-500",
  rescheduled_done: "bg-teal-500",
  booking_amount: "bg-purple-500",
  remaining: "bg-blue-500",
  all_booked: "bg-slate-500",
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
}

export function WorkshopCallsDialog({
  open,
  onOpenChange,
  workshopTitle,
  category,
}: WorkshopCallsDialogProps) {
  const { isManager } = useUserRole();
  
  const { data: calls, isLoading } = useQuery({
    queryKey: ["workshop-calls", workshopTitle, category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_workshop_calls_by_category', {
        p_workshop_title: workshopTitle,
        p_category: category,
      });

      if (error) throw error;
      return (data || []) as WorkshopCall[];
    },
    enabled: open && !!workshopTitle,
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
                {(category === "converted" || category === "rescheduled_done") && !isManager && (
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
                    {call.closer_name || "Unassigned"}
                  </TableCell>
                  {(category === "converted" || category === "rescheduled_done") && !isManager && (
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
