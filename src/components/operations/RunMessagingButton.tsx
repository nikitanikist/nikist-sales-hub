import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RunMessagingButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  hasGroup: boolean;
  hasSequence: boolean;
  className?: string;
}

export function RunMessagingButton({
  onClick,
  isLoading,
  disabled,
  hasGroup,
  hasSequence,
  className,
}: RunMessagingButtonProps) {
  const canRun = hasGroup && hasSequence && !disabled && !isLoading;
  
  let tooltipText = '';
  if (!hasGroup) {
    tooltipText = 'Link a WhatsApp group first';
  } else if (!hasSequence) {
    tooltipText = 'Assign a tag with a template sequence first';
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        onClick={onClick}
        disabled={!canRun}
        className="w-full gap-2"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Scheduling...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Run the Messaging
          </>
        )}
      </Button>
      {tooltipText && (
        <p className="text-xs text-muted-foreground text-center">
          {tooltipText}
        </p>
      )}
      {canRun && (
        <p className="text-xs text-muted-foreground text-center">
          Schedules all messages for their designated times
        </p>
      )}
    </div>
  );
}
