import { useState, useEffect } from 'react';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import {
  Search,
  Eye,
  CheckCircle2,
  Tag,
  Users,
  Play,
  Activity,
  Calendar,
  Smartphone,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  Settings2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton, MobileCardSkeleton } from '@/components/skeletons';
import { WorkshopTagBadge } from '@/components/operations';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useSMSNotification, useWorkshopSMSMessages, ScheduledSMSMessage } from '@/hooks/useSMSNotification';
import { useSMSSequences } from '@/hooks/useSMSSequences';

// Extended workshop type for SMS
interface WorkshopWithSMS {
  id: string;
  title: string;
  start_date: string;
  organization_id: string;
  tag_id: string | null;
  tag?: {
    id: string;
    name: string;
    color: string;
    sms_sequence_id: string | null;
  } | null;
  registrations_count?: number;
}

// Message status icon
function MessageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
    case 'sending':
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  }
}

// Get status badge for SMS setup
function getStatusBadge(workshop: WorkshopWithSMS, hasScheduledMessages: boolean) {
  if (hasScheduledMessages) {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Scheduled
      </Badge>
    );
  }

  if (!workshop.tag_id) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <Tag className="h-3 w-3 mr-1" />
        Assign Tag
      </Badge>
    );
  }

  if (!workshop.tag?.sms_sequence_id) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <Settings2 className="h-3 w-3 mr-1" />
        Add SMS Sequence
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
      <Play className="h-3 w-3 mr-1" />
      Run Sequence
    </Badge>
  );
}

// Check if setup is complete
function isSetupComplete(workshop: WorkshopWithSMS): boolean {
  return !!(workshop.tag_id && workshop.tag?.sms_sequence_id);
}


