import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Phone, Mail, User, Video, ExternalLink, Clock, Loader2 } from "lucide-react";
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

// Time slots for Aadesh (90-minute intervals from 9:00 AM to 10:30 PM)
const TIME_SLOTS = [
  "09:00",  // 9:00 AM
  "10:30",  // 10:30 AM
  "12:00",  // 12:00 PM
  "13:30",  // 1:30 PM
  "15:00",  // 3:00 PM
  "16:30",  // 4:30 PM
  "18:00",  // 6:00 PM
  "19:30",  // 7:30 PM
  "21:00",  // 9:00 PM
  "22:30",  // 10:30 PM
];

// Helper to format time for display (e.g., "09:00" -> "9:00 AM")
const formatTimeDisplay = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

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
  const [selectedTime, setSelectedTime] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check closer types
  const isDipanshu = closer?.email?.toLowerCase() === DIPANSHU_EMAIL.toLowerCase();
  const isAdesh = closer?.email?.toLowerCase() === ADESH_EMAIL.toLowerCase();

  // Fetch booked slots for Aadesh on selected date
  const { data: bookedSlots, isLoading: isLoadingSlots } = useQuery({
    queryKey: ["adesh-booked-slots", closer?.id, selectedDate ? format(selectedDate, "yyyy-MM-dd") : null],
    queryFn: async () => {
      if (!closer?.id || !selectedDate) return [];
      
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("call_appointments")
        .select("scheduled_time")
        .eq("closer_id", closer.id)
        .eq("scheduled_date", dateStr)
        .in("status", ["scheduled", "pending", "reschedule"]);
      
      if (error) throw error;
      
      // Return array of booked time strings (e.g., ["10:00:00", "14:30:00"])
      return data?.map(apt => apt.scheduled_time.slice(0, 5)) || [];
    },
    enabled: isAdesh && !!closer?.id && !!selectedDate && open,
  });

  // Get available and booked slots
  const slotStatus = useMemo(() => {
    const booked = new Set(bookedSlots || []);
    return TIME_SLOTS.map(slot => ({
      time: slot,
      isBooked: booked.has(slot),
    }));
  }, [bookedSlots]);

  const scheduleCallMutation = useMutation({
    mutationFn: async () => {
      if (!lead || !closer || !selectedDate || !selectedTime) {
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
      queryClient.invalidateQueries({ queryKey: ["adesh-booked-slots"] });
      
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
      setSelectedTime("");
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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Schedule Call</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
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
                          setSelectedTime(""); // Reset time when date changes
                          setShowCalendar(false);
                        }}
                        initialFocus
                        className="pointer-events-auto"
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Aadesh: Time Slot Grid */}
                {isAdesh ? (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Select Time Slot
                    </Label>
                    
                    {isLoadingSlots ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading available slots...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-1">
                        {slotStatus.map(({ time, isBooked }) => (
                          <Button
                            key={time}
                            type="button"
                            variant={selectedTime === time ? "default" : isBooked ? "ghost" : "outline"}
                            size="sm"
                            disabled={isBooked}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "text-xs h-9",
                              isBooked && "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                              selectedTime === time && "ring-2 ring-primary ring-offset-2"
                            )}
                          >
                            {isBooked ? (
                              <span className="text-[10px]">Booked</span>
                            ) : (
                              formatTimeDisplay(time)
                            )}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    {selectedTime && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Selected: <span className="font-medium text-foreground">{formatTimeDisplay(selectedTime)}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  /* Other closers: Manual Time Input */
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
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
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
                disabled={scheduleCallMutation.isPending || !selectedDate || !selectedTime}
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
