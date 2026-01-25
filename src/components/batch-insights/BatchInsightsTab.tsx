import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ReceivablesAgingTable } from "./ReceivablesAgingTable";
import { TrendingUp, TrendingDown, Target, Percent } from "lucide-react";

interface InsightsData {
  receivablesAging: any[];
  collectionRate: number;
  thisMonthCollected: number;
  lastMonthCollected: number;
  totalReceivables: number;
  studentsWithoutFollowUp: any[];
  overdueFollowUps: any[];
}

interface BatchInsightsTabProps {
  insights: InsightsData;
  onBracketClick: (bracket: string, students: any[]) => void;
}

export const BatchInsightsTab: React.FC<BatchInsightsTabProps> = ({
  insights,
  onBracketClick,
}) => {
  const formatAmount = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const collectionGrowth = insights.lastMonthCollected > 0
    ? ((insights.thisMonthCollected - insights.lastMonthCollected) / insights.lastMonthCollected) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Collection Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* This Month Collections */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/50">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">This Month EMI</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-green-700 dark:text-green-300">
              {formatAmount(insights.thisMonthCollected)}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              EMI collected
            </p>
          </CardContent>
        </Card>

        {/* Last Month Collections */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
                <Target className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Last Month EMI</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">
              {formatAmount(insights.lastMonthCollected)}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              EMI collected
            </p>
          </CardContent>
        </Card>

        {/* Growth Rate */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-full ${collectionGrowth >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                {collectionGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
                )}
              </div>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">MoM Growth</span>
            </div>
            <div className={`text-lg sm:text-xl font-bold ${collectionGrowth >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
              {collectionGrowth >= 0 ? '+' : ''}{collectionGrowth.toFixed(1)}%
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              vs last month
            </p>
          </CardContent>
        </Card>

        {/* Collection Rate */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/50">
                <Percent className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Collection Rate</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-purple-700 dark:text-purple-300">
              {insights.collectionRate.toFixed(1)}%
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              Cash vs Offered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Pending Actions</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Without follow-up date</span>
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  {insights.studentsWithoutFollowUp.length} students
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overdue follow-ups</span>
                <span className="font-medium text-orange-700 dark:text-orange-300">
                  {insights.overdueFollowUps.length} students
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Total Receivables</h3>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatAmount(insights.totalReceivables)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Excluding PAE students
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Receivables Aging Table */}
      <ReceivablesAgingTable
        receivablesAging={insights.receivablesAging}
        onBracketClick={onBracketClick}
      />
    </div>
  );
};
