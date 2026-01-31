import { useState, useEffect } from 'react';
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
  Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/skeletons';
import { WorkshopWithDetails, ScheduledMessage } from '@/hooks/useWorkshopNotification';
import { WorkshopTagBadge, WorkshopDetailSheet, TodaysWorkshopCard, MessagingProgressBanner, SequenceProgressButton } from '@/components/operations';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

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
  const { whatsapp_group_linked } = workshop.automation_status || {};
  return !!(
    workshop.tag_id && 
    workshop.tag?.template_sequence_id &&
    workshop.whatsapp_session_id && 
    whatsapp_group_linked
  );
}

interface WhatsAppGroupTabProps {
  workshops: WorkshopWithDetails[];
  workshopsLoading: boolean;
  orgTimezone: string;
  subscribeToMessages: (workshopId: string) => () => void;
  useWorkshopMessages: (workshopId: string | null) => { data: ScheduledMessage[] | undefined };
  isRunningMessaging: boolean;
  onDeleteWorkshop?: (workshopId: string) => void;
  isDeletingWorkshop?: boolean;
}

export function WhatsAppGroupTab({
  workshops,
  workshopsLoading,
  orgTimezone,
  subscribeToMessages,
  useWorkshopMessages,
  isRunningMessaging,
  onDeleteWorkshop,
  isDeletingWorkshop,
}: WhatsAppGroupTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopWithDetails | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [activeProgressWorkshop, setActiveProgressWorkshop] = useState<WorkshopWithDetails | null>(null);
  const [workshopToDelete, setWorkshopToDelete] = useState<WorkshopWithDetails | null>(null);

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
  }, [workshops, selectedWorkshop]);

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

  const handleConfirmDelete = () => {
    if (workshopToDelete && onDeleteWorkshop) {
      onDeleteWorkshop(workshopToDelete.id);
      setWorkshopToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Today's Workshop Card */}
      {!workshopsLoading && workshops.length > 0 && (
        <TodaysWorkshopCard
          workshops={workshops}
          orgTimezone={orgTimezone}
          onQuickSetup={handleViewWorkshop}
          onRunSequence={handleRunSequence}
          subscribeToMessages={subscribeToMessages}
          useWorkshopMessages={useWorkshopMessages}
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
                        <SequenceProgressButton
                          workshopId={workshop.id}
                          isSetupComplete={setupComplete}
                          onRun={() => handleRunSequence(workshop)}
                          onSetup={() => handleViewWorkshop(workshop)}
                          subscribeToMessages={subscribeToMessages}
                          useWorkshopMessages={useWorkshopMessages}
                          variant="compact"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewWorkshop(workshop)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {onDeleteWorkshop && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWorkshopToDelete(workshop);
                                }}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete workshop</TooltipContent>
                          </Tooltip>
                        )}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!workshopToDelete}
        onOpenChange={(open) => !open && setWorkshopToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Workshop"
        description={`Are you sure you want to delete "${workshopToDelete?.title}"? This will also delete all scheduled messages and configurations for this workshop. This action cannot be undone.`}
        isDeleting={isDeletingWorkshop}
      />
    </div>
  );
}
