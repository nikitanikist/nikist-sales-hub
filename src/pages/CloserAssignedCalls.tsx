import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { RebookCallDialog } from "@/components/RebookCallDialog";
import { ReassignCallDialog } from "@/components/ReassignCallDialog";
import { UpdateEmiDialog } from "@/components/UpdateEmiDialog";
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";

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
  scheduled: "bg-sky-100 text-sky-700 border-sky-200",
  converted_beginner: "bg-emerald-100 text-emerald-700 border-emerald-200",
  converted_intermediate: "bg-emerald-100 text-emerald-700 border-emerald-200",
  converted_advance: "bg-emerald-100 text-emerald-700 border-emerald-200",
  converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  booking_amount: "bg-amber-100 text-amber-700 border-amber-200",
  not_converted: "bg-red-100 text-red-700 border-red-200",
  not_decided: "bg-orange-100 text-orange-700 border-orange-200",
  so_so: "bg-amber-100 text-amber-700 border-amber-200",
  reschedule: "bg-violet-100 text-violet-700 border-violet-200",
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  refunded: "bg-pink-100 text-pink-700 border-pink-200",
  discontinued: "bg-red-100 text-red-700 border-red-200",
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

const reminderTypeOrder = ["two_days", "one_day", "three_hours", "one_hour", "thirty_minutes", "ten_minutes", "we_are_live"];
const reminderTypeLabels: Record<string, string> = {
  two_days: "2 Days",
  one_day: "1 Day",
  three_hours: "3 Hours",
  one_hour: "1 Hour",
  thirty_minutes: "30 Min",
  ten_minutes: "10 Min",
  we_are_live: "We're Live",
};

const ITEMS_PER_PAGE = 10;

// Helper function to format time string (HH:MM:SS) to 12-hour format
const formatTimeString = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Helper function to format reminder time in IST timezone
const formatReminderDateTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    return formatter.format(date) + ' IST';
  } catch {
    return '';
  }
};

// Helper to check if a today's call time has passed
const hasCallTimePassed = (dateStr: string, timeStr: string): boolean => {
  const callDate = new Date(dateStr);
  
  // Only relevant for today's calls
  if (!isToday(callDate)) return false;
  
  // Parse scheduled time (HH:MM:SS format)
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  const callDateTime = new Date();
  callDateTime.setHours(hours, minutes, 0, 0);
  
  return now > callDateTime;
};

// Helper to check if a call is currently in progress (within 1-hour window)
const isCallInProgress = (dateStr: string, timeStr: string, status: CallStatus): boolean => {
  // If status is no longer 'scheduled', the call is done - not live
  if (status !== 'scheduled') return false;
  
  const callDate = new Date(dateStr);
  
  // Only relevant for today's calls
  if (!isToday(callDate)) return false;
  
  // Parse scheduled time (HH:MM:SS format)
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  
  const callStart = new Date();
  callStart.setHours(hours, minutes, 0, 0);
  
  const callEnd = new Date();
  callEnd.setHours(hours + 1, minutes, 0, 0); // 1 hour duration
  
  return now >= callStart && now < callEnd;
};

// Helper to check if a call is overdue (past date + still scheduled)
const isOverdueCall = (dateStr: string, status: CallStatus): boolean => {
  const callDate = new Date(dateStr);
  return isPast(startOfDay(callDate)) && !isToday(callDate) && status === 'scheduled';
};

