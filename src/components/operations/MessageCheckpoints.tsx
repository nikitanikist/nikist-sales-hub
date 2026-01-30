import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Checkpoint {
  id: string;
  time: string;
  label: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  scheduledFor: Date;
  sentAt?: Date;
  errorMessage?: string;
}

interface MessageCheckpointsProps {
  checkpoints: Checkpoint[];
  isLoading?: boolean;
}

const statusConfig = {
  pending: {
    icon: Circle,
    label: 'Scheduled',
    className: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  },
  sending: {
    icon: Loader2,
    label: 'Sending',
    className: 'text-amber-500',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  sent: {
    icon: CheckCircle2,
    label: 'Sent',
    className: 'text-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    className: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-700',
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    className: 'text-slate-400',
    badgeClass: 'bg-slate-100 text-slate-500',
  },
};

export function MessageCheckpoints({ checkpoints, isLoading }: MessageCheckpointsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-5 w-5 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
            <div className="h-5 w-16 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No messages scheduled yet</p>
        <p className="text-xs mt-1">Click "Run the Messaging" to schedule messages</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {checkpoints.map((checkpoint) => {
        const config = statusConfig[checkpoint.status];
        const Icon = config.icon;
        
        return (
          <div
            key={checkpoint.id}
            className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Icon
              className={cn(
                'h-5 w-5 flex-shrink-0',
                config.className,
                checkpoint.status === 'sending' && 'animate-spin'
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {checkpoint.time}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {checkpoint.label}
                </span>
              </div>
              {checkpoint.status === 'sent' && checkpoint.sentAt && (
                <p className="text-xs text-muted-foreground">
                  Sent at {format(checkpoint.sentAt, 'h:mm a')}
                </p>
              )}
              {checkpoint.status === 'failed' && checkpoint.errorMessage && (
                <p className="text-xs text-red-500 truncate">
                  {checkpoint.errorMessage}
                </p>
              )}
            </div>
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                config.badgeClass
              )}
            >
              {config.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Helper to convert ScheduledMessage to Checkpoint format
export function toCheckpoints(
  messages: Array<{
    id: string;
    message_type: string;
    scheduled_for: string;
    status: string;
    sent_at: string | null;
    error_message: string | null;
  }>
): Checkpoint[] {
  return messages.map((msg) => {
    const scheduledDate = new Date(msg.scheduled_for);
    return {
      id: msg.id,
      time: format(scheduledDate, 'h:mm a'),
      label: msg.message_type.replace(/_/g, ' ').replace(/step \d+/i, 'Message'),
      status: msg.status as Checkpoint['status'],
      scheduledFor: scheduledDate,
      sentAt: msg.sent_at ? new Date(msg.sent_at) : undefined,
      errorMessage: msg.error_message || undefined,
    };
  });
}
