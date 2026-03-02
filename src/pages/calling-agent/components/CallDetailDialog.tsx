import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Clock, DollarSign, Phone } from "lucide-react";
import type { CallingAgentCall } from "@/hooks/useCallingAgentDetail";

interface CallDetailDialogProps {
  call: CallingAgentCall | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetailDialog({ call, open, onOpenChange }: CallDetailDialogProps) {
  if (!call) return null;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  // Parse transcript into chat bubbles
  const parseTranscript = (transcript: string | null) => {
    if (!transcript) return [];
    return transcript.split("\n").filter(Boolean).map((line) => {
      const match = line.match(/^(assistant|user):\s*(.*)/i);
      if (match) {
        return { role: match[1].toLowerCase() as "assistant" | "user", text: match[2].trim() };
      }
      return { role: "user" as const, text: line.trim() };
    }).filter((m) => m.text && m.text !== ".");
  };

  const messages = parseTranscript(call.transcript);

  const extractedEntries = call.extracted_data
    ? Object.entries(call.extracted_data).filter(([, v]) => v != null)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {call.contact_name || call.contact_phone}
          </DialogTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(call.call_duration_seconds)}</span>
            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />₹{call.total_cost?.toFixed(2)}</span>
            <Badge variant="outline">{call.status}</Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="summary" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
            <TabsTrigger value="transcript" className="flex-1">Transcript</TabsTrigger>
            <TabsTrigger value="data" className="flex-1">Extracted Data</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {call.summary ? (
                  <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">{call.summary}</div>
                ) : (
                  <p className="text-sm text-muted-foreground">No summary available for this call.</p>
                )}

                {call.recording_url && (
                  <div className="pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                        <Play className="h-4 w-4 mr-2" />
                        Play Recording
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="transcript">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {messages.length > 0 ? messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      msg.role === "assistant"
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No transcript available.</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="data">
            <ScrollArea className="h-[400px] pr-4">
              {extractedEntries.length > 0 ? (
                <div className="grid gap-3">
                  {extractedEntries.map(([key, value]) => (
                    <div key={key} className="p-3 bg-muted rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground uppercase">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm mt-1">{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No extracted data available.</p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
