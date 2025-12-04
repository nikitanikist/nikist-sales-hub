import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Search, RefreshCw, ChevronDown, ChevronRight, Phone, Mail, Check, Clock, AlertCircle, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type CallStatus = Database["public"]["Enums"]["call_status"];
type ReminderStatus = Database["public"]["Enums"]["reminder_status"];

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: CallStatus;
  offer_amount: number | null;
  cash_received: number | null;
  due_amount: number | null;
  closer_remarks: string | null;
  additional_comments: string | null;
  lead: {
    id: string;
    contact_name: string;
    email: string;
    phone: string | null;
    country: string | null;
  } | null;
  reminders: {
    reminder_type: string;
    status: ReminderStatus | null;
    sent_at: string | null;
    reminder_time: string;
  }[];
}

const statusColors: Record<CallStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  rescheduled: "bg-yellow-100 text-yellow-800 border-yellow-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  no_show: "bg-gray-100 text-gray-800 border-gray-200",
};

const reminderTypeOrder = ["two_days", "one_day", "three_hours", "one_hour", "thirty_minutes", "ten_minutes"];
const reminderTypeLabels: Record<string, string> = {
  two_days: "2 Days",
  one_day: "1 Day",
  three_hours: "3 Hours",
  one_hour: "1 Hour",
  thirty_minutes: "30 Min",
  ten_minutes: "10 Min",
};

