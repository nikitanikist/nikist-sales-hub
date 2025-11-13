import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, subDays } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DateFilter = 'yesterday' | 'today' | 'tomorrow' | 'custom';

const Calls = () => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const queryClient = useQueryClient();

  const getSelectedDate = () => {
    const today = new Date();
    switch (dateFilter) {
      case 'yesterday':
        return format(subDays(today, 1), 'yyyy-MM-dd');
      case 'today':
        return format(today, 'yyyy-MM-dd');
      case 'tomorrow':
        return format(addDays(today, 1), 'yyyy-MM-dd');
      case 'custom':
        return format(customDate, 'yyyy-MM-dd');
      default:
        return format(today, 'yyyy-MM-dd');
    }
  };

  const selectedDate = getSelectedDate();

  // Fetch appointments
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["call-appointments", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_appointments")
        .select(`
          *,
          lead:leads(
            id,
            contact_name,
            company_name,
            email,
            phone,
            country
          ),
          closer:profiles!closer_id(
            id,
            full_name
          ),
          reminders:call_reminders(
            id,
            reminder_type,
            reminder_time,
            status,
            sent_at
          )
        `)
        .eq("scheduled_date", selectedDate)
        .order("scheduled_time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch closers with call counts
  const { data: closers } = useQuery({
    queryKey: ["closers-with-calls", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_closer_call_counts', {
        target_date: selectedDate
      });

      if (error) throw error;
      return data;
    },
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async (appointment: any) => {
      const { error } = await supabase
        .from('call_appointments')
        .update({
          scheduled_date: appointment.scheduled_date,
          scheduled_time: appointment.scheduled_time,
          status: appointment.status,
          offer_amount: appointment.offer_amount,
          cash_received: appointment.cash_received,
          due_amount: appointment.due_amount,
          closer_remarks: appointment.closer_remarks,
          additional_comments: appointment.additional_comments,
        })
        .eq('id', appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["closers-with-calls"] });
      toast.success("Appointment updated successfully");
      setEditingAppointment(null);
    },
    onError: (error: any) => {
      toast.error("Failed to update appointment: " + error.message);
    },
  });

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter === 'custom') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
    }
  };

  const handleSaveAppointment = () => {
    if (editingAppointment) {
      const dueAmount = editingAppointment.offer_amount - editingAppointment.cash_received;
      updateAppointmentMutation.mutate({
        ...editingAppointment,
        due_amount: dueAmount,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'scheduled':
        return 'bg-blue-500';
      case 'rescheduled':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'no_show':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">1:1 Call Schedule</h1>

      {/* Date Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={dateFilter === 'yesterday' ? 'default' : 'outline'}
              onClick={() => handleDateFilterChange('yesterday')}
            >
              Yesterday
            </Button>
            <Button
              variant={dateFilter === 'today' ? 'default' : 'outline'}
              onClick={() => handleDateFilterChange('today')}
            >
              Today
            </Button>
            <Button
              variant={dateFilter === 'tomorrow' ? 'default' : 'outline'}
              onClick={() => handleDateFilterChange('tomorrow')}
            >
              Tomorrow
            </Button>
            
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant={dateFilter === 'custom' ? 'default' : 'outline'}
                  onClick={() => handleDateFilterChange('custom')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter === 'custom' ? format(customDate, 'MM/dd/yyyy') : 'Custom'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    if (date) {
                      setCustomDate(date);
                      setDateFilter('custom');
                      setShowDatePicker(false);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {dateFilter === 'custom' && (
              <span className="flex items-center text-sm text-muted-foreground">
                Showing calls for {format(customDate, 'MMMM dd, yyyy')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Closer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {closers?.map((closer) => (
          <Card key={closer.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{closer.full_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{closer.call_count}</div>
              <p className="text-xs text-muted-foreground mt-1">Scheduled calls</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Appointments for {format(new Date(selectedDate), 'MMMM dd, yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : !appointments || appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No appointments scheduled for this date
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Cash</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appointment) => (
                    <>
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">
                          <div>{appointment.lead.contact_name}</div>
                          <div className="text-sm text-muted-foreground">{appointment.lead.company_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{appointment.lead.email}</div>
                          <div className="text-sm text-muted-foreground">{appointment.lead.phone}</div>
                        </TableCell>
                        <TableCell>{format(new Date(appointment.scheduled_date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell>{appointment.scheduled_time}</TableCell>
                        <TableCell>{appointment.closer.full_name}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-white", getStatusColor(appointment.status))}>
                            {appointment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{appointment.offer_amount?.toLocaleString('en-IN')}</TableCell>
                        <TableCell>₹{appointment.cash_received?.toLocaleString('en-IN')}</TableCell>
                        <TableCell>₹{appointment.due_amount?.toLocaleString('en-IN')}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRow(expandedRow === appointment.id ? null : appointment.id)}
                          >
                            {expandedRow === appointment.id ? (
                              <><ChevronUp className="h-4 w-4 mr-1" /> Hide</>
                            ) : (
                              <><ChevronDown className="h-4 w-4 mr-1" /> Details</>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Details Row */}
                      {expandedRow === appointment.id && (
                        <TableRow>
                          <TableCell colSpan={10}>
                            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                              <div>
                                <h4 className="font-semibold mb-2">Reminders</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {appointment.reminders?.map((reminder: any) => (
                                    <div key={reminder.id} className="flex items-center gap-2 text-sm">
                                      <span className="font-medium capitalize">
                                        {reminder.reminder_type.replace('_', ' ')}:
                                      </span>
                                      <span>{format(new Date(reminder.reminder_time), 'MM/dd HH:mm')}</span>
                                      {reminder.status === 'sent' && (
                                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                          sent
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              {appointment.closer_remarks && (
                                <div>
                                  <p className="font-semibold">Closer remarks:</p>
                                  <p className="text-sm text-muted-foreground">{appointment.closer_remarks}</p>
                                </div>
                              )}
                              
                              {appointment.additional_comments && (
                                <div>
                                  <p className="font-semibold">Additional comments:</p>
                                  <p className="text-sm text-muted-foreground">{appointment.additional_comments}</p>
                                </div>
                              )}
                              
                              <Button onClick={() => setEditingAppointment(appointment)}>
                                Edit Appointment
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Appointment Dialog */}
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
            <Button onClick={handleSaveAppointment} disabled={updateAppointmentMutation.isPending}>
              {updateAppointmentMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calls;
