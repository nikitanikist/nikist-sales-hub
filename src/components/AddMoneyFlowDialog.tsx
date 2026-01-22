import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface MoneyFlowEntry {
  id: string;
  date: string;
  total_revenue: number;
  cash_collected: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

interface AddMoneyFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEntry?: MoneyFlowEntry | null;
}

const AddMoneyFlowDialog = ({ open, onOpenChange, editingEntry }: AddMoneyFlowDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dateOption, setDateOption] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());
  const [totalRevenue, setTotalRevenue] = useState("");
  const [cashCollected, setCashCollected] = useState("");
  const [notes, setNotes] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Reset form when dialog opens or editingEntry changes
  useEffect(() => {
    if (open) {
      if (editingEntry) {
        const entryDate = new Date(editingEntry.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = subDays(today, 1);
        
        if (entryDate.toDateString() === today.toDateString()) {
          setDateOption("today");
        } else if (entryDate.toDateString() === yesterday.toDateString()) {
          setDateOption("yesterday");
        } else {
          setDateOption("custom");
          setCustomDate(entryDate);
        }
        setTotalRevenue(editingEntry.total_revenue.toString());
        setCashCollected(editingEntry.cash_collected.toString());
        setNotes(editingEntry.notes || "");
      } else {
        setDateOption("today");
        setCustomDate(new Date());
        setTotalRevenue("");
        setCashCollected("");
        setNotes("");
      }
    }
  }, [open, editingEntry]);

  const getSelectedDate = (): string => {
    if (dateOption === "today") {
      return format(new Date(), "yyyy-MM-dd");
    } else if (dateOption === "yesterday") {
      return format(subDays(new Date(), 1), "yyyy-MM-dd");
    } else {
      return customDate ? format(customDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const date = getSelectedDate();
      const data = {
        date,
        total_revenue: parseFloat(totalRevenue) || 0,
        cash_collected: parseFloat(cashCollected) || 0,
        notes: notes || null,
        created_by: user?.id,
      };

      if (editingEntry) {
        const { error } = await (supabase as any)
          .from("daily_money_flow")
          .update(data)
          .eq("id", editingEntry.id);
        if (error) throw error;
      } else {
        // Try to insert, if conflict (date exists), update instead
        const { error } = await (supabase as any)
          .from("daily_money_flow")
          .upsert(data, { onConflict: "date" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-money-flow"] });
      toast({
        title: editingEntry ? "Entry updated" : "Entry added",
        description: `Data for ${format(new Date(getSelectedDate()), "dd MMM yyyy")} saved successfully.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalRevenue && !cashCollected) {
      toast({
        title: "Validation Error",
        description: "Please enter at least revenue or cash collected.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{editingEntry ? "Edit Entry" : "Add Daily Data"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Date Selection */}
          <div className="space-y-3">
            <Label className="text-sm sm:text-base">Select Date</Label>
            <RadioGroup
              value={dateOption}
              onValueChange={(value) => setDateOption(value as "today" | "yesterday" | "custom")}
              className="flex flex-wrap gap-3 sm:gap-4"
            >
              <div className="flex items-center space-x-2 min-w-[80px]">
                <RadioGroupItem value="today" id="today" className="h-5 w-5" />
                <Label htmlFor="today" className="cursor-pointer font-normal text-sm sm:text-base">
                  Today
                </Label>
              </div>
              <div className="flex items-center space-x-2 min-w-[80px]">
                <RadioGroupItem value="yesterday" id="yesterday" className="h-5 w-5" />
                <Label htmlFor="yesterday" className="cursor-pointer font-normal text-sm sm:text-base">
                  Yesterday
                </Label>
              </div>
              <div className="flex items-center space-x-2 min-w-[80px]">
                <RadioGroupItem value="custom" id="custom" className="h-5 w-5" />
                <Label htmlFor="custom" className="cursor-pointer font-normal text-sm sm:text-base">
                  Custom
                </Label>
              </div>
            </RadioGroup>

            {dateOption === "custom" && (
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11 sm:h-10",
                      !customDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate ? format(customDate, "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={(date) => {
                      setCustomDate(date);
                      setIsCalendarOpen(false);
                    }}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            <p className="text-xs sm:text-sm text-muted-foreground">
              Selected: {format(new Date(getSelectedDate()), "dd MMM yyyy")}
            </p>
          </div>

          {/* Total Revenue */}
          <div className="space-y-2">
            <Label htmlFor="revenue" className="text-sm sm:text-base">Total Revenue (₹)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                id="revenue"
                type="number"
                inputMode="numeric"
                placeholder="0"
                className="pl-8 h-11 sm:h-10 text-base"
                value={totalRevenue}
                onChange={(e) => setTotalRevenue(e.target.value)}
              />
            </div>
          </div>

          {/* Cash Collected */}
          <div className="space-y-2">
            <Label htmlFor="cash" className="text-sm sm:text-base">Cash Collected (₹)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                id="cash"
                type="number"
                inputMode="numeric"
                placeholder="0"
                className="pl-8 h-11 sm:h-10 text-base"
                value={cashCollected}
                onChange={(e) => setCashCollected(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm sm:text-base">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-base"
            />
          </div>

          {/* Submit Button */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 sm:pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 sm:h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="h-11 sm:h-10">
              {mutation.isPending ? "Saving..." : editingEntry ? "Update" : "Save Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddMoneyFlowDialog;
