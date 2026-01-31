import { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CalendarClock, 
  Users, 
  AlertCircle, 
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { WorkshopWithDetails, ScheduledMessage } from '@/hooks/useWorkshopNotification';
import { WorkshopTagBadge } from './WorkshopTagBadge';
import { SequenceProgressButton } from './SequenceProgressButton';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import { toZonedTime } from 'date-fns-tz';
import { isSameDay } from 'date-fns';

interface TodaysWorkshopCardProps {
  workshops: WorkshopWithDetails[];
  orgTimezone: string;
  onQuickSetup: (workshop: WorkshopWithDetails) => void;
  onRunSequence: (workshop: WorkshopWithDetails) => void;
  subscribeToMessages?: (workshopId: string) => () => void;
  useWorkshopMessages?: (workshopId: string | null) => { data: ScheduledMessage[] | undefined };
}

function calculateProgress(workshop: WorkshopWithDetails): {
  percent: number;
  missing: string[];
} {
  const steps = [
    { done: !!workshop.tag_id, label: 'Assign a workshop tag' },
    { done: !!workshop.tag?.template_sequence_id, label: 'Tag needs a template sequence' },
    { done: !!workshop.whatsapp_session_id, label: 'Select WhatsApp account' },
    { done: workshop.automation_status?.whatsapp_group_linked, label: 'Select WhatsApp groups' },
  ];
  
  const completed = steps.filter(s => s.done).length;
  const missing = steps.filter(s => !s.done).map(s => s.label);
  
  return { percent: Math.round((completed / steps.length) * 100), missing };
}

export function TodaysWorkshopCard({ 
  workshops, 
  orgTimezone, 
  onQuickSetup, 
  onRunSequence,
  subscribeToMessages,
  useWorkshopMessages,
}: TodaysWorkshopCardProps) {
  // Filter to today's workshops in org timezone
  const todayWorkshops = useMemo(() => {
    const nowInOrgTz = toZonedTime(new Date(), orgTimezone);
    
    return workshops.filter(w => {
      const workshopDateInOrgTz = toZonedTime(new Date(w.start_date), orgTimezone);
      return isSameDay(workshopDateInOrgTz, nowInOrgTz);
    }).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [workshops, orgTimezone]);

  if (todayWorkshops.length === 0) return null;

  const workshop = todayWorkshops[0];
  const { percent, missing } = calculateProgress(workshop);
  const isReady = percent === 100;
  const hasMultiple = todayWorkshops.length > 1;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <CalendarClock className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary">Today's Workshop</span>
          </div>
          <Badge 
            variant={isReady ? 'default' : 'secondary'} 
            className={isReady ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
          >
            {isReady ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready
              </>
            ) : (
              `${percent}% Complete`
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Workshop Title & Time */}
        <div className="space-y-1">
          <h3 className="text-lg font-semibold leading-tight line-clamp-1">
            {workshop.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatInOrgTime(workshop.start_date, orgTimezone, 'EEEE, MMM d · h:mm a')}
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="font-medium">{workshop.registrations_count || 0}</span>
            <span>registrations</span>
          </div>
          {workshop.tag && (
            <WorkshopTagBadge name={workshop.tag.name} color={workshop.tag.color} />
          )}
        </div>

        {/* Progress Bar */}
        {!isReady && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Setup Progress</span>
              <span className="font-medium">{percent}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
        )}

        {/* Missing Items Warning */}
        {missing.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Next step:</span> {missing[0]}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <SequenceProgressButton
            workshopId={workshop.id}
            isSetupComplete={isReady}
            onRun={() => onRunSequence(workshop)}
            onSetup={() => onQuickSetup(workshop)}
            subscribeToMessages={subscribeToMessages}
            useWorkshopMessages={useWorkshopMessages}
            className="flex-1"
          />
          <Button 
            variant="outline" 
            onClick={() => onQuickSetup(workshop)}
            className="gap-1"
          >
            View
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Multiple workshops indicator */}
        {hasMultiple && (
          <div className="text-xs text-muted-foreground text-center pt-1">
            +{todayWorkshops.length - 1} more workshop{todayWorkshops.length > 2 ? 's' : ''} today
          </div>
        )}
      </CardContent>
    </Card>
  );
}
