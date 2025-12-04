import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Phone, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface ScheduleCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    contact_name: string;
    email: string;
    phone?: string | null;
  } | null;
  closer: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export const ScheduleCallDialog = ({
  open,
  onOpenChange,
  lead,
  closer,
}: ScheduleCallDialogProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [showCalendar, setShowCalendar] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const scheduleCallMutation = useMutation({
    mutationFn: async () => {
      if (!lead || !closer || !selectedDate) {
        throw new Error("Missing required fields");
      }

      // First, assign the lead to the closer
      const { error: assignError } = await supabase
        .from("leads")
        .update({ assigned_to: closer.id })
        .eq("id", lead.id);

      if (assignError) throw assignError;

      // Create the call appointment
      const { error: appointmentError } = await supabase
        .from("call_appointments")
        .insert({
          lead_id: lead.id,
          closer_id: closer.id,
          scheduled_date: format(selectedDate, "yyyy-MM-dd"),
          scheduled_time: selectedTime,
          status: "scheduled",
          created_by: user?.id,
        });

      if (appointmentError) throw appointmentError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["call-appointments"] });
      toast.success(`Call scheduled with ${closer?.full_name} for ${lead?.contact_name}`);
      onOpenChange(false);
      // Reset form
      setSelectedDate(new Date());
      setSelectedTime("10:00");
    },
    onError: (error: any) => {
      toast.error("Failed to schedule call: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    scheduleCallMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Call</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Customer Info (Read-only) */}
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{lead?.contact_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{lead?.email}</span>
              </div>
              {lead?.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{lead.phone}</span>
                </div>
              )}
            </div>

            {/* Assigned Closer */}
            <div className="space-y-2">
              <Label>Assigned Closer</Label>
              <div className="p-2 bg-primary/10 rounded-md text-sm font-medium">
                {closer?.full_name}
              </div>
            </div>

            {/* Date Picker */}
            <div className="space-y-2">
              <Label>Call Date</Label>
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setShowCalendar(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Picker */}
            <div className="space-y-2">
              <Label htmlFor="call-time">Call Time</Label>
              <Input
                id="call-time"
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={scheduleCallMutation.isPending || !selectedDate}
            >
              {scheduleCallMutation.isPending ? "Scheduling..." : "Schedule Call"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
