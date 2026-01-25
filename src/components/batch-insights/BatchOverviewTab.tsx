import React from "react";
import { UpcomingPaymentsCalendar } from "./UpcomingPaymentsCalendar";
import { WeekSummaryCard } from "./WeekSummaryCard";
import { ActionRequiredCards } from "./ActionRequiredCards";

interface InsightsData {
  upcomingPayments: any[];
  thisWeekTotal: number;
  thisWeekStudentCount: number;
  studentsWithoutFollowUp: any[];
  studentsWithoutFollowUpAmount: number;
  overdueFollowUps: any[];
  overdueFollowUpsAmount: number;
  totalReceivables: number;
  collectionRate: number;
}

interface BatchOverviewTabProps {
  insights: InsightsData;
  onDateClick: (date: string, students: any[]) => void;
  onViewNoFollowUp: () => void;
  onViewOverdue: () => void;
  summaryCards?: React.ReactNode;
}

export const BatchOverviewTab: React.FC<BatchOverviewTabProps> = ({
  insights,
  onDateClick,
  onViewNoFollowUp,
  onViewOverdue,
  summaryCards,
}) => {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summaryCards}
      
      {/* Week Summary Metrics */}
      <WeekSummaryCard
        thisWeekTotal={insights.thisWeekTotal}
        thisWeekStudentCount={insights.thisWeekStudentCount}
        collectionRate={insights.collectionRate}
        totalReceivables={insights.totalReceivables}
      />
      
      {/* Upcoming Payments Calendar */}
      <UpcomingPaymentsCalendar
        upcomingPayments={insights.upcomingPayments}
        onDateClick={onDateClick}
      />
      
      {/* Action Required Section */}
      <ActionRequiredCards
        studentsWithoutFollowUp={insights.studentsWithoutFollowUp}
        studentsWithoutFollowUpAmount={insights.studentsWithoutFollowUpAmount}
        overdueFollowUps={insights.overdueFollowUps}
        overdueFollowUpsAmount={insights.overdueFollowUpsAmount}
        onViewNoFollowUp={onViewNoFollowUp}
        onViewOverdue={onViewOverdue}
      />
    </div>
  );
};
