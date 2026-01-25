import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Plus, Edit, Trash2, Calendar, ArrowLeft, Users, Loader2, Search, Download, ChevronDown, ChevronRight, IndianRupee, Filter, X, MoreHorizontal, RefreshCcw, FileText, Pencil, HandCoins, BarChart3, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { UpdateFuturesEmiDialog } from "@/components/UpdateFuturesEmiDialog";
import { AddFuturesStudentDialog } from "@/components/AddFuturesStudentDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useBatchInsights } from "@/hooks/useBatchInsights";
import { 
  UpcomingPaymentsCalendar, 
  ActionRequiredCards, 
  WeekSummaryCard, 
  ReceivablesAgingTable, 
  StudentListDialog 
} from "@/components/batch-insights";

interface FuturesBatch {
  id: string;
  name: string;
  event_dates: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  students_count?: number;
}

interface FuturesStudent {
  id: string;
  lead_id: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  conversion_date: string;
  offer_amount: number;
  cash_received: number;
  due_amount: number;
  status: string;
  notes: string | null;
  refund_reason: string | null;
  closer_id: string | null;
  closer_name: string | null;
  next_follow_up_date: string | null;
  pay_after_earning: boolean;
}

interface FuturesEmiPayment {
  id: string;
  student_id: string;
  emi_number: number;
  amount: number;
  payment_date: string;
  created_at: string | null;
  created_by: string | null;
  created_by_profile?: { full_name: string } | null;
  no_cost_emi: number | null;
  gst_fees: number | null;
  platform_fees: number | null;
  payment_platform: string | null;
  remarks: string | null;
}

