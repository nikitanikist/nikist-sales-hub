import { useState } from "react";
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
  onSuccess: () => void;
}

// Generate time slots from 8 AM to 10 PM
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

const TIME_SLOTS = generateTimeSlots();

const formatTimeDisplay = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export const RebookCallDialog = ({ open, onOpenChange, appointment, onSuccess }: RebookCallDialogProps) => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

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

      const { data, error } = await supabase.functions.invoke("rebook-call", {
        body: {
          appointment_id: appointment.id,
          new_date: newDate,
          new_time: selectedTime,
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
        throw new Error(data?.error || "Failed to rebook call");
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Rebook Call
          </DialogTitle>
          <DialogDescription>
            Reschedule the call for {appointment.lead?.contact_name || "Unknown"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsDatePopoverOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* New Time Selection */}
          <div className="space-y-2">
            <Label>New Time <span className="text-destructive">*</span></Label>
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
                {TIME_SLOTS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {formatTimeDisplay(time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Info */}
          <div className="text-sm text-muted-foreground">
            <p>Customer will receive a WhatsApp confirmation message with the new schedule.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
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
