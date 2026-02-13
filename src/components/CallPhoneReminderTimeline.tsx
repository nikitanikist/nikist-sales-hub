import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Clock, X, Loader2, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CallPhoneReminderTimelineProps {
  appointmentId: string;
  closerId: string | null;
  organizationId: string;
}

const formatReminderTime = (isoString: string): string => {
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
    return formatter.format(date);
  } catch {
    return '';
  }
};

export function CallPhoneReminderTimeline({ appointmentId, closerId, organizationId }: CallPhoneReminderTimelineProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch call phone reminders for this appointment
  const { data: reminders, isLoading } = useQuery({
    queryKey: ["call-phone-reminders", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_phone_reminders" as any)
        .select(`
          id,
          reminder_time,
          status,
          completed_at,
          completed_by,
          reminder_type_id
        `)
        .eq("appointment_id", appointmentId)
        .order("reminder_time", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!appointmentId,
  });

  // Fetch reminder type labels
  const { data: reminderTypes } = useQuery({
    queryKey: ["call-phone-reminder-types-for-timeline", closerId, organizationId],
    queryFn: async () => {
      if (!closerId) return [];
      const { data, error } = await supabase
        .from("call_phone_reminder_types" as any)
        .select("id, label, offset_type, offset_value, display_order")
        .eq("closer_id", closerId)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!closerId && !!organizationId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ reminderId, newStatus }: { reminderId: string; newStatus: string }) => {
      const updateData: any = { status: newStatus };
      if (newStatus === 'done') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id || null;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }
      const { error } = await supabase
        .from("call_phone_reminders" as any)
        .update(updateData)
        .eq("id", reminderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-phone-reminders", appointmentId] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update reminder", description: error.message, variant: "destructive" });
    },
  });

  // Don't render if no reminders configured
  if (!reminders || reminders.length === 0) return null;

  // Build a map of type id -> label
  const typeLabels: Record<string, string> = {};
  reminderTypes?.forEach((rt: any) => {
    typeLabels[rt.id] = rt.label;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <Check className="h-4 w-4 text-emerald-600" />;
      case 'skipped': return <X className="h-4 w-4 text-gray-400" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'done': return 'border-emerald-200 bg-emerald-50';
      case 'skipped': return 'border-gray-200 bg-gray-50';
      default: return 'border-amber-200 bg-amber-50';
    }
  };

  const handleClick = (reminder: any) => {
    if (reminder.status === 'skipped') return;
    const newStatus = reminder.status === 'done' ? 'pending' : 'done';
    toggleMutation.mutate({ reminderId: reminder.id, newStatus });
  };

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <PhoneCall className="h-3.5 w-3.5" />
        Call Reminder Timeline
      </h4>
      <div className="flex flex-wrap gap-2">
        {reminders.map((reminder: any) => (
          <button
            key={reminder.id}
            onClick={() => handleClick(reminder)}
            disabled={reminder.status === 'skipped' || toggleMutation.isPending}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded border text-xs transition-colors",
              getStatusClass(reminder.status),
              reminder.status !== 'skipped' && "cursor-pointer hover:shadow-sm",
              reminder.status === 'skipped' && "opacity-60 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-1">
              {getStatusIcon(reminder.status)}
              <span className="font-medium">{typeLabels[reminder.reminder_type_id] || "Reminder"}</span>
            </div>
            {reminder.reminder_time && (
              <span className="text-muted-foreground text-[10px]">
                {formatReminderTime(reminder.reminder_time)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
