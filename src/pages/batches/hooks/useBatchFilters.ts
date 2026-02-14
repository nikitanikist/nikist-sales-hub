import { useState, useMemo } from "react";
import { format, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import type { Batch, BatchStudent, EmiPayment } from "./useBatchesData";
import { CLASSES_ACCESS_LABELS } from "./useBatchesData";

export const useBatchFilters = (
  batchStudents: BatchStudent[] | undefined,
  batchEmiPayments: EmiPayment[] | undefined,
  batches: Batch[] | undefined,
  selectedBatch: Batch | null,
  isManager: boolean,
  isCloser: boolean
) => {
  const { getToday } = useOrgTimezone();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [batchSearchQuery, setBatchSearchQuery] = useState("");

  // Advanced filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedClosers, setSelectedClosers] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | "initial" | "emi">("all");
  const [isDateFromOpen, setIsDateFromOpen] = useState(false);
  const [isDateToOpen, setIsDateToOpen] = useState(false);
  const [filterTodayFollowUp, setFilterTodayFollowUp] = useState(false);
  const [filterRefunded, setFilterRefunded] = useState(false);
  const [filterDiscontinued, setFilterDiscontinued] = useState(false);
  const [filterFullPayment, setFilterFullPayment] = useState(false);
  const [filterRemaining, setFilterRemaining] = useState(false);
  const [filterPAE, setFilterPAE] = useState(false);

  // Get unique closers from batch students
  const uniqueClosers = useMemo(() => {
    if (!batchStudents) return [];
    const closerMap = new Map<string, string>();
    batchStudents.forEach(student => {
      if (student.closer_id && student.closer_name) {
        closerMap.set(student.closer_id, student.closer_name);
      }
    });
    return Array.from(closerMap.entries()).map(([id, name]) => ({ id, name }));
  }, [batchStudents]);

  // Get unique classes from batch students
  const uniqueClasses = useMemo(() => {
    if (!batchStudents) return [];
    const classesSet = new Set<number>();
    batchStudents.forEach(student => {
      if (student.classes_access) {
        classesSet.add(student.classes_access);
      }
    });
    return Array.from(classesSet).sort((a, b) => a - b);
  }, [batchStudents]);

  // Filter students
  const filteredStudents = useMemo(() => {
    if (!batchStudents) return [];
    
    return batchStudents.filter(student => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        student.contact_name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower) ||
        (student.phone && student.phone.includes(searchQuery));
      
      const matchesCloser = selectedClosers.length === 0 || 
        (student.closer_id && selectedClosers.includes(student.closer_id));
      
      const matchesClasses = selectedClasses.length === 0 || 
        (student.classes_access && selectedClasses.includes(student.classes_access.toString()));
      
      const convertToISTDate = (dateString: string): Date => {
        const utcDate = new Date(dateString);
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
        return startOfDay(istDate);
      };
      
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const fromDateNormalized = dateFrom ? startOfDay(dateFrom) : null;
        const toDateNormalized = dateTo ? startOfDay(dateTo) : null;
        
        if (paymentTypeFilter === "emi") {
          const studentEmis = batchEmiPayments?.filter(emi => emi.appointment_id === student.id) || [];
          matchesDate = studentEmis.some(emi => {
            const emiDateIST = convertToISTDate(emi.payment_date);
            const afterFrom = !fromDateNormalized || emiDateIST >= fromDateNormalized;
            const beforeTo = !toDateNormalized || emiDateIST <= toDateNormalized;
            return afterFrom && beforeTo;
          });
        } else {
          if (student.scheduled_date) {
            const scheduledDateIST = convertToISTDate(student.scheduled_date);
            const afterFrom = !fromDateNormalized || scheduledDateIST >= fromDateNormalized;
            const beforeTo = !toDateNormalized || scheduledDateIST <= toDateNormalized;
            matchesDate = afterFrom && beforeTo;
          } else {
            matchesDate = false;
          }
        }
      }
      
      let matchesPaymentType = true;
      if (paymentTypeFilter === "emi") {
        const hasEmis = batchEmiPayments?.some(emi => emi.appointment_id === student.id);
        matchesPaymentType = !!hasEmis;
      } else if (paymentTypeFilter === "initial") {
        matchesPaymentType = (student.cash_received || 0) > 0;
      }
      
      const todayFormatted = getToday();
      const matchesTodayFollowUp = !filterTodayFollowUp || 
        student.next_follow_up_date === todayFormatted;
      
      const matchesStatusFilter = 
        (!filterRefunded && !filterDiscontinued) || 
        (filterRefunded && student.status === 'refunded') ||
        (filterDiscontinued && student.status === 'discontinued');
      
      const matchesFullPayment = !filterFullPayment || 
        ((student.due_amount || 0) === 0 && (student.cash_received || 0) > 0 && student.status !== 'refunded' && student.status !== 'discontinued');
      
      const matchesRemaining = !filterRemaining || 
        ((student.due_amount || 0) > 0 && !student.pay_after_earning && student.status !== 'refunded' && student.status !== 'discontinued');
      
      const matchesPAE = !filterPAE || 
        ((student.due_amount || 0) > 0 && student.pay_after_earning && student.status !== 'refunded' && student.status !== 'discontinued');
      
      return matchesSearch && matchesCloser && matchesClasses && matchesDate && matchesPaymentType && matchesTodayFollowUp && matchesStatusFilter && matchesFullPayment && matchesRemaining && matchesPAE;
    });
  }, [batchStudents, searchQuery, selectedClosers, selectedClasses, dateFrom, dateTo, paymentTypeFilter, batchEmiPayments, filterTodayFollowUp, filterRefunded, filterDiscontinued, filterFullPayment, filterRemaining, filterPAE]);

  // All students totals (unfiltered)
  const allStudentsTotals = useMemo(() => {
    if (!batchStudents) return { 
      offered: 0, received: 0, due: 0, 
      count: 0, fullPaymentCount: 0, duePaymentCount: 0,
      refundedCount: 0, refundedReceived: 0,
      discontinuedCount: 0, discontinuedReceived: 0,
      emiCollected: 0, paeAmount: 0, paeCount: 0
    };
    
    const activeStudents = batchStudents.filter(s => 
      s.status !== 'refunded' && s.status !== 'discontinued'
    );
    const refundedStudents = batchStudents.filter(s => s.status === 'refunded');
    const discontinuedStudents = batchStudents.filter(s => s.status === 'discontinued');
    
    const paeStudents = activeStudents.filter(s => s.pay_after_earning && (s.due_amount || 0) > 0);
    const nonPaeStudentsWithDue = activeStudents.filter(s => !s.pay_after_earning && (s.due_amount || 0) > 0);
    
    const emiCollected = activeStudents.reduce((sum, student) => {
      const studentEmis = batchEmiPayments?.filter(emi => emi.appointment_id === student.id) || [];
      return sum + studentEmis.reduce((emiSum, emi) => emiSum + Number(emi.amount), 0);
    }, 0);
    
    return {
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
      emiCollected,
      paeAmount: paeStudents.reduce((sum, s) => sum + (s.due_amount || 0), 0),
      paeCount: paeStudents.length
    };
  }, [batchStudents, batchEmiPayments]);

  // Closer breakdown and totals based on filtered students
  const { closerBreakdown, totals, refundedBreakdown, refundedTotals, discontinuedBreakdown, discontinuedTotals, todayFollowUpCount } = useMemo(() => {
    const activeStudents = filteredStudents.filter(s => 
      s.status !== 'refunded' && s.status !== 'discontinued'
    );
    const refundedStudents = filteredStudents.filter(s => s.status === 'refunded');
    const discontinuedStudents = filteredStudents.filter(s => s.status === 'discontinued');

    const calculateBreakdown = (students: typeof filteredStudents) => {
      const breakdown: Record<string, { 
        closerId: string; 
        closerName: string; 
        offered: number; 
        received: number; 
        due: number;
        emiCollected: number;
        count: number;
      }> = {};
      
      students.forEach(student => {
        const closerId = student.closer_id || 'unassigned';
        const closerName = student.closer_name || 'Unassigned';
        
        if (!breakdown[closerId]) {
          breakdown[closerId] = { closerId, closerName, offered: 0, received: 0, due: 0, emiCollected: 0, count: 0 };
        }
        
        breakdown[closerId].offered += student.offer_amount || 0;
        breakdown[closerId].received += student.cash_received || 0;
        breakdown[closerId].due += student.due_amount || 0;
        breakdown[closerId].count += 1;
        
        const studentEmis = batchEmiPayments?.filter(emi => emi.appointment_id === student.id) || [];
        const emiTotal = studentEmis.reduce((sum, emi) => sum + Number(emi.amount), 0);
        breakdown[closerId].emiCollected += emiTotal;
      });
      
      return Object.values(breakdown).sort((a, b) => b.received - a.received);
    };

    const calculateTotals = (breakdownArray: ReturnType<typeof calculateBreakdown>) => ({
      offered: breakdownArray.reduce((sum, c) => sum + c.offered, 0),
      received: breakdownArray.reduce((sum, c) => sum + c.received, 0),
      due: breakdownArray.reduce((sum, c) => sum + c.due, 0),
      emiCollected: breakdownArray.reduce((sum, c) => sum + c.emiCollected, 0),
      count: breakdownArray.reduce((sum, c) => sum + c.count, 0)
    });

    const activeBreakdown = calculateBreakdown(activeStudents);
    const activeTotals = calculateTotals(activeBreakdown);
    const refundedBreakdownCalc = calculateBreakdown(refundedStudents);
    const refundedTotalsCalc = calculateTotals(refundedBreakdownCalc);
    const discontinuedBreakdownCalc = calculateBreakdown(discontinuedStudents);
    const discontinuedTotalsCalc = calculateTotals(discontinuedBreakdownCalc);
    
    const todayFormatted = format(new Date(), "yyyy-MM-dd");
    const todayFollowUpCount = (batchStudents || []).filter(s => 
      s.next_follow_up_date === todayFormatted
    ).length;
    
    return { 
      closerBreakdown: activeBreakdown, 
      totals: activeTotals,
      refundedBreakdown: refundedBreakdownCalc,
      refundedTotals: refundedTotalsCalc,
      discontinuedBreakdown: discontinuedBreakdownCalc,
      discontinuedTotals: discontinuedTotalsCalc,
      todayFollowUpCount
    };
  }, [filteredStudents, batchEmiPayments, batchStudents]);

  // Filter batches based on search
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    if (!batchSearchQuery.trim()) return batches;
    const searchLower = batchSearchQuery.toLowerCase();
    return batches.filter(batch => batch.name.toLowerCase().includes(searchLower));
  }, [batches, batchSearchQuery]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedClosers.length > 0) count++;
    if (selectedClasses.length > 0) count++;
    if (dateFrom || dateTo) count++;
    if (!isManager && !isCloser && paymentTypeFilter !== "all") count++;
    if (filterTodayFollowUp) count++;
    if (filterRefunded) count++;
    if (filterDiscontinued) count++;
    if (filterFullPayment) count++;
    if (filterRemaining) count++;
    if (filterPAE) count++;
    return count;
  }, [selectedClosers, selectedClasses, dateFrom, dateTo, paymentTypeFilter, isManager, isCloser, filterTodayFollowUp, filterRefunded, filterDiscontinued, filterFullPayment, filterRemaining, filterPAE]);

  const clearAllFilters = () => {
    setSelectedClosers([]);
    setSelectedClasses([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    setFilterTodayFollowUp(false);
    setFilterRefunded(false);
    setFilterDiscontinued(false);
    setFilterFullPayment(false);
    setFilterRemaining(false);
    setFilterPAE(false);
    if (!isManager && !isCloser) {
      setPaymentTypeFilter("all");
    }
  };

  const toggleCloser = (closerId: string) => {
    setSelectedClosers(prev => 
      prev.includes(closerId) ? prev.filter(id => id !== closerId) : [...prev, closerId]
    );
  };

  const toggleClass = (classNum: string) => {
    setSelectedClasses(prev => 
      prev.includes(classNum) ? prev.filter(c => c !== classNum) : [...prev, classNum]
    );
  };

  // Export students to CSV
  const handleExportStudents = async () => {
    if (!filteredStudents?.length) return;

    if (isManager) {
      const headers = [
        "Conversion Date", "Student Name", "Closer", "Email", "Phone", "Classes Access", "Status"
      ];

      const rows = filteredStudents.map(student => [
        student.scheduled_date ? format(new Date(student.scheduled_date), "dd MMM yyyy") : "",
        student.contact_name || "",
        student.closer_name || "",
        student.email || "",
        student.phone || "",
        student.classes_access ? CLASSES_ACCESS_LABELS[student.classes_access] || "" : "",
        student.status || "",
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${selectedBatch?.name || "batch"}_students_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }

    // Full export for admin/closer
    const appointmentIds = filteredStudents.map(s => s.id);
    const { data: allEmiPayments } = await supabase
      .from("emi_payments")
      .select("*")
      .in("appointment_id", appointmentIds)
      .order("emi_number", { ascending: true });

    const emiByAppointment: Record<string, typeof allEmiPayments> = {};
    (allEmiPayments || []).forEach(emi => {
      if (!emiByAppointment[emi.appointment_id]) {
        emiByAppointment[emi.appointment_id] = [];
      }
      emiByAppointment[emi.appointment_id]!.push(emi);
    });

    const maxEmis = Math.max(
      0,
      ...Object.values(emiByAppointment).map(emis => emis!.length)
    );

    const headers = [
      "Conversion Date", "Student Name", "Closer", "Email", "Phone",
      "Classes Access", "Offered Amount", "Initial Cash", "Due Amount", "Status",
      "Notes", "Follow-up Date", "PAE",
    ];

    for (let i = 1; i <= maxEmis; i++) {
      headers.push(`EMI ${i} Amount`, `EMI ${i} Date`, `EMI ${i} Prev Cash`, `EMI ${i} Classes`);
    }
    if (maxEmis > 0) headers.push("Total EMI Collected");

    const rows = filteredStudents.map(student => {
      const baseData = [
        student.scheduled_date ? format(new Date(student.scheduled_date), "dd MMM yyyy") : "",
        student.contact_name || "",
        student.closer_name || "",
        student.email || "",
        student.phone || "",
        student.classes_access ? CLASSES_ACCESS_LABELS[student.classes_access] || "" : "",
        student.offer_amount?.toString() || "",
        student.cash_received?.toString() || "",
        student.due_amount?.toString() || "",
        student.status || "",
        student.additional_comments || "",
        student.next_follow_up_date ? format(new Date(student.next_follow_up_date), "dd MMM yyyy") : "",
        student.pay_after_earning ? "Yes" : "No",
      ];

      const studentEmis = emiByAppointment[student.id] || [];
      const emiData: string[] = [];
      let totalEmiCollected = 0;

      for (let i = 0; i < maxEmis; i++) {
        const emi = studentEmis[i];
        if (emi) {
          emiData.push(emi.amount.toString());
          emiData.push(format(new Date(emi.payment_date), "dd MMM yyyy"));
          emiData.push(emi.previous_cash_received != null ? emi.previous_cash_received.toString() : "");
          emiData.push(emi.new_classes_access ? CLASSES_ACCESS_LABELS[emi.new_classes_access] || emi.new_classes_access.toString() : "");
          totalEmiCollected += emi.amount;
        } else {
          emiData.push("", "", "", "");
        }
      }
      if (maxEmis > 0) emiData.push(totalEmiCollected > 0 ? totalEmiCollected.toString() : "");

      return [...baseData, ...emiData];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedBatch?.name || "batch"}_students_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return {
    // Search
    searchQuery,
    setSearchQuery,
    batchSearchQuery,
    setBatchSearchQuery,
    // Filter state
    isFilterOpen,
    setIsFilterOpen,
    selectedClosers,
    selectedClasses,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    paymentTypeFilter,
    setPaymentTypeFilter,
    isDateFromOpen,
    setIsDateFromOpen,
    isDateToOpen,
    setIsDateToOpen,
    filterTodayFollowUp,
    setFilterTodayFollowUp,
    filterRefunded,
    setFilterRefunded,
    filterDiscontinued,
    setFilterDiscontinued,
    filterFullPayment,
    setFilterFullPayment,
    filterRemaining,
    setFilterRemaining,
    filterPAE,
    setFilterPAE,
    // Computed
    uniqueClosers,
    uniqueClasses,
    filteredStudents,
    filteredBatches,
    allStudentsTotals,
    closerBreakdown,
    totals,
    refundedBreakdown,
    refundedTotals,
    discontinuedBreakdown,
    discontinuedTotals,
    todayFollowUpCount,
    activeFilterCount,
    // Actions
    clearAllFilters,
    toggleCloser,
    toggleClass,
    handleExportStudents,
  };
};
