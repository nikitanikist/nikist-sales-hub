import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ArrowLeft, Search, RefreshCw, ChevronDown, ChevronRight, Phone, Mail, Check, Clock, AlertCircle, X, Loader2, Calendar, Trash2, RotateCcw, UserPlus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isFuture, isPast, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { RebookCallDialog } from "@/components/RebookCallDialog";
import { ReassignCallDialog } from "@/components/ReassignCallDialog";
import { UpdateEmiDialog } from "@/components/UpdateEmiDialog";

type CallStatus = Database["public"]["Enums"]["call_status"];
type ReminderStatus = Database["public"]["Enums"]["reminder_status"];

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
  was_rescheduled: boolean | null;
  previous_scheduled_date: string | null;
  previous_scheduled_time: string | null;
  previous_closer_id: string | null;
  previous_closer: { full_name: string } | null;
  batch_id: string | null;
  classes_access: number | null;
  access_given: boolean | null;
  access_given_at: string | null;
  batch: { id: string; name: string; start_date: string } | null;
  closer: { id: string; full_name: string } | null;
  lead: {
    id: string;
    contact_name: string;
    email: string;
    phone: string | null;
    country: string | null;
    workshop_name: string | null;
  } | null;
  reminders: {
    reminder_type: string;
    status: ReminderStatus | null;
    sent_at: string | null;
    reminder_time: string;
  }[];
}

// Cutoff date: calls on or after this date use new workflow
const NEW_WORKFLOW_CUTOFF_DATE = new Date('2025-12-28');

// Helper to check if an appointment uses new workflow
const isNewWorkflow = (scheduledDate: string): boolean => {
  return new Date(scheduledDate) >= NEW_WORKFLOW_CUTOFF_DATE;
};

const CLASSES_ACCESS_OPTIONS = [
  { value: 1, label: "1 Class" },
  { value: 2, label: "2 Classes" },
  { value: 3, label: "3 Classes" },
  { value: 4, label: "4 Classes" },
  { value: 5, label: "5 Classes" },
  { value: 6, label: "6 Classes" },
  { value: 7, label: "7 Classes" },
  { value: 8, label: "8 Classes" },
  { value: 9, label: "9 Classes" },
  { value: 10, label: "10 Classes" },
  { value: 11, label: "11 Classes" },
  { value: 12, label: "12 Classes" },
  { value: 13, label: "13 Classes" },
  { value: 14, label: "14 Classes" },
  { value: 15, label: "All Classes" },
];

const statusColors: Record<CallStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  converted_beginner: "bg-green-100 text-green-800 border-green-200",
  converted_intermediate: "bg-green-200 text-green-900 border-green-300",
  converted_advance: "bg-emerald-200 text-emerald-900 border-emerald-300",
  converted: "bg-green-100 text-green-800 border-green-200",
  booking_amount: "bg-yellow-100 text-yellow-800 border-yellow-200",
  not_converted: "bg-red-100 text-red-800 border-red-200",
  not_decided: "bg-orange-100 text-orange-800 border-orange-200",
  so_so: "bg-amber-100 text-amber-800 border-amber-200",
  reschedule: "bg-purple-100 text-purple-800 border-purple-200",
  pending: "bg-gray-100 text-gray-800 border-gray-200",
  refunded: "bg-rose-100 text-rose-800 border-rose-200",
  discontinued: "bg-red-100 text-red-800 border-red-200",
};

const statusLabels: Record<CallStatus, string> = {
  scheduled: "Scheduled",
  converted_beginner: "Converted (Beginner)",
  converted_intermediate: "Converted (Intermediate)",
  converted_advance: "Converted (Advance)",
  converted: "Converted",
  booking_amount: "Booking Amount",
  not_converted: "Not Converted",
  not_decided: "Not Decided",
  so_so: "So-So",
  reschedule: "Reschedule",
  pending: "Pending",
  refunded: "Refunded",
  discontinued: "Discontinued",
};

const ITEMS_PER_PAGE = 10;

