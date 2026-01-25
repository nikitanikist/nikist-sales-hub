import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { CalendarDays, IndianRupee } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpcomingPayment {
  date: string;
  dateFormatted: string;
  students: any[];
  totalAmount: number;
  isToday: boolean;
  isPast: boolean;
}

interface UpcomingPaymentsCalendarProps {
  upcomingPayments: UpcomingPayment[];
  onDateClick: (date: string, students: any[]) => void;
}

export const UpcomingPaymentsCalendar: React.FC<UpcomingPaymentsCalendarProps> = ({
  upcomingPayments,
  onDateClick,
}) => {
  const formatAmount = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(0)}K`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <CardTitle className="text-base sm:text-lg">Upcoming Payments (Next 14 Days)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {upcomingPayments.map((day) => (
              <div
                key={day.date}
                onClick={() => day.students.length > 0 && onDateClick(day.date, day.students)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[72px] sm:min-w-[80px] rounded-lg border p-2 sm:p-3 transition-all",
                  day.students.length > 0
                    ? "cursor-pointer hover:border-primary hover:shadow-md bg-primary/5"
                    : "opacity-50",
                  day.isToday && "ring-2 ring-primary"
                )}
              >
                <span className={cn(
                  "text-xs font-medium",
                  day.isToday ? "text-primary" : "text-muted-foreground"
                )}>
                  {day.dateFormatted}
                </span>
                {day.students.length > 0 ? (
                  <>
                    <span className="text-sm sm:text-base font-bold text-primary mt-1">
                      {formatAmount(day.totalAmount)}
                    </span>
                    <Badge variant="secondary" className="mt-1 text-[10px] px-1.5">
                      {day.students.length} {day.students.length === 1 ? "student" : "students"}
                    </Badge>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground mt-1">—</span>
                )}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
