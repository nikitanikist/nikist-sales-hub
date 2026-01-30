import { useState, useEffect, useMemo } from 'react';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import { 
  Search, 
  Eye, 
  CheckCircle2, 
  Tag, 
  Smartphone, 
  Users, 
  Play,
  Settings2,
  Activity,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/skeletons';
import { PageIntro } from '@/components/PageIntro';
import { useWorkshopNotification, WorkshopWithDetails, ScheduledMessage } from '@/hooks/useWorkshopNotification';
import { WorkshopTagBadge, WorkshopDetailSheet, TodaysWorkshopCard, MessagingProgressBanner } from '@/components/operations';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Helper to get actionable status badge
function getStatusBadge(workshop: WorkshopWithDetails) {
  const { whatsapp_group_linked, messages_scheduled } = workshop.automation_status || {};

  // Fully ready
  if (messages_scheduled && whatsapp_group_linked) {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Ready
      </Badge>
    );
  }

  // Missing tag
  if (!workshop.tag_id) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <Tag className="h-3 w-3 mr-1" />
        Assign Tag
      </Badge>
    );
  }

  // Missing WhatsApp account
  if (!workshop.whatsapp_session_id) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <Smartphone className="h-3 w-3 mr-1" />
        Select Account
      </Badge>
    );
  }

  // Missing groups
  if (!whatsapp_group_linked) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <Users className="h-3 w-3 mr-1" />
        Select Groups
      </Badge>
    );
  }

  // Ready to run sequence
  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
      <Play className="h-3 w-3 mr-1" />
      Run Sequence
    </Badge>
  );
}

// Check if workshop setup is complete
function isSetupComplete(workshop: WorkshopWithDetails): boolean {
  const { whatsapp_group_linked, messages_scheduled } = workshop.automation_status || {};
  return !!(
    workshop.tag_id && 
    workshop.tag?.template_sequence_id &&
    workshop.whatsapp_session_id && 
    whatsapp_group_linked
  );
}

export default function WorkshopNotification() {
  const { 
    workshops, 
    workshopsLoading, 
    orgTimezone,
    runMessaging,
    isRunningMessaging,
    useWorkshopGroups,
    useWorkshopMessages,
    subscribeToMessages,
  } = useWorkshopNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopWithDetails | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [activeProgressWorkshop, setActiveProgressWorkshop] = useState<WorkshopWithDetails | null>(null);

  // Subscribe to messages for the active progress workshop
  const { data: progressMessages } = useWorkshopMessages(activeProgressWorkshop?.id || null);
  
  useEffect(() => {
    if (!activeProgressWorkshop?.id) return;
    return subscribeToMessages(activeProgressWorkshop.id);
  }, [activeProgressWorkshop?.id, subscribeToMessages]);

  // Track when messaging starts to show progress banner
  useEffect(() => {
    if (selectedWorkshop && isRunningMessaging) {
      setActiveProgressWorkshop(selectedWorkshop);
      setBannerDismissed(false);
    }
  }, [isRunningMessaging, selectedWorkshop]);

  // Keep selectedWorkshop in sync with fresh query data after mutations
  useEffect(() => {
    if (selectedWorkshop && workshops.length > 0) {
      const freshData = workshops.find(w => w.id === selectedWorkshop.id);
      if (freshData) {
        setSelectedWorkshop(freshData);
      }
    }
  }, [workshops]);

  // Filter workshops by search query
  const filteredWorkshops = workshops.filter((w) =>
    w.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewWorkshop = (workshop: WorkshopWithDetails) => {
    setSelectedWorkshop(workshop);
    setSheetOpen(true);
  };

  const handleRunSequence = async (workshop: WorkshopWithDetails) => {
    // We need to fetch the linked groups for this workshop
    // For quick action, we'll open the sheet instead since we need group selection
    handleViewWorkshop(workshop);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Real-time Progress Banner */}
      {activeProgressWorkshop && progressMessages && !bannerDismissed && (
        <MessagingProgressBanner
          messages={progressMessages}
          workshopTitle={activeProgressWorkshop.title}
          onDismiss={() => {
            setBannerDismissed(true);
            setActiveProgressWorkshop(null);
          }}
          onViewDetails={() => {
            handleViewWorkshop(activeProgressWorkshop);
          }}
        />
      )}
      
      <PageIntro
        icon={Activity}
        tagline="Operations"
        description="Manage workshop notifications and automated messaging."
        variant="violet"
      />

      {/* Today's Workshop Card */}
      {!workshopsLoading && workshops.length > 0 && (
        <TodaysWorkshopCard
          workshops={workshops}
          orgTimezone={orgTimezone}
          onQuickSetup={handleViewWorkshop}
          onRunSequence={handleRunSequence}
        />
      )}

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workshops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Workshops Table */}
      {workshopsLoading ? (
        <TableSkeleton columns={5} rows={5} />
      ) : filteredWorkshops.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No workshops found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery ? 'Try a different search term' : 'Workshops will appear here once created'}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Workshop Name</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="text-center">Registrations</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkshops.map((workshop) => {
                const setupComplete = isSetupComplete(workshop);

                return (
                  <TableRow key={workshop.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium">
                          {formatInOrgTime(workshop.start_date, orgTimezone, 'MMM d, h:mm a')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatInOrgTime(workshop.start_date, orgTimezone, 'yyyy')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate font-medium">
                        {workshop.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {workshop.tag ? (
                        <WorkshopTagBadge
                          name={workshop.tag.name}
                          color={workshop.tag.color}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {workshop.registrations_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getStatusBadge(workshop)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {setupComplete ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="default"
                                size="sm"
                                className="gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRunSequence(workshop);
                                }}
                              >
                                <Play className="h-3.5 w-3.5" />
                                Run
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Run message sequence</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleViewWorkshop(workshop)}
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                                Setup
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Complete setup</TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewWorkshop(workshop)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Workshop Detail Sheet */}
      <WorkshopDetailSheet
        workshop={selectedWorkshop}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
