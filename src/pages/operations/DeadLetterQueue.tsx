import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Trash2, Eye, MessageSquare, Mail, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { TableEmptyState } from "@/components/TableEmptyState";
import { TableSkeleton } from "@/components/skeletons";

type DLQEntry = {
  id: string;
  organization_id: string;
  source_table: string;
  source_id: string;
  payload: Record<string, unknown>;
  retry_payload: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  scheduled_whatsapp_messages: "WhatsApp Message",
  notification_campaign_groups: "Campaign Broadcast",
  scheduled_sms_messages: "SMS Message",
};

const SOURCE_ICONS: Record<string, typeof MessageSquare> = {
  scheduled_whatsapp_messages: MessageSquare,
  notification_campaign_groups: Send,
  scheduled_sms_messages: Mail,
};

export default function DeadLetterQueue() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedEntry, setSelectedEntry] = useState<DLQEntry | null>(null);
  const [notes, setNotes] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["dead-letter-queue", currentOrganization?.id, statusFilter, sourceFilter],
    queryFn: async () => {
      if (!currentOrganization) return [];
      let query = supabase
        .from("dead_letter_queue")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (sourceFilter !== "all") {
        query = query.eq("source_table", sourceFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DLQEntry[];
    },
    enabled: !!currentOrganization,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("dead_letter_queue")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dead-letter-queue"] });
      setSelectedEntry(null);
      setNotes("");
    },
  });

  const handleDiscard = (entry: DLQEntry) => {
    updateMutation.mutate(
      { id: entry.id, status: "discarded", notes: notes || "Manually discarded" },
      { onSuccess: () => toast.success("Entry discarded") }
    );
  };

  const handleRetry = (entry: DLQEntry) => {
    // Mark as retried in DLQ — actual re-queue would need the original source table reset
    updateMutation.mutate(
      { id: entry.id, status: "retried", notes: notes || "Marked for retry" },
      { onSuccess: () => toast.success("Marked as retried. Re-queue the message from the source table if needed.") }
    );
  };

  const pendingCount = entries.filter(e => e.status === "pending_review").length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Dead Letter Queue"
        subtitle="Review and manage permanently failed messages across WhatsApp and SMS channels."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retried</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {entries.filter(e => e.status === "retried").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="retried">Retried</SelectItem>
            <SelectItem value="discarded">Discarded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="scheduled_whatsapp_messages">WhatsApp Messages</SelectItem>
            <SelectItem value="notification_campaign_groups">Campaign Broadcasts</SelectItem>
            <SelectItem value="scheduled_sms_messages">SMS Messages</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : entries.length === 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableBody>
              <TableEmptyState
                colSpan={6}
                icon={AlertTriangle}
                title="No failed messages"
                description="All messages have been delivered successfully. Failed messages will appear here for review."
              />
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Failed At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const Icon = SOURCE_ICONS[entry.source_table] || AlertTriangle;
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {SOURCE_LABELS[entry.source_table] || entry.source_table}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-destructive line-clamp-2 max-w-[300px]">
                        {entry.error_message || "Unknown error"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.retry_count}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.status === "pending_review" ? "destructive" :
                          entry.status === "retried" ? "default" : "secondary"
                        }
                      >
                        {entry.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedEntry(entry); setNotes(entry.notes || ""); }}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {entry.status === "pending_review" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRetry(entry)}
                              title="Mark as retried"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDiscard(entry)}
                              title="Discard"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Failed Message Details
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Source</span>
                  <p>{SOURCE_LABELS[selectedEntry.source_table] || selectedEntry.source_table}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Retry Count</span>
                  <p>{selectedEntry.retry_count}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Failed At</span>
                  <p>{format(new Date(selectedEntry.created_at), "PPp")}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Status</span>
                  <p className="capitalize">{selectedEntry.status.replace("_", " ")}</p>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-muted-foreground">Error Message</span>
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mt-1">
                  {selectedEntry.error_message}
                </p>
              </div>

              <div>
                <span className="text-sm font-medium text-muted-foreground">Payload</span>
                <pre className="text-xs bg-muted p-3 rounded-md mt-1 overflow-x-auto max-h-[200px]">
                  {JSON.stringify(selectedEntry.payload, null, 2)}
                </pre>
              </div>

              {selectedEntry.retry_payload && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Retry Payload</span>
                  <pre className="text-xs bg-muted p-3 rounded-md mt-1 overflow-x-auto max-h-[200px]">
                    {JSON.stringify(selectedEntry.retry_payload, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-muted-foreground">Notes</span>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add resolution notes..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedEntry?.status === "pending_review" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => selectedEntry && handleDiscard(selectedEntry)}
                  disabled={updateMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Discard
                </Button>
                <Button
                  onClick={() => selectedEntry && handleRetry(selectedEntry)}
                  disabled={updateMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Mark Retried
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
