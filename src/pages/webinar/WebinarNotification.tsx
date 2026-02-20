import { useState, useEffect, useMemo } from 'react';
import { Video, Search, Eye, CheckCircle2, Tag, Smartphone, Users, Play, Trash2, Calendar, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton, MobileCardSkeleton } from '@/components/skeletons';
import { useWebinarNotification, WebinarWithDetails, useWebinarMessages } from '@/hooks/useWebinarNotification';
import { WorkshopTagBadge, MessagingProgressBanner, SequenceProgressButton } from '@/components/operations';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { PageIntro } from '@/components/PageIntro';
import { useWorkshopTags } from '@/hooks/useWorkshopTags';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import { fromZonedTime } from 'date-fns-tz';
import WebinarDetailSheet from './WebinarDetailSheet';

function getStatusBadge(webinar: WebinarWithDetails) {
  const { whatsapp_group_linked, messages_scheduled } = webinar.automation_status || {};

  if (messages_scheduled && whatsapp_group_linked) {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Ready
      </Badge>
    );
  }
  if (!webinar.tag_id) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <Tag className="h-3 w-3 mr-1" />
        Assign Tag
      </Badge>
    );
  }
  if (!webinar.whatsapp_session_id) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <Smartphone className="h-3 w-3 mr-1" />
        Select Account
      </Badge>
    );
  }
  if (!whatsapp_group_linked) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <Users className="h-3 w-3 mr-1" />
        Select Groups
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
      <Play className="h-3 w-3 mr-1" />
      Run Sequence
    </Badge>
  );
}

function isSetupComplete(webinar: WebinarWithDetails): boolean {
  const { whatsapp_group_linked } = webinar.automation_status || {};
  return !!(webinar.tag_id && webinar.tag?.template_sequence_id && webinar.whatsapp_session_id && whatsapp_group_linked);
}

