import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CalendarX, Phone, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionRequiredCardsProps {
  studentsWithoutFollowUp: any[];
  studentsWithoutFollowUpAmount: number;
  overdueFollowUps: any[];
  overdueFollowUpsAmount: number;
  onViewNoFollowUp: () => void;
  onViewOverdue: () => void;
}

export const ActionRequiredCards: React.FC<ActionRequiredCardsProps> = ({
  studentsWithoutFollowUp,
  studentsWithoutFollowUpAmount,
  overdueFollowUps,
  overdueFollowUpsAmount,
  onViewNoFollowUp,
  onViewOverdue,
}) => {
  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-semibold text-amber-800 dark:text-amber-200">Action Required</h3>
        </div>
        
        <div className="space-y-2">
          {/* Students Without Follow-up */}
          <div
            onClick={onViewNoFollowUp}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-all",
              studentsWithoutFollowUp.length > 0
                ? "bg-white dark:bg-background cursor-pointer hover:shadow-md border"
                : "bg-muted/50 opacity-60"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-medium text-sm">No Follow-up Date Set</p>
                <p className="text-xs text-muted-foreground">
                  {formatAmount(studentsWithoutFollowUpAmount)} total due
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-red-600 dark:text-red-400">
                {studentsWithoutFollowUp.length}
              </span>
              {studentsWithoutFollowUp.length > 0 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Overdue Follow-ups */}
          <div
            onClick={onViewOverdue}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-all",
              overdueFollowUps.length > 0
                ? "bg-white dark:bg-background cursor-pointer hover:shadow-md border"
                : "bg-muted/50 opacity-60"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <CalendarX className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Overdue Follow-ups</p>
                <p className="text-xs text-muted-foreground">
                  {formatAmount(overdueFollowUpsAmount)} total due
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {overdueFollowUps.length}
              </span>
              {overdueFollowUps.length > 0 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
