import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, Search } from "lucide-react";
import type { VoiceCampaignCall } from "@/types/voice-campaign";
import { CallStatusBadge, CallOutcomeBadge, maskPhone, formatDuration, formatCost } from "./index";
import { TranscriptDialog } from "./TranscriptDialog";

interface Props {
  calls: VoiceCampaignCall[];
}

const STATUS_ORDER: Record<string, number> = {
  "in-progress": 0, ringing: 1, queued: 2, pending: 3, completed: 4, "no-answer": 5, busy: 6, failed: 7, cancelled: 8,
};

export function CampaignCallsTable({ calls }: Props) {
  const [search, setSearch] = useState("");
  const [transcriptCall, setTranscriptCall] = useState<VoiceCampaignCall | null>(null);

  const filtered = useMemo(() => {
    let result = [...calls];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.contact_name.toLowerCase().includes(q) || c.contact_phone.includes(q));
    }
    result.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
    return result;
  }, [calls, search]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Reschedule</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead className="w-16">Transcript</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No calls found</TableCell></TableRow>
            ) : (
              filtered.map((call, i) => (
                <TableRow key={call.id}>
                  <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{call.contact_name}</TableCell>
                  <TableCell className="text-sm font-mono">{maskPhone(call.contact_phone)}</TableCell>
                  <TableCell><CallStatusBadge status={call.status} /></TableCell>
                  <TableCell><CallOutcomeBadge outcome={call.outcome} /></TableCell>
                  <TableCell className="text-sm">{call.reschedule_day || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {call.whatsapp_link_sent ? "Link Sent" : call.in_whatsapp_group === true ? "Yes" : call.in_whatsapp_group === false ? "No" : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{formatDuration(call.call_duration_seconds)}</TableCell>
                  <TableCell className="text-sm">{formatCost(call.total_cost)}</TableCell>
                  <TableCell>
                    {call.transcript ? (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setTranscriptCall(call)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {transcriptCall && (
        <TranscriptDialog
          open={!!transcriptCall}
          onOpenChange={() => setTranscriptCall(null)}
          transcript={transcriptCall.transcript || ""}
          contactName={transcriptCall.contact_name}
        />
      )}
    </div>
  );
}