// Helper function to format time string (HH:MM:SS) to 12-hour format
const formatTimeString = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Custom sorting: Today → Future (ascending) → Past (descending)
const sortAppointments = (appointments: Appointment[]): Appointment[] => {
  const today: Appointment[] = [];
  const future: Appointment[] = [];
  const past: Appointment[] = [];

  appointments.forEach((apt) => {
    const date = new Date(apt.scheduled_date);
    if (isToday(date)) {
      today.push(apt);
    } else if (isFuture(date)) {
      future.push(apt);
    } else {
      past.push(apt);
    }
  });

  // Sort today by time (earliest first)
  today.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
  
  // Sort future ascending by date, then by time within each date
  future.sort((a, b) => {
    const dateComparison = new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    if (dateComparison !== 0) return dateComparison;
    return a.scheduled_time.localeCompare(b.scheduled_time);
  });
  
  // Sort past descending by date, then by time within each date (earliest first)
  past.sort((a, b) => {
    const dateComparison = new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime();
    if (dateComparison !== 0) return dateComparison;
    return a.scheduled_time.localeCompare(b.scheduled_time);
  });

  return [...today, ...future, ...past];
};

// EMI History Section Component
const EmiHistorySection = ({ appointmentId }: { appointmentId: string }) => {
  const { data: emiPayments, isLoading } = useQuery({
    queryKey: ["emi-payments-inline", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emi_payments")
        .select("*")
        .eq("appointment_id", appointmentId)
        .order("emi_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          EMI Payment History
        </h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!emiPayments || emiPayments.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          EMI Payment History
        </h4>
        <p className="text-sm text-muted-foreground">No EMI payments recorded yet</p>
      </div>
    );
  }

  const totalEmi = emiPayments.reduce((sum, emi) => sum + Number(emi.amount), 0);

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        EMI Payment History
      </h4>
      <div className="rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">EMI #</th>
              <th className="text-left px-4 py-2 font-medium">Amount</th>
              <th className="text-left px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {emiPayments.map((emi) => (
              <tr key={emi.id} className="border-t">
                <td className="px-4 py-2">EMI {emi.emi_number}</td>
                <td className="px-4 py-2 text-green-600">₹{Number(emi.amount).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2">{format(new Date(emi.payment_date), "dd MMM yyyy")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr className="border-t font-medium">
              <td className="px-4 py-2">Total EMI</td>
              <td className="px-4 py-2 text-green-600">₹{totalEmi.toLocaleString("en-IN")}</td>
              <td className="px-4 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

const AllCloserCalls = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Read initial status filter from URL
  const initialStatus = searchParams.get("status") || "all";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [closerFilter, setCloserFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    status: CallStatus;
    offer_amount: number;
    cash_received: number;
    closer_remarks: string;
    batch_id: string | null;
    classes_access: number | null;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rebookingAppointment, setRebookingAppointment] = useState<Appointment | null>(null);
  const [reassigningAppointment, setReassigningAppointment] = useState<Appointment | null>(null);
  const [emiAppointment, setEmiAppointment] = useState<Appointment | null>(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  // Fetch active batches for dropdown
  const { data: batches } = useQuery({
    queryKey: ["batches-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select("id, name, start_date")
        .eq("is_active", true)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all closers for filter dropdown
  const { data: closers } = useQuery({
    queryKey: ["all-closers-dropdown"],
    queryFn: async () => {
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales_rep");

      if (rolesError) throw rolesError;

      const userIds = userRoles.map(ur => ur.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      return profiles;
    },
  });

  const { isAdmin, isManager } = useUserRole();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, closerFilter, dateFilter, customDate]);

  // Fetch all appointments
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["all-closer-appointments"],
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
          was_rescheduled,
          previous_scheduled_date,
          previous_scheduled_time,
          previous_closer_id,
          batch_id,
          classes_access,
          access_given,
          access_given_at,
          previous_closer:profiles!call_appointments_previous_closer_id_fkey(full_name),
          closer:profiles!call_appointments_closer_id_fkey(id, full_name),
          batch:batches(id, name, start_date),
          lead:leads(id, contact_name, email, phone, country, workshop_name)
        `);

      if (error) throw error;

      // Fetch reminders for each appointment
      const appointmentsWithReminders = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: reminders } = await supabase
            .from("call_reminders")
            .select("reminder_type, status, sent_at, reminder_time")
            .eq("appointment_id", apt.id);

          // Get correct workshop name
          let workshopName = null;
          if (apt.lead) {
            const { data: matchedWorkshop } = await supabase
              .rpc('get_workshop_name_for_lead', { p_lead_id: apt.lead.id });
            workshopName = matchedWorkshop || apt.lead.workshop_name || null;
          }

          return {
            ...apt,
            lead: apt.lead ? { ...apt.lead, workshop_name: workshopName } : null,
            reminders: reminders || [],
          };
        })
      );

      return appointmentsWithReminders as Appointment[];
    },
  });

  // Filter and sort appointments
  const processedAppointments = useMemo(() => {
    if (!appointments) return [];

    let filtered = appointments;

    // Filter by closer
    if (closerFilter !== "all") {
      filtered = filtered.filter((apt) => apt.closer?.id === closerFilter);
    }

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "converted") {
        filtered = filtered.filter((apt) => apt.status.startsWith("converted_") || apt.status === "converted");
      } else {
        filtered = filtered.filter((apt) => apt.status === statusFilter);
      }
    }

    // Filter by date
    if (dateFilter !== "all") {
      const today = new Date();
      filtered = filtered.filter((apt) => {
        const date = new Date(apt.scheduled_date);
        switch (dateFilter) {
          case "today":
            return isToday(date);
          case "tomorrow":
            return format(date, "yyyy-MM-dd") === format(addDays(today, 1), "yyyy-MM-dd");
          case "this_week":
            return date >= startOfWeek(today) && date <= endOfWeek(today);
          case "past":
            return isPast(startOfDay(date)) && !isToday(date);
          case "future":
            return isFuture(endOfDay(date)) && !isToday(date);
          case "custom":
            if (customDate) {
              return format(date, "yyyy-MM-dd") === format(customDate, "yyyy-MM-dd");
            }
            return true;
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (apt) =>
          apt.lead?.contact_name?.toLowerCase().includes(query) ||
          apt.lead?.email?.toLowerCase().includes(query) ||
          apt.lead?.phone?.toLowerCase().includes(query)
      );
    }

    // Sort: Today → Future → Past
    return sortAppointments(filtered);
  }, [appointments, closerFilter, statusFilter, dateFilter, customDate, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(processedAppointments.length / ITEMS_PER_PAGE);
  const paginatedAppointments = processedAppointments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const updateMutation = useMutation({
    mutationFn: async (data: { 
      id: string; 
      status: CallStatus; 
      offer_amount: number; 
      cash_received: number; 
      closer_remarks: string;
      batch_id: string | null;
      classes_access: number | null;
    }) => {
      const due_amount = Math.max(0, data.offer_amount - data.cash_received);

      const { error: updateError } = await supabase
        .from("call_appointments")
        .update({
          status: data.status,
          offer_amount: data.offer_amount,
          cash_received: data.cash_received,
          due_amount,
          closer_remarks: data.closer_remarks,
          batch_id: data.batch_id,
          classes_access: data.classes_access,
        })
        .eq("id", data.id);

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-closer-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["sales-closers"] });
      toast({ title: "Updated", description: "Appointment details saved successfully" });
      setEditingId(null);
      setEditData(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("call_reminders").delete().eq("appointment_id", id);
      const { error } = await supabase.from("call_appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-closer-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["sales-closers"] });
      toast({ title: "Deleted", description: "Appointment has been deleted" });
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleRefresh = () => {
    refetch();
    toast({ title: "Refreshed", description: "Appointments data has been refreshed" });
  };

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
      batch_id: apt.batch_id || null,
      classes_access: apt.classes_access || null,
    });
  };

  const handleSave = () => {
    if (!editingId || !editData) return;
    
    if (editData.status === 'scheduled') {
      toast({ 
        title: "Status Required", 
        description: "Please select an outcome status (not 'Scheduled')", 
        variant: "destructive" 
      });
      return;
    }

    const currentAppointment = appointments?.find(apt => apt.id === editingId);
    if (currentAppointment && isNewWorkflow(currentAppointment.scheduled_date) && editData.status === 'converted') {
      if (!editData.classes_access) {
        toast({ 
          title: "Classes Access Required", 
          description: "Please select the number of classes for course access", 
          variant: "destructive" 
        });
        return;
      }
      if (!editData.batch_id) {
        toast({ 
          title: "Batch Required", 
          description: "Please select a batch for the student", 
          variant: "destructive" 
        });
        return;
      }
    }
    
    setShowSaveConfirmation(true);
  };

  const handleConfirmedSave = () => {
    if (!editingId || !editData) return;
    updateMutation.mutate({ id: editingId, ...editData });
    setShowSaveConfirmation(false);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData(null);
  };

  const getPageTitle = () => {
    switch (statusFilter) {
      case "converted": return "All Converted Calls";
      case "not_converted": return "All Not Converted Calls";
      case "reschedule": return "All Rescheduled Calls";
      default: return "All Assigned Calls";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales-closers")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{getPageTitle()}</h1>
          <p className="text-muted-foreground mt-1">
            View and manage calls across all closers
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{getPageTitle()}</CardTitle>
              <CardDescription>
                {processedAppointments.length} calls found
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={closerFilter} onValueChange={setCloserFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue placeholder="Filter by closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Closers</SelectItem>
                {closers?.map((closer) => (
                  <SelectItem key={closer.id} value={closer.id}>{closer.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="converted">All Converted</SelectItem>
                <SelectItem value="converted_beginner">Converted (Beginner)</SelectItem>
                <SelectItem value="converted_intermediate">Converted (Intermediate)</SelectItem>
                <SelectItem value="converted_advance">Converted (Advance)</SelectItem>
                <SelectItem value="booking_amount">Booking Amount</SelectItem>
                <SelectItem value="not_converted">Not Converted</SelectItem>
                <SelectItem value="not_decided">Not Decided</SelectItem>
                <SelectItem value="so_so">So-So</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full lg:w-[200px] justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateFilter === "custom" && customDate
                    ? format(customDate, "PPP")
                    : dateFilter === "all"
                    ? "All Dates"
                    : dateFilter === "today"
                    ? "Today"
                    : dateFilter === "tomorrow"
                    ? "Tomorrow"
                    : dateFilter === "this_week"
                    ? "This Week"
                    : dateFilter === "future"
                    ? "Future Calls"
                    : dateFilter === "past"
                    ? "Past Calls"
                    : "Select Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "all", label: "All" },
                      { value: "today", label: "Today" },
                      { value: "tomorrow", label: "Tomorrow" },
                      { value: "this_week", label: "This Week" },
                      { value: "future", label: "Future" },
                      { value: "past", label: "Past" },
                    ].map((option) => (
                      <Button
                        key={option.value}
                        variant={dateFilter === option.value ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setDateFilter(option.value);
                          setCustomDate(undefined);
                          setIsDatePopoverOpen(false);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Or select a specific date:</p>
                    <CalendarComponent
                      mode="single"
                      selected={customDate}
                      onSelect={(date) => {
                        setCustomDate(date);
                        if (date) {
                          setDateFilter("custom");
                        }
                        setIsDatePopoverOpen(false);
                      }}
                      className="rounded-md border pointer-events-auto"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedAppointments && paginatedAppointments.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Closer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Offer</TableHead>
                      <TableHead className="text-right">Cash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAppointments.map((apt) => (
                      <Collapsible key={apt.id} open={expandedId === apt.id} asChild>
                        <>
                          <TableRow 
                            className={cn(
                              "cursor-pointer hover:bg-muted/50",
                              expandedId === apt.id && "bg-muted/50"
                            )}
                            onClick={() => handleExpand(apt.id)}
                          >
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  {expandedId === apt.id ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-medium">
                              {apt.lead?.contact_name || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {apt.closer?.full_name || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-blue-600">{apt.lead?.email || "N/A"}</span>
                                </div>
                                {apt.lead?.phone && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    {apt.lead.phone}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {format(new Date(apt.scheduled_date), "dd MMM yyyy")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {formatTimeString(apt.scheduled_time)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("border", statusColors[apt.status])}>
                                {statusLabels[apt.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {apt.offer_amount ? `₹${apt.offer_amount.toLocaleString("en-IN")}` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {apt.cash_received ? `₹${apt.cash_received.toLocaleString("en-IN")}` : "-"}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/30 p-0">
                                <div className="p-6 space-y-6">
                                  {/* Customer Details */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground uppercase">Workshop</Label>
                                      <p className="text-sm font-medium">{apt.lead?.workshop_name || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground uppercase">Country</Label>
                                      <p className="text-sm font-medium">{apt.lead?.country || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground uppercase">Due Amount</Label>
                                      <p className="text-sm font-medium text-orange-600">
                                        ₹{(apt.due_amount || 0).toLocaleString("en-IN")}
                                      </p>
                                    </div>
                                    {apt.batch && (
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase">Batch</Label>
                                        <p className="text-sm font-medium">{apt.batch.name}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* EMI History */}
                                  <EmiHistorySection appointmentId={apt.id} />

                                  {/* Edit Form */}
                                  {editingId === apt.id && editData ? (
                                    <div className="space-y-4 border-t pt-4">
                                      <h4 className="font-semibold">Edit Appointment</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                          <Label>Status</Label>
                                          <Select
                                            value={editData.status}
                                            onValueChange={(v) => setEditData({ ...editData, status: v as CallStatus })}
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="scheduled">Scheduled</SelectItem>
                                              <SelectItem value="converted">Converted</SelectItem>
                                              <SelectItem value="converted_beginner">Converted (Beginner)</SelectItem>
                                              <SelectItem value="converted_intermediate">Converted (Intermediate)</SelectItem>
                                              <SelectItem value="converted_advance">Converted (Advance)</SelectItem>
                                              <SelectItem value="booking_amount">Booking Amount</SelectItem>
                                              <SelectItem value="not_converted">Not Converted</SelectItem>
                                              <SelectItem value="not_decided">Not Decided</SelectItem>
                                              <SelectItem value="so_so">So-So</SelectItem>
                                              <SelectItem value="reschedule">Reschedule</SelectItem>
                                              <SelectItem value="pending">Pending</SelectItem>
                                              <SelectItem value="refunded">Refunded</SelectItem>
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
                                        <div className="space-y-2">
                                          <Label>Cash Received (₹)</Label>
                                          <Input
                                            type="number"
                                            value={editData.cash_received}
                                            onChange={(e) => setEditData({ ...editData, cash_received: Number(e.target.value) })}
                                          />
                                        </div>
                                        {isNewWorkflow(apt.scheduled_date) && editData.status === 'converted' && (
                                          <>
                                            <div className="space-y-2">
                                              <Label>Batch</Label>
                                              <Select
                                                value={editData.batch_id || ""}
                                                onValueChange={(v) => setEditData({ ...editData, batch_id: v })}
                                              >
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select batch" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {batches?.map((batch) => (
                                                    <SelectItem key={batch.id} value={batch.id}>
                                                      {batch.name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Classes Access</Label>
                                              <Select
                                                value={editData.classes_access?.toString() || ""}
                                                onValueChange={(v) => setEditData({ ...editData, classes_access: Number(v) })}
                                              >
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select classes" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {CLASSES_ACCESS_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value.toString()}>
                                                      {opt.label}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Closer Remarks</Label>
                                        <Textarea
                                          value={editData.closer_remarks}
                                          onChange={(e) => setEditData({ ...editData, closer_remarks: e.target.value })}
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button onClick={handleSave} disabled={updateMutation.isPending}>
                                          {updateMutation.isPending ? "Saving..." : "Save Changes"}
                                        </Button>
                                        <Button variant="outline" onClick={handleCancel}>
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 border-t pt-4">
                                      <Button onClick={() => handleEdit(apt)}>
                                        Edit Status
                                      </Button>
                                      <Button variant="outline" onClick={() => setRebookingAppointment(apt)}>
                                        <RotateCcw className="h-4 w-4 mr-2" />
                                        Rebook Call
                                      </Button>
                                      <Button variant="outline" onClick={() => setReassigningAppointment(apt)}>
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        Reassign
                                      </Button>
                                      <Button variant="outline" onClick={() => setEmiAppointment(apt)}>
                                        Update EMI
                                      </Button>
                                      {isAdmin && (
                                        <Button variant="destructive" onClick={() => setDeletingId(apt.id)}>
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No calls found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showSaveConfirmation} onOpenChange={setShowSaveConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Save</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedSave}>
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rebook Call Dialog */}
      {rebookingAppointment && (
        <RebookCallDialog
          appointment={{
            id: rebookingAppointment.id,
            scheduled_date: rebookingAppointment.scheduled_date,
            scheduled_time: rebookingAppointment.scheduled_time,
            lead: rebookingAppointment.lead,
          }}
          open={!!rebookingAppointment}
          onOpenChange={(open) => !open && setRebookingAppointment(null)}
          onSuccess={() => {
            setRebookingAppointment(null);
            refetch();
          }}
        />
      )}

      {/* Reassign Call Dialog */}
      {reassigningAppointment && (
        <ReassignCallDialog
          appointment={{
            id: reassigningAppointment.id,
            scheduled_date: reassigningAppointment.scheduled_date,
            scheduled_time: reassigningAppointment.scheduled_time,
            lead: reassigningAppointment.lead,
          }}
          open={!!reassigningAppointment}
          onOpenChange={(open) => !open && setReassigningAppointment(null)}
          onSuccess={() => {
            setReassigningAppointment(null);
            refetch();
          }}
        />
      )}

      {/* Update EMI Dialog */}
      {emiAppointment && (
        <UpdateEmiDialog
          appointmentId={emiAppointment.id}
          offerAmount={emiAppointment.offer_amount || 0}
          cashReceived={emiAppointment.cash_received || 0}
          dueAmount={emiAppointment.due_amount || 0}
          classesAccess={emiAppointment.classes_access}
          batchId={emiAppointment.batch_id}
          customerName={emiAppointment.lead?.contact_name || "Customer"}
          open={!!emiAppointment}
          onOpenChange={(open) => !open && setEmiAppointment(null)}
          onSuccess={() => {
            setEmiAppointment(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default AllCloserCalls;
