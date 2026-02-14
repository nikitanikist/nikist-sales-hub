import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { format } from "date-fns";
import { toast } from "sonner";

export type DateFilter = 'yesterday' | 'today' | 'tomorrow' | 'custom';

export type Appointment = {
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

export type CloserMetrics = {
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

export function useCallsData() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [selectedCloserId, setSelectedCloserId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { isAdmin, isCloser, isManager, profileId, isLoading: roleLoading } = useUserRole();
  const { currentOrganization } = useOrganization();
  const { getToday, getYesterday, getTomorrow, format: formatOrg } = useOrgTimezone();

  const getSelectedDate = () => {
    switch (dateFilter) {
      case 'yesterday': return getYesterday();
      case 'today': return getToday();
      case 'tomorrow': return getTomorrow();
      case 'custom': return formatOrg(customDate, 'yyyy-MM-dd');
      default: return getToday();
    }
  };

  const selectedDate = getSelectedDate();

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["call-appointments", selectedDate, profileId, isCloser, currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];

      let query = supabase
        .from("call_appointments")
        .select(`
          *,
          lead:leads!call_appointments_lead_id_fkey(
            id, contact_name, company_name, email, phone, country
          ),
          closer:profiles!call_appointments_closer_id_fkey(
            id, full_name
          ),
          reminders:call_reminders(
            id, reminder_type, reminder_time, status, sent_at
          )
        `)
        .eq("scheduled_date", selectedDate)
        .eq("organization_id", currentOrganization.id)
        .order("scheduled_time", { ascending: true });

      if (isCloser && !isAdmin && profileId) {
        query = query.eq("closer_id", profileId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Appointment[];
    },
    enabled: !roleLoading && !!currentOrganization,
  });

  // Real-time subscription
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

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, currentOrganization]);

  const { data: closerMetrics } = useQuery<CloserMetrics[]>({
    queryKey: ["closer-metrics", selectedDate, profileId, isCloser, isManager],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_closer_call_metrics', {
        target_date: selectedDate
      });
      if (error) throw error;

      if (isCloser && !isAdmin && profileId) {
        return (data as CloserMetrics[]).filter((c) => c.id === profileId);
      }
      return data as CloserMetrics[];
    },
    enabled: !roleLoading && !isManager,
  });

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

  return {
    dateFilter,
    customDate,
    setCustomDate,
    showDatePicker,
    setShowDatePicker,
    selectedCloserId,
    setSelectedCloserId,
    editingAppointment,
    setEditingAppointment,
    selectedDate,
    appointments,
    isLoading,
    roleLoading,
    closerMetrics,
    isManager,
    updateAppointmentMutation,
    handleDateFilterChange,
    handleSaveAppointment,
    formatOrg,
    setDateFilter,
  };
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'scheduled': return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'rescheduled': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
    case 'no_show': return 'bg-slate-100 text-slate-700 border-slate-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};
