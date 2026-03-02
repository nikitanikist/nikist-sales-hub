import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { CallDetailDialog } from "./CallDetailDialog";
import type { CallingAgentCall } from "@/hooks/useCallingAgentDetail";

interface AgentCallsTableProps {
  calls: CallingAgentCall[];
}

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  queued: "bg-muted text-muted-foreground",
  ringing: "bg-warning/20 text-warning",
  "in-progress": "bg-primary/20 text-primary",
  completed: "bg-emerald-500/20 text-emerald-700",
  "no-answer": "bg-orange-500/20 text-orange-700",
  busy: "bg-orange-500/20 text-orange-700",
  failed: "bg-destructive/20 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function AgentCallsTable({ calls }: AgentCallsTableProps) {
  const [selectedCall, setSelectedCall] = useState<CallingAgentCall | null>(null);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead className="w-[60px]">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No calls yet
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow key={call.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCall(call)}>
                  <TableCell className="font-medium">{call.contact_name || "-"}</TableCell>
                  <TableCell className="text-sm">{call.contact_phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[call.status] || ""}>
                      {call.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDuration(call.call_duration_seconds)}</TableCell>
                  <TableCell>₹{(call.total_cost || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedCall(call); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CallDetailDialog call={selectedCall} open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)} />
    </>
  );
}
