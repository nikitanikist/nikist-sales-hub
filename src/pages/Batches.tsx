import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Plus, Edit, Trash2, Calendar, ArrowLeft, Users, CheckCircle2, Clock, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

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
  access_given: boolean;
  access_given_at: string | null;
  status: string;
  closer_id: string | null;
  closer_name: string | null;
  updated_at: string | null;
  offer_amount: number | null;
  cash_received: number | null;
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
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formStartDate, setFormStartDate] = useState<Date | undefined>(undefined);
  const [formIsActive, setFormIsActive] = useState(true);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  // Search and filter state for batch students
  const [searchQuery, setSearchQuery] = useState("");
  const [closerFilter, setCloserFilter] = useState<string>("all");
  const [classesFilter, setClassesFilter] = useState<string>("all");
  
  // Edit batch dialog state
  const [editingStudent, setEditingStudent] = useState<BatchStudent | null>(null);
  const [newBatchId, setNewBatchId] = useState<string>("");

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
  const { data: batchStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ["batch-students", selectedBatch?.id],
    queryFn: async () => {
      if (!selectedBatch) return [];
      
      const { data, error } = await supabase
        .from("call_appointments")
        .select(`
          id,
          lead_id,
          closer_id,
          classes_access,
          access_given,
          access_given_at,
          status,
          updated_at,
          offer_amount,
          cash_received,
          lead:leads(contact_name, email, phone),
          closer:profiles!closer_id(full_name)
        `)
        .eq("batch_id", selectedBatch.id);
      
      if (error) throw error;
      
      return (data || []).map((apt) => ({
        id: apt.id,
        lead_id: apt.lead_id,
        contact_name: apt.lead?.contact_name || "Unknown",
        email: apt.lead?.email || "",
        phone: apt.lead?.phone || null,
        classes_access: apt.classes_access,
        access_given: apt.access_given || false,
        access_given_at: apt.access_given_at,
        status: apt.status,
        closer_id: apt.closer_id,
        closer_name: apt.closer?.full_name || null,
        updated_at: apt.updated_at,
        offer_amount: apt.offer_amount,
        cash_received: apt.cash_received,
      })) as BatchStudent[];
    },
    enabled: !!selectedBatch,
  });

  // Get unique closers from batch students for filter dropdown
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

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    if (!batchStudents) return [];
    
    return batchStudents.filter(student => {
      // Search filter (name, email, phone)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        student.contact_name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower) ||
        (student.phone && student.phone.includes(searchQuery));
      
      // Closer filter
      const matchesCloser = closerFilter === "all" || student.closer_id === closerFilter;
      
      // Classes filter
      const matchesClasses = classesFilter === "all" || 
        student.classes_access?.toString() === classesFilter;
      
      return matchesSearch && matchesCloser && matchesClasses;
    });
  }, [batchStudents, searchQuery, closerFilter, classesFilter]);

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

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents([...selectedStudents, studentId]);
    } else {
      setSelectedStudents(selectedStudents.filter((id) => id !== studentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredStudents) {
      setSelectedStudents(filteredStudents.filter((s) => !s.access_given).map((s) => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleGiveAccess = () => {
    // This will be connected to backend in Phase 2
    toast({ 
      title: "Coming Soon", 
      description: "Give Access functionality will be connected to TagMango and Pabbly in the next phase" 
    });
  };

  const handleTransferStudent = () => {
    if (!editingStudent || !newBatchId) return;
    transferMutation.mutate({ appointmentId: editingStudent.id, newBatchId });
  };

  // Reset filters when leaving batch detail view
  const handleBackToBatches = () => {
    setSelectedBatch(null);
    setSelectedStudents([]);
    setSearchQuery("");
    setCloserFilter("all");
    setClassesFilter("all");
  };

  // Batch detail view
  if (selectedBatch) {
    const studentsWithoutAccess = filteredStudents?.filter((s) => !s.access_given) || [];
    
    return (
      <div className="space-y-6">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>{batchStudents?.length || 0} students enrolled in this batch</CardDescription>
            </div>
            {selectedStudents.length > 0 && (
              <Button onClick={handleGiveAccess}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Give Access ({selectedStudents.length})
              </Button>
            )}
          </CardHeader>
          
          {/* Search and Filters Section */}
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
            
            {/* Filters Row */}
            <div className="flex gap-4">
              {/* Closer Filter */}
              <Select value={closerFilter} onValueChange={setCloserFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by Closer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Closers</SelectItem>
                  {uniqueClosers.map(closer => (
                    <SelectItem key={closer.id} value={closer.id}>{closer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Classes Filter */}
              <Select value={classesFilter} onValueChange={setClassesFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(num => (
                    <SelectItem key={num} value={num.toString()}>
                      {CLASSES_ACCESS_LABELS[num]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Filtered count */}
            {(searchQuery || closerFilter !== "all" || classesFilter !== "all") && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredStudents.length} of {batchStudents?.length || 0} students
              </p>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={studentsWithoutAccess.length > 0 && selectedStudents.length === studentsWithoutAccess.length}
                        onCheckedChange={handleSelectAll}
                        disabled={studentsWithoutAccess.length === 0}
                      />
                    </TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Conversion Date</TableHead>
                    <TableHead>Offered Amount</TableHead>
                    <TableHead>Cash Received</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Classes Access</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Access Given</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                          disabled={student.access_given}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{student.contact_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {student.updated_at ? format(new Date(student.updated_at), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {student.offer_amount ? `₹${student.offer_amount.toLocaleString('en-IN')}` : "-"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {student.cash_received ? `₹${student.cash_received.toLocaleString('en-IN')}` : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {student.closer_name || "-"}
                      </TableCell>
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
                        <Badge className={student.status === "converted" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {student.status.charAt(0).toUpperCase() + student.status.slice(1).replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.access_given ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setEditingStudent(student);
                            setNewBatchId(selectedBatch.id);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Transfer Student Dialog */}
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
      </div>

      <Card>
        <CardContent className="pt-6">
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow 
                    key={batch.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedBatch(batch)}
                  >
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell>{format(new Date(batch.start_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {batch.is_active ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{batch.students_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(batch)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => setDeletingBatch(batch)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingBatch} onOpenChange={() => setDeletingBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingBatch?.name}"? This will unlink all students from this batch but won't delete their call appointments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingBatch && deleteMutation.mutate(deletingBatch.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Batches;
