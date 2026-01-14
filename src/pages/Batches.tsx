import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { GraduationCap, Plus, Edit, Trash2, Calendar, ArrowLeft, Users, Loader2, Search, Download, ChevronDown, ChevronRight, IndianRupee, Filter, X, MoreHorizontal, RefreshCcw, FileText, Pencil } from "lucide-react";
import { UpdateEmiDialog } from "@/components/UpdateEmiDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

interface Batch {
  id: string;
  name: string;
  start_date: string;
  is_active: boolean;
  created_at: string;
  students_count?: number;
}

interface BatchStudent {
  id: string;
  lead_id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  classes_access: number | null;
  status: string;
  closer_id: string | null;
  closer_name: string | null;
  scheduled_date: string | null;
  created_at: string;
  offer_amount: number | null;
  cash_received: number | null;
  due_amount: number | null;
  additional_comments: string | null;
  refund_reason: string | null;
}

interface EmiPayment {
  id: string;
  appointment_id: string;
  emi_number: number;
  amount: number;
  payment_date: string;
  previous_classes_access: number | null;
  new_classes_access: number | null;
  previous_cash_received: number | null;
}

const CLASSES_ACCESS_LABELS: Record<number, string> = {
  1: "1 Class",
  2: "2 Classes",
  3: "3 Classes",
  4: "4 Classes",
  5: "5 Classes",
  6: "6 Classes",
  7: "7 Classes",
  8: "8 Classes",
  9: "9 Classes",
  10: "10 Classes",
  11: "11 Classes",
  12: "12 Classes",
  13: "13 Classes",
  14: "14 Classes",
  15: "All Classes",
};