const FuturesMentorship = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<FuturesBatch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<FuturesBatch | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<FuturesBatch | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formEventDates, setFormEventDates] = useState("");
  const [formStatus, setFormStatus] = useState("active");

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
  
  // Dialog state
  const [refundingStudent, setRefundingStudent] = useState<FuturesStudent | null>(null);
  const [refundNotes, setRefundNotes] = useState<string>("");
  const [notesStudent, setNotesStudent] = useState<FuturesStudent | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [payAfterEarning, setPayAfterEarning] = useState(false);
  const [isFollowUpDateOpen, setIsFollowUpDateOpen] = useState(false);
  const [emiStudent, setEmiStudent] = useState<FuturesStudent | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [discontinuingStudent, setDiscontinuingStudent] = useState<FuturesStudent | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<FuturesStudent | null>(null);
  const [viewingNotesStudent, setViewingNotesStudent] = useState<FuturesStudent | null>(null);
  
  // Business Insights tab state
  const [activeTab, setActiveTab] = useState<string>("students");
  const [showStudentListDialog, setShowStudentListDialog] = useState(false);
  const [studentListTitle, setStudentListTitle] = useState("");
  const [studentListSubtitle, setStudentListSubtitle] = useState("");
  const [studentListData, setStudentListData] = useState<FuturesStudent[]>([]);

  // Fetch batches with student counts
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["futures-batches"],
    queryFn: async () => {
      const { data: batchesData, error } = await supabase
        .from("futures_mentorship_batches")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Get student counts for each batch
      const batchesWithCounts = await Promise.all(
        (batchesData || []).map(async (batch) => {
          const { count } = await supabase
            .from("futures_mentorship_students")
            .select("*", { count: "exact", head: true })
            .eq("batch_id", batch.id);
          
          return { ...batch, students_count: count || 0 };
        })
      );
      
      return batchesWithCounts as FuturesBatch[];
    },
  });

  // Fetch students for selected batch with closer info
  const { data: batchStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ["futures-students", selectedBatch?.id],
    queryFn: async () => {
      if (!selectedBatch) return [];
      
      const { data, error } = await supabase
        .from("futures_mentorship_students")
        .select(`
          id,
          lead_id,
          conversion_date,
          offer_amount,
          cash_received,
          due_amount,
          status,
          notes,
          refund_reason,
          closer_id,
          next_follow_up_date,
          pay_after_earning,
          lead:leads(contact_name, email, phone),
          closer:profiles!closer_id(full_name)
        `)
        .eq("batch_id", selectedBatch.id)
        .order("conversion_date", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((student: any) => ({
        id: student.id,
        lead_id: student.lead_id,
        contact_name: student.lead?.contact_name || "Unknown",
        email: student.lead?.email || "",
        phone: student.lead?.phone || null,
        conversion_date: student.conversion_date,
        offer_amount: student.offer_amount || 0,
        cash_received: student.cash_received || 0,
        due_amount: student.due_amount || 0,
        status: student.status,
        notes: student.notes,
        refund_reason: student.refund_reason,
        closer_id: student.closer_id,
        closer_name: student.closer?.full_name || null,
        next_follow_up_date: student.next_follow_up_date,
        pay_after_earning: student.pay_after_earning || false,
      })) as FuturesStudent[];
    },
    enabled: !!selectedBatch,
  });

  // Fetch EMI payments for expanded student
  const { data: studentEmiPayments, isLoading: emiLoading } = useQuery({
    queryKey: ["futures-emi", expandedStudentId],
    queryFn: async () => {
      if (!expandedStudentId) return [];
      
      const { data, error } = await supabase
        .from("futures_emi_payments")
        .select("*, created_by_profile:profiles!created_by(full_name)")
        .eq("student_id", expandedStudentId)
        .order("emi_number", { ascending: true });
      
      if (error) throw error;
      return data as FuturesEmiPayment[];
    },
    enabled: !!expandedStudentId,
  });

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    if (!batchStudents) return [];
    
    return batchStudents.filter(student => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        student.contact_name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower) ||
        (student.phone && student.phone.includes(searchQuery));
      
      // Status filter from sheet
      const matchesStatusSheet = statusFilter === "all" || student.status === statusFilter;
      
      // Date range filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const conversionDate = startOfDay(new Date(student.conversion_date));
        const fromDateNormalized = dateFrom ? startOfDay(dateFrom) : null;
        const toDateNormalized = dateTo ? startOfDay(dateTo) : null;
        
        const afterFrom = !fromDateNormalized || conversionDate >= fromDateNormalized;
        const beforeTo = !toDateNormalized || conversionDate <= toDateNormalized;
        matchesDate = afterFrom && beforeTo;
      }
      
      // Today's follow-up filter
      const todayFormatted = format(new Date(), "yyyy-MM-dd");
      const matchesTodayFollowUp = !filterTodayFollowUp || 
        student.next_follow_up_date === todayFormatted;
      
      // Status card filters (Refunded/Discontinued)
      const matchesStatusCard = 
        (!filterRefunded && !filterDiscontinued) || 
        (filterRefunded && student.status === 'refunded') ||
        (filterDiscontinued && student.status === 'discontinued');
      
      // Full payment filter (due_amount = 0 and has made payment)
      const matchesFullPayment = !filterFullPayment || 
        ((student.due_amount || 0) === 0 && (student.cash_received || 0) > 0 && student.status !== 'refunded' && student.status !== 'discontinued');
      
      // Remaining amount filter (due_amount > 0 and NOT PAE)
      const matchesRemaining = !filterRemaining || 
        ((student.due_amount || 0) > 0 && !student.pay_after_earning && student.status !== 'refunded' && student.status !== 'discontinued');
      
      // Pay After Earning filter (due_amount > 0 and PAE = true)
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
    
    // Separate students by status
    const activeStudents = batchStudents.filter(s => 
      s.status !== 'refunded' && s.status !== 'discontinued'
    );
    const refundedStudents = batchStudents.filter(s => s.status === 'refunded');
    const discontinuedStudents = batchStudents.filter(s => s.status === 'discontinued');
    
    // PAE students (active, has due amount, pay_after_earning = true)
    const paeStudents = activeStudents.filter(s => 
      s.pay_after_earning && (s.due_amount || 0) > 0
    );
    // Non-PAE students with due (active, has due amount, pay_after_earning = false)
    const nonPaeStudentsWithDue = activeStudents.filter(s => 
      !s.pay_after_earning && (s.due_amount || 0) > 0
    );
    
    // Calculate closer breakdown for active students
    const breakdown: Record<string, { 
      closerId: string; 
      closerName: string; 
      offered: number; 
      received: number; 
      due: number;
      count: number;
    }> = {};
    
    activeStudents.forEach(student => {
      const closerId = student.closer_id || 'manual';
      const closerName = student.closer_name || 'Added Manually';
      
      if (!breakdown[closerId]) {
        breakdown[closerId] = { 
          closerId, 
          closerName, 
          offered: 0, 
          received: 0, 
          due: 0,
          count: 0
        };
      }
      
      breakdown[closerId].offered += student.offer_amount || 0;
      breakdown[closerId].received += student.cash_received || 0;
      // Only include non-PAE due in closer breakdown
      if (!student.pay_after_earning) {
        breakdown[closerId].due += student.due_amount || 0;
      }
      breakdown[closerId].count += 1;
    });
    
    const closerBreakdownArray = Object.values(breakdown).sort((a, b) => b.received - a.received);
    
    // Calculate today's follow-up count
    const todayFormatted = format(new Date(), "yyyy-MM-dd");
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
        // Due excludes PAE students
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

  // Create batch mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; event_dates: string; status: string }) => {
      const { error } = await supabase.from("futures_mentorship_batches").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-batches"] });
      toast({ title: "Batch created", description: "New futures mentorship batch has been created" });
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update batch mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; event_dates: string; status: string }) => {
      const { id, ...updates } = data;
      const { error } = await supabase.from("futures_mentorship_batches").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-batches"] });
      toast({ title: "Batch updated", description: "Batch has been updated successfully" });
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete batch mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("futures_mentorship_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-batches"] });
      toast({ title: "Batch deleted", description: "Batch has been deleted" });
      setDeletingBatch(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mark as refunded mutation
  const refundMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("futures_mentorship_students")
        .update({ status: "refunded", refund_reason: reason })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-students"] });
      toast({ title: "Marked as refunded", description: "Student has been marked as refunded" });
      setRefundingStudent(null);
      setRefundNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update notes mutation - now includes follow-up date
  // Update notes mutation - now includes follow-up date and PAE
  const notesMutation = useMutation({
    mutationFn: async ({ id, notes, nextFollowUpDate, payAfterEarning }: { id: string; notes: string; nextFollowUpDate: string | null; payAfterEarning: boolean }) => {
      const { error } = await supabase
        .from("futures_mentorship_students")
        .update({ notes, next_follow_up_date: nextFollowUpDate, pay_after_earning: payAfterEarning })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-students"] });
      toast({ title: "Notes updated", description: "Notes and follow-up date have been saved" });
      setNotesStudent(null);
      setNotesText("");
      setFollowUpDate(undefined);
      setPayAfterEarning(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Discontinued mutation
  const discontinueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("futures_mentorship_students")
        .update({ status: "discontinued" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-students"] });
      toast({ title: "Status updated", description: "Student has been marked as discontinued" });
      setDiscontinuingStudent(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete student mutation (admin only)
  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete associated EMI payments
      await supabase.from("futures_emi_payments").delete().eq("student_id", id);
      // Delete offer amount history
      await supabase.from("futures_offer_amount_history").delete().eq("student_id", id);
      // Then delete the student
      const { error } = await supabase.from("futures_mentorship_students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-students"] });
      queryClient.invalidateQueries({ queryKey: ["futures-batches"] });
      toast({ title: "Student deleted", description: "Student entry has been permanently removed" });
      setDeletingStudent(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseForm = () => {
    setIsCreateOpen(false);
    setEditingBatch(null);
    setFormName("");
    setFormEventDates("");
    setFormStatus("active");
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast({ title: "Error", description: "Batch name is required", variant: "destructive" });
      return;
    }
    
    if (editingBatch) {
      updateMutation.mutate({ id: editingBatch.id, name: formName, event_dates: formEventDates, status: formStatus });
    } else {
      createMutation.mutate({ name: formName, event_dates: formEventDates, status: formStatus });
    }
  };

  const openEditDialog = (batch: FuturesBatch) => {
    setEditingBatch(batch);
    setFormName(batch.name);
    setFormEventDates(batch.event_dates || "");
    setFormStatus(batch.status);
  };

  const exportStudentsCSV = () => {
    if (!filteredStudents.length) return;
    
    const headers = ["Conversion Date", "Student Name", "Amount Offered", "Cash Received", "Due Amount", "Email", "Phone", "Closer", "Status"];
    const rows = filteredStudents.map(s => [
      format(new Date(s.conversion_date), "yyyy-MM-dd"),
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
    a.download = `${selectedBatch?.name || "futures"}-students-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "refunded":
        return <Badge variant="destructive">Refunded</Badge>;
      case "discontinued":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Discontinued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBatchStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completed</Badge>;
      case "planned":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Planned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Batch List View
  if (!selectedBatch) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Responsive Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
            <h1 className="text-xl sm:text-2xl font-bold">Futures Mentorship</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto h-11 sm:h-10">
              <Plus className="h-4 w-4 mr-2" />
              Add Batch
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg sm:text-xl">Batches</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search batches..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="pl-8 h-11 sm:h-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {batchesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch Name</TableHead>
                        <TableHead>Event Dates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Students</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBatches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No batches found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredBatches.map((batch) => (
                          <TableRow 
                            key={batch.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedBatch(batch)}
                          >
                            <TableCell className="font-medium">{batch.name}</TableCell>
                            <TableCell>{batch.event_dates || "TBD"}</TableCell>
                            <TableCell>{getBatchStatusBadge(batch.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                {batch.students_count}
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(batch)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => setDeletingBatch(batch)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {filteredBatches.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No batches found</p>
                  ) : (
                    filteredBatches.map((batch) => (
                      <div 
                        key={batch.id}
                        className="p-4 rounded-lg border bg-card cursor-pointer active:bg-muted/50"
                        onClick={() => setSelectedBatch(batch)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{batch.name}</p>
                            <p className="text-sm text-muted-foreground">{batch.event_dates || "TBD"}</p>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(batch)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingBatch(batch)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          {getBatchStatusBadge(batch.status)}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {batch.students_count} students
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Batch Dialog */}
        <Dialog open={isCreateOpen || !!editingBatch} onOpenChange={(open) => !open && handleCloseForm()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBatch ? "Edit Batch" : "Create New Batch"}</DialogTitle>
              <DialogDescription>
                {editingBatch ? "Update the batch details" : "Add a new futures mentorship batch"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Future Mentorship Batch 10"
                />
              </div>
              <div className="space-y-2">
                <Label>Event Dates</Label>
                <Input
                  value={formEventDates}
                  onChange={(e) => setFormEventDates(e.target.value)}
                  placeholder="e.g., 15-16 Feb 2025"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseForm}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingBatch ? "Save Changes" : "Create Batch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingBatch} onOpenChange={(open) => !open && setDeletingBatch(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Batch</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingBatch?.name}"? This action cannot be undone and will remove all students in this batch.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingBatch && deleteMutation.mutate(deletingBatch.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Handler for opening student list dialog from insights
  const handleOpenStudentList = (title: string, subtitle: string, students: FuturesStudent[]) => {
    setStudentListTitle(title);
    setStudentListSubtitle(subtitle);
    setStudentListData(students);
    setShowStudentListDialog(true);
  };

  // Batch Detail View
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Responsive Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" onClick={() => setSelectedBatch(null)} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{selectedBatch.name}</h1>
            <p className="text-sm text-muted-foreground">Event Dates: {selectedBatch.event_dates || "TBD"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isManager) && (
            <Button onClick={() => setAddStudentOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          )}
        </div>
      </div>

      {/* Business Insights Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">
            <Eye className="h-4 w-4 mr-1 sm:mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-xs sm:text-sm py-2">
            <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="students" className="text-xs sm:text-sm py-2">
            <Users className="h-4 w-4 mr-1 sm:mr-2" />
            Students
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <WeekSummaryCard
            thisWeekTotal={insights.thisWeekTotal}
            thisWeekStudentCount={insights.thisWeekStudentCount}
            collectionRate={insights.collectionRate}
            totalReceivables={insights.totalReceivables}
          />
          
          <UpcomingPaymentsCalendar
            upcomingPayments={insights.upcomingPayments}
            onDateClick={(date, students) => handleOpenStudentList(
              `Students Due on ${format(new Date(date), "dd MMM yyyy")}`,
              `${students.length} students with follow-up scheduled`,
              students as FuturesStudent[]
            )}
          />
          
          <ActionRequiredCards
            studentsWithoutFollowUp={insights.studentsWithoutFollowUp}
            studentsWithoutFollowUpAmount={insights.studentsWithoutFollowUpAmount}
            overdueFollowUps={insights.overdueFollowUps}
            overdueFollowUpsAmount={insights.overdueFollowUpsAmount}
            onViewNoFollowUp={() => handleOpenStudentList(
              "Students Without Follow-up Date",
              "These students have pending dues but no follow-up date set",
              insights.studentsWithoutFollowUp as FuturesStudent[]
            )}
            onViewOverdue={() => handleOpenStudentList(
              "Overdue Follow-ups",
              "Follow-up date has passed but student still has pending dues",
              insights.overdueFollowUps as FuturesStudent[]
            )}
          />
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <ReceivablesAgingTable
            receivablesAging={insights.receivablesAging}
            onBracketClick={(bracket, students) => handleOpenStudentList(
              `Receivables: ${bracket}`,
              `Students with dues in this aging bracket`,
              students as FuturesStudent[]
            )}
          />
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-4">
      {/* Row 1: Financial Cards with Closer Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Offered Card */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
            <div className="p-4 flex flex-col justify-center bg-blue-50">
              <p className="text-sm text-muted-foreground">Total Offered</p>
              <div className="text-base sm:text-lg font-bold text-blue-700 whitespace-nowrap">
                ₹{allStudentsTotals.offered.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {allStudentsTotals.count} students
              </p>
            </div>
            <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-medium">By Closer</p>
              {closerBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                closerBreakdown.map((closer, idx) => (
                  <div key={closer.closerId} className={cn(
                    "flex justify-between items-baseline text-sm gap-2",
                    idx < closerBreakdown.length - 1 && "border-b pb-1"
                  )}>
                    <span className="truncate min-w-0 flex-1" title={closer.closerName}>{closer.closerName}</span>
                    <span className="font-medium whitespace-nowrap">
                      ₹{closer.offered.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Cash Received Card */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
            <div className="p-4 flex flex-col justify-center bg-green-50">
              <p className="text-sm text-muted-foreground">Cash Received</p>
              <div className="text-base sm:text-lg font-bold text-green-700 whitespace-nowrap">
                ₹{allStudentsTotals.received.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {allStudentsTotals.count} students
              </p>
            </div>
            <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-medium">By Closer</p>
              {closerBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                closerBreakdown.map((closer, idx) => (
                  <div key={closer.closerId} className={cn(
                    "flex justify-between items-baseline text-sm gap-2",
                    idx < closerBreakdown.length - 1 && "border-b pb-1"
                  )}>
                    <span className="truncate min-w-0 flex-1" title={closer.closerName}>{closer.closerName}</span>
                    <span className="font-medium whitespace-nowrap">
                      ₹{closer.received.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Remaining Amount Card - Clickable filter */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterRemaining && "ring-2 ring-orange-500"
          )}
          onClick={() => {
            if (filterRemaining) {
              setFilterRemaining(false);
            } else {
              setFilterRemaining(true);
              setFilterRefunded(false);
              setFilterDiscontinued(false);
              setFilterTodayFollowUp(false);
              setFilterFullPayment(false);
            }
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
            <div className="p-4 flex flex-col justify-center bg-orange-50">
              <p className="text-sm text-muted-foreground">Remaining Amount</p>
              <div className="text-base sm:text-lg font-bold text-orange-700 whitespace-nowrap">
                ₹{allStudentsTotals.due.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {allStudentsTotals.duePaymentCount} students
              </p>
              {filterRemaining && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 mt-2 w-fit">
                  Filter Active
                </Badge>
              )}
            </div>
            <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-medium">By Closer</p>
              {closerBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                closerBreakdown.map((closer, idx) => (
                  <div key={closer.closerId} className={cn(
                    "flex justify-between items-baseline text-sm gap-2",
                    idx < closerBreakdown.length - 1 && "border-b pb-1"
                  )}>
                    <span className="truncate min-w-0 flex-1" title={closer.closerName}>{closer.closerName}</span>
                    <span className="font-medium whitespace-nowrap">
                      ₹{closer.due.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Status Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Refunded Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterRefunded && "ring-2 ring-amber-500"
          )}
          onClick={() => {
            if (filterRefunded) {
              setFilterRefunded(false);
            } else {
              setFilterRefunded(true);
              setFilterDiscontinued(false);
              setFilterTodayFollowUp(false);
              setFilterFullPayment(false);
              setFilterRemaining(false);
            }
          }}
        >
          <div className="p-4 bg-amber-50 h-full">
            <p className="text-sm text-muted-foreground">Refunded</p>
            <div className="text-xl font-bold text-amber-700">
              ₹{allStudentsTotals.refundedReceived.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {allStudentsTotals.refundedCount} students
            </p>
            {filterRefunded && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>

        {/* Discontinued Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterDiscontinued && "ring-2 ring-red-500"
          )}
          onClick={() => {
            if (filterDiscontinued) {
              setFilterDiscontinued(false);
            } else {
              setFilterDiscontinued(true);
              setFilterRefunded(false);
              setFilterTodayFollowUp(false);
              setFilterFullPayment(false);
              setFilterRemaining(false);
            }
          }}
        >
          <div className="p-4 bg-red-50 h-full">
            <p className="text-sm text-muted-foreground">Discontinued</p>
            <div className="text-xl font-bold text-red-700">
              ₹{allStudentsTotals.discontinuedReceived.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {allStudentsTotals.discontinuedCount} students
            </p>
            {filterDiscontinued && (
              <Badge variant="secondary" className="bg-red-100 text-red-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>

        {/* Full Payment Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterFullPayment && "ring-2 ring-emerald-500"
          )}
          onClick={() => {
            if (filterFullPayment) {
              setFilterFullPayment(false);
            } else {
              setFilterFullPayment(true);
              setFilterRefunded(false);
              setFilterDiscontinued(false);
              setFilterTodayFollowUp(false);
              setFilterRemaining(false);
            }
          }}
        >
          <div className="p-4 bg-emerald-50 h-full">
            <p className="text-sm text-muted-foreground">Full Payment</p>
            <div className="text-xl font-bold text-emerald-700">
              {allStudentsTotals.fullPaymentCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Students with no dues
            </p>
            {filterFullPayment && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>

        {/* Today's Follow-up Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterTodayFollowUp && "ring-2 ring-purple-500"
          )}
          onClick={() => {
            if (filterTodayFollowUp) {
              setFilterTodayFollowUp(false);
            } else {
              setFilterTodayFollowUp(true);
              setFilterRefunded(false);
              setFilterDiscontinued(false);
              setFilterFullPayment(false);
              setFilterRemaining(false);
              setFilterPAE(false);
            }
          }}
        >
          <div className="p-4 bg-purple-50 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Follow-ups</p>
                <div className="text-xl font-bold text-purple-700">
                  {todayFollowUpCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  To contact today
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-300" />
            </div>
            {filterTodayFollowUp && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>

        {/* Pay After Earning Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterPAE && "ring-2 ring-violet-500"
          )}
          onClick={() => {
            if (filterPAE) {
              setFilterPAE(false);
            } else {
              setFilterPAE(true);
              setFilterRefunded(false);
              setFilterDiscontinued(false);
              setFilterFullPayment(false);
              setFilterRemaining(false);
              setFilterTodayFollowUp(false);
            }
          }}
        >
          <div className="p-4 bg-violet-50 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pay After Earning</p>
                <div className="text-xl font-bold text-violet-700">
                  ₹{allStudentsTotals.paeAmount.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {allStudentsTotals.paeCount} students
                </p>
              </div>
              <HandCoins className="h-8 w-8 text-violet-300" />
            </div>
            {filterPAE && (
              <Badge variant="secondary" className="bg-violet-100 text-violet-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Students Section */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 sm:pb-6">
          <div>
            <CardTitle className="text-lg sm:text-xl">Students</CardTitle>
            <CardDescription>{filteredStudents.length} of {batchStudents?.length || 0} students</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearAllFilters} className="h-11 sm:h-10">
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Clear All</span>
              </Button>
            )}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative h-11 sm:h-10">
                  <Filter className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 sm:ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:w-[400px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 py-6">
                  <div className="space-y-3">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-11 sm:h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                        <SelectItem value="discontinued">Discontinued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label>Date Range</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("flex-1 justify-start h-11 sm:h-10", !dateFrom && "text-muted-foreground")}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateFrom ? format(dateFrom, "dd MMM yyyy") : "From"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={dateFrom}
                            onSelect={(d) => { setDateFrom(d); setIsDateFromOpen(false); }}
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("flex-1 justify-start h-11 sm:h-10", !dateTo && "text-muted-foreground")}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateTo ? format(dateTo, "dd MMM yyyy") : "To"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={dateTo}
                            onSelect={(d) => { setDateTo(d); setIsDateToOpen(false); }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                <SheetFooter className="flex-row gap-2">
                  <Button variant="outline" onClick={clearAllFilters} className="flex-1 h-11 sm:h-10">Clear All</Button>
                  <Button onClick={() => setIsFilterOpen(false)} className="flex-1 h-11 sm:h-10">Apply</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Button variant="outline" onClick={exportStudentsCSV} className="h-11 sm:h-10">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button onClick={() => setAddStudentOpen(true)} className="h-11 sm:h-10">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Student</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="mb-4">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-11 sm:h-10"
              />
            </div>
          </div>
          
          {studentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Conversion Date</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Amount Offered</TableHead>
                      <TableHead>Cash Received</TableHead>
                      <TableHead>Due Amount</TableHead>
                      <TableHead>Closer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No students found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => (
                        <React.Fragment key={student.id}>
                          <TableRow 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                          >
                            <TableCell>
                              {expandedStudentId === student.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(student.conversion_date), "dd MMM yyyy")}</TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {student.contact_name}
                                {student.pay_after_earning && (student.due_amount || 0) > 0 && (
                                  <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                                    PAE
                                  </Badge>
                                )}
                                {(student.notes || student.next_follow_up_date) && (
                                  <FileText 
                                    className="h-4 w-4 text-blue-500 cursor-pointer hover:text-blue-700 transition-colors" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingNotesStudent(student);
                                    }}
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>₹{student.offer_amount.toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-green-600">₹{student.cash_received.toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-orange-600">₹{student.due_amount.toLocaleString('en-IN')}</TableCell>
                            <TableCell>{student.closer_name || "Added Manually"}</TableCell>
                            <TableCell>{getStatusBadge(student.status)}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEmiStudent(student)}>
                                    <IndianRupee className="h-4 w-4 mr-2" />
                                    Update EMI
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setNotesStudent(student);
                                    setNotesText(student.notes || "");
                                    setFollowUpDate(student.next_follow_up_date ? new Date(student.next_follow_up_date) : undefined);
                                    setPayAfterEarning(student.pay_after_earning || false);
                                  }}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Edit Notes
                                  </DropdownMenuItem>
                                  {student.status === "active" && (
                                    <>
                                      <DropdownMenuItem onClick={() => setRefundingStudent(student)}>
                                        <RefreshCcw className="h-4 w-4 mr-2" />
                                        Mark as Refunded
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setDiscontinuingStudent(student)}>
                                        <X className="h-4 w-4 mr-2" />
                                        Discontinued
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {isAdmin && (
                                    <DropdownMenuItem 
                                      onClick={() => setDeletingStudent(student)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Student
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                          {/* Expanded EMI Row */}
                          {expandedStudentId === student.id && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={9} className="py-4">
                                <div className="pl-8">
                                  <h4 className="font-medium mb-3">EMI Payment History</h4>
                                  {emiLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : studentEmiPayments && studentEmiPayments.length > 0 ? (
                                    <div className="rounded-md border overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-[80px]">EMI #</TableHead>
                                            <TableHead>Cash Collected</TableHead>
                                            <TableHead>No Cost EMI</TableHead>
                                            <TableHead>GST</TableHead>
                                            <TableHead>Platform Fees</TableHead>
                                            <TableHead>Platform</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Remarks</TableHead>
                                            <TableHead>Updated By</TableHead>
                                            <TableHead className="w-[100px]">Actions</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {studentEmiPayments.map((emi) => (
                                            <TableRow key={emi.id}>
                                              <TableCell className="font-medium">EMI {emi.emi_number}</TableCell>
                                              <TableCell className="text-green-600">₹{Number(emi.amount).toLocaleString('en-IN')}</TableCell>
                                              <TableCell>₹{Number(emi.no_cost_emi || 0).toLocaleString('en-IN')}</TableCell>
                                              <TableCell>₹{Number(emi.gst_fees || 0).toLocaleString('en-IN')}</TableCell>
                                              <TableCell>₹{Number(emi.platform_fees || 0).toLocaleString('en-IN')}</TableCell>
                                              <TableCell>{emi.payment_platform || "-"}</TableCell>
                                              <TableCell>{format(new Date(emi.payment_date), "dd MMM yyyy")}</TableCell>
                                              <TableCell className="max-w-[150px] truncate" title={emi.remarks || undefined}>
                                                {emi.remarks || "-"}
                                              </TableCell>
                                              <TableCell>{emi.created_by_profile?.full_name || "Unknown"}</TableCell>
                                              <TableCell>
                                                <div className="flex gap-1">
                                                  <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEmiStudent(student);
                                                    }}
                                                  >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                  </Button>
                                                  <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEmiStudent(student);
                                                    }}
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <p className="text-muted-foreground text-sm">No EMI payments recorded</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {filteredStudents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No students found</p>
                ) : (
                  filteredStudents.map((student) => (
                    <div key={student.id} className="rounded-lg border bg-card overflow-hidden">
                      <div 
                        className="p-4 cursor-pointer active:bg-muted/50"
                        onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {expandedStudentId === student.id ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{student.contact_name}</p>
                                {(student.notes || student.next_follow_up_date) && (
                                  <FileText 
                                    className="h-4 w-4 text-blue-500 cursor-pointer hover:text-blue-700 transition-colors flex-shrink-0" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingNotesStudent(student);
                                    }}
                                  />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{format(new Date(student.conversion_date), "dd MMM yyyy")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {getStatusBadge(student.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEmiStudent(student)}>
                                  <IndianRupee className="h-4 w-4 mr-2" />
                                  Update EMI
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setNotesStudent(student);
                                  setNotesText(student.notes || "");
                                  setFollowUpDate(student.next_follow_up_date ? new Date(student.next_follow_up_date) : undefined);
                                }}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Edit Notes
                                </DropdownMenuItem>
                                {student.status === "active" && (
                                  <>
                                    <DropdownMenuItem onClick={() => setRefundingStudent(student)}>
                                      <RefreshCcw className="h-4 w-4 mr-2" />
                                      Mark as Refunded
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setDiscontinuingStudent(student)}>
                                      <X className="h-4 w-4 mr-2" />
                                      Discontinued
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {isAdmin && (
                                  <DropdownMenuItem 
                                    onClick={() => setDeletingStudent(student)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Student
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Offered</p>
                            <p className="font-medium">₹{student.offer_amount.toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Received</p>
                            <p className="font-medium text-green-600">₹{student.cash_received.toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Due</p>
                            <p className="font-medium text-orange-600">₹{student.due_amount.toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Closer: {student.closer_name || "Added Manually"}
                        </div>
                      </div>
                      
                      {/* Mobile Expanded EMI Section */}
                      {expandedStudentId === student.id && (
                        <div className="border-t bg-muted/30 p-4">
                          <h4 className="font-medium mb-3 text-sm">EMI Payment History</h4>
                          {emiLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : studentEmiPayments && studentEmiPayments.length > 0 ? (
                            <div className="space-y-2">
                              {studentEmiPayments.map((emi) => (
                                <div key={emi.id} className="p-3 rounded-md border bg-background text-sm">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="font-medium">EMI {emi.emi_number}</span>
                                    <span className="text-green-600 font-medium">₹{Number(emi.amount).toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                    <span>Date: {format(new Date(emi.payment_date), "dd MMM yyyy")}</span>
                                    <span>Platform: {emi.payment_platform || "-"}</span>
                                    <span>GST: ₹{Number(emi.gst_fees || 0).toLocaleString('en-IN')}</span>
                                    <span>Fees: ₹{Number(emi.platform_fees || 0).toLocaleString('en-IN')}</span>
                                  </div>
                                  {emi.remarks && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">Remarks: {emi.remarks}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm">No EMI payments recorded</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Update EMI Dialog */}
      {emiStudent && (
        <UpdateFuturesEmiDialog
          open={!!emiStudent}
          onOpenChange={(open) => !open && setEmiStudent(null)}
          studentId={emiStudent.id}
          offerAmount={emiStudent.offer_amount}
          cashReceived={emiStudent.cash_received}
          dueAmount={emiStudent.due_amount}
          customerName={emiStudent.contact_name}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["futures-students"] })}
        />
      )}

      {/* Add Student Dialog */}
      <AddFuturesStudentDialog
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
        batchId={selectedBatch.id}
        batchName={selectedBatch.name}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["futures-students"] })}
      />

      {/* Refund Dialog */}
      <AlertDialog open={!!refundingStudent} onOpenChange={(open) => !open && setRefundingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Refunded</AlertDialogTitle>
            <AlertDialogDescription>
              Mark {refundingStudent?.contact_name} as refunded. Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Refund reason..."
              value={refundNotes}
              onChange={(e) => setRefundNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => refundingStudent && refundMutation.mutate({ id: refundingStudent.id, reason: refundNotes })}
              disabled={!refundNotes.trim()}
            >
              Confirm Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notes Dialog with Follow-up Date */}
      <Dialog open={!!notesStudent} onOpenChange={(open) => !open && setNotesStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
            <DialogDescription>Update notes and follow-up date for {notesStudent?.contact_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Enter notes..."
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Next EMI Reminder Date</Label>
              <Popover open={isFollowUpDateOpen} onOpenChange={setIsFollowUpDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !followUpDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {followUpDate ? format(followUpDate, "dd MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={followUpDate}
                    onSelect={(d) => { setFollowUpDate(d); setIsFollowUpDateOpen(false); }}
                  />
                </PopoverContent>
              </Popover>
              {followUpDate && (
                <Button variant="ghost" size="sm" onClick={() => setFollowUpDate(undefined)}>
                  Clear date
                </Button>
              )}
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="pae-toggle" className="flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-violet-600" />
                    Pay After Earning (PAE)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Student will pay remaining amount after earning from the course
                  </p>
                </div>
                <Switch
                  id="pae-toggle"
                  checked={payAfterEarning}
                  onCheckedChange={setPayAfterEarning}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesStudent(null)}>Cancel</Button>
            <Button 
              onClick={() => notesStudent && notesMutation.mutate({ 
                id: notesStudent.id, 
                notes: notesText,
                nextFollowUpDate: followUpDate ? format(followUpDate, "yyyy-MM-dd") : null,
                payAfterEarning
              })}
              disabled={notesMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Notes Dialog (Read-only) */}
      <Dialog open={!!viewingNotesStudent} onOpenChange={(open) => !open && setViewingNotesStudent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notes & Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="font-medium">{viewingNotesStudent?.contact_name}</p>
              <p className="text-sm text-muted-foreground">{viewingNotesStudent?.email}</p>
            </div>
            
            <div className="space-y-1">
              <Label className="text-muted-foreground">Next Follow-up Date</Label>
              <p className="font-medium">
                {viewingNotesStudent?.next_follow_up_date 
                  ? format(new Date(viewingNotesStudent.next_follow_up_date), "dd MMM yyyy")
                  : "Not set"}
              </p>
            </div>
            
            <div className="space-y-1">
              <Label className="text-muted-foreground">Notes</Label>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md min-h-[60px]">
                {viewingNotesStudent?.notes || "No notes added"}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setViewingNotesStudent(null)}>
              Close
            </Button>
            <Button onClick={() => {
              if (viewingNotesStudent) {
                setNotesStudent(viewingNotesStudent);
                setNotesText(viewingNotesStudent.notes || "");
                setFollowUpDate(viewingNotesStudent.next_follow_up_date 
                  ? new Date(viewingNotesStudent.next_follow_up_date) 
                  : undefined);
                setPayAfterEarning(viewingNotesStudent.pay_after_earning || false);
                setViewingNotesStudent(null);
              }
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discontinued Dialog */}
      <AlertDialog open={!!discontinuingStudent} onOpenChange={(open) => !open && setDiscontinuingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Discontinued</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark {discontinuingStudent?.contact_name} as discontinued? This indicates the student is no longer continuing with the program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => discontinuingStudent && discontinueMutation.mutate(discontinuingStudent.id)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Student Dialog (Admin Only) */}
      <AlertDialog open={!!deletingStudent} onOpenChange={(open) => !open && setDeletingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {deletingStudent?.contact_name}? This will also delete all EMI payments and offer history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingStudent && deleteStudentMutation.mutate(deletingStudent.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        </TabsContent>
      </Tabs>

      {/* Student List Dialog for Insights - Outside Tabs so it renders on any tab */}
      <StudentListDialog
        open={showStudentListDialog}
        onOpenChange={setShowStudentListDialog}
        title={studentListTitle}
        subtitle={studentListSubtitle}
        students={studentListData}
        totalAmount={studentListData.reduce((sum, s) => sum + (s.due_amount || 0), 0)}
        onEditNotes={(student) => {
          setShowStudentListDialog(false);
          const futuresStudent = studentListData.find(s => s.id === student.id);
          if (futuresStudent) {
            setNotesStudent(futuresStudent);
            setNotesText(futuresStudent.notes || "");
            setFollowUpDate(futuresStudent.next_follow_up_date ? new Date(futuresStudent.next_follow_up_date) : undefined);
            setPayAfterEarning(futuresStudent.pay_after_earning || false);
          }
        }}
        showFollowUpDate
      />
    </div>
  );
};

export default FuturesMentorship;
