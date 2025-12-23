import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Phone, Mail, User, Video, ExternalLink } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

// Dipanshu's configuration for Calendly webhook integration
const DIPANSHU_EMAIL = "nikistofficial@gmail.com";
const DIPANSHU_CALENDLY_URL = "https://calendly.com/nikist/1-1-call-with-dipanshu-malasi-clone";

// Adesh's configuration for direct Zoom API integration
const ADESH_EMAIL = "aadeshnikist@gmail.com";

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

  // Check closer types
  const isDipanshu = closer?.email?.toLowerCase() === DIPANSHU_EMAIL.toLowerCase();
  const isAdesh = closer?.email?.toLowerCase() === ADESH_EMAIL.toLowerCase();

  const scheduleCallMutation = useMutation({
    mutationFn: async () => {
      if (!lead || !closer || !selectedDate) {
        throw new Error("Missing required fields");
      }

      const scheduledDate = format(selectedDate, "yyyy-MM-dd");

      // Determine which edge function to call based on closer
      const edgeFunctionName = isAdesh ? "schedule-adesh-call" : "schedule-calendly-call";

      // Call the appropriate edge function
      const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
        body: {
          lead_id: lead.id,
          closer_id: closer.id,
          scheduled_date: scheduledDate,
          scheduled_time: selectedTime,
          user_id: user?.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      queryClient.invalidateQueries({ queryKey: ["call-appointments"] });
      
      if (data?.zoom_link) {
        toast.success(`Call scheduled with ${closer?.full_name}. Zoom meeting created!`);
      } else if (data?.calendly) {
        toast.success(`Call scheduled with ${closer?.full_name}. Calendly booking created.`);
      } else {
        toast.success(`Call scheduled with ${closer?.full_name} for ${lead?.contact_name}`);
      }
      
      if (data?.whatsapp_sent) {
        toast.info("WhatsApp booking confirmation sent to customer!");
      }
      
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
              <div className="p-2 bg-primary/10 rounded-md text-sm font-medium flex items-center justify-between">
                <span>{closer?.full_name}</span>
                {isDipanshu && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                    <Video className="h-3 w-3" />
                    Calendly + WhatsApp
                  </span>
                )}
                {isAdesh && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                    <Video className="h-3 w-3" />
                    Zoom + WhatsApp
                  </span>
                )}
              </div>
            </div>

            {/* Dipanshu: Show Calendly booking message instead of date/time pickers */}
            {isDipanshu ? (
              <div className="space-y-4">
                <Alert className="bg-blue-500/10 border-blue-500/30">
                  <Video className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-sm">
                    For Dipanshu, please book calls directly in Calendly. The booking will sync automatically to this CRM with Zoom link and WhatsApp reminders.
                  </AlertDescription>
                </Alert>
                
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => window.open(DIPANSHU_CALENDLY_URL, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Calendly to Book Call
                </Button>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {!isDipanshu && (
              <Button
                type="submit"
                disabled={scheduleCallMutation.isPending || !selectedDate}
              >
                {scheduleCallMutation.isPending ? "Scheduling..." : "Schedule Call"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