const CloserAssignedCalls = () => {
  const { closerId } = useParams<{ closerId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    status: CallStatus;
    offer_amount: number;
    cash_received: number;
    closer_remarks: string;
  } | null>(null);

  // Fetch closer profile
  const { data: closer } = useQuery({
    queryKey: ["closer-profile", closerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", closerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!closerId,
  });

  // Fetch appointments
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["closer-appointments", closerId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("call_appointments")
        .select(`
          id,
          scheduled_date,
          scheduled_time,
          status,
          offer_amount,
          cash_received,
          due_amount,
          closer_remarks,
          additional_comments,
          lead:leads(id, contact_name, email, phone, country)
        `)
        .eq("closer_id", closerId!)
        .order("scheduled_date", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as CallStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch reminders for each appointment
      const appointmentsWithReminders = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: reminders } = await supabase
            .from("call_reminders")
            .select("reminder_type, status, sent_at, reminder_time")
            .eq("appointment_id", apt.id);

          return {
            ...apt,
            reminders: reminders || [],
          };
        })
      );

      return appointmentsWithReminders as Appointment[];
    },
    enabled: !!closerId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; status: CallStatus; offer_amount: number; cash_received: number; closer_remarks: string }) => {
      const due_amount = Math.max(0, data.offer_amount - data.cash_received);

      const { error } = await supabase
        .from("call_appointments")
        .update({
          status: data.status,
          offer_amount: data.offer_amount,
          cash_received: data.cash_received,
          due_amount,
          closer_remarks: data.closer_remarks,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-appointments", closerId] });
      queryClient.invalidateQueries({ queryKey: ["sales-closers"] });
      toast({ title: "Updated", description: "Appointment details saved successfully" });
      setEditingId(null);
      setEditData(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleRefresh = () => {
    refetch();
    toast({ title: "Refreshed", description: "Appointments data has been refreshed" });
  };

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingId(null);
      setEditData(null);
    } else {
      setExpandedId(id);
    }
  };

  const handleEdit = (apt: Appointment) => {
    setEditingId(apt.id);
    setEditData({
      status: apt.status,
      offer_amount: apt.offer_amount || 0,
      cash_received: apt.cash_received || 0,
      closer_remarks: apt.closer_remarks || "",
    });
  };

  const handleSave = () => {
    if (!editingId || !editData) return;
    updateMutation.mutate({ id: editingId, ...editData });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData(null);
  };

  const getReminderIcon = (status: ReminderStatus | null) => {
    switch (status) {
      case "sent":
        return <Check className="h-4 w-4 text-green-600" />;
      case "failed":
        return <X className="h-4 w-4 text-red-600" />;
      case "pending":
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  // Filter appointments by search query
  const filteredAppointments = appointments?.filter((apt) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      apt.lead?.contact_name?.toLowerCase().includes(query) ||
      apt.lead?.email?.toLowerCase().includes(query) ||
      apt.lead?.phone?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales-closers")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assigned Calls</h1>
          <p className="text-muted-foreground mt-1">
            {closer?.full_name || "Loading..."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Assigned Calls</CardTitle>
              <CardDescription>
                {filteredAppointments?.length || 0} calls found
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rescheduled">Rescheduled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAppointments && filteredAppointments.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Offer ₹</TableHead>
                    <TableHead className="text-right">Cash ₹</TableHead>
                    <TableHead className="text-right">Due ₹</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((apt) => (
                    <Collapsible key={apt.id} asChild open={expandedId === apt.id}>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleExpand(apt.id)}
                          >
                            <TableCell>
                              {expandedId === apt.id ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {apt.lead?.contact_name || "Unknown"}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {apt.lead?.email && (
                                  <div className="text-sm text-blue-600">{apt.lead.email}</div>
                                )}
                                {apt.lead?.phone && (
                                  <div className="text-sm text-blue-600">{apt.lead.phone}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{format(new Date(apt.scheduled_date), "dd MMM yyyy")}</TableCell>
                            <TableCell>{apt.scheduled_time}</TableCell>
                            <TableCell>
                              <Badge className={statusColors[apt.status]}>{apt.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ₹{(apt.offer_amount || 0).toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              ₹{(apt.cash_received || 0).toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              ₹{(apt.due_amount || 0).toLocaleString("en-IN")}
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={9} className="bg-muted/30 p-0">
                              <div className="p-6 space-y-6">
                                {/* Contact Info - Read Only */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Contact Details
                                  </h4>
                                  <div className="flex flex-wrap gap-4">
                                    {apt.lead?.email && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span>{apt.lead.email}</span>
                                      </div>
                                    )}
                                    {apt.lead?.phone && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span>{apt.lead.phone}</span>
                                      </div>
                                    )}
                                    {apt.lead?.country && (
                                      <div className="text-sm">
                                        <span className="text-muted-foreground">Country:</span> {apt.lead.country}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Reminder Timeline */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Reminder Timeline
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {reminderTypeOrder.map((type) => {
                                      const reminder = apt.reminders.find((r) => r.reminder_type === type);
                                      return (
                                        <div
                                          key={type}
                                          className="flex flex-col items-center gap-1 px-3 py-2 bg-background rounded border text-xs"
                                        >
                                          <div className="flex items-center gap-1">
                                            {reminder ? getReminderIcon(reminder.status) : <AlertCircle className="h-4 w-4 text-gray-400" />}
                                            <span>{reminderTypeLabels[type]}</span>
                                          </div>
                                          {reminder?.reminder_time && (
                                            <span className="text-muted-foreground text-[10px]">
                                              {format(new Date(reminder.reminder_time), "dd MMM, hh:mm a")}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Editable Fields */}
                                <div className="space-y-4">
                                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Call Details
                                  </h4>

                                  {editingId === apt.id && editData ? (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                          <Label>Status</Label>
                                          <Select
                                            value={editData.status}
                                            onValueChange={(value) => setEditData({ ...editData, status: value as CallStatus })}
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="scheduled">Scheduled</SelectItem>
                                              <SelectItem value="completed">Completed</SelectItem>
                                              <SelectItem value="rescheduled">Rescheduled</SelectItem>
                                              <SelectItem value="cancelled">Cancelled</SelectItem>
                                              <SelectItem value="no_show">No Show</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Offer Amount (₹)</Label>
                                          <Input
                                            type="number"
                                            value={editData.offer_amount}
                                            onChange={(e) => setEditData({ ...editData, offer_amount: Number(e.target.value) })}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Cash Received (₹)</Label>
                                          <Input
                                            type="number"
                                            value={editData.cash_received}
                                            onChange={(e) => setEditData({ ...editData, cash_received: Number(e.target.value) })}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Due Amount (₹)</Label>
                                          <Input
                                            type="number"
                                            value={Math.max(0, editData.offer_amount - editData.cash_received)}
                                            disabled
                                            className="bg-muted"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Closer Remarks</Label>
                                        <Textarea
                                          value={editData.closer_remarks}
                                          onChange={(e) => setEditData({ ...editData, closer_remarks: e.target.value })}
                                          placeholder="Add your remarks here..."
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                                          {updateMutation.isPending ? "Saving..." : "Save"}
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={handleCancel}>
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {apt.closer_remarks && (
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Remarks:</span> {apt.closer_remarks}
                                        </div>
                                      )}
                                      <Button size="sm" variant="outline" onClick={() => handleEdit(apt)}>
                                        Edit Details
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No assigned calls found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CloserAssignedCalls;
