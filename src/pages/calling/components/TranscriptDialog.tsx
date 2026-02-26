import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: string;
  contactName: string;
}

export function TranscriptDialog({ open, onOpenChange, transcript, contactName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Call Transcript — {contactName}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <pre className="whitespace-pre-wrap text-sm text-foreground p-4 bg-muted rounded-md font-mono">
            {transcript || "No transcript available."}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
