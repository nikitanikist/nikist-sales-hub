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
import { Zap, Plus, Edit, Trash2, Calendar, ArrowLeft, Users, Loader2, Search, Download, ChevronDown, ChevronRight, IndianRupee, Filter, X, MoreHorizontal, RefreshCcw, FileText, Pencil } from "lucide-react";
import { UpdateHighFutureEmiDialog } from "@/components/UpdateHighFutureEmiDialog";
import { AddHighFutureStudentDialog } from "@/components/AddHighFutureStudentDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

interface HighFutureBatch {
  id: string;
  name: string;
  event_dates: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  students_count?: number;
}

interface HighFutureStudent {
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
}

interface HighFutureEmiPayment {
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

const HighFuture = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<HighFutureBatch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<HighFutureBatch | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<HighFutureBatch | null>(null);
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
  
  // Dialog state
  const [refundingStudent, setRefundingStudent] = useState<HighFutureStudent | null>(null);
  const [refundNotes, setRefundNotes] = useState<string>("");
  const [notesStudent, setNotesStudent] = useState<HighFutureStudent | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [emiStudent, setEmiStudent] = useState<HighFutureStudent | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [discontinuingStudent, setDiscontinuingStudent] = useState<HighFutureStudent | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<HighFutureStudent | null>(null);

