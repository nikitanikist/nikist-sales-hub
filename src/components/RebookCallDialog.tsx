import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// Adesh's email for checking if we should show time slot grid
const ADESH_EMAIL = "aadeshnikist@gmail.com";

// Time slots for Aadesh (90-minute intervals from 9:00 AM to 10:30 PM)
const ADESH_TIME_SLOTS = [
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

interface RebookCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    scheduled_date: string;
    scheduled_time: string;
    lead: {
      contact_name: string;
      email: string;
      phone: string | null;
    } | null;
  };
  closer?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  onSuccess: () => void;
}

// Generate time slots from 8 AM to 10 PM (for non-Adesh closers)
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
      slots.push(timeStr);
    }
  }
  return slots;
};

const DEFAULT_TIME_SLOTS = generateTimeSlots();

const formatTimeDisplay = (timeStr: string): string => {
  // Handle both "HH:MM" and "HH:MM:SS" formats
  const parts = timeStr.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export const RebookCallDialog = ({ open, onOpenChange, appointment, closer, onSuccess }: RebookCallDialogProps) => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  // Check if this is Adesh
  const isAdesh = closer?.email?.toLowerCase() === ADESH_EMAIL.toLowerCase();

  // Fetch booked slots for Aadesh on selected date
  const { data: bookedSlots, isLoading: isLoadingSlots } = useQuery({
    queryKey: ["adesh-booked-slots-rebook", closer?.id, selectedDate ? format(selectedDate, "yyyy-MM-dd") : null],
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
      
      // Return array of booked time strings (e.g., ["10:30", "14:30"])
      return data?.map(apt => apt.scheduled_time.slice(0, 5)) || [];
    },
    enabled: isAdesh && !!closer?.id && !!selectedDate && open,
  });

  // Get available and booked slots for Adesh
  const slotStatus = useMemo(() => {
    const booked = new Set(bookedSlots || []);
    return ADESH_TIME_SLOTS.map(slot => ({
      time: slot,
      isBooked: booked.has(slot),
    }));
  }, [bookedSlots]);

  const handleRebook = async () => {
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Missing Information",
        description: "Please select both date and time for the new call",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newDate = format(selectedDate, "yyyy-MM-dd");
      // For Adesh, time is in "HH:MM" format, need to append ":00" for the edge function
      const timeFormatted = selectedTime.includes(":00:") ? selectedTime : selectedTime + ":00";

      const { data, error } = await supabase.functions.invoke("rebook-call", {
        body: {
          appointment_id: appointment.id,
          new_date: newDate,
          new_time: timeFormatted,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Call Rebooked",
          description: `Call rescheduled to ${format(selectedDate, "dd MMM yyyy")} at ${formatTimeDisplay(selectedTime)}${data.whatsapp?.sent ? ". WhatsApp confirmation sent!" : ""}`,
        });
        onSuccess();
        onOpenChange(false);
        setSelectedDate(undefined);
        setSelectedTime("");
      } else {
        // Show detailed Calendly error if available
        const errorMessage = data?.calendly?.error || data?.error || "Failed to rebook call";
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error rebooking call:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to rebook call",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedDate(undefined);
    setSelectedTime("");
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(""); // Reset time when date changes
    setIsDatePopoverOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Rebook Call
          </DialogTitle>
          <DialogDescription>
            Reschedule the call for {appointment.lead?.contact_name || "Unknown"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1">
          {/* Previous Schedule Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Previous Schedule</p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(appointment.scheduled_date), "dd MMM yyyy")}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatTimeDisplay(appointment.scheduled_time)}</span>
              </div>
            </div>
          </div>

          {/* Closer Info (if available) */}
          {closer && (
            <div className="text-sm">
              <span className="text-muted-foreground">Closer: </span>
              <span className="font-medium">{closer.full_name}</span>
            </div>
          )}

          {/* New Date Selection */}
          <div className="space-y-2">
            <Label>New Date <span className="text-destructive">*</span></Label>
            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Select new date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* New Time Selection - Different UI for Adesh vs Others */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              New Time <span className="text-destructive">*</span>
            </Label>
            
            {isAdesh ? (
              // Adesh: Show time slot grid with availability
              <>
                {!selectedDate ? (
                  <p className="text-sm text-muted-foreground">Please select a date first to see available slots</p>
                ) : isLoadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading available slots...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-[250px] overflow-y-auto p-1">
                    {slotStatus.map(({ time, isBooked }) => (
                      <Button
                        key={time}
                        type="button"
                        variant={selectedTime === time ? "default" : isBooked ? "ghost" : "outline"}
                        size="sm"
                        disabled={isBooked}
                        onClick={() => setSelectedTime(time)}
                        className={cn(
                          "text-xs h-12",
                          isBooked && "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                          selectedTime === time && "ring-2 ring-primary ring-offset-2"
                        )}
                      >
                        {isBooked ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px]">Booked</span>
                            <span className="text-[10px] font-medium">{formatTimeDisplay(time)}</span>
                          </div>
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
              </>
            ) : (
              // Other closers: Show dropdown select
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select new time">
                    {selectedTime ? (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTimeDisplay(selectedTime)}
                      </div>
                    ) : (
                      "Select new time"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {DEFAULT_TIME_SLOTS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTimeDisplay(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Customer Info */}
          <div className="text-sm text-muted-foreground">
            <p>Customer will receive a WhatsApp confirmation message with the new schedule.</p>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleRebook} disabled={isSubmitting || !selectedDate || !selectedTime}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rebooking...
              </>
            ) : (
              "Rebook Call"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RebookCallDialog;
