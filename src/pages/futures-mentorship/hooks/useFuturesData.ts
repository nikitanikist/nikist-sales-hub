import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";

export interface FuturesBatch {
  id: string;
  name: string;
  event_dates: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  students_count?: number;
}

export interface FuturesStudent {
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

export interface FuturesEmiPayment {
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

export function useFuturesData(selectedBatch: FuturesBatch | null, expandedStudentId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();

  // Form state
  const [formName, setFormName] = useState("");
  const [formEventDates, setFormEventDates] = useState("");
  const [formStatus, setFormStatus] = useState("active");

  // Fetch batches with student counts
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["futures-batches", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data: batchesData, error } = await supabase
        .from("futures_mentorship_batches")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
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
    enabled: !!currentOrganization,
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
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update notes mutation
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
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete student mutation (admin only)
  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("futures_emi_payments").delete().eq("student_id", id);
      await supabase.from("futures_offer_amount_history").delete().eq("student_id", id);
      const { error } = await supabase.from("futures_mentorship_students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["futures-students"] });
      queryClient.invalidateQueries({ queryKey: ["futures-batches"] });
      toast({ title: "Student deleted", description: "Student entry has been permanently removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseForm = () => {
    setFormName("");
    setFormEventDates("");
    setFormStatus("active");
  };

  const handleSubmit = (editingBatch: FuturesBatch | null) => {
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
    setFormName(batch.name);
    setFormEventDates(batch.event_dates || "");
    setFormStatus(batch.status);
    return batch;
  };

  return {
    // Data
    batches,
    batchesLoading,
    batchStudents,
    studentsLoading,
    studentEmiPayments,
    emiLoading,
    // Mutations
    createMutation,
    updateMutation,
    deleteMutation,
    refundMutation,
    notesMutation,
    discontinueMutation,
    deleteStudentMutation,
    // Form
    formName,
    setFormName,
    formEventDates,
    setFormEventDates,
    formStatus,
    setFormStatus,
    // Helpers
    handleCloseForm,
    handleSubmit,
    openEditDialog,
    queryClient,
  };
}