  // Fetch batches with student counts
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["high-future-batches"],
    queryFn: async () => {
      const { data: batchesData, error } = await supabase
        .from("high_future_batches")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Get student counts for each batch
      const batchesWithCounts = await Promise.all(
        (batchesData || []).map(async (batch) => {
          const { count } = await supabase
            .from("high_future_students")
            .select("*", { count: "exact", head: true })
            .eq("batch_id", batch.id);
          
          return { ...batch, students_count: count || 0 };
        })
      );
      
      return batchesWithCounts as HighFutureBatch[];
    },
  });

  // Fetch students for selected batch
  const { data: batchStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ["high-future-students", selectedBatch?.id],
    queryFn: async () => {
      if (!selectedBatch) return [];
      
      const { data, error } = await supabase
        .from("high_future_students")
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
          lead:leads(contact_name, email, phone)
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
      })) as HighFutureStudent[];
    },
    enabled: !!selectedBatch,
  });

  // Fetch EMI payments for expanded student
  const { data: studentEmiPayments, isLoading: emiLoading } = useQuery({
    queryKey: ["high-future-emi", expandedStudentId],
    queryFn: async () => {
      if (!expandedStudentId) return [];
      
      const { data, error } = await supabase
        .from("high_future_emi_payments")
        .select("*")
        .eq("student_id", expandedStudentId)
        .order("emi_number", { ascending: true });
      
      if (error) throw error;
      
      // Fetch profile names for created_by
      const createdByIds = [...new Set((data || []).map(emi => emi.created_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (createdByIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", createdByIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p.full_name }), {});
      }
      
      return (data || []).map(emi => ({
        ...emi,
        created_by_profile: emi.created_by ? { full_name: profilesMap[emi.created_by] || "Unknown" } : null
      })) as HighFutureEmiPayment[];
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
      
      const matchesStatus = statusFilter === "all" || student.status === statusFilter;
      
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const conversionDate = startOfDay(new Date(student.conversion_date));
        const fromDateNormalized = dateFrom ? startOfDay(dateFrom) : null;
        const toDateNormalized = dateTo ? startOfDay(dateTo) : null;
        
        const afterFrom = !fromDateNormalized || conversionDate >= fromDateNormalized;
        const beforeTo = !toDateNormalized || conversionDate <= toDateNormalized;
        matchesDate = afterFrom && beforeTo;
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [batchStudents, searchQuery, statusFilter, dateFrom, dateTo]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      offered: filteredStudents.reduce((sum, s) => sum + s.offer_amount, 0),
      received: filteredStudents.reduce((sum, s) => sum + s.cash_received, 0),
      due: filteredStudents.reduce((sum, s) => sum + s.due_amount, 0),
      count: filteredStudents.length,
    };
  }, [filteredStudents]);

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
    return count;
  }, [dateFrom, dateTo, statusFilter]);

  const clearAllFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatusFilter("all");
  };

  // Create batch mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; event_dates: string; status: string }) => {
      const { error } = await supabase.from("high_future_batches").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-future-batches"] });
      toast({ title: "Batch created", description: "New High Future batch has been created" });
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
      const { error } = await supabase.from("high_future_batches").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-future-batches"] });
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
      const { error } = await supabase.from("high_future_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-future-batches"] });
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
        .from("high_future_students")
        .update({ status: "refunded", refund_reason: reason })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-future-students"] });
      toast({ title: "Marked as refunded", description: "Student has been marked as refunded" });
      setRefundingStudent(null);
      setRefundNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update notes mutation
  const notesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("high_future_students")
        .update({ notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-future-students"] });
      toast({ title: "Notes updated", description: "Notes have been saved" });
      setNotesStudent(null);
      setNotesText("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Discontinued mutation
  const discontinueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("high_future_students")
        .update({ status: "discontinued" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-future-students"] });
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
      await supabase.from("high_future_emi_payments").delete().eq("student_id", id);
      // Delete offer amount history
      await supabase.from("high_future_offer_amount_history").delete().eq("student_id", id);
      // Then delete the student
      const { error } = await supabase.from("high_future_students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-future-students"] });
      queryClient.invalidateQueries({ queryKey: ["high-future-batches"] });
      toast({ title: "Student deleted", description: "Student entry has been permanently removed" });
      setDeletingStudent(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

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

  const openEditDialog = (batch: HighFutureBatch) => {
    setEditingBatch(batch);
    setFormName(batch.name);
    setFormEventDates(batch.event_dates || "");
    setFormStatus(batch.status);
  };

  const exportStudentsCSV = () => {
    if (!filteredStudents.length) return;
    
    const headers = ["Conversion Date", "Student Name", "Amount Offered", "Cash Received", "Due Amount", "Email", "Phone", "Status"];
    const rows = filteredStudents.map(s => [
      format(new Date(s.conversion_date), "yyyy-MM-dd"),
      s.contact_name,
      s.offer_amount,
      s.cash_received,
      s.due_amount,
      s.email,
      s.phone || "",
      s.status
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedBatch?.name || "high-future"}-students-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6" />
            <h1 className="text-2xl font-bold">High Future</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Batch
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Batches</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search batches..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {batchesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Batch Dialog */}
        <Dialog open={isCreateOpen || !!editingBatch} onOpenChange={(open) => !open && handleCloseForm()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBatch ? "Edit Batch" : "Create New Batch"}</DialogTitle>
              <DialogDescription>
                {editingBatch ? "Update the batch details" : "Add a new High Future batch"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., High Future Jan Batch"
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

  // Batch Detail View
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setSelectedBatch(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{selectedBatch.name}</h1>
          <p className="text-muted-foreground">Event Dates: {selectedBatch.event_dates || "TBD"}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Offered</p>
            <p className="text-2xl font-bold text-blue-700">₹{totals.offered.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cash Received</p>
            <p className="text-2xl font-bold text-green-700">₹{totals.received.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Remaining Amount</p>
            <p className="text-2xl font-bold text-orange-700">₹{totals.due.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Students Enrolled</p>
            <p className="text-2xl font-bold text-purple-700">{totals.count}</p>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Students</CardTitle>
            <CardDescription>{filteredStudents.length} of {batchStudents?.length || 0} students</CardDescription>
          </div>
          <div className="flex gap-2">
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
              <SheetContent className="w-[400px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 py-6">
                  <div className="space-y-3">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
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
                    <div className="flex gap-2">
                      <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("flex-1 justify-start", !dateFrom && "text-muted-foreground")}>
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
                          <Button variant="outline" className={cn("flex-1 justify-start", !dateTo && "text-muted-foreground")}>
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
                <SheetFooter>
                  <Button variant="outline" onClick={clearAllFilters}>Clear All</Button>
                  <Button onClick={() => setIsFilterOpen(false)}>Apply</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Button variant="outline" onClick={exportStudentsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setAddStudentOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          {studentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Conversion Date</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Amount Offered</TableHead>
                  <TableHead>Cash Received</TableHead>
                  <TableHead>Due Amount</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
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
                        <TableCell className="font-medium">{student.contact_name}</TableCell>
                        <TableCell>₹{student.offer_amount.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-green-600">₹{student.cash_received.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-orange-600">₹{student.due_amount.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-sm">{student.email}</TableCell>
                        <TableCell className="text-sm">{student.phone || "-"}</TableCell>
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
                          <TableCell colSpan={10} className="py-4">
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
          )}
        </CardContent>
      </Card>

      {/* Update EMI Dialog */}
      {emiStudent && (
        <UpdateHighFutureEmiDialog
          open={!!emiStudent}
          onOpenChange={(open) => !open && setEmiStudent(null)}
          studentId={emiStudent.id}
          offerAmount={emiStudent.offer_amount}
          cashReceived={emiStudent.cash_received}
          dueAmount={emiStudent.due_amount}
          customerName={emiStudent.contact_name}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["high-future-students"] })}
        />
      )}

      {/* Add Student Dialog */}
      <AddHighFutureStudentDialog
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
        batchId={selectedBatch.id}
        batchName={selectedBatch.name}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["high-future-students"] })}
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

      {/* Notes Dialog */}
      <Dialog open={!!notesStudent} onOpenChange={(open) => !open && setNotesStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
            <DialogDescription>Update notes for {notesStudent?.contact_name}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter notes..."
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesStudent(null)}>Cancel</Button>
            <Button 
              onClick={() => notesStudent && notesMutation.mutate({ id: notesStudent.id, notes: notesText })}
              disabled={notesMutation.isPending}
            >
              Save Notes
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
              Are you sure you want to delete {deletingStudent?.contact_name}? 
              This will permanently remove the student and all their EMI payment records. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingStudent && deleteStudentMutation.mutate(deletingStudent.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStudentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HighFuture;