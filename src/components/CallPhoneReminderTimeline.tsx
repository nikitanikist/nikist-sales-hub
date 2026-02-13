import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Clock, X, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
  const [selectedReminder, setSelectedReminder] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [reasonError, setReasonError] = useState(false);

  const { data: reminders } = useQuery({
    queryKey: ["call-phone-reminders", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_phone_reminders" as any)
        .select(`id, reminder_time, status, completed_at, completed_by, reminder_type_id, skip_reason`)
        .eq("appointment_id", appointmentId)
        .order("reminder_time", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!appointmentId,
  });

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

  const updateMutation = useMutation({
    mutationFn: async ({ reminderId, newStatus, reason }: { reminderId: string; newStatus: string; reason?: string }) => {
      const updateData: any = { status: newStatus };
      if (newStatus === 'done') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id || null;
        updateData.skip_reason = null;
      } else if (newStatus === 'skipped') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id || null;
        updateData.skip_reason = reason || null;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
        updateData.skip_reason = null;
      }
      const { error } = await supabase
        .from("call_phone_reminders" as any)
        .update(updateData)
        .eq("id", reminderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-phone-reminders", appointmentId] });
      setDialogOpen(false);
      setSelectedReminder(null);
      setSkipReason("");
      setReasonError(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update reminder", description: error.message, variant: "destructive" });
    },
  });

  if (!reminders || reminders.length === 0) return null;

  const typeLabels: Record<string, string> = {};
  reminderTypes?.forEach((rt: any) => {
    typeLabels[rt.id] = rt.label;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <Check className="h-4 w-4 text-emerald-600" />;
      case 'skipped': return <X className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'done': return 'border-emerald-200 bg-emerald-50';
      case 'skipped': return 'border-red-200 bg-red-50';
      default: return 'border-amber-200 bg-amber-50';
    }
  };

  const handleCardClick = (reminder: any) => {
    setSelectedReminder(reminder);
    setSkipReason("");
    setReasonError(false);
    setDialogOpen(true);
  };

  const handleDone = () => {
    if (!selectedReminder) return;
    updateMutation.mutate({ reminderId: selectedReminder.id, newStatus: 'done' });
  };

  const handleNotDone = () => {
    if (!selectedReminder) return;
    if (!skipReason.trim()) {
      setReasonError(true);
      return;
    }
    updateMutation.mutate({ reminderId: selectedReminder.id, newStatus: 'skipped', reason: skipReason.trim() });
  };

  const handleResetToPending = () => {
    if (!selectedReminder) return;
    updateMutation.mutate({ reminderId: selectedReminder.id, newStatus: 'pending' });
  };

  return (
    <>
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <PhoneCall className="h-3.5 w-3.5" />
          Call Reminder Timeline
        </h4>
        <div className="flex flex-wrap gap-2">
          {reminders.map((reminder: any) => (
            <button
              key={reminder.id}
              onClick={() => handleCardClick(reminder)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded border text-xs transition-colors cursor-pointer hover:shadow-sm",
                getStatusClass(reminder.status)
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
              {reminder.status === 'skipped' && reminder.skip_reason && (
                <span className="text-[10px] text-red-600 max-w-[120px] truncate" title={reminder.skip_reason}>
                  {reminder.skip_reason}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedReminder ? (typeLabels[selectedReminder.reminder_type_id] || "Reminder") : "Reminder"}
            </DialogTitle>
          </DialogHeader>

          {selectedReminder && (selectedReminder.status === 'done' || selectedReminder.status === 'skipped') ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This reminder is marked as <span className="font-medium">{selectedReminder.status === 'done' ? 'Done' : 'Not Done'}</span>.
              </p>
              {selectedReminder.skip_reason && (
                <div className="text-sm">
                  <span className="font-medium">Reason:</span> {selectedReminder.skip_reason}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleResetToPending} disabled={updateMutation.isPending}>
                  Reset to Pending
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Was this call reminder completed?</p>

              <div className="space-y-2">
                <Label className="text-xs">Reason (required if Not Done)</Label>
                <Textarea
                  placeholder="Why was the call not made?"
                  value={skipReason}
                  onChange={(e) => { setSkipReason(e.target.value); setReasonError(false); }}
                  className={cn("min-h-[60px]", reasonError && "border-red-500")}
                />
                {reasonError && <p className="text-xs text-red-500">Please provide a reason</p>}
              </div>

              <DialogFooter className="flex gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={handleNotDone}
                  disabled={updateMutation.isPending}
                  className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Not Done
                </Button>
                <Button
                  onClick={handleDone}
                  disabled={updateMutation.isPending}
                  className="gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}