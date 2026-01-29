import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, Loader2, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useOrgClosers, useOrgIntegrations, hasIntegrationForCloser } from "@/hooks/useOrgClosers";

// Time slots for closers with Zoom integration (90-minute intervals from 9:00 AM to 10:30 PM)
const ZOOM_TIME_SLOTS = [
  "09:00", "10:30", "12:00", "13:30", "15:00", 
  "16:30", "18:00", "19:30", "21:00", "22:30"
];

interface ReassignCallDialogProps {
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
  currentCloser?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  onSuccess: () => void;
}

// Generate time slots from 8 AM to 10 PM (for closers without specific slot patterns)
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
  const parts = timeStr.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export const ReassignCallDialog = ({ 
  open, 
  onOpenChange, 
  appointment, 
  currentCloser, 
  onSuccess 
}: ReassignCallDialogProps) => {
  const { toast } = useToast();
  
  // Pre-fill with current values
  const initialDate = new Date(appointment.scheduled_date);
  const initialTime = appointment.scheduled_time.slice(0, 5);
  
  const [selectedCloserId, setSelectedCloserId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
  const [selectedTime, setSelectedTime] = useState<string>(initialTime);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  // Fetch closers scoped to current organization
  const { data: closers } = useOrgClosers();
  
  // Fetch integrations for the organization
  const { data: integrations = [] } = useOrgIntegrations();

  // Get selected closer details
  const selectedCloser = useMemo(() => {
    return closers?.find(c => c.id === selectedCloserId);
  }, [closers, selectedCloserId]);

  // Check if selected closer has Zoom integration (uses time slot grid)
  const hasZoom = selectedCloser ? hasIntegrationForCloser(integrations, selectedCloser.email, 'zoom') : false;

  // Fetch booked slots for closers with Zoom on selected date
  const { data: bookedSlots, isLoading: isLoadingSlots } = useMemo(() => {
    return {
      data: [] as string[],
      isLoading: false
    };
  }, []);

  // For Zoom closers, we need to fetch booked slots
  const [fetchedBookedSlots, setFetchedBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useMemo(() => {
    if (hasZoom && selectedCloserId && selectedDate && open) {
      setLoadingSlots(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      supabase
        .from("call_appointments")
        .select("scheduled_time")
        .eq("closer_id", selectedCloserId)
        .eq("scheduled_date", dateStr)
        .in("status", ["scheduled", "pending", "reschedule"])
        .neq("id", appointment.id)
        .then(({ data }) => {
          setFetchedBookedSlots(data?.map(apt => apt.scheduled_time.slice(0, 5)) || []);
          setLoadingSlots(false);
        });
    }
  }, [hasZoom, selectedCloserId, selectedDate, open, appointment.id]);

  // Get available and booked slots for Zoom closers
  const slotStatus = useMemo(() => {
    const booked = new Set(fetchedBookedSlots);
    return ZOOM_TIME_SLOTS.map(slot => ({
      time: slot,
      isBooked: booked.has(slot),
    }));
  }, [fetchedBookedSlots]);

  // Check if date/time has changed
  const dateTimeChanged = useMemo(() => {
    if (!selectedDate) return false;
    const newDateStr = format(selectedDate, "yyyy-MM-dd");
    const newTimeNormalized = selectedTime.slice(0, 5);
    const oldTimeNormalized = appointment.scheduled_time.slice(0, 5);
    return newDateStr !== appointment.scheduled_date || newTimeNormalized !== oldTimeNormalized;
  }, [selectedDate, selectedTime, appointment.scheduled_date, appointment.scheduled_time]);

  const handleReassign = async () => {
    if (!selectedCloserId) {
      toast({
        title: "Missing Information",
        description: "Please select a closer to reassign the call to",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast({
        title: "Missing Information",
        description: "Please select date and time for the call",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newDate = format(selectedDate, "yyyy-MM-dd");
      const timeFormatted = selectedTime.includes(":00:") ? selectedTime : selectedTime + ":00";

      const { data, error } = await supabase.functions.invoke("reassign-call", {
        body: {
          appointment_id: appointment.id,
          new_closer_id: selectedCloserId,
          new_date: newDate,
          new_time: timeFormatted,
        },
      });

      if (error) throw error;

      if (data?.success) {
        let description = `Call reassigned to ${data.newCloser}`;
        if (data.dateTimeChanged) {
          description += ` with new schedule: ${format(selectedDate, "dd MMM yyyy")} at ${formatTimeDisplay(selectedTime)}`;
          if (data.whatsapp?.sent) {
            description += ". WhatsApp confirmation sent!";
          }
        } else {
          description += ". Date and time kept the same.";
        }

        toast({
          title: "Call Reassigned",
          description,
        });
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(data?.error || "Failed to reassign call");
      }
    } catch (error) {
      console.error("Error reassigning call:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reassign call",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCloserId("");
    setSelectedDate(new Date(appointment.scheduled_date));
    setSelectedTime(appointment.scheduled_time.slice(0, 5));
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    // Reset time only if switching closers changes the slot pattern
    if (hasZoom && selectedTime && !ZOOM_TIME_SLOTS.includes(selectedTime.slice(0, 5))) {
      setSelectedTime("");
    }
    setIsDatePopoverOpen(false);
  };

  const handleCloserChange = (closerId: string) => {
    setSelectedCloserId(closerId);
    // Reset time when changing closer (different slot patterns)
    const newCloser = closers?.find(c => c.id === closerId);
    const willHaveZoom = newCloser ? hasIntegrationForCloser(integrations, newCloser.email, 'zoom') : false;
    
    if (willHaveZoom && !ZOOM_TIME_SLOTS.includes(selectedTime.slice(0, 5))) {
      setSelectedTime("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Reassign Call
          </DialogTitle>
          <DialogDescription>
            Reassign the call for {appointment.lead?.contact_name || "Unknown"} to another closer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1">
          {/* Current Assignment Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Current Assignment</p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{currentCloser?.full_name || "Unknown"}</span>
              </div>
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

          {/* Select New Closer */}
          <div className="space-y-2">
            <Label>Reassign To <span className="text-destructive">*</span></Label>
            <Select value={selectedCloserId} onValueChange={handleCloserChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select new closer">
                  {selectedCloser ? (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {selectedCloser.full_name}
                    </div>
                  ) : (
                    "Select new closer"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {closers?.filter(c => c.id !== currentCloser?.id).map((closer) => (
                  <SelectItem key={closer.id} value={closer.id}>
                    {closer.full_name}
                  </SelectItem>
                ))
                }
              </SelectContent>
            </Select>
          </div>

          {/* New Date Selection */}
          <div className="space-y-2">
            <Label>Date <span className="text-destructive">*</span></Label>
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
                  {selectedDate ? format(selectedDate, "PPP") : "Select date"}
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

          {/* Time Selection - Different UI based on integration type */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time <span className="text-destructive">*</span>
            </Label>
            
            {!selectedCloserId ? (
              <p className="text-sm text-muted-foreground">Please select a closer first</p>
            ) : hasZoom ? (
              // Zoom closer: Show time slot grid
              <>
                {!selectedDate ? (
                  <p className="text-sm text-muted-foreground">Please select a date to see available slots</p>
                ) : loadingSlots ? (
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
                  <SelectValue placeholder="Select time">
                    {selectedTime ? (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTimeDisplay(selectedTime)}
                      </div>
                    ) : (
                      "Select time"
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

          {/* Info about WhatsApp */}
          <div className="space-y-2">
            {dateTimeChanged ? (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Date/time changed - WhatsApp confirmation will be sent
              </Badge>
            ) : selectedCloserId ? (
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                Same date/time - No WhatsApp will be sent (only Zoom link changes)
              </Badge>
            ) : null}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleReassign} 
            disabled={isSubmitting || !selectedCloserId || !selectedDate || !selectedTime}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reassigning...
              </>
            ) : (
              "Reassign Call"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReassignCallDialog;
