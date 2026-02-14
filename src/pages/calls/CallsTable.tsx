import React from "react";
import { format, parse } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TableSkeleton, MobileCardSkeleton } from "@/components/skeletons";
import type { Appointment } from "./hooks/useCallsData";
import { getStatusColor } from "./hooks/useCallsData";

interface CallsTableProps {
  appointments: Appointment[] | undefined;
  isLoading: boolean;
  roleLoading: boolean;
  selectedCloserId: string | null;
  formattedDate: string;
}

const CallsTable = React.memo(function CallsTable({
  appointments,
  isLoading,
  roleLoading,
  selectedCloserId,
  formattedDate,
}: CallsTableProps) {
  const filteredAppointments = appointments?.filter(
    (apt) => (selectedCloserId ? apt.closer_id === selectedCloserId : true)
  );

  return (
    <>
      {isLoading || roleLoading ? (
        <>
          <div className="hidden sm:block">
            <TableSkeleton columns={8} rows={5} />
          </div>
          <div className="sm:hidden p-4">
            <MobileCardSkeleton count={3} />
          </div>
        </>
      ) : !filteredAppointments || filteredAppointments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No appointments scheduled for this date
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Offer Amount</TableHead>
                  <TableHead>Cash Collection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appointment) => {
                  const lead = Array.isArray(appointment.lead) ? appointment.lead[0] : appointment.lead;
                  const closer = Array.isArray(appointment.closer) ? appointment.closer[0] : appointment.closer;
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        <div>{lead?.contact_name || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{lead?.email || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">{lead?.phone || '-'}</div>
                      </TableCell>
                      <TableCell>{format(new Date(appointment.scheduled_date), 'dd-MM-yyyy')}</TableCell>
                      <TableCell>
                        {format(parse(appointment.scheduled_time.substring(0, 5), 'HH:mm', new Date()), 'h:mm a')}
                      </TableCell>
                      <TableCell>{closer?.full_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-white", getStatusColor(appointment.status))}>
                          {appointment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        ₹{(appointment.offer_amount || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        ₹{(appointment.cash_received || 0).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3 px-4">
            {filteredAppointments.map((appointment) => {
              const lead = Array.isArray(appointment.lead) ? appointment.lead[0] : appointment.lead;
              const closer = Array.isArray(appointment.closer) ? appointment.closer[0] : appointment.closer;
              return (
                <div key={appointment.id} className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{lead?.contact_name || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">{closer?.full_name || 'N/A'}</div>
                    </div>
                    <Badge className={cn("text-white text-xs", getStatusColor(appointment.status))}>
                      {appointment.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Date</span>
                      <div>{format(new Date(appointment.scheduled_date), 'dd-MM-yyyy')}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Time</span>
                      <div>{format(parse(appointment.scheduled_time.substring(0, 5), 'HH:mm', new Date()), 'h:mm a')}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Offer</span>
                      <div className="font-medium">₹{(appointment.offer_amount || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Cash</span>
                      <div className="font-medium text-green-600">₹{(appointment.cash_received || 0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                  {lead?.email && (
                    <div className="text-xs text-blue-600 truncate">{lead.email}</div>
                  )}
                  {lead?.phone && (
                    <div className="text-xs text-blue-600">{lead.phone}</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
});

export default CallsTable;
