import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { GraduationCap, Plus, Edit, Trash2, Calendar, ArrowLeft, Users, Loader2, Search, Download, ChevronDown, ChevronRight, IndianRupee, Filter, X, MoreHorizontal, RefreshCcw, FileText, Pencil, HandCoins, BarChart3, Eye, Settings, FolderOpen } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
import { useOrganization } from "@/hooks/useOrganization";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";

interface CohortBatch {
  id: string;
  name: string;
  start_date: string | null;
  event_dates: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  students_count?: number;
}

interface CohortStudent {
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

interface CohortEmiPayment {
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

const CohortPage = () => {
  const { cohortSlug } = useParams<{ cohortSlug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  
  // State
  const [selectedBatch, setSelectedBatch] = useState<CohortBatch | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<CohortBatch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<CohortBatch | null>(null);
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
  const [filterRefunded, setFilterRefunded] = useState(false);
  const [filterDiscontinued, setFilterDiscontinued] = useState(false);
  const [filterFullPayment, setFilterFullPayment] = useState(false);
  const [filterRemaining, setFilterRemaining] = useState(false);
  const [filterTodayFollowUp, setFilterTodayFollowUp] = useState(false);
  const [filterPAE, setFilterPAE] = useState(false);
  
  // Dialog state
  const [notesStudent, setNotesStudent] = useState<CohortStudent | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [payAfterEarning, setPayAfterEarning] = useState(false);
  const [isFollowUpDateOpen, setIsFollowUpDateOpen] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<string>("students");
  const [showStudentListDialog, setShowStudentListDialog] = useState(false);
  const [studentListTitle, setStudentListTitle] = useState("");
  const [studentListSubtitle, setStudentListSubtitle] = useState("");
  const [studentListData, setStudentListData] = useState<any[]>([]);
  const [studentListAmount, setStudentListAmount] = useState(0);

  // Fetch cohort type by slug
  const { data: cohortType, isLoading: cohortTypeLoading } = useQuery({
    queryKey: ["cohort-type", cohortSlug, currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization || !cohortSlug) return null;
      
      const { data, error } = await supabase
        .from("cohort_types")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .eq("slug", cohortSlug)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization && !!cohortSlug,
  });

  // Fetch batches for this cohort type
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["cohort-batches", cohortType?.id],
    queryFn: async () => {
      if (!cohortType) return [];
      
      const { data: batchesData, error } = await supabase
        .from("cohort_batches")
        .select("*")
        .eq("cohort_type_id", cohortType.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Get student counts for each batch
      const batchesWithCounts = await Promise.all(
        (batchesData || []).map(async (batch) => {
          const { count } = await supabase
            .from("cohort_students")
            .select("*", { count: "exact", head: true })
            .eq("cohort_batch_id", batch.id);
          
          return { ...batch, students_count: count || 0 };
        })
      );
      
      return batchesWithCounts as CohortBatch[];
    },
    enabled: !!cohortType,
  });

  // Fetch students for selected batch
  const { data: batchStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ["cohort-students", selectedBatch?.id],
    queryFn: async () => {
      if (!selectedBatch) return [];
      
      const { data, error } = await supabase
        .from("cohort_students")
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
        .eq("cohort_batch_id", selectedBatch.id)
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
      })) as CohortStudent[];
    },
    enabled: !!selectedBatch,
  });

  // Fetch EMI payments for expanded student
  const { data: studentEmiPayments, isLoading: emiLoading } = useQuery({
    queryKey: ["cohort-emi", expandedStudentId],
    queryFn: async () => {
      if (!expandedStudentId) return [];
      
      const { data, error } = await supabase
        .from("cohort_emi_payments")
        .select("*, created_by_profile:profiles!created_by(full_name)")
        .eq("student_id", expandedStudentId)
        .order("emi_number", { ascending: true });
      
      if (error) throw error;
      return data as CohortEmiPayment[];
    },
    enabled: !!expandedStudentId,
  });

  // Filter students
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
      
      const todayFormatted = format(new Date(), "yyyy-MM-dd");
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

  // Filter batches
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    if (!batchSearchQuery.trim()) return batches;
    
    const searchLower = batchSearchQuery.toLowerCase();
    return batches.filter(batch => batch.name.toLowerCase().includes(searchLower));
  }, [batches, batchSearchQuery]);

  // Calculate totals
  const { totals, allStudentsTotals, todayFollowUpCount } = useMemo(() => {
    if (!batchStudents) return { 
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
    
    const todayFormatted = format(new Date(), "yyyy-MM-dd");
    const todayFollowUpCount = batchStudents.filter(s => 
      s.next_follow_up_date === todayFormatted
    ).length;
    
    return {
      totals: {
        offered: activeStudents.reduce((sum, s) => sum + (s.offer_amount || 0), 0),
        received: activeStudents.reduce((sum, s) => sum + (s.cash_received || 0), 0),
        due: nonPaeStudentsWithDue.reduce((sum, s) => sum + (s.due_amount || 0), 0),
        count: activeStudents.length
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

  // Business insights
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

  // Mutations
  const createBatchMutation = useMutation({
    mutationFn: async (data: { name: string; event_dates: string; status: string }) => {
      if (!cohortType || !currentOrganization) throw new Error("Missing cohort type or organization");
      
      const { error } = await supabase
        .from("cohort_batches")
        .insert({
          cohort_type_id: cohortType.id,
          organization_id: currentOrganization.id,
          name: data.name,
          event_dates: data.event_dates || null,
          status: data.status,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-batches"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Batch created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error creating batch", description: error.message, variant: "destructive" });
    },
  });

  const updateBatchMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; event_dates: string; status: string }) => {
      const { error } = await supabase
        .from("cohort_batches")
        .update({
          name: data.name,
          event_dates: data.event_dates || null,
          status: data.status,
        })
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-batches"] });
      setEditingBatch(null);
      resetForm();
      toast({ title: "Batch updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error updating batch", description: error.message, variant: "destructive" });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cohort_batches")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-batches"] });
      setDeletingBatch(null);
      toast({ title: "Batch deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting batch", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormEventDates("");
    setFormStatus("active");
  };

  const handleCreateBatch = () => {
    createBatchMutation.mutate({
      name: formName,
      event_dates: formEventDates,
      status: formStatus,
    });
  };

  const handleUpdateBatch = () => {
    if (!editingBatch) return;
    updateBatchMutation.mutate({
      id: editingBatch.id,
      name: formName,
      event_dates: formEventDates,
      status: formStatus,
    });
  };

  const openEditBatch = (batch: CohortBatch) => {
    setFormName(batch.name);
    setFormEventDates(batch.event_dates || "");
    setFormStatus(batch.status);
    setEditingBatch(batch);
  };

  // Loading states
  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  if (!currentOrganization) {
    return (
      <EmptyState 
        icon={FolderOpen}
        title="No organization" 
        description="Please select an organization to continue." 
      />
    );
  }

  if (cohortTypeLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cohortType) {
    return (
      <EmptyState 
        icon={FolderOpen}
        title="Cohort not found" 
        description="This cohort type doesn't exist or you don't have access to it."
        actionLabel="Go to Dashboard"
        onAction={() => navigate("/")}
      />
    );
  }

  // Render batch list view
  if (!selectedBatch) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{cohortType.name}</h1>
            <p className="text-sm text-muted-foreground">Manage batches and students</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Batch
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search batches..."
            value={batchSearchQuery}
            onChange={(e) => setBatchSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Batches Grid */}
        {batchesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredBatches.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No batches yet"
            description="Create your first batch to get started."
            actionLabel={isAdmin ? "Add Batch" : undefined}
            onAction={isAdmin ? () => setIsCreateOpen(true) : undefined}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBatches.map((batch) => (
              <Card
                key={batch.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedBatch(batch)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{batch.name}</CardTitle>
                    <Badge variant={batch.status === 'active' ? 'default' : 'secondary'}>
                      {batch.status}
                    </Badge>
                  </div>
                  {batch.event_dates && (
                    <CardDescription>{batch.event_dates}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    {batch.students_count || 0} students
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Batch Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Batch</DialogTitle>
              <DialogDescription>Add a new batch to {cohortType.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Batch Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Batch 1, January 2024"
                />
              </div>
              <div>
                <Label>Event Dates (optional)</Label>
                <Input
                  value={formEventDates}
                  onChange={(e) => setFormEventDates(e.target.value)}
                  placeholder="e.g., Jan 15-20, 2024"
                />
              </div>
              <div>
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
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateBatch} 
                disabled={!formName.trim() || createBatchMutation.isPending}
              >
                {createBatchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Batch Dialog */}
        <Dialog open={!!editingBatch} onOpenChange={() => setEditingBatch(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Batch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Batch Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Batch 1"
                />
              </div>
              <div>
                <Label>Event Dates (optional)</Label>
                <Input
                  value={formEventDates}
                  onChange={(e) => setFormEventDates(e.target.value)}
                  placeholder="e.g., Jan 15-20, 2024"
                />
              </div>
              <div>
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
              <Button variant="outline" onClick={() => setEditingBatch(null)}>Cancel</Button>
              <Button 
                onClick={handleUpdateBatch} 
                disabled={!formName.trim() || updateBatchMutation.isPending}
              >
                {updateBatchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Batch Dialog */}
        <AlertDialog open={!!deletingBatch} onOpenChange={() => setDeletingBatch(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Batch</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingBatch?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingBatch && deleteBatchMutation.mutate(deletingBatch.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Render batch detail view with students
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedBatch(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{selectedBatch.name}</h1>
            <p className="text-sm text-muted-foreground">{cohortType.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => openEditBatch(selectedBatch)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDeletingBatch(selectedBatch)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offered Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <IndianRupee className="h-5 w-5" />
              {totals.offered.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center text-success">
              <IndianRupee className="h-5 w-5" />
              {totals.received.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center text-warning">
              <IndianRupee className="h-5 w-5" />
              {totals.due.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4 mt-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <div>
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
                  <div className="flex items-center justify-between">
                    <Label>Today's Follow-ups</Label>
                    <Switch checked={filterTodayFollowUp} onCheckedChange={setFilterTodayFollowUp} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Full Payment</Label>
                    <Switch checked={filterFullPayment} onCheckedChange={setFilterFullPayment} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Due Remaining</Label>
                    <Switch checked={filterRemaining} onCheckedChange={setFilterRemaining} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Pay After Earning</Label>
                    <Switch checked={filterPAE} onCheckedChange={setFilterPAE} />
                  </div>
                </div>
                <SheetFooter className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatusFilter("all");
                      setFilterTodayFollowUp(false);
                      setFilterFullPayment(false);
                      setFilterRemaining(false);
                      setFilterPAE(false);
                      setFilterRefunded(false);
                      setFilterDiscontinued(false);
                    }}
                  >
                    Clear All
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {/* Students Table */}
          {studentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students found"
              description={searchQuery ? "Try adjusting your search or filters." : "Add students to this batch to get started."}
            />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="text-right">Offered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow 
                      key={student.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                    >
                      <TableCell className="font-medium">{student.contact_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{student.email}</TableCell>
                      <TableCell className="text-right">₹{(student.offer_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">₹{(student.cash_received || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-warning">₹{(student.due_amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'active' ? 'default' : student.status === 'refunded' ? 'destructive' : 'secondary'}>
                          {student.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <UpcomingPaymentsCalendar
            upcomingPayments={insights.upcomingPayments}
            onDateClick={(date, students) => {
              const dateObj = new Date(date);
              setStudentListTitle(`Payments on ${format(dateObj, "MMM d, yyyy")}`);
              setStudentListSubtitle(`${students.length} expected payment(s)`);
              setStudentListData(students);
              setStudentListAmount(students.reduce((sum, s) => sum + (s.due_amount || 0), 0));
              setShowStudentListDialog(true);
            }}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 mt-4">
          <ActionRequiredCards
            studentsWithoutFollowUp={insights.studentsWithoutFollowUp}
            studentsWithoutFollowUpAmount={insights.studentsWithoutFollowUpAmount}
            overdueFollowUps={insights.overdueFollowUps}
            overdueFollowUpsAmount={insights.overdueFollowUpsAmount}
            onViewNoFollowUp={() => {
              setStudentListTitle("No Follow-up Date");
              setStudentListSubtitle("Students without a next follow-up date");
              setStudentListData(insights.studentsWithoutFollowUp);
              setStudentListAmount(insights.studentsWithoutFollowUpAmount);
              setShowStudentListDialog(true);
            }}
            onViewOverdue={() => {
              setStudentListTitle("Overdue Follow-ups");
              setStudentListSubtitle("Students with follow-up dates in the past");
              setStudentListData(insights.overdueFollowUps);
              setStudentListAmount(insights.overdueFollowUpsAmount);
              setShowStudentListDialog(true);
            }}
          />
          <ReceivablesAgingTable 
            receivablesAging={insights.receivablesAging} 
            onBracketClick={(bracket, students) => {
              setStudentListTitle(`Receivables: ${bracket}`);
              setStudentListSubtitle(`${students.length} student(s)`);
              setStudentListData(students);
              setStudentListAmount(students.reduce((sum, s) => sum + (s.due_amount || 0), 0));
              setShowStudentListDialog(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Student List Dialog */}
      <StudentListDialog
        open={showStudentListDialog}
        onOpenChange={setShowStudentListDialog}
        title={studentListTitle}
        subtitle={studentListSubtitle}
        students={studentListData}
        totalAmount={studentListAmount}
        onEditNotes={(student) => {
          const fullStudent = batchStudents?.find(s => s.id === student.id);
          if (fullStudent) {
            setNotesStudent(fullStudent);
            setNotesText(fullStudent.notes || "");
            setFollowUpDate(fullStudent.next_follow_up_date ? new Date(fullStudent.next_follow_up_date) : undefined);
            setPayAfterEarning(fullStudent.pay_after_earning);
          }
        }}
      />
    </div>
  );
};

export default CohortPage;