// SMS Message Checkpoints Component
function SMSMessageCheckpoints({ 
  messages, 
  orgTimezone,
  onCancel,
}: { 
  messages: ScheduledSMSMessage[];
  orgTimezone: string;
  onCancel: (id: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No SMS messages scheduled yet</p>
      </div>
    );
  }

  // Group messages by template
  const groupedByTemplate = messages.reduce((acc, msg) => {
    const templateId = msg.template_id;
    if (!acc[templateId]) {
      acc[templateId] = [];
    }
    acc[templateId].push(msg);
    return acc;
  }, {} as Record<string, ScheduledSMSMessage[]>);

  return (
    <div className="space-y-3">
      {Object.entries(groupedByTemplate).map(([templateId, templateMessages]) => {
        const firstMsg = templateMessages[0];
        const pendingCount = templateMessages.filter(m => m.status === 'pending').length;
        const sentCount = templateMessages.filter(m => m.status === 'sent').length;
        const failedCount = templateMessages.filter(m => m.status === 'failed').length;

        return (
          <Card key={templateId} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageStatusIcon status={
                  sentCount === templateMessages.length ? 'sent' :
                  failedCount > 0 ? 'failed' :
                  pendingCount > 0 ? 'pending' : 'cancelled'
                } />
                <div>
                  <p className="text-sm font-medium">
                    {formatInOrgTime(firstMsg.scheduled_for, orgTimezone, 'h:mm a')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sentCount}/{templateMessages.length} sent
                    {failedCount > 0 && ` · ${failedCount} failed`}
                  </p>
                </div>
              </div>
              {pendingCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    templateMessages
                      .filter(m => m.status === 'pending')
                      .forEach(m => onCancel(m.id));
                  }}
                >
                  Cancel All
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Workshop Detail Panel
function WorkshopSMSPanel({
  workshop,
  orgTimezone,
  onRunSequence,
  isRunning,
}: {
  workshop: WorkshopWithSMS;
  orgTimezone: string;
  onRunSequence: () => void;
  isRunning: boolean;
}) {
  const { data: messages = [], isLoading } = useWorkshopSMSMessages(workshop.id);
  const { subscribeToSMSMessages, cancelSMS } = useSMSNotification();
  const { sequences } = useSMSSequences();

  // Subscribe to real-time updates
  useEffect(() => {
    return subscribeToSMSMessages(workshop.id);
  }, [workshop.id, subscribeToSMSMessages]);

  const sequence = sequences.find(s => s.id === workshop.tag?.sms_sequence_id);
  const setupComplete = isSetupComplete(workshop);
  const hasScheduled = messages.some(m => m.status === 'pending' || m.status === 'sent');

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{workshop.title}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatInOrgTime(workshop.start_date, orgTimezone, 'EEE, MMM d · h:mm a')}
          </p>
        </div>
        {workshop.tag && (
          <WorkshopTagBadge name={workshop.tag.name} color={workshop.tag.color} />
        )}
      </div>

      {/* Setup Status */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span>Tag:</span>
          <span className={workshop.tag ? 'font-medium' : 'text-muted-foreground'}>
            {workshop.tag?.name || 'Not assigned'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <span>SMS Sequence:</span>
          <span className={sequence ? 'font-medium' : 'text-muted-foreground'}>
            {sequence?.name || 'Not assigned'}
            {sequence?.steps && ` (${sequence.steps.length} messages)`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>Registrations:</span>
          <span className="font-medium">{workshop.registrations_count || 0}</span>
        </div>
      </div>

      {/* Actions */}
      {setupComplete ? (
        <Button
          onClick={onRunSequence}
          disabled={isRunning || hasScheduled}
          className="w-full gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scheduling...
            </>
          ) : hasScheduled ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Already Scheduled
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run SMS Sequence
            </>
          )}
        </Button>
      ) : (
        <Button variant="outline" asChild className="w-full gap-2">
          <Link to="/settings?tab=notifications">
            <Settings2 className="h-4 w-4" />
            Configure SMS in Settings
          </Link>
        </Button>
      )}

      {/* Message Checkpoints */}
      {isLoading ? (
        <div className="text-center py-4">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : (
        <SMSMessageCheckpoints
          messages={messages}
          orgTimezone={orgTimezone}
          onCancel={cancelSMS}
        />
      )}
    </Card>
  );
}

interface SMSTabProps {
  workshops: WorkshopWithSMS[];
  workshopsLoading: boolean;
  orgTimezone: string;
}

export function SMSTab({ workshops, workshopsLoading, orgTimezone }: SMSTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopWithSMS | null>(null);
  const { runSMSSequence, isRunningSMSSequence } = useSMSNotification();

  // Filter workshops
  const filteredWorkshops = workshops.filter((w) =>
    w.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get message counts for status badges
  const { data: allMessages = [] } = useWorkshopSMSMessages(selectedWorkshop?.id || null);

  const handleRunSequence = async (workshop: WorkshopWithSMS) => {
    try {
      await runSMSSequence({
        workshopId: workshop.id,
        workshop: {
          id: workshop.id,
          title: workshop.title,
          start_date: workshop.start_date,
          tag: workshop.tag,
        },
      });
    } catch {
      // Error handled by mutation
    }
  };

  // Check if any sequences exist
  const { sequences, sequencesLoading } = useSMSSequences();
  const hasSequences = sequences.length > 0;

  if (!sequencesLoading && !hasSequences) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Smartphone className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">SMS Notifications</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Send SMS reminders to workshop registrants via Fast2SMS DLT templates.
        </p>
        <div className="mt-6 space-y-2">
          <Button asChild>
            <Link to="/settings?tab=notifications">
              <Settings2 className="h-4 w-4 mr-2" />
              Set Up SMS Templates & Sequences
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Configure your DLT templates and create sequences in Settings first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workshops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Smartphone className="h-3.5 w-3.5" />
          Fast2SMS DLT
        </Badge>
      </div>

      {/* Content */}
      {workshopsLoading ? (
        <>
          <div className="hidden sm:block">
            <TableSkeleton columns={5} rows={5} />
          </div>
          <div className="sm:hidden">
            <MobileCardSkeleton count={3} />
          </div>
        </>
      ) : filteredWorkshops.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No workshops found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery ? 'Try a different search term' : 'Workshops will appear here once created'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Workshop List */}
          <div className="space-y-3">
            {filteredWorkshops.slice(0, 10).map((workshop) => (
              <Card
                key={workshop.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedWorkshop?.id === workshop.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedWorkshop(workshop)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-1">{workshop.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {formatInOrgTime(workshop.start_date, orgTimezone, 'EEE, MMM d')}
                    </p>
                  </div>
                  {getStatusBadge(workshop, false)}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {workshop.tag && (
                    <WorkshopTagBadge name={workshop.tag.name} color={workshop.tag.color} />
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {workshop.registrations_count || 0}
                  </span>
                </div>
              </Card>
            ))}
          </div>

          {/* Selected Workshop Panel */}
          <div>
            {selectedWorkshop ? (
              <WorkshopSMSPanel
                workshop={selectedWorkshop}
                orgTimezone={orgTimezone}
                onRunSequence={() => handleRunSequence(selectedWorkshop)}
                isRunning={isRunningSMSSequence}
              />
            ) : (
              <Card className="p-8 text-center">
                <Eye className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a workshop to view SMS details
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
