import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, IndianRupee, Percent } from "lucide-react";

interface WeekSummaryCardProps {
  thisWeekTotal: number;
  thisWeekStudentCount: number;
  collectionRate: number;
  totalReceivables: number;
}

export const WeekSummaryCard: React.FC<WeekSummaryCardProps> = ({
  thisWeekTotal,
  thisWeekStudentCount,
  collectionRate,
  totalReceivables,
}) => {
  const formatAmount = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {/* This Week Pipeline */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">This Week</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">
            {formatAmount(thisWeekTotal)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {thisWeekStudentCount} {thisWeekStudentCount === 1 ? "student" : "students"}
          </p>
        </CardContent>
      </Card>

      {/* Total Receivables */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-full bg-orange-100 dark:bg-orange-900/50">
              <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Receivables</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-orange-700 dark:text-orange-300">
            {formatAmount(totalReceivables)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            Total pending
          </p>
        </CardContent>
      </Card>

      {/* Collection Rate */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/50">
              <Percent className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Collection Rate</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-green-700 dark:text-green-300">
            {collectionRate.toFixed(1)}%
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            Cash vs Offered
          </p>
        </CardContent>
      </Card>

      {/* Students with Dues */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/50">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Avg/Student</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-purple-700 dark:text-purple-300">
            {thisWeekStudentCount > 0
              ? formatAmount(Math.round(thisWeekTotal / thisWeekStudentCount))
              : "₹0"}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            This week avg
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