const Batches = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isManager, isCloser, profileId } = useUserRole();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formStartDate, setFormStartDate] = useState<Date | undefined>(undefined);
  const [formIsActive, setFormIsActive] = useState(true);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

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
  
  // Edit batch dialog state
  const [editingStudent, setEditingStudent] = useState<BatchStudent | null>(null);
  const [newBatchId, setNewBatchId] = useState<string>("");
  
  // Refund and notes dialog state
  const [refundingStudent, setRefundingStudent] = useState<BatchStudent | null>(null);
  const [refundNotes, setRefundNotes] = useState<string>("");
  const [notesStudent, setNotesStudent] = useState<BatchStudent | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  
  // Discontinued dialog state
  const [discontinuingStudent, setDiscontinuingStudent] = useState<BatchStudent | null>(null);
  const [discontinuedNotes, setDiscontinuedNotes] = useState<string>("");
  
  // EMI update dialog state
  const [emiStudent, setEmiStudent] = useState<BatchStudent | null>(null);

  // Fetch batches with student counts
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data: batchesData, error } = await supabase
        .from("batches")
        .select("*")
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      
      // Get student counts for each batch
      const batchesWithCounts = await Promise.all(
        (batchesData || []).map(async (batch) => {
          const { count } = await supabase
            .from("call_appointments")
            .select("*", { count: "exact", head: true })
            .eq("batch_id", batch.id);
          
          return { ...batch, students_count: count || 0 };
        })
      );
      
      return batchesWithCounts as Batch[];
    },
  });

  // Fetch students for selected batch (with closer info)
  // For closers, only show their own students
  const { data: batchStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ["batch-students", selectedBatch?.id, isCloser, profileId],
    queryFn: async () => {
      if (!selectedBatch) return [];
      
      let query = supabase
        .from("call_appointments")
        .select(`
          id,
          lead_id,
          closer_id,
          classes_access,
          status,
          scheduled_date,
          created_at,
          offer_amount,
          cash_received,
          due_amount,
          additional_comments,
          refund_reason,
          lead:leads(contact_name, email, phone),
          closer:profiles!closer_id(full_name)
        `)
        .eq("batch_id", selectedBatch.id)
        .order("scheduled_date", { ascending: false })
        .order("created_at", { ascending: false });
      
      // For closers, only show their own students
      if (isCloser && profileId) {
        query = query.eq("closer_id", profileId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []).map((apt) => ({
        id: apt.id,
        lead_id: apt.lead_id,
        contact_name: apt.lead?.contact_name || "Unknown",
        email: apt.lead?.email || "",
        phone: apt.lead?.phone || null,
        classes_access: apt.classes_access,
        status: apt.status,
        closer_id: apt.closer_id,
        closer_name: apt.closer?.full_name || null,
        scheduled_date: apt.scheduled_date,
        created_at: apt.created_at,
        offer_amount: apt.offer_amount,
        cash_received: apt.cash_received,
        due_amount: apt.due_amount,
        additional_comments: apt.additional_comments,
        refund_reason: apt.refund_reason,
      })) as BatchStudent[];
    },
    enabled: !!selectedBatch,
  });

  // Fetch EMI payments for expanded student
  const { data: studentEmiPayments, isLoading: emiLoading } = useQuery({
    queryKey: ["batch-student-emi", expandedStudentId],
    queryFn: async () => {
      if (!expandedStudentId) return [];
      
      const { data, error } = await supabase
        .from("emi_payments")
        .select("*")
        .eq("appointment_id", expandedStudentId)
        .order("emi_number", { ascending: true });
      
      if (error) throw error;
      return data as EmiPayment[];
    },
    enabled: !!expandedStudentId,
  });

  // Fetch all EMI payments for the batch (for filtering)
  const { data: batchEmiPayments } = useQuery({
    queryKey: ["batch-all-emi-payments", selectedBatch?.id],
    queryFn: async () => {
      if (!selectedBatch || !batchStudents?.length) return [];
      
      const appointmentIds = batchStudents.map(s => s.id);
      const { data, error } = await supabase
        .from("emi_payments")
        .select("*")
        .in("appointment_id", appointmentIds);
      
      if (error) throw error;
      return data as EmiPayment[];
    },
    enabled: !!selectedBatch && !!batchStudents?.length,
  });

  // Get unique closers from batch students for filter
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

  // Get unique classes from batch students for filter
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

  // Filter students based on search and advanced filters
  const filteredStudents = useMemo(() => {
    if (!batchStudents) return [];
    
    return batchStudents.filter(student => {
      // Search filter (name, email, phone)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        student.contact_name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower) ||
        (student.phone && student.phone.includes(searchQuery));
      
      // Multi-select closer filter
      const matchesCloser = selectedClosers.length === 0 || 
        (student.closer_id && selectedClosers.includes(student.closer_id));
      
      // Multi-select classes filter
      const matchesClasses = selectedClasses.length === 0 || 
        (student.classes_access && selectedClasses.includes(student.classes_access.toString()));
      
      // Date range filter (based on scheduled_date for initial, or EMI payment_date)
      // Convert UTC to IST (add 5 hours 30 minutes) and compare date portions only
      const convertToISTDate = (dateString: string): Date => {
        const utcDate = new Date(dateString);
        // Add 5 hours 30 minutes for IST
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
        return startOfDay(istDate);
      };
      
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const fromDateNormalized = dateFrom ? startOfDay(dateFrom) : null;
        const toDateNormalized = dateTo ? startOfDay(dateTo) : null;
        
        if (paymentTypeFilter === "emi") {
          // For EMI filter, check if student has EMI payments in date range
          const studentEmis = batchEmiPayments?.filter(emi => emi.appointment_id === student.id) || [];
          matchesDate = studentEmis.some(emi => {
            const emiDateIST = convertToISTDate(emi.payment_date);
            const afterFrom = !fromDateNormalized || emiDateIST >= fromDateNormalized;
            const beforeTo = !toDateNormalized || emiDateIST <= toDateNormalized;
            return afterFrom && beforeTo;
          });
        } else {
          // For initial/all, check scheduled_date
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
      
      // Payment type filter
      let matchesPaymentType = true;
      if (paymentTypeFilter === "emi") {
        // Show only students who have EMI payments
        const hasEmis = batchEmiPayments?.some(emi => emi.appointment_id === student.id);
        matchesPaymentType = !!hasEmis;
      } else if (paymentTypeFilter === "initial") {
        // Show only students with initial payment (cash_received > 0)
        matchesPaymentType = (student.cash_received || 0) > 0;
      }
      
      return matchesSearch && matchesCloser && matchesClasses && matchesDate && matchesPaymentType;
    });
  }, [batchStudents, searchQuery, selectedClosers, selectedClasses, dateFrom, dateTo, paymentTypeFilter, batchEmiPayments]);

  // Calculate closer breakdown and totals based on filtered students
  const { closerBreakdown, totals, refundedBreakdown, refundedTotals, discontinuedBreakdown, discontinuedTotals } = useMemo(() => {
    // Separate students by status
    const activeStudents = filteredStudents.filter(s => 
      s.status !== 'refunded' && s.status !== 'discontinued'
    );
    const refundedStudents = filteredStudents.filter(s => s.status === 'refunded');
    const discontinuedStudents = filteredStudents.filter(s => s.status === 'discontinued');

    // Helper function to calculate breakdown for a set of students
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
          breakdown[closerId] = { 
            closerId, 
            closerName, 
            offered: 0, 
            received: 0, 
            due: 0,
            emiCollected: 0,
            count: 0
          };
        }
        
        breakdown[closerId].offered += student.offer_amount || 0;
        breakdown[closerId].received += student.cash_received || 0;
        breakdown[closerId].due += student.due_amount || 0;
        breakdown[closerId].count += 1;
        
        // Calculate EMI collected for this student
        const studentEmis = batchEmiPayments?.filter(emi => emi.appointment_id === student.id) || [];
        const emiTotal = studentEmis.reduce((sum, emi) => sum + Number(emi.amount), 0);
        breakdown[closerId].emiCollected += emiTotal;
      });
      
      return Object.values(breakdown).sort((a, b) => b.received - a.received);
    };

    // Helper function to calculate totals from breakdown
    const calculateTotals = (breakdownArray: ReturnType<typeof calculateBreakdown>) => ({
      offered: breakdownArray.reduce((sum, c) => sum + c.offered, 0),
      received: breakdownArray.reduce((sum, c) => sum + c.received, 0),
      due: breakdownArray.reduce((sum, c) => sum + c.due, 0),
      emiCollected: breakdownArray.reduce((sum, c) => sum + c.emiCollected, 0),
      count: breakdownArray.reduce((sum, c) => sum + c.count, 0)
    });

    // Calculate for active students (main totals)
    const activeBreakdown = calculateBreakdown(activeStudents);
    const activeTotals = calculateTotals(activeBreakdown);

    // Calculate for refunded students
    const refundedBreakdownCalc = calculateBreakdown(refundedStudents);
    const refundedTotalsCalc = calculateTotals(refundedBreakdownCalc);

    // Calculate for discontinued students
    const discontinuedBreakdownCalc = calculateBreakdown(discontinuedStudents);
    const discontinuedTotalsCalc = calculateTotals(discontinuedBreakdownCalc);
    
    return { 
      closerBreakdown: activeBreakdown, 
      totals: activeTotals,
      refundedBreakdown: refundedBreakdownCalc,
      refundedTotals: refundedTotalsCalc,
      discontinuedBreakdown: discontinuedBreakdownCalc,
      discontinuedTotals: discontinuedTotalsCalc
    };
  }, [filteredStudents, batchEmiPayments]);

  // Filter batches based on search query
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    if (!batchSearchQuery.trim()) return batches;
    
    const searchLower = batchSearchQuery.toLowerCase();
    return batches.filter(batch => 
      batch.name.toLowerCase().includes(searchLower)
    );
  }, [batches, batchSearchQuery]);

  // Count active filters (exclude payment type for managers)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedClosers.length > 0) count++;
    if (selectedClasses.length > 0) count++;
    if (dateFrom || dateTo) count++;
    if (!isManager && !isCloser && paymentTypeFilter !== "all") count++;
    return count;
  }, [selectedClosers, selectedClasses, dateFrom, dateTo, paymentTypeFilter, isManager, isCloser]);

  // Clear all filters (managers don't have payment type filter)
  const clearAllFilters = () => {
    setSelectedClosers([]);
    setSelectedClasses([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    if (!isManager && !isCloser) {
      setPaymentTypeFilter("all");
    }
  };

  // Create batch mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; start_date: string; is_active: boolean }) => {
      const { error } = await supabase.from("batches").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast({ title: "Batch created", description: "New batch has been created successfully" });
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update batch mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; start_date: string; is_active: boolean }) => {
      const { id, ...updates } = data;
      const { error } = await supabase.from("batches").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
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
      // First, remove batch_id from any call_appointments
      await supabase.from("call_appointments").update({ batch_id: null }).eq("batch_id", id);
      
      const { error } = await supabase.from("batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast({ title: "Batch deleted", description: "Batch has been deleted successfully" });
      setDeletingBatch(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Transfer student to different batch mutation
  const transferMutation = useMutation({
    mutationFn: async ({ appointmentId, newBatchId }: { appointmentId: string; newBatchId: string }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({ batch_id: newBatchId })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-students", selectedBatch?.id] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast({ title: "Student Transferred", description: "Student has been moved to the new batch" });
      setEditingStudent(null);
      setNewBatchId("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mark student as refunded mutation
  const markRefundedMutation = useMutation({
    mutationFn: async ({ appointmentId, refundReason }: { appointmentId: string; refundReason: string }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({ status: "refunded", refund_reason: refundReason })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-students", selectedBatch?.id] });
      toast({ title: "Status Updated", description: "Student has been marked as refunded" });
      setRefundingStudent(null);
      setRefundNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ appointmentId, notes }: { appointmentId: string; notes: string }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({ additional_comments: notes })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-students", selectedBatch?.id] });
      toast({ title: "Notes Saved", description: "Notes have been saved successfully" });
      setNotesStudent(null);
      setNotesText("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mark student as discontinued mutation
  const markDiscontinuedMutation = useMutation({
    mutationFn: async ({ appointmentId, discontinuedReason }: { appointmentId: string; discontinuedReason: string }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({ status: "discontinued", refund_reason: discontinuedReason })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-students", selectedBatch?.id] });
      toast({ title: "Status Updated", description: "Student has been marked as discontinued" });
      setDiscontinuingStudent(null);
      setDiscontinuedNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseForm = () => {
    setIsCreateOpen(false);
    setEditingBatch(null);
    setFormName("");
    setFormStartDate(undefined);
    setFormIsActive(true);
  };

  const handleOpenEdit = (batch: Batch) => {
    setEditingBatch(batch);
    setFormName(batch.name);
    setFormStartDate(new Date(batch.start_date));
    setFormIsActive(batch.is_active);
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formStartDate) {
      toast({ title: "Validation Error", description: "Name and start date are required", variant: "destructive" });
      return;
    }
    
    const data = {
      name: formName.trim(),
      start_date: format(formStartDate, "yyyy-MM-dd"),
      is_active: formIsActive,
    };
    
    if (editingBatch) {
      updateMutation.mutate({ ...data, id: editingBatch.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleTransferStudent = () => {
    if (!editingStudent || !newBatchId) return;
    transferMutation.mutate({ appointmentId: editingStudent.id, newBatchId });
  };

  // Reset filters when leaving batch detail view
  const handleBackToBatches = () => {
    setSelectedBatch(null);
    setExpandedStudentId(null);
    setSearchQuery("");
    setEmiStudent(null);
    clearAllFilters();
  };

  // Export students to CSV with full EMI details (no financial data for managers)
  const handleExportStudents = async () => {
    if (!filteredStudents?.length) return;

    // For managers, skip EMI data entirely
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
    // Fetch all EMI payments for all filtered students
    const appointmentIds = filteredStudents.map(s => s.id);
    const { data: allEmiPayments } = await supabase
      .from("emi_payments")
      .select("*")
      .in("appointment_id", appointmentIds)
      .order("emi_number", { ascending: true });

    // Group EMI payments by appointment_id
    const emiByAppointment: Record<string, EmiPayment[]> = {};
    (allEmiPayments || []).forEach(emi => {
      if (!emiByAppointment[emi.appointment_id]) {
        emiByAppointment[emi.appointment_id] = [];
      }
      emiByAppointment[emi.appointment_id].push(emi);
    });

    // Find max number of EMIs across all students
    const maxEmis = Math.max(1, ...Object.values(emiByAppointment).map(emis => emis.length));

    // Build dynamic headers
    const baseHeaders = [
      "Conversion Date", "Student Name", "Offered Amount", "Cash Received", "Due Amount",
      "Closer", "Email", "Phone", "Initial Classes Access", "Status"
    ];
    
    // Add EMI columns dynamically: Amount, Date, Prev Cash, New Classes After
    const emiHeaders: string[] = [];
    for (let i = 1; i <= maxEmis; i++) {
      emiHeaders.push(`EMI ${i} Amount`, `EMI ${i} Date`, `EMI ${i} Prev Cash`, `EMI ${i} New Classes After`);
    }
    emiHeaders.push("Total EMI Collected");

    const headers = [...baseHeaders, ...emiHeaders];

    const rows = filteredStudents.map(student => {
      const baseData = [
        student.scheduled_date ? format(new Date(student.scheduled_date), "dd MMM yyyy") : "",
        student.contact_name || "",
        student.offer_amount?.toString() || "",
        student.cash_received?.toString() || "",
        student.due_amount?.toString() || "",
        student.closer_name || "",
        student.email || "",
        student.phone || "",
        student.classes_access ? CLASSES_ACCESS_LABELS[student.classes_access] || "" : "",
        student.status || "",
      ];

      // Add EMI data
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
          emiData.push("");
          emiData.push("");
          emiData.push("");
          emiData.push("");
        }
      }
      emiData.push(totalEmiCollected > 0 ? totalEmiCollected.toString() : "");

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

  const toggleStudentExpand = (studentId: string) => {
    setExpandedStudentId(prev => prev === studentId ? null : studentId);
  };

  // Toggle closer selection
  const toggleCloser = (closerId: string) => {
    setSelectedClosers(prev => 
      prev.includes(closerId) 
        ? prev.filter(id => id !== closerId)
        : [...prev, closerId]
    );
  };

  // Toggle class selection
  const toggleClass = (classNum: string) => {
    setSelectedClasses(prev => 
      prev.includes(classNum) 
        ? prev.filter(c => c !== classNum)
        : [...prev, classNum]
    );
  };


  // Batch detail view
  if (selectedBatch) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Back button + Batch info */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToBatches}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{selectedBatch.name}</h1>
              <p className="text-muted-foreground">
                Start Date: {format(new Date(selectedBatch.start_date), "dd MMM yyyy")} • 
                {selectedBatch.is_active ? " Active" : " Inactive"}
              </p>
            </div>
          </div>
          
          {/* Right side: Compact Students Enrolled Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Students Enrolled</p>
                  <p className="text-xl font-bold">
                    {activeFilterCount > 0 
                      ? `${filteredStudents.length} of ${batchStudents?.length || 0}` 
                      : batchStudents?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards - Hidden for Managers */}
        {!isManager && (
          <>
            {paymentTypeFilter === "emi" ? (
              // Single EMI Collected Card when EMI filter is active
              <Card className="overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                  <div className="p-4 flex flex-col justify-center bg-purple-50">
                    <p className="text-sm text-muted-foreground">EMI Collected</p>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-700 break-words">
                      ₹{totals.emiCollected.toLocaleString('en-IN')}
                    </div>
                    {(dateFrom || dateTo) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {dateFrom && dateTo 
                          ? `${format(dateFrom, "dd MMM")} - ${format(dateTo, "dd MMM yyyy")}`
                          : dateFrom 
                            ? `From ${format(dateFrom, "dd MMM yyyy")}`
                            : `Until ${format(dateTo!, "dd MMM yyyy")}`
                        }
                      </p>
                    )}
                  </div>
                  <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-xs text-muted-foreground font-medium">By Closer</p>
                    {closerBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No EMI data</p>
                    ) : (
                      closerBreakdown.map((closer, idx) => (
                        <div key={closer.closerId} className={cn(
                          "flex justify-between items-baseline text-sm gap-2",
                          idx < closerBreakdown.length - 1 && "border-b pb-1"
                        )}>
                          <span className="truncate min-w-0 flex-1" title={closer.closerName}>{closer.closerName}</span>
                          <span className="font-medium whitespace-nowrap">
                            ₹{closer.emiCollected.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              // Regular cards for All/Initial payment filter - now 5 cards
              <div className="space-y-4">
                {/* Row 1: Active Student Cards (3 columns) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Offered Amount Card */}
                  <Card className="overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                      <div className="p-4 flex flex-col justify-center bg-blue-50">
                        <p className="text-sm text-muted-foreground">Total Offered</p>
                        <div className="text-base sm:text-lg font-bold text-blue-700 whitespace-nowrap">
                          ₹{totals.offered.toLocaleString('en-IN')}
                        </div>
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
                          ₹{totals.received.toLocaleString('en-IN')}
                        </div>
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

                  {/* Remaining Amount Card */}
                  <Card className="overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                      <div className="p-4 flex flex-col justify-center bg-orange-50">
                        <p className="text-sm text-muted-foreground">Remaining Amount</p>
                        <div className="text-base sm:text-lg font-bold text-orange-700 whitespace-nowrap">
                          ₹{totals.due.toLocaleString('en-IN')}
                        </div>
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

                {/* Row 2: Refunded & Discontinued Cards (2 columns) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Refunded Amount Card */}
                  <Card className="overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                      <div className="p-4 flex flex-col justify-center bg-amber-50">
                        <p className="text-sm text-muted-foreground">Refunded</p>
                        <div className="text-base sm:text-lg font-bold text-amber-700 whitespace-nowrap">
                          ₹{refundedTotals.received.toLocaleString('en-IN')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          ({refundedTotals.count} students)
                        </p>
                      </div>
                      <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                        <p className="text-xs text-muted-foreground font-medium">By Closer</p>
                        {refundedBreakdown.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No refunds</p>
                        ) : (
                          refundedBreakdown.map((closer, idx) => (
                            <div key={closer.closerId} className={cn(
                              "flex justify-between items-baseline text-sm gap-2",
                              idx < refundedBreakdown.length - 1 && "border-b pb-1"
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

                  {/* Discontinued Amount Card */}
                  <Card className="overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                      <div className="p-4 flex flex-col justify-center bg-red-50">
                        <p className="text-sm text-muted-foreground">Discontinued</p>
                        <div className="text-base sm:text-lg font-bold text-red-700 whitespace-nowrap">
                          ₹{discontinuedTotals.received.toLocaleString('en-IN')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          ({discontinuedTotals.count} students)
                        </p>
                      </div>
                      <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                        <p className="text-xs text-muted-foreground font-medium">By Closer</p>
                        {discontinuedBreakdown.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No discontinued</p>
                        ) : (
                          discontinuedBreakdown.map((closer, idx) => (
                            <div key={closer.closerId} className={cn(
                              "flex justify-between items-baseline text-sm gap-2",
                              idx < discontinuedBreakdown.length - 1 && "border-b pb-1"
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
                </div>
              </div>
            )}
          </>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>{filteredStudents.length} of {batchStudents?.length || 0} students</CardDescription>
            </div>
            <div className="flex gap-2">
              {/* Filter Button with Sheet */}
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="relative">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  
                  <div className="space-y-6 py-6">
                    {/* Payment Type Filter - Hidden for Managers */}
                    {!isManager && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Payment Type</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="payment-all"
                              name="paymentType"
                              checked={paymentTypeFilter === "all"}
                              onChange={() => setPaymentTypeFilter("all")}
                              className="h-4 w-4"
                            />
                            <label htmlFor="payment-all" className="text-sm cursor-pointer">All Payments</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="payment-initial"
                              name="paymentType"
                              checked={paymentTypeFilter === "initial"}
                              onChange={() => setPaymentTypeFilter("initial")}
                              className="h-4 w-4"
                            />
                            <label htmlFor="payment-initial" className="text-sm cursor-pointer">Initial Payment Only</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="payment-emi"
                              name="paymentType"
                              checked={paymentTypeFilter === "emi"}
                              onChange={() => setPaymentTypeFilter("emi")}
                              className="h-4 w-4"
                            />
                            <label htmlFor="payment-emi" className="text-sm cursor-pointer">EMI Only</label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Date Range Filter */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Date Range</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {dateFrom ? format(dateFrom, "dd MMM yyyy") : "From"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={dateFrom}
                                onSelect={(date) => { setDateFrom(date); setIsDateFromOpen(false); }}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex-1">
                          <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {dateTo ? format(dateTo, "dd MMM yyyy") : "To"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={dateTo}
                                onSelect={(date) => { setDateTo(date); setIsDateToOpen(false); }}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {(dateFrom || dateTo) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
                          className="text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear dates
                        </Button>
                      )}
                    </div>

                    {/* Closers Multi-select - Hidden for closers */}
                    {!isCloser && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Closers</Label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                          {uniqueClosers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No closers available</p>
                          ) : (
                            uniqueClosers.map(closer => (
                              <div key={closer.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`closer-${closer.id}`}
                                  checked={selectedClosers.includes(closer.id)}
                                  onCheckedChange={() => toggleCloser(closer.id)}
                                />
                                <label 
                                  htmlFor={`closer-${closer.id}`} 
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {closer.name}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Classes Multi-select */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Classes Access</Label>
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        {uniqueClasses.map(classNum => (
                          <div key={classNum} className="flex items-center space-x-2">
                            <Checkbox
                              id={`class-${classNum}`}
                              checked={selectedClasses.includes(classNum.toString())}
                              onCheckedChange={() => toggleClass(classNum.toString())}
                            />
                            <label 
                              htmlFor={`class-${classNum}`} 
                              className="text-xs cursor-pointer"
                            >
                              {CLASSES_ACCESS_LABELS[classNum] || `${classNum}`}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <SheetFooter className="flex gap-2">
                    <Button variant="outline" onClick={clearAllFilters}>
                      Clear All
                    </Button>
                    <Button onClick={() => setIsFilterOpen(false)}>
                      Apply Filters
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              {batchStudents && batchStudents.length > 0 && (
                <Button variant="outline" onClick={handleExportStudents}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </CardHeader>
          
          {/* Search and Active Filters Section */}
          <div className="px-6 pb-4 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Active Filters Display */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Active:</span>
                
                {/* Payment Type Badge - Hidden for Managers */}
                {!isManager && paymentTypeFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {paymentTypeFilter === "emi" ? "EMI Only" : "Initial Only"}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setPaymentTypeFilter("all")} 
                    />
                  </Badge>
                )}
                
                {(dateFrom || dateTo) && (
                  <Badge variant="secondary" className="gap-1">
                    {dateFrom && dateTo 
                      ? `${format(dateFrom, "dd MMM")} - ${format(dateTo, "dd MMM")}`
                      : dateFrom 
                        ? `From ${format(dateFrom, "dd MMM")}`
                        : `Until ${format(dateTo!, "dd MMM")}`
                    }
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} 
                    />
                  </Badge>
                )}
                
                {selectedClosers.map(closerId => {
                  const closer = uniqueClosers.find(c => c.id === closerId);
                  return closer ? (
                    <Badge key={closerId} variant="secondary" className="gap-1">
                      {closer.name}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => toggleCloser(closerId)} 
                      />
                    </Badge>
                  ) : null;
                })}
                
                {selectedClasses.map(classNum => (
                  <Badge key={classNum} variant="secondary" className="gap-1">
                    {CLASSES_ACCESS_LABELS[Number(classNum)] || `${classNum} Classes`}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => toggleClass(classNum)} 
                    />
                  </Badge>
                ))}
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="h-6 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
          
          <CardContent>
            {studentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !batchStudents?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No students enrolled in this batch yet</p>
              </div>
            ) : !filteredStudents.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No students match your search or filters</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* EMI expand button - visible for closers (to see EMI history), hidden for managers */}
                      {!isManager && <TableHead className="w-10"></TableHead>}
                      {isManager && <TableHead className="w-10"></TableHead>}
                      <TableHead>Conversion Date</TableHead>
                      <TableHead>Student Name</TableHead>
                      {!isManager && <TableHead>Offered Amount</TableHead>}
                      {!isManager && <TableHead>Cash Received</TableHead>}
                      {!isManager && <TableHead>Due Amount</TableHead>}
                      {!isCloser && <TableHead>Closer</TableHead>}
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Classes Access</TableHead>
                      <TableHead>Status</TableHead>
                      {!isManager && !isCloser && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <React.Fragment key={student.id}>
                        <TableRow 
                          className={cn(
                            "cursor-pointer",
                            expandedStudentId === student.id && "bg-muted/50",
                            student.status === "refunded" && "bg-amber-50/70",
                            student.status === "discontinued" && "bg-red-50/70"
                          )}
                          onClick={() => !isManager && toggleStudentExpand(student.id)}
                        >
                              {/* EMI expand button - only for non-managers */}
                              {!isManager ? (
                                <TableCell>
                                  {expandedStudentId === student.id ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                              ) : (
                                <TableCell></TableCell>
                              )}
                              <TableCell className="text-sm text-muted-foreground">
                                {student.scheduled_date ? format(new Date(student.scheduled_date), "dd MMM yyyy") : "-"}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {student.contact_name}
                                  {student.additional_comments && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <FileText className="h-4 w-4 text-blue-500 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <p className="text-sm whitespace-pre-wrap">{student.additional_comments}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </TableCell>
                              {!isManager && (
                                <TableCell className="text-sm font-medium">
                                  {student.offer_amount ? `₹${student.offer_amount.toLocaleString('en-IN')}` : "-"}
                                </TableCell>
                              )}
                              {!isManager && (
                                <TableCell className="text-sm font-medium">
                                  {student.cash_received ? `₹${student.cash_received.toLocaleString('en-IN')}` : "-"}
                                </TableCell>
                              )}
                              {!isManager && (
                                <TableCell className="text-sm font-medium text-orange-600">
                                  {student.due_amount ? `₹${student.due_amount.toLocaleString('en-IN')}` : "-"}
                                </TableCell>
                              )}
                              {!isCloser && (
                                <TableCell className="text-sm text-muted-foreground">
                                  {student.closer_name || "-"}
                                </TableCell>
                              )}
                              <TableCell className="text-sm text-muted-foreground">{student.email}</TableCell>
                              <TableCell className="text-sm">{student.phone || "-"}</TableCell>
                              <TableCell>
                                {student.classes_access ? (
                                  <Badge variant="outline">
                                    {CLASSES_ACCESS_LABELS[student.classes_access] || `${student.classes_access} Classes`}
                                  </Badge>
                                ) : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  student.status === "refunded" 
                                    ? "bg-amber-100 text-amber-800 border-amber-200" 
                                    : student.status === "discontinued"
                                      ? "bg-red-100 text-red-800 border-red-200"
                                      : student.status === "converted" || student.status.startsWith("converted_")
                                        ? "bg-green-100 text-green-800" 
                                        : "bg-gray-100 text-gray-800"
                                }>
                                  {student.status.charAt(0).toUpperCase() + student.status.slice(1).replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              {!isManager && !isCloser && (
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-background">
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingStudent(student);
                                        setNewBatchId(selectedBatch.id);
                                      }}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Change Batch
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRefundingStudent(student);
                                        }}
                                        disabled={student.status === "refunded" || student.status === "discontinued"}
                                      >
                                        <RefreshCcw className="h-4 w-4 mr-2" />
                                        Mark as Refunded
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDiscontinuingStudent(student);
                                        }}
                                        disabled={student.status === "discontinued" || student.status === "refunded"}
                                      >
                                        <X className="h-4 w-4 mr-2" />
                                        Mark as Discontinued
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        setNotesStudent(student);
                                        setNotesText(student.additional_comments || "");
                                      }}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        {student.additional_comments ? "Edit Notes" : "Add Notes"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEmiStudent(student);
                                        }}
                                        disabled={!["converted", "converted_beginner", "converted_intermediate", "converted_advance", "booking_amount"].includes(student.status)}
                                      >
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Update EMI & Course Access
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              )}
                        </TableRow>
                        {!isManager && expandedStudentId === student.id && (
                          <TableRow>
                              <TableCell colSpan={isCloser ? 10 : 12} className="bg-muted/30 p-0">
                                <div className="p-4 border-t">
                                  {/* Show Refund Reason if status is refunded */}
                                  {student.status === "refunded" && student.refund_reason && (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                      <div className="flex items-center gap-2 mb-1">
                                        <RefreshCcw className="h-4 w-4 text-amber-600" />
                                        <span className="font-medium text-sm text-amber-800">Refund Reason</span>
                                      </div>
                                      <p className="text-sm text-amber-700 whitespace-pre-wrap">
                                        {student.refund_reason}
                                      </p>
                                    </div>
                                  )}
                                  {/* Show Discontinued Reason if status is discontinued */}
                                  {student.status === "discontinued" && student.refund_reason && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                      <div className="flex items-center gap-2 mb-1">
                                        <X className="h-4 w-4 text-red-600" />
                                        <span className="font-medium text-sm text-red-800">Discontinued Reason</span>
                                      </div>
                                      <p className="text-sm text-red-700 whitespace-pre-wrap">
                                        {student.refund_reason}
                                      </p>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-2 mb-3">
                                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">EMI Payment History</span>
                                  </div>
                                  
                                  {emiLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                  ) : (() => {
                                    const studentEmiList = studentEmiPayments?.filter(emi => emi.appointment_id === student.id) || [];
                                    const totalEmiCollected = studentEmiList.reduce((sum, emi) => sum + Number(emi.amount), 0);
                                    
                                    return !studentEmiList.length ? (
                                      <p className="text-sm text-muted-foreground py-2">No EMI payments recorded yet</p>
                                    ) : (
                                      <div className="space-y-3">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="py-2">EMI #</TableHead>
                                              <TableHead className="py-2">Amount</TableHead>
                                              <TableHead className="py-2">Date</TableHead>
                                              <TableHead className="py-2">Classes</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {studentEmiList.map((emi) => (
                                              <TableRow key={emi.id}>
                                                <TableCell className="py-2">EMI {emi.emi_number}</TableCell>
                                                <TableCell className="py-2 font-medium">₹{Number(emi.amount).toLocaleString('en-IN')}</TableCell>
                                                <TableCell className="py-2 text-muted-foreground">
                                                  {format(new Date(emi.payment_date), "dd MMM yyyy")}
                                                </TableCell>
                                                <TableCell className="py-2 text-sm text-muted-foreground">
                                                  {emi.previous_classes_access && emi.new_classes_access && emi.previous_classes_access !== emi.new_classes_access
                                                    ? `${CLASSES_ACCESS_LABELS[emi.previous_classes_access] || emi.previous_classes_access} → ${CLASSES_ACCESS_LABELS[emi.new_classes_access] || emi.new_classes_access}`
                                                    : emi.new_classes_access ? CLASSES_ACCESS_LABELS[emi.new_classes_access] || emi.new_classes_access : "-"}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                            <TableRow className="bg-muted/50">
                                              <TableCell className="py-2 font-medium">Total</TableCell>
                                              <TableCell className="py-2 font-bold text-green-600">
                                                ₹{totalEmiCollected.toLocaleString('en-IN')}
                                              </TableCell>
                                              <TableCell className="py-2"></TableCell>
                                              <TableCell className="py-2"></TableCell>
                                            </TableRow>
                                          </TableBody>
                                        </Table>
                                      </div>
                                    );
                                  })()}
                                  
                                  {/* Update EMI Button */}
                                  <div className="flex items-center gap-4 pt-3 mt-3 border-t">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEmiStudent(student);
                                    }}
                                  >
                                      <Pencil className="h-3 w-3 mr-1" />
                                      Update EMI & Course Access
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transfer Student Dialog - Hidden for Managers and Closers */}
        {!isManager && !isCloser && (
          <Dialog open={!!editingStudent} onOpenChange={(open) => { if (!open) { setEditingStudent(null); setNewBatchId(""); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Student to Different Batch</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <p className="font-medium">{editingStudent?.contact_name}</p>
                  <p className="text-sm text-muted-foreground">{editingStudent?.email}</p>
                </div>
                <div className="space-y-2">
                  <Label>Select New Batch</Label>
                  <Select value={newBatchId} onValueChange={setNewBatchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches?.map(batch => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name} ({format(new Date(batch.start_date), "dd MMM yyyy")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditingStudent(null); setNewBatchId(""); }}>Cancel</Button>
                <Button 
                  onClick={handleTransferStudent} 
                  disabled={transferMutation.isPending || !newBatchId || newBatchId === selectedBatch?.id}
                >
                  {transferMutation.isPending ? "Transferring..." : "Transfer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Mark as Refunded Confirmation Dialog - Hidden for Managers and Closers */}
        {!isManager && !isCloser && (
          <AlertDialog open={!!refundingStudent} onOpenChange={(open) => { if (!open) { setRefundingStudent(null); setRefundNotes(""); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as Refunded</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="font-medium">Student:</span> {refundingStudent?.contact_name}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Email:</span> {refundingStudent?.email}
                    </div>
                    <p className="text-muted-foreground mt-2">
                      Are you sure you want to mark this student as refunded? This will:
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      <li>Change status to "Refunded"</li>
                      <li>Be visible throughout the CRM</li>
                    </ul>
                    <div className="space-y-2 pt-2">
                      <Label className="text-foreground">
                        Refund Reason <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        placeholder="Enter reason for refund..."
                        value={refundNotes}
                        onChange={(e) => setRefundNotes(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">Required</p>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => refundingStudent && markRefundedMutation.mutate({ 
                    appointmentId: refundingStudent.id, 
                    refundReason: refundNotes.trim() 
                  })}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  disabled={markRefundedMutation.isPending || !refundNotes.trim()}
                >
                  {markRefundedMutation.isPending ? "Updating..." : "Mark as Refunded"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Notes Dialog - Hidden for Managers and Closers */}
        {!isManager && !isCloser && (
          <Dialog open={!!notesStudent} onOpenChange={(open) => { if (!open) { setNotesStudent(null); setNotesText(""); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{notesStudent?.additional_comments ? "Edit Notes" : "Add Notes"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <p className="font-medium">{notesStudent?.contact_name}</p>
                  <p className="text-sm text-muted-foreground">{notesStudent?.email}</p>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Enter notes here..."
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setNotesStudent(null); setNotesText(""); }}>Cancel</Button>
                <Button 
                  onClick={() => notesStudent && updateNotesMutation.mutate({ appointmentId: notesStudent.id, notes: notesText })}
                  disabled={updateNotesMutation.isPending}
                >
                  {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Mark as Discontinued Confirmation Dialog - Hidden for Managers and Closers */}
        {!isManager && !isCloser && (
          <AlertDialog open={!!discontinuingStudent} onOpenChange={(open) => { if (!open) { setDiscontinuingStudent(null); setDiscontinuedNotes(""); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as Discontinued</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="font-medium">Student:</span> {discontinuingStudent?.contact_name}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Email:</span> {discontinuingStudent?.email}
                    </div>
                    <p className="text-muted-foreground mt-2">
                      Are you sure you want to mark this student as discontinued? This will:
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      <li>Change status to "Discontinued"</li>
                      <li>Highlight the student in red</li>
                      <li>Be visible throughout the CRM</li>
                    </ul>
                    <div className="space-y-2 pt-2">
                      <Label className="text-foreground">
                        Reason for Discontinuation <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        placeholder="Enter reason for discontinuation..."
                        value={discontinuedNotes}
                        onChange={(e) => setDiscontinuedNotes(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">Required</p>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => discontinuingStudent && markDiscontinuedMutation.mutate({ 
                    appointmentId: discontinuingStudent.id, 
                    discontinuedReason: discontinuedNotes.trim() 
                  })}
                  className="bg-red-600 text-white hover:bg-red-700"
                  disabled={markDiscontinuedMutation.isPending || !discontinuedNotes.trim()}
                >
                  {markDiscontinuedMutation.isPending ? "Updating..." : "Mark as Discontinued"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Update EMI Dialog - Rendered in batch detail view */}
        {emiStudent && (
          <UpdateEmiDialog
            open={!!emiStudent}
            onOpenChange={(open) => !open && setEmiStudent(null)}
            appointmentId={emiStudent.id}
            offerAmount={emiStudent.offer_amount || 0}
            cashReceived={emiStudent.cash_received || 0}
            dueAmount={emiStudent.due_amount || 0}
            classesAccess={emiStudent.classes_access ?? null}
            batchId={selectedBatch?.id || null}
            customerName={emiStudent.contact_name}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["batch-students"] });
              queryClient.invalidateQueries({ queryKey: ["batch-student-emi"] });
              queryClient.invalidateQueries({ queryKey: ["batch-all-emi-payments"] });
            }}
          />
        )}
      </div>
    );
  }

  // Batches list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Batches</h1>
            <p className="text-muted-foreground">Manage course batches and student access</p>
          </div>
        </div>
        {!isManager && !isCloser && (
          <Dialog open={isCreateOpen || !!editingBatch} onOpenChange={(open) => { if (!open) handleCloseForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
              Add Batch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBatch ? "Edit Batch" : "Create New Batch"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Batch Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g., Batch 1 - Jan 3"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Date <span className="text-red-500">*</span></Label>
                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !formStartDate && "text-muted-foreground")}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formStartDate ? format(formStartDate, "dd MMM yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formStartDate}
                      onSelect={(date) => { setFormStartDate(date); setIsDatePopoverOpen(false); }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseForm}>Cancel</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingBatch ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Search Bar for Batches */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search batches..."
              value={batchSearchQuery}
              onChange={(e) => setBatchSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {batchesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !batches?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No batches created yet</p>
              <p className="text-sm">Click "Add Batch" to create your first batch</p>
            </div>
          ) : !filteredBatches.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No batches match your search</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  {!isManager && !isCloser && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow 
                    key={batch.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedBatch(batch)}
                  >
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell>{format(new Date(batch.start_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const startDate = new Date(batch.start_date);
                        startDate.setHours(0, 0, 0, 0);
                        const isLive = startDate <= today;
                        
                        return isLive ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Live</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Upcoming</Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {batch.students_count || 0}
                      </div>
                    </TableCell>
                    {!isManager && !isCloser && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(batch)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeletingBatch(batch)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog - Hidden for Managers and Closers */}
      {!isManager && !isCloser && (
        <AlertDialog open={!!deletingBatch} onOpenChange={(open) => { if (!open) setDeletingBatch(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Batch</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingBatch?.name}"? 
                This will remove the batch but students will remain with no batch assigned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingBatch && deleteMutation.mutate(deletingBatch.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
};

export default Batches;