// Helper to check if today's call is overdue (past the 1-hour window + still scheduled)
const isTodayCallOverdue = (dateStr: string, timeStr: string, status: CallStatus): boolean => {
  // Only applies to scheduled calls
  if (status !== 'scheduled') return false;
  
  const callDate = new Date(dateStr);
  
  // Only relevant for today's calls
  if (!isToday(callDate)) return false;
  
  // Parse scheduled time (HH:MM:SS format)
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  
  // Call ends 1 hour after start time
  const callEnd = new Date();
  callEnd.setHours(hours + 1, minutes, 0, 0);
  
  // Overdue if current time is past the call end time
  return now >= callEnd;
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
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
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

const CloserAssignedCalls = () => {
  const { closerId } = useParams<{ closerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const { getToday, format: formatOrg, toOrgTime } = useOrgTimezone();
  // Read initial status filter from URL
  const initialStatus = searchParams.get("status") || "all";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
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
    queryKey: ["batches-dropdown", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("batches")
        .select("id, name, start_date")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { isAdmin, isManager } = useUserRole();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter, customDate]);

  // Fetch closer profile (including email for Adesh detection)
  const { data: closer } = useQuery({
    queryKey: ["closer-profile", closerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", closerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!closerId,
  });

  // Fetch appointments
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["closer-appointments", closerId, currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
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
          batch:batches(id, name, start_date),
          lead:leads(id, contact_name, email, phone, country, workshop_name)
        `)
        .eq("closer_id", closerId!)
        .eq("organization_id", currentOrganization.id);

      if (error) throw error;

      // Fetch reminders for each appointment and smart-match workshop names
      const appointmentsWithReminders = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: reminders } = await supabase
            .from("call_reminders")
            .select("reminder_type, status, sent_at, reminder_time")
            .eq("appointment_id", apt.id);

          // Always use the database function to get correct workshop name
          // (prioritizes lead_assignments over leads.workshop_name)
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
    enabled: !!closerId && !!currentOrganization,
  });

  // Filter and sort appointments
  const processedAppointments = useMemo(() => {
    if (!appointments) return [];

    let filtered = appointments;

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
  }, [appointments, statusFilter, dateFilter, customDate, searchQuery]);

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

      // Step 1: Update the appointment in the database
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

      // Step 2: Fetch fresh appointment data directly from DB (authoritative source)
      const { data: freshAppointment, error: fetchError } = await supabase
        .from("call_appointments")
        .select(`
          id,
          scheduled_date,
          scheduled_time,
          status,
          offer_amount,
          cash_received,
          due_amount,
          classes_access,
          batch:batches(id, name, start_date),
          lead:leads(id, contact_name, email, phone)
        `)
        .eq("id", data.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching fresh appointment:', fetchError);
        throw fetchError;
      }

      if (!freshAppointment) {
        throw new Error('Could not fetch updated appointment');
      }

      // Step 3: Sync to cohort_students if status is converted and has a batch
      const convertedStatuses: CallStatus[] = ['converted', 'converted_beginner', 'converted_intermediate', 'converted_advance', 'booking_amount'];
      
      if (convertedStatuses.includes(data.status) && data.batch_id && freshAppointment.lead) {
        // Check if the batch_id is a cohort_batch (not a regular batch)
        const { data: cohortBatch } = await supabase
          .from("cohort_batches")
          .select("id")
          .eq("id", data.batch_id)
          .maybeSingle();
        
        if (cohortBatch) {
          // This is a cohort batch - sync to cohort_students
          const { data: existingStudent } = await supabase
            .from("cohort_students")
            .select("id")
            .eq("lead_id", freshAppointment.lead.id)
            .eq("cohort_batch_id", data.batch_id)
            .maybeSingle();

          if (existingStudent) {
            // Update existing cohort student
            await supabase
              .from("cohort_students")
              .update({
                offer_amount: data.offer_amount,
                cash_received: data.cash_received,
                due_amount,
                classes_access: data.classes_access,
                closer_id: closerId,
              })
              .eq("id", existingStudent.id);
          } else {
            // Create new cohort student
            await supabase
              .from("cohort_students")
              .insert({
                cohort_batch_id: data.batch_id,
                organization_id: currentOrganization?.id,
                lead_id: freshAppointment.lead.id,
                conversion_date: freshAppointment.scheduled_date,
                offer_amount: data.offer_amount,
                cash_received: data.cash_received,
                due_amount,
                classes_access: data.classes_access,
                closer_id: closerId,
                status: 'active',
              });
          }
        }
      }

      // Step 4: Send to Pabbly webhook with fresh data
      if (freshAppointment.lead) {
        const isNewFlow = isNewWorkflow(freshAppointment.scheduled_date);
        
        const basePayload = {
          customer_name: freshAppointment.lead.contact_name,
          customer_email: freshAppointment.lead.email,
          customer_phone: freshAppointment.lead.phone,
          status: freshAppointment.status,
          offer_amount: freshAppointment.offer_amount,
          cash_received: freshAppointment.cash_received,
          due_amount: freshAppointment.due_amount,
          call_date: freshAppointment.scheduled_date,
          closer_name: closer?.full_name || 'Unknown'
        };
        
        // For new workflow converted calls, include batch info from fresh DB data
        if (isNewFlow && freshAppointment.status === 'converted') {
          // Validate required fields before sending
          if (!freshAppointment.batch?.start_date) {
            throw new Error('Batch start date is required for converted calls. Please ensure a batch is selected.');
          }
          if (!freshAppointment.classes_access) {
            throw new Error('Classes access is required for converted calls. Please select the number of classes.');
          }
          
          const payload = {
            ...basePayload,
            batch_name: freshAppointment.batch.name,
            batch_start_date: freshAppointment.batch.start_date,
            classes_access: freshAppointment.classes_access,
            use_new_webhook: true
          };
          
          console.log('Sending to Pabbly (NEW workflow):', JSON.stringify(payload, null, 2));
          
          const { error: pabblyError } = await supabase.functions.invoke('send-status-to-pabbly', { body: payload });
          if (pabblyError) {
            console.error('Pabbly webhook error:', pabblyError);
            // Don't throw - DB update succeeded, just log the error
          } else {
            console.log('Successfully sent to Pabbly (new webhook)');
          }
        } else {
          // Old workflow or non-converted status
          const payload = {
            ...basePayload,
            use_new_webhook: false
          };
          
          console.log('Sending to Pabbly (OLD workflow):', JSON.stringify(payload, null, 2));
          
          const { error: pabblyError } = await supabase.functions.invoke('send-status-to-pabbly', { body: payload });
          if (pabblyError) {
            console.error('Pabbly webhook error:', pabblyError);
          } else {
            console.log('Successfully sent to Pabbly (old webhook)');
          }
        }
      }

      return freshAppointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-appointments", closerId] });
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
      // First delete related reminders
      await supabase.from("call_reminders").delete().eq("appointment_id", id);
      
      // Then delete the appointment
      const { error } = await supabase.from("call_appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-appointments", closerId] });
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

    // For new workflow "converted" status, validate required fields
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
    
    // Show confirmation dialog instead of saving directly
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

  const getReminderIcon = (status: ReminderStatus | null) => {
    switch (status) {
      case "sent":
        return <Check className="h-4 w-4 text-green-600" />;
      case "failed":
        return <X className="h-4 w-4 text-red-600" />;
      case "skipped":
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
      case "pending":
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  // Organization loading/empty state
  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  if (!currentOrganization) {
    return (
      <EmptyState
        icon={Phone}
        title="No Organization Selected"
        description="Please select an organization to view calls data."
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageIntro
        icon={Phone}
        tagline="Your Assigned Calls"
        description="Manage and track your personal call queue."
        variant="sky"
      />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales-closers")} className="w-fit">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <p className="text-sm text-muted-foreground">
          {closer?.full_name || <span className="inline-block h-4 w-24 bg-muted animate-pulse rounded" />}
        </p>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">
                {statusFilter === 'converted' ? 'All Converted Calls' : 
                 statusFilter === 'not_converted' ? 'All Not Converted Calls' : 
                 statusFilter === 'reschedule' ? 'All Rescheduled Calls' : 'All Assigned Calls'}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {processedAppointments.length} calls found
              </CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
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
                    className="flex-1 sm:flex-none sm:w-[180px] justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    <span className="truncate">
                      {dateFilter === "custom" && customDate
                        ? format(customDate, "PP")
                        : dateFilter === "all"
                        ? "All Dates"
                        : dateFilter === "today"
                        ? "Today"
                        : dateFilter === "tomorrow"
                        ? "Tomorrow"
                        : dateFilter === "this_week"
                        ? "This Week"
                        : dateFilter === "future"
                        ? "Future"
                        : dateFilter === "past"
                        ? "Past"
                        : "Select"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0" 
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  collisionPadding={10}
                  avoidCollisions={true}
                >
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
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
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
                      <TableHead>Contact</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Classes</TableHead>
                      {!isManager && (
                        <>
                          <TableHead className="text-right">Offer ₹</TableHead>
                          <TableHead className="text-right">Cash ₹</TableHead>
                          <TableHead className="text-right">Due ₹</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAppointments.map((apt) => (
                      <Collapsible key={apt.id} asChild open={expandedId === apt.id}>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow
                              className={cn(
                                "cursor-pointer",
                                (isOverdueCall(apt.scheduled_date, apt.status) || isTodayCallOverdue(apt.scheduled_date, apt.scheduled_time, apt.status))
                                  ? "animate-overdue-pulse border-l-4 border-l-red-500"
                                  : isCallInProgress(apt.scheduled_date, apt.scheduled_time, apt.status)
                                    ? "animate-live-pulse"
                                    : isToday(new Date(apt.scheduled_date))
                                      ? hasCallTimePassed(apt.scheduled_date, apt.scheduled_time)
                                        ? "bg-green-50 hover:bg-green-100"
                                        : "bg-yellow-50 hover:bg-yellow-100"
                                      : "hover:bg-muted/50"
                              )}
                              onClick={() => handleExpand(apt.id)}
                            >
                              <TableCell>
                                {expandedId === apt.id ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <div className="flex items-center flex-wrap gap-1">
                                    {(isOverdueCall(apt.scheduled_date, apt.status) || isTodayCallOverdue(apt.scheduled_date, apt.scheduled_time, apt.status)) && (
                                      <Badge className="mr-1 bg-red-500 text-white border-red-500 flex items-center gap-1 animate-pulse">
                                        <AlertCircle className="h-3 w-3" />
                                        Update Status
                                      </Badge>
                                    )}
                                    {isCallInProgress(apt.scheduled_date, apt.scheduled_time, apt.status) && (
                                      <Badge className="mr-2 bg-red-500 text-white border-red-500 flex items-center gap-1 animate-pulse">
                                        <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                                        LIVE
                                      </Badge>
                                    )}
                                    {apt.lead?.contact_name || "Unknown"}
                                    {isToday(new Date(apt.scheduled_date)) && !isCallInProgress(apt.scheduled_date, apt.scheduled_time, apt.status) && (
                                      <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">Today</Badge>
                                    )}
                                  </div>
                                  {apt.was_rescheduled && apt.previous_scheduled_date && apt.previous_scheduled_time && (
                                    <span className="text-xs text-purple-600 mt-0.5 flex items-center gap-1">
                                      <RotateCcw className="h-3 w-3" />
                                      Rescheduled from {format(new Date(apt.previous_scheduled_date), "dd MMM")} {formatTimeString(apt.previous_scheduled_time)}
                                    </span>
                                  )}
                                  {apt.lead?.workshop_name && (
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                      {apt.lead.workshop_name}
                                    </span>
                                  )}
                                  {apt.previous_closer?.full_name && (
                                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 mt-0.5 w-fit">
                                      Previously: {apt.previous_closer.full_name}
                                    </Badge>
                                  )}
                                  {apt.batch?.name && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 mt-0.5 w-fit">
                                      {apt.batch.name}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {apt.lead?.email && (
                                    <div className="text-sm text-blue-600">{apt.lead.email}</div>
                                  )}
                                  {apt.lead?.phone && (
                                    <div className="text-sm text-blue-600">{apt.lead.phone}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{format(new Date(apt.scheduled_date), "dd MMM yyyy")}</TableCell>
                              <TableCell>{formatTimeString(apt.scheduled_time)}</TableCell>
                              <TableCell>
                                <Badge className={statusColors[apt.status]}>{statusLabels[apt.status]}</Badge>
                              </TableCell>
                              <TableCell>
                                {apt.classes_access ? (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    {apt.classes_access === 15 ? "All Classes" : `${apt.classes_access} Classes`}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              {!isManager && (
                                <>
                                  <TableCell className="text-right">
                                    ₹{(apt.offer_amount || 0).toLocaleString("en-IN")}
                                  </TableCell>
                                  <TableCell className="text-right text-green-600">
                                    ₹{(apt.cash_received || 0).toLocaleString("en-IN")}
                                  </TableCell>
                                  <TableCell className="text-right text-red-600">
                                    ₹{(apt.due_amount || 0).toLocaleString("en-IN")}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={isManager ? 6 : 9} className="bg-muted/30 p-0">
                                <div className="p-6 space-y-6">
                                  {/* Contact Info - Read Only */}
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                      Contact Details
                                    </h4>
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
                                      {apt.lead?.country && (
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Country:</span> {apt.lead.country}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* EMI Payment History - Only show for converted calls */}
                                  {(apt.status === 'converted' || ['converted_beginner', 'converted_intermediate', 'converted_advance'].includes(apt.status)) && (
                                    <EmiHistorySection appointmentId={apt.id} />
                                  )}

                                  {/* Reminder Timeline */}
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                      Reminder Timeline
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                      {reminderTypeOrder.map((type) => {
                                        const reminder = apt.reminders.find((r) => r.reminder_type === type);
                                        return (
                                          <div
                                            key={type}
                                            className="flex flex-col items-center gap-1 px-3 py-2 bg-background rounded border text-xs"
                                          >
                                            <div className="flex items-center gap-1">
                                              {reminder ? getReminderIcon(reminder.status) : <AlertCircle className="h-4 w-4 text-gray-400" />}
                                              <span>{reminderTypeLabels[type]}</span>
                                            </div>
                                            {reminder?.reminder_time && (
                                              <span className="text-muted-foreground text-[10px]">
                                                {formatReminderDateTime(reminder.reminder_time)}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Editable Fields */}
                                  <div className="space-y-4">
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                      Call Details
                                    </h4>

                                    {editingId === apt.id && editData ? (
                                      <div className="space-y-4">
                                        <div className={cn("grid gap-4", isManager ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
                                          <div className="space-y-2">
                                            <Label>Status <span className="text-red-500">*</span></Label>
                                            <Select
                                              value={editData.status}
                                              onValueChange={(value) => setEditData({ ...editData, status: value as CallStatus })}
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                                {isNewWorkflow(apt.scheduled_date) ? (
                                                  <SelectItem value="converted">Converted</SelectItem>
                                                ) : (
                                                  <>
                                                    <SelectItem value="converted_beginner">Converted (Beginner)</SelectItem>
                                                    <SelectItem value="converted_intermediate">Converted (Intermediate)</SelectItem>
                                                    <SelectItem value="converted_advance">Converted (Advance)</SelectItem>
                                                  </>
                                                )}
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
                                          {/* New workflow fields for converted status */}
                                          {isNewWorkflow(apt.scheduled_date) && editData.status === 'converted' && (
                                            <>
                                              <div className="space-y-2">
                                                <Label>Classes Access <span className="text-red-500">*</span></Label>
                                                <Select
                                                  value={editData.classes_access?.toString() || ""}
                                                  onValueChange={(value) => setEditData({ ...editData, classes_access: parseInt(value) })}
                                                >
                                                  <SelectTrigger>
                                                    <SelectValue placeholder="Select classes" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {CLASSES_ACCESS_OPTIONS.map((opt) => (
                                                      <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              <div className="space-y-2">
                                                <Label>Batch <span className="text-red-500">*</span></Label>
                                                <Select
                                                  value={editData.batch_id || ""}
                                                  onValueChange={(value) => setEditData({ ...editData, batch_id: value })}
                                                >
                                                  <SelectTrigger>
                                                    <SelectValue placeholder="Select batch" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {batches?.map((batch) => (
                                                      <SelectItem key={batch.id} value={batch.id}>
                                                        {batch.name} - {format(new Date(batch.start_date), "dd MMM")}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </>
                                          )}
                                          {!isManager && (
                                            <>
                                              <div className="space-y-2">
                                                <Label>Offer Amount (₹) <span className="text-red-500">*</span></Label>
                                                <Input
                                                  type="number"
                                                  value={editData.offer_amount}
                                                  onChange={(e) => setEditData({ ...editData, offer_amount: Number(e.target.value) })}
                                                />
                                              </div>
                                              <div className="space-y-2">
                                                <Label>Cash Received (₹) <span className="text-red-500">*</span></Label>
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
                                            </>
                                          )}
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
                                        {apt.closer_remarks && (
                                          <div className="text-sm">
                                            <span className="text-muted-foreground">Remarks:</span> {apt.closer_remarks}
                                          </div>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                          {(apt.status === 'converted' || ['converted_beginner', 'converted_intermediate', 'converted_advance'].includes(apt.status)) ? (
                                            <Button size="sm" variant="outline" onClick={() => setEmiAppointment(apt)}>
                                              Update EMI & Course Access
                                            </Button>
                                          ) : (
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(apt)}>
                                              Update Status
                                            </Button>
                                          )}
                                          {(apt.status === 'scheduled' || apt.status === 'reschedule') && (
                                            <Button 
                                              size="sm" 
                                              variant="secondary"
                                              onClick={() => setReassigningAppointment(apt)}
                                            >
                                              <UserPlus className="h-4 w-4 mr-1" />
                                              Reassign
                                            </Button>
                                          )}
                                          {apt.status === 'reschedule' && (
                                            <Button 
                                              size="sm" 
                                              variant="default"
                                              onClick={() => setRebookingAppointment(apt)}
                                              className="bg-primary hover:bg-primary/90"
                                            >
                                              <RotateCcw className="h-4 w-4 mr-1" />
                                              Book Call Again
                                            </Button>
                                          )}
                                          {isAdmin && (
                                            <Button 
                                              size="sm" 
                                              variant="destructive" 
                                              onClick={() => setDeletingId(apt.id)}
                                            >
                                              <Trash2 className="h-4 w-4 mr-1" />
                                              Delete
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
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
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, processedAppointments.length)} of {processedAppointments.length} calls
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first, last, current, and adjacent pages
                          return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                        })
                        .map((page, idx, arr) => (
                          <PaginationItem key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="px-2">...</span>
                            )}
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
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={Phone}
              title="No assigned calls"
              description="This closer has no calls matching your current filters."
            />
          )}
        </CardContent>
      </Card>

      {/* Status Update Confirmation Dialog */}
      <AlertDialog open={showSaveConfirmation} onOpenChange={(open) => !open && setShowSaveConfirmation(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Update</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {(() => {
                  const apt = appointments?.find(a => a.id === editingId);
                  return (
                    <>
                      <div className="text-sm">
                        <span className="font-medium">Customer:</span> {apt?.lead?.contact_name || "Unknown"}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Email:</span> {apt?.lead?.email || "N/A"}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">New Status:</span>{" "}
                        <Badge className={editData?.status ? statusColors[editData.status] : ""}>
                          {editData?.status ? statusLabels[editData.status] : ""}
                        </Badge>
                      </div>
                      {!isManager && editData && (
                        <>
                          <div className="text-sm">
                            <span className="font-medium">Offer Amount:</span> ₹{editData.offer_amount.toLocaleString("en-IN")}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Cash Received:</span> ₹{editData.cash_received.toLocaleString("en-IN")}
                          </div>
                        </>
                      )}
                      <p className="text-muted-foreground mt-2">
                        Are you sure you want to save these changes? This action will trigger notifications to the customer.
                      </p>
                    </>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Confirm Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this call appointment and all its reminders. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rebook Call Dialog */}
      {rebookingAppointment && (
        <RebookCallDialog
          open={!!rebookingAppointment}
          onOpenChange={(open) => !open && setRebookingAppointment(null)}
          appointment={{
            id: rebookingAppointment.id,
            scheduled_date: rebookingAppointment.scheduled_date,
            scheduled_time: rebookingAppointment.scheduled_time,
            lead: rebookingAppointment.lead,
          }}
          closer={closer ? { id: closer.id, full_name: closer.full_name, email: closer.email } : null}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["sales-closers"] });
            queryClient.invalidateQueries({ queryKey: ["adesh-booked-slots-rebook"] });
            queryClient.invalidateQueries({ queryKey: ["adesh-booked-slots"] });
          }}
        />
      )}

      {/* Reassign Call Dialog */}
      {reassigningAppointment && (
        <ReassignCallDialog
          open={!!reassigningAppointment}
          onOpenChange={(open) => !open && setReassigningAppointment(null)}
          appointment={{
            id: reassigningAppointment.id,
            scheduled_date: reassigningAppointment.scheduled_date,
            scheduled_time: reassigningAppointment.scheduled_time,
            lead: reassigningAppointment.lead,
          }}
          currentCloser={closer ? { id: closer.id, full_name: closer.full_name, email: closer.email } : null}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["sales-closers"] });
          }}
        />
      )}

      {/* Update EMI Dialog */}
      {emiAppointment && (
        <UpdateEmiDialog
          open={!!emiAppointment}
          onOpenChange={(open) => !open && setEmiAppointment(null)}
          appointmentId={emiAppointment.id}
          offerAmount={emiAppointment.offer_amount || 0}
          cashReceived={emiAppointment.cash_received || 0}
          dueAmount={emiAppointment.due_amount || 0}
          classesAccess={emiAppointment.classes_access}
          batchId={emiAppointment.batch_id}
          customerName={emiAppointment.lead?.contact_name || "Customer"}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["sales-closers"] });
          }}
        />
      )}
    </div>
  );
};

export default CloserAssignedCalls;
