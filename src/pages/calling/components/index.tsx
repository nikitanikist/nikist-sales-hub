import { Badge } from "@/components/ui/badge";
import type { CallStatus, CallOutcome } from "@/types/voice-campaign";
import { Check, Calendar, X, AlertTriangle, Phone, PhoneOff, Clock, Ban } from "lucide-react";

const STATUS_CONFIG: Record<CallStatus, { label: string; className: string; pulse?: boolean }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  queued: { label: "Queued", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ringing: { label: "Ringing", className: "bg-blue-500 text-white animate-pulse" },
  "in-progress": { label: "Calling", className: "bg-blue-600 text-white animate-pulse", pulse: true },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  "no-answer": { label: "No Answer", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  busy: { label: "Busy", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

const OUTCOME_CONFIG: Record<CallOutcome, { label: string; icon: typeof Check; className: string }> = {
  confirmed: { label: "Confirmed", icon: Check, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rescheduled: { label: "Rescheduled", icon: Calendar, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  not_interested: { label: "Not Interested", icon: X, className: "bg-destructive/10 text-destructive" },
  angry: { label: "Angry/DND", icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
  wrong_number: { label: "Wrong Number", icon: PhoneOff, className: "bg-muted text-muted-foreground" },
  voicemail: { label: "Voicemail", icon: Phone, className: "bg-muted text-muted-foreground" },
  no_response: { label: "No Response", icon: Ban, className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return <Badge variant="outline" className={`${config.className} border-0 text-xs`}>{config.label}</Badge>;
}

export function CallOutcomeBadge({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) return <span className="text-muted-foreground">—</span>;
  const config = OUTCOME_CONFIG[outcome];
  if (!config) return <span className="text-muted-foreground">{outcome}</span>;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.className} border-0 text-xs gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    scheduled: { label: "Scheduled", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    running: { label: "In Progress", className: "bg-blue-500 text-white" },
    paused: { label: "Paused", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  };
  const config = map[status] || map.draft;
  return (
    <Badge variant="outline" className={`${config.className} border-0 text-xs`}>
      {status === "running" && <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-1 inline-block" />}
      {config.label}
    </Badge>
  );
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone;
  return digits.slice(0, 5) + "***" + digits.slice(-2);
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatCost(cost: number | null): string {
  if (cost === null || cost === undefined) return "—";
  return `₹${cost.toFixed(2)}`;
}