export default function WebinarNotification() {
  const {
    webinars, webinarsLoading, orgTimezone, isRunningMessaging, subscribeToMessages,
    deleteWebinar, isDeletingWebinar, createWebinar, isCreatingWebinar,
  } = useWebinarNotification();
  const { tags } = useWorkshopTags();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWebinar, setSelectedWebinar] = useState<WebinarWithDetails | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [activeProgressWebinar, setActiveProgressWebinar] = useState<WebinarWithDetails | null>(null);
  const [webinarToDelete, setWebinarToDelete] = useState<WebinarWithDetails | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newTagId, setNewTagId] = useState<string>('none');

  const { data: progressMessages } = useWebinarMessages(activeProgressWebinar?.id || null);

  useEffect(() => {
    if (!activeProgressWebinar?.id) return;
    return subscribeToMessages(activeProgressWebinar.id);
  }, [activeProgressWebinar?.id, subscribeToMessages]);

  useEffect(() => {
    if (selectedWebinar && isRunningMessaging) {
      setActiveProgressWebinar(selectedWebinar);
      setBannerDismissed(false);
    }
  }, [isRunningMessaging, selectedWebinar]);

  useEffect(() => {
    if (selectedWebinar && webinars.length > 0) {
      const freshData = webinars.find(w => w.id === selectedWebinar.id);
      if (freshData) setSelectedWebinar(freshData);
    }
  }, [webinars, selectedWebinar]);

  const filteredWebinars = webinars.filter((w) =>
    w.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewWebinar = (webinar: WebinarWithDetails) => {
    setSelectedWebinar(webinar);
    setSheetOpen(true);
  };

  const handleRunSequence = (webinar: WebinarWithDetails) => {
    handleViewWebinar(webinar);
  };

  const handleConfirmDelete = () => {
    if (webinarToDelete) {
      deleteWebinar(webinarToDelete.id);
      setWebinarToDelete(null);
    }
  };

  const handleCreateWebinar = async () => {
    if (!newTitle.trim() || !newStartDate || !newEndDate) return;

    const startUTC = fromZonedTime(new Date(newStartDate), orgTimezone).toISOString();
    const endUTC = fromZonedTime(new Date(newEndDate), orgTimezone).toISOString();

    await createWebinar({
      title: newTitle.trim(),
      startDate: startUTC,
      endDate: endUTC,
      tagId: newTagId === 'none' ? null : newTagId,
    });

    setNewTitle('');
    setNewStartDate('');
    setNewEndDate('');
    setNewTagId('none');
    setCreateDialogOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageIntro
        icon={Video}
        tagline="Webinar"
        description="Manage webinar notifications via WhatsApp."
        variant="violet"
      />

      {/* Progress Banner */}
      {activeProgressWebinar && progressMessages && !bannerDismissed && (
        <MessagingProgressBanner
          messages={progressMessages}
          workshopTitle={activeProgressWebinar.title}
          onDismiss={() => { setBannerDismissed(true); setActiveProgressWebinar(null); }}
          onViewDetails={() => handleViewWebinar(activeProgressWebinar)}
        />
      )}

      {/* Search + Create */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search webinars..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Webinar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Webinar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Webinar Name</Label>
                <Input
                  placeholder="Enter webinar name..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tag</Label>
                <Select value={newTagId} onValueChange={setNewTagId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No tag</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color || '#8B5CF6' }} />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreateWebinar}
                disabled={!newTitle.trim() || !newStartDate || !newEndDate || isCreatingWebinar}
              >
                {isCreatingWebinar ? 'Creating...' : 'Create Webinar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webinar Table */}
      {webinarsLoading ? (
        <>
          <div className="hidden sm:block"><TableSkeleton columns={5} rows={5} /></div>
          <div className="sm:hidden"><MobileCardSkeleton count={3} /></div>
        </>
      ) : filteredWebinars.length === 0 ? (
        <div className="text-center py-12">
          <Video className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No webinars found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery ? 'Try a different search term' : 'Click "Create Webinar" to get started'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Webinar Name</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWebinars.map((webinar) => {
                  const setupComplete = isSetupComplete(webinar);
                  return (
                    <TableRow key={webinar.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{formatInOrgTime(webinar.start_date, orgTimezone, 'MMM d, h:mm a')}</div>
                          <div className="text-xs text-muted-foreground">{formatInOrgTime(webinar.start_date, orgTimezone, 'yyyy')}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate font-medium">{webinar.title}</div>
                      </TableCell>
                      <TableCell>
                        {webinar.tag ? (
                          <WorkshopTagBadge name={webinar.tag.name} color={webinar.tag.color} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(webinar)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <SequenceProgressButton
                            workshopId={webinar.id}
                            isSetupComplete={setupComplete}
                            onRun={() => handleRunSequence(webinar)}
                            onSetup={() => handleViewWebinar(webinar)}
                            subscribeToMessages={subscribeToMessages}
                            variant="compact"
                          />
                          <Button variant="ghost" size="sm" onClick={() => handleViewWebinar(webinar)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setWebinarToDelete(webinar); }}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete webinar</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {filteredWebinars.map((webinar) => {
              const setupComplete = isSetupComplete(webinar);
              return (
                <Card key={webinar.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">{webinar.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {formatInOrgTime(webinar.start_date, orgTimezone, 'EEE, MMM d · h:mm a')}
                      </p>
                    </div>
                    {getStatusBadge(webinar)}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {webinar.tag ? (
                      <WorkshopTagBadge name={webinar.tag.name} color={webinar.tag.color} />
                    ) : (
                      <span className="text-xs text-muted-foreground">No tag</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1">
                      <SequenceProgressButton
                        workshopId={webinar.id}
                        isSetupComplete={setupComplete}
                        onRun={() => handleRunSequence(webinar)}
                        onSetup={() => handleViewWebinar(webinar)}
                        subscribeToMessages={subscribeToMessages}
                        variant="compact"
                        className="w-full"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleViewWebinar(webinar)} className="h-9 w-9">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setWebinarToDelete(webinar)}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Detail Sheet */}
      <WebinarDetailSheet
        webinar={selectedWebinar}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        open={!!webinarToDelete}
        onOpenChange={(open) => !open && setWebinarToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Webinar"
        description={`Are you sure you want to delete "${webinarToDelete?.title}"? This will also delete all scheduled messages and configurations. This action cannot be undone.`}
        isDeleting={isDeletingWebinar}
      />
    </div>
  );
}
