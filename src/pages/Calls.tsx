import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { format, addDays, subDays, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
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
import { TableSkeleton, MobileCardSkeleton } from "@/components/skeletons";
import { PageIntro } from "@/components/PageIntro";

type DateFilter = 'yesterday' | 'today' | 'tomorrow' | 'custom';

type Appointment = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  offer_amount: number | null;
  cash_received: number | null;
  due_amount: number | null;
  closer_remarks: string | null;
  additional_comments: string | null;
  closer_id: string;
  lead: {
    id: string;
    contact_name: string;
    company_name: string;
    email: string;
    phone: string | null;
    country: string | null;
  } | null;
  closer: {
    id: string;
    full_name: string;
  } | null;
  reminders: {
    id: string;
    reminder_type: string;
    reminder_time: string;
    status: string;
    sent_at: string | null;
  }[];
};

const Calls = () => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [selectedCloserId, setSelectedCloserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { isAdmin, isCloser, isManager, profileId, isLoading: roleLoading } = useUserRole();
  const { currentOrganization } = useOrganization();

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
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["call-appointments", selectedDate, profileId, isCloser, currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      let query = supabase
        .from("call_appointments")
        .select(`
          *,
          lead:leads!call_appointments_lead_id_fkey(
            id,
            contact_name,
            company_name,
            email,
            phone,
            country
          ),
          closer:profiles!call_appointments_closer_id_fkey(
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
        .eq("organization_id", currentOrganization.id)
        .order("scheduled_time", { ascending: true });

      // If user is a closer, filter to only their appointments
      if (isCloser && !isAdmin && profileId) {
        query = query.eq("closer_id", profileId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as Appointment[];
    },
    enabled: !roleLoading && !!currentOrganization,
  });

  // Real-time subscription for call appointments
  useEffect(() => {
    if (!currentOrganization) return;

    const channel = supabase
      .channel('calls-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_appointments',
          filter: `organization_id=eq.${currentOrganization.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["call-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["closer-metrics"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentOrganization]);

  type CloserMetrics = {
    id: string;
    full_name: string;
    total_calls: number;
    offered_amount: number;
    cash_collected: number;
    converted_count: number;
    not_converted_count: number;
    rescheduled_count: number;
    pending_count: number;
  };

  const { data: closerMetrics } = useQuery<CloserMetrics[]>({
    queryKey: ["closer-metrics", selectedDate, profileId, isCloser, isManager],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_closer_call_metrics', {
        target_date: selectedDate
      });

      if (error) throw error;
      
      // If user is a closer, filter to only their card
      if (isCloser && !isAdmin && profileId) {
        return (data as CloserMetrics[]).filter(
          (closer) => closer.id === profileId
        );
      }
      
      return data as CloserMetrics[];
    },
    enabled: !roleLoading && !isManager,
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async (appointment: any) => {
      const { error } = await (supabase as any)
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
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'scheduled':
        return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'rescheduled':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'no_show':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageIntro
        icon={CalendarIcon}
        tagline="Call Management"
        description="Schedule and track your one-on-one calls."
        variant="sky"
      />

      {/* Date Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap">
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

      {/* Closer Cards - Hidden for Managers */}
      {!isManager && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto">
          {/* Show All Closers Card */}
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md overflow-hidden",
              selectedCloserId === null && "ring-2 ring-primary"
            )}
            onClick={() => setSelectedCloserId(null)}
          >
            <div className="grid grid-cols-2 divide-x">
              {/* Left Column */}
              <div className="p-4 flex flex-col justify-center">
                <h3 className="text-lg font-medium mb-2">All Closers</h3>
                <div className="text-5xl font-bold">
                  {closerMetrics?.reduce((sum, c) => sum + (c.total_calls || 0), 0) || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total calls</p>
              </div>
              
              {/* Right Column */}
              <div className="p-4 space-y-3">
                {/* Financial Row */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Offered amt</span>
                    <span className="text-base font-bold">
                      ₹{(closerMetrics?.reduce((sum, c) => sum + (c.offered_amount || 0), 0) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Cash collected</span>
                    <span className="text-base font-bold">
                      ₹{(closerMetrics?.reduce((sum, c) => sum + (c.cash_collected || 0), 0) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                
                {/* Status Breakdown */}
                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span>Converted</span>
                    <span className="font-medium text-green-600">
                      {closerMetrics?.reduce((sum, c) => sum + (c.converted_count || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Rescheduled</span>
                    <span className="font-medium text-purple-600">
                      {closerMetrics?.reduce((sum, c) => sum + (c.rescheduled_count || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Pending</span>
                    <span className="font-medium text-blue-600">
                      {closerMetrics?.reduce((sum, c) => sum + (c.pending_count || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Not Converted</span>
                    <span className="font-medium text-red-600">
                      {closerMetrics?.reduce((sum, c) => sum + (c.not_converted_count || 0), 0) || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Individual Closer Cards */}
          {closerMetrics?.map((closer) => (
            <Card 
              key={closer.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md overflow-hidden",
                selectedCloserId === closer.id && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedCloserId(selectedCloserId === closer.id ? null : closer.id)}
            >
              <div className="grid grid-cols-2 divide-x">
                {/* Left Column */}
                <div className="p-4 flex flex-col justify-center">
                  <h3 className="text-lg font-medium mb-2">{closer.full_name}</h3>
                  <div className="text-5xl font-bold">{closer.total_calls || 0}</div>
                  <p className="text-sm text-muted-foreground mt-1">Total calls</p>
                </div>
                
                {/* Right Column */}
                <div className="p-4 space-y-3">
                  {/* Financial Row */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Offered amt</span>
                      <span className="text-base font-bold">
                        ₹{(closer.offered_amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Cash collected</span>
                      <span className="text-base font-bold">
                        ₹{(closer.cash_collected || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Status Breakdown */}
                  <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between border-b pb-1">
                      <span>Converted</span>
                      <span className="font-medium text-green-600">{closer.converted_count || 0}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Rescheduled</span>
                      <span className="font-medium text-purple-600">{closer.rescheduled_count || 0}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Pending</span>
                      <span className="font-medium text-blue-600">{closer.pending_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Not Converted</span>
                      <span className="font-medium text-red-600">{closer.not_converted_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Appointments Table */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Appointments for {format(new Date(selectedDate), 'MMM dd, yyyy')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading || roleLoading ? (
            <>
              <div className="hidden sm:block">
                <TableSkeleton columns={8} rows={5} />
              </div>
              <div className="sm:hidden p-4">
                <MobileCardSkeleton count={3} />
              </div>
            </>
          ) : !appointments || appointments.length === 0 ? (
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
                    {appointments
                      .filter(apt => selectedCloserId ? apt.closer_id === selectedCloserId : true)
                      .map((appointment) => {
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
                {appointments
                  .filter(apt => selectedCloserId ? apt.closer_id === selectedCloserId : true)
                  .map((appointment) => {
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
