import { useState, useMemo } from "react";
import { startOfDay } from "date-fns";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useBatchInsights } from "@/hooks/useBatchInsights";
import { Badge } from "@/components/ui/badge";
import type { FuturesStudent, FuturesBatch } from "./useFuturesData";
import React from "react";

export function useFuturesFilters(
  batchStudents: FuturesStudent[] | undefined,
  batches: FuturesBatch[] | undefined,
  selectedBatch: FuturesBatch | null
) {
  const { getToday, format: formatOrg } = useOrgTimezone();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [batchSearchQuery, setBatchSearchQuery] = useState("");

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDateFromOpen, setIsDateFromOpen] = useState(false);
  const [isDateToOpen, setIsDateToOpen] = useState(false);

  // Status filter cards
  const [filterRefunded, setFilterRefunded] = useState(false);
  const [filterDiscontinued, setFilterDiscontinued] = useState(false);
  const [filterFullPayment, setFilterFullPayment] = useState(false);
  const [filterRemaining, setFilterRemaining] = useState(false);
  const [filterTodayFollowUp, setFilterTodayFollowUp] = useState(false);
  const [filterPAE, setFilterPAE] = useState(false);

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    if (!batchStudents) return [];
    
    return batchStudents.filter(student => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        student.contact_name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower) ||
        (student.phone && student.phone.includes(searchQuery));
      
      const matchesStatusSheet = statusFilter === "all" || student.status === statusFilter;
      
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const conversionDate = startOfDay(new Date(student.conversion_date));
        const fromDateNormalized = dateFrom ? startOfDay(dateFrom) : null;
        const toDateNormalized = dateTo ? startOfDay(dateTo) : null;
        const afterFrom = !fromDateNormalized || conversionDate >= fromDateNormalized;
        const beforeTo = !toDateNormalized || conversionDate <= toDateNormalized;
        matchesDate = afterFrom && beforeTo;
      }
      
      const todayFormatted = getToday();
      const matchesTodayFollowUp = !filterTodayFollowUp || 
        student.next_follow_up_date === todayFormatted;
      
      const matchesStatusCard = 
        (!filterRefunded && !filterDiscontinued) || 
        (filterRefunded && student.status === 'refunded') ||
        (filterDiscontinued && student.status === 'discontinued');
      
      const matchesFullPayment = !filterFullPayment || 
        ((student.due_amount || 0) === 0 && (student.cash_received || 0) > 0 && student.status !== 'refunded' && student.status !== 'discontinued');
      
      const matchesRemaining = !filterRemaining || 
        ((student.due_amount || 0) > 0 && !student.pay_after_earning && student.status !== 'refunded' && student.status !== 'discontinued');
      
      const matchesPAE = !filterPAE || 
        ((student.due_amount || 0) > 0 && student.pay_after_earning && student.status !== 'refunded' && student.status !== 'discontinued');
      
      return matchesSearch && matchesStatusSheet && matchesDate && matchesTodayFollowUp && matchesStatusCard && matchesFullPayment && matchesRemaining && matchesPAE;
    });
  }, [batchStudents, searchQuery, statusFilter, dateFrom, dateTo, filterTodayFollowUp, filterRefunded, filterDiscontinued, filterFullPayment, filterRemaining, filterPAE]);

  // Calculate totals and closer breakdown
  const { closerBreakdown, totals, allStudentsTotals, todayFollowUpCount } = useMemo(() => {
    if (!batchStudents) return { 
      closerBreakdown: [], 
      totals: { offered: 0, received: 0, due: 0, count: 0 },
      allStudentsTotals: { 
        offered: 0, received: 0, due: 0, count: 0, 
        fullPaymentCount: 0, duePaymentCount: 0,
        refundedCount: 0, refundedReceived: 0,
        discontinuedCount: 0, discontinuedReceived: 0,
        paeAmount: 0, paeCount: 0
      },
      todayFollowUpCount: 0
    };
    
    const activeStudents = batchStudents.filter(s => 
      s.status !== 'refunded' && s.status !== 'discontinued'
    );
    const refundedStudents = batchStudents.filter(s => s.status === 'refunded');
    const discontinuedStudents = batchStudents.filter(s => s.status === 'discontinued');
    
    const paeStudents = activeStudents.filter(s => 
      s.pay_after_earning && (s.due_amount || 0) > 0
    );
    const nonPaeStudentsWithDue = activeStudents.filter(s => 
      !s.pay_after_earning && (s.due_amount || 0) > 0
    );
    
    const breakdown: Record<string, { 
      closerId: string; closerName: string; offered: number; received: number; due: number; count: number;
    }> = {};
    
    activeStudents.forEach(student => {
      const closerId = student.closer_id || 'manual';
      const closerName = student.closer_name || 'Added Manually';
      
      if (!breakdown[closerId]) {
        breakdown[closerId] = { closerId, closerName, offered: 0, received: 0, due: 0, count: 0 };
      }
      
      breakdown[closerId].offered += student.offer_amount || 0;
      breakdown[closerId].received += student.cash_received || 0;
      if (!student.pay_after_earning) {
        breakdown[closerId].due += student.due_amount || 0;
      }
      breakdown[closerId].count += 1;
    });
    
    const closerBreakdownArray = Object.values(breakdown).sort((a, b) => b.received - a.received);
    
    const todayFormatted = getToday();
    const todayFollowUpCount = batchStudents.filter(s => 
      s.next_follow_up_date === todayFormatted
    ).length;
    
    return {
      closerBreakdown: closerBreakdownArray,
      totals: {
        offered: closerBreakdownArray.reduce((sum, c) => sum + c.offered, 0),
        received: closerBreakdownArray.reduce((sum, c) => sum + c.received, 0),
        due: closerBreakdownArray.reduce((sum, c) => sum + c.due, 0),
        count: closerBreakdownArray.reduce((sum, c) => sum + c.count, 0)
      },
      allStudentsTotals: {
        offered: activeStudents.reduce((sum, s) => sum + (s.offer_amount || 0), 0),
        received: activeStudents.reduce((sum, s) => sum + (s.cash_received || 0), 0),
        due: nonPaeStudentsWithDue.reduce((sum, s) => sum + (s.due_amount || 0), 0),
        count: activeStudents.length,
        fullPaymentCount: activeStudents.filter(s => (s.due_amount || 0) === 0 && (s.cash_received || 0) > 0).length,
        duePaymentCount: nonPaeStudentsWithDue.length,
        refundedCount: refundedStudents.length,
        refundedReceived: refundedStudents.reduce((sum, s) => sum + (s.cash_received || 0), 0),
        discontinuedCount: discontinuedStudents.length,
        discontinuedReceived: discontinuedStudents.reduce((sum, s) => sum + (s.cash_received || 0), 0),
        paeAmount: paeStudents.reduce((sum, s) => sum + (s.due_amount || 0), 0),
        paeCount: paeStudents.length
      },
      todayFollowUpCount
    };
  }, [batchStudents]);

  // Business insights data
  const insightsStudents = useMemo(() => {
    if (!batchStudents) return [];
    return batchStudents.map(s => ({
      ...s,
      offer_amount: s.offer_amount || 0,
      cash_received: s.cash_received || 0,
      due_amount: s.due_amount || 0,
    }));
  }, [batchStudents]);

  const insights = useBatchInsights(insightsStudents);

  // Filter batches based on search
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    if (!batchSearchQuery.trim()) return batches;
    const searchLower = batchSearchQuery.toLowerCase();
    return batches.filter(batch => batch.name.toLowerCase().includes(searchLower));
  }, [batches, batchSearchQuery]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateFrom || dateTo) count++;
    if (statusFilter !== "all") count++;
    if (filterTodayFollowUp) count++;
    if (filterRefunded) count++;
    if (filterDiscontinued) count++;
    if (filterFullPayment) count++;
    if (filterRemaining) count++;
    if (filterPAE) count++;
    return count;
  }, [dateFrom, dateTo, statusFilter, filterTodayFollowUp, filterRefunded, filterDiscontinued, filterFullPayment, filterRemaining, filterPAE]);

  const clearAllFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatusFilter("all");
    setFilterTodayFollowUp(false);
    setFilterRefunded(false);
    setFilterDiscontinued(false);
    setFilterFullPayment(false);
    setFilterRemaining(false);
    setFilterPAE(false);
  };

  const exportStudentsCSV = () => {
    if (!filteredStudents.length) return;
    
    const headers = ["Conversion Date", "Student Name", "Amount Offered", "Cash Received", "Due Amount", "Email", "Phone", "Closer", "Status"];
    const rows = filteredStudents.map(s => [
      formatOrg(s.conversion_date, "yyyy-MM-dd"),
      s.contact_name,
      s.offer_amount,
      s.cash_received,
      s.due_amount,
      s.email,
      s.phone || "",
      s.closer_name || "Added Manually",
      s.status
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedBatch?.name || "futures"}-students-${getToday()}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return React.createElement(Badge, { className: "bg-green-100 text-green-800 hover:bg-green-100" }, "Active");
      case "refunded":
        return React.createElement(Badge, { variant: "destructive" }, "Refunded");
      case "discontinued":
        return React.createElement(Badge, { className: "bg-slate-100 text-slate-700 hover:bg-slate-100 border border-slate-200" }, "Discontinued");
      default:
        return React.createElement(Badge, { variant: "outline" }, status);
    }
  };

  const getBatchStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return React.createElement(Badge, { className: "bg-green-100 text-green-800 hover:bg-green-100" }, "Active");
      case "completed":
        return React.createElement(Badge, { className: "bg-blue-100 text-blue-800 hover:bg-blue-100" }, "Completed");
      case "planned":
        return React.createElement(Badge, { className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" }, "Planned");
      default:
        return React.createElement(Badge, { variant: "outline" }, status);
    }
  };

  return {
    // Search
    searchQuery, setSearchQuery,
    batchSearchQuery, setBatchSearchQuery,
    // Filters
    isFilterOpen, setIsFilterOpen,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    statusFilter, setStatusFilter,
    isDateFromOpen, setIsDateFromOpen,
    isDateToOpen, setIsDateToOpen,
    filterRefunded, setFilterRefunded,
    filterDiscontinued, setFilterDiscontinued,
    filterFullPayment, setFilterFullPayment,
    filterRemaining, setFilterRemaining,
    filterTodayFollowUp, setFilterTodayFollowUp,
    filterPAE, setFilterPAE,
    // Computed
    filteredStudents,
    closerBreakdown,
    totals,
    allStudentsTotals,
    todayFollowUpCount,
    insights,
    insightsStudents,
    filteredBatches,
    activeFilterCount,
    // Actions
    clearAllFilters,
    exportStudentsCSV,
    getStatusBadge,
    getBatchStatusBadge,
    // Org timezone
    formatOrg,
    getToday,
  };
}
