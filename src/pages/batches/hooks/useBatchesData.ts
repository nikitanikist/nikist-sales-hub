import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";

export interface Batch {
  id: string;
  name: string;
  start_date: string;
  is_active: boolean;
  created_at: string;
  students_count?: number;
}

export interface BatchStudent {
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
  next_follow_up_date: string | null;
  pay_after_earning: boolean;
}

export interface EmiPayment {
  id: string;
  appointment_id: string;
  emi_number: number;
  amount: number;
  payment_date: string;
  previous_classes_access: number | null;
  new_classes_access: number | null;
  previous_cash_received: number | null;
}

export const CLASSES_ACCESS_LABELS: Record<number, string> = {
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

export const useBatchesData = (
  selectedBatch: Batch | null,
  expandedStudentId: string | null
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isManager, isCloser, profileId } = useUserRole();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  // Form state
  const [formName, setFormName] = useState("");
  const [formStartDate, setFormStartDate] = useState<Date | undefined>(undefined);
  const [formIsActive, setFormIsActive] = useState(true);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);

  // Fetch batches with student counts
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["batches", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data: batchesData, error } = await supabase
        .from("batches")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      
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
    enabled: !!currentOrganization,
  });

  // Fetch students for selected batch
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
          next_follow_up_date,
          pay_after_earning,
          lead:leads(contact_name, email, phone),
          closer:profiles!closer_id(full_name)
        `)
        .eq("batch_id", selectedBatch.id)
        .order("scheduled_date", { ascending: false })
        .order("created_at", { ascending: false });
      
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
        next_follow_up_date: apt.next_follow_up_date,
        pay_after_earning: apt.pay_after_earning || false,
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

  // Create batch mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; start_date: string; is_active: boolean }) => {
      if (!currentOrganization) throw new Error("No organization selected");
      const { error } = await supabase.from("batches").insert({
        ...data,
        organization_id: currentOrganization.id,
      });
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

  // Transfer student mutation
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
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mark student as refunded
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
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ appointmentId, notes, nextFollowUpDate, payAfterEarning }: { appointmentId: string; notes: string; nextFollowUpDate: string | null; payAfterEarning: boolean }) => {
      const { error } = await supabase
        .from("call_appointments")
        .update({ 
          additional_comments: notes,
          next_follow_up_date: nextFollowUpDate,
          pay_after_earning: payAfterEarning
        })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-students", selectedBatch?.id] });
      toast({ title: "Notes Saved", description: "Notes and follow-up date have been saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mark student as discontinued
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
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete student mutation (admin only)
  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("emi_payments").delete().eq("appointment_id", id);
      await supabase.from("offer_amount_history").delete().eq("appointment_id", id);
      const { error } = await supabase.from("call_appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-students", selectedBatch?.id] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast({ title: "Student deleted", description: "Student entry has been permanently removed" });
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

  return {
    // Organization
    currentOrganization,
    orgLoading,
    // Role
    isAdmin,
    isManager,
    isCloser,
    profileId,
    // Query data
    batches,
    batchesLoading,
    batchStudents,
    studentsLoading,
    studentEmiPayments,
    emiLoading,
    batchEmiPayments,
    // Mutations
    createMutation,
    updateMutation,
    deleteMutation,
    transferMutation,
    markRefundedMutation,
    updateNotesMutation,
    markDiscontinuedMutation,
    deleteStudentMutation,
    // Form state
    formName,
    setFormName,
    formStartDate,
    setFormStartDate,
    formIsActive,
    setFormIsActive,
    isDatePopoverOpen,
    setIsDatePopoverOpen,
    isCreateOpen,
    setIsCreateOpen,
    editingBatch,
    setEditingBatch,
    deletingBatch,
    setDeletingBatch,
    // Handlers
    handleCloseForm,
    handleOpenEdit,
    handleSubmit,
    // QueryClient for external invalidation
    queryClient,
  };
};
