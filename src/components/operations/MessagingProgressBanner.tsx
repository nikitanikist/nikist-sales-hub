import { useState, useEffect, useMemo } from 'react';
import { X, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
}

interface MessagingProgressBannerProps {
  messages: Message[];
  workshopTitle?: string;
  onDismiss: () => void;
  onViewDetails: () => void;
}

export function MessagingProgressBanner({
  messages,
  workshopTitle,
  onDismiss,
  onViewDetails,
}: MessagingProgressBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const stats = useMemo(() => {
    const total = messages.length;
    const sent = messages.filter(m => m.status === 'sent').length;
    const failed = messages.filter(m => m.status === 'failed').length;
    const sending = messages.filter(m => m.status === 'sending').length;
    const pending = messages.filter(m => m.status === 'pending').length;
    
    const inProgress = sending > 0 || (pending > 0 && sent > 0);
    const allDone = pending === 0 && sending === 0;
    const hasFailures = failed > 0;
    
    return { total, sent, failed, sending, pending, inProgress, allDone, hasFailures };
  }, [messages]);

  // Auto-dismiss after completion (with delay)
  useEffect(() => {
    if (stats.allDone && !stats.hasFailures && stats.sent > 0) {
      const timer = setTimeout(() => {
        setDismissed(true);
        onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [stats.allDone, stats.hasFailures, stats.sent, onDismiss]);

  // Don't show if dismissed or no messages
  if (dismissed || messages.length === 0) return null;

  // Don't show if all pending (not started) or all cancelled
  if (stats.pending === stats.total || stats.sent === 0 && stats.sending === 0 && stats.failed === 0) {
    return null;
  }

  const percent = Math.round((stats.sent / stats.total) * 100);

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md",
        "bg-background border rounded-lg shadow-lg p-4",
        "animate-in slide-in-from-top-2 fade-in duration-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {stats.inProgress ? (
            <div className="p-2 rounded-full bg-primary/10">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          ) : stats.hasFailures ? (
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
          ) : (
            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {stats.inProgress ? (
                <>Sending messages...</>
              ) : stats.hasFailures ? (
                <>{stats.failed} message{stats.failed !== 1 ? 's' : ''} failed</>
              ) : (
                <>All messages sent!</>
              )}
            </p>
            {workshopTitle && (
              <p className="text-xs text-muted-foreground truncate">
                {workshopTitle}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => {
            setDismissed(true);
            onDismiss();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {stats.sent}/{stats.total} messages sent
          </span>
          <span className="font-medium">{percent}%</span>
        </div>
        <Progress value={percent} className="h-2" />
      </div>

      {(stats.hasFailures || stats.allDone) && (
        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            View Details
          </Button>
        </div>
      )}
    </div>
  );
}
