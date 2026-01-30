import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, Tag, MessageCircle, Smartphone } from 'lucide-react';
import { useWorkshopNotification, WorkshopWithDetails } from '@/hooks/useWorkshopNotification';
import { useWorkshopTags } from '@/hooks/useWorkshopTags';
import { useWhatsAppSession } from '@/hooks/useWhatsAppSession';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { WorkshopTagBadge } from './WorkshopTagBadge';
import { MessageCheckpoints, toCheckpoints } from './MessageCheckpoints';
import { MessagingActions } from './MessagingActions';
import { SendMessageNowDialog } from './SendMessageNowDialog';
import { MultiGroupSelect } from './MultiGroupSelect';
import { formatInOrgTime } from '@/lib/timezoneUtils';

interface WorkshopDetailSheetProps {
  workshop: WorkshopWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkshopDetailSheet({ workshop, open, onOpenChange }: WorkshopDetailSheetProps) {
  const [sendNowDialogOpen, setSendNowDialogOpen] = useState(false);
  
  const { 
    updateTag, 
    isUpdatingTag, 
    updateSession, 
    updateGroups, 
    isUpdatingGroups,
    runMessaging,
    isRunningMessaging,
    sendMessageNow,
    isSendingNow,
    useWorkshopMessages,
    useWorkshopGroups: useFetchWorkshopGroups,
    subscribeToMessages,
    orgTimezone,
  } = useWorkshopNotification();
  
  const { tags } = useWorkshopTags();
  const { sessions } = useWhatsAppSession();
  const { groups, syncGroups, isSyncing } = useWhatsAppGroups();
  
  // Fetch messages for this workshop
  const { data: messages, isLoading: messagesLoading } = useWorkshopMessages(workshop?.id || null);
  
  // Fetch linked groups for this workshop from junction table
  const { data: linkedGroups } = useFetchWorkshopGroups(workshop?.id || null);
  
  // Subscribe to real-time updates
  useEffect(() => {
    if (!workshop?.id || !open) return;
    return subscribeToMessages(workshop.id);
  }, [workshop?.id, open, subscribeToMessages]);

  // Track selected session
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    workshop?.whatsapp_session_id || null
  );
  
  // Track selected group IDs (multi-select)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  
  // Initialize selected groups from junction table
  useEffect(() => {
    if (linkedGroups && linkedGroups.length > 0) {
      setSelectedGroupIds(linkedGroups.map(g => g.group_id));
    } else if (workshop?.whatsapp_group_id) {
      // Fallback to legacy single group
      setSelectedGroupIds([workshop.whatsapp_group_id]);
    } else {
      setSelectedGroupIds([]);
    }
  }, [linkedGroups, workshop?.whatsapp_group_id]);
  
  useEffect(() => {
    if (workshop?.whatsapp_session_id) {
      setSelectedSessionId(workshop.whatsapp_session_id);
    }
  }, [workshop?.whatsapp_session_id]);

  // Filter groups by selected session and map with is_admin
  const sessionGroups = useMemo(() => 
    (groups || [])
      .filter(g => !selectedSessionId || g.session_id === selectedSessionId)
      .map(g => ({
        ...g,
        is_admin: g.is_admin ?? false,
      })),
    [groups, selectedSessionId]
  );

  const connectedSessions = sessions?.filter(s => s.status === 'connected') || [];

  // Handle group selection change
  const handleGroupSelectionChange = (groupIds: string[]) => {
    setSelectedGroupIds(groupIds);
    if (workshop) {
      updateGroups({ workshopId: workshop.id, groupIds });
    }
  };

  if (!workshop) return null;

  const checkpoints = toCheckpoints(messages || [], orgTimezone);
  const hasSequence = !!(workshop.tag?.template_sequence_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left pr-8">{workshop.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Overview Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Overview
            </h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Workshop Date</p>
                <p className="text-sm font-medium">
                  {formatInOrgTime(workshop.start_date, orgTimezone, 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatInOrgTime(workshop.start_date, orgTimezone, 'EEEE')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registrations</p>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {workshop.registrations_count || 0}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Workshop Tag Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Workshop Tag
            </h3>
            <div className="space-y-2">
              <Select
                value={workshop.tag_id || 'none'}
                onValueChange={(value) => {
                  updateTag({ 
                    workshopId: workshop.id, 
                    tagId: value === 'none' ? null : value 
                  });
                }}
                disabled={isUpdatingTag}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tag..." />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" className="z-[100]">
                  <SelectItem value="none">No tag</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color || '#8B5CF6' }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {workshop.tag && (
                <div className="flex items-center gap-2 text-sm">
                  <WorkshopTagBadge 
                    name={workshop.tag.name} 
                    color={workshop.tag.color} 
                  />
                  {hasSequence ? (
                    <span className="text-xs text-muted-foreground">
                      → Has template sequence
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">
                      → No sequence configured
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* WhatsApp Settings Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp Settings
            </h3>
            
            <div className="space-y-4">
              {/* Account Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Account</Label>
                <Select
                  value={selectedSessionId || 'none'}
                  onValueChange={(value) => {
                    const sessionId = value === 'none' ? null : value;
                    setSelectedSessionId(sessionId);
                    updateSession({ workshopId: workshop.id, sessionId });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" className="z-[100]">
                    <SelectItem value="none">No account</SelectItem>
                    {connectedSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          {session.display_name || session.phone_number || 'Connected'}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Multi-Group Selection */}
              <MultiGroupSelect
                groups={sessionGroups}
                selectedGroupIds={selectedGroupIds}
                onSelectionChange={handleGroupSelectionChange}
                onSync={selectedSessionId ? () => syncGroups(selectedSessionId) : undefined}
                isSyncing={isSyncing}
                disabled={!selectedSessionId || isUpdatingGroups}
                sessionId={selectedSessionId}
              />

              {/* Show linked groups summary */}
              {selectedGroupIds.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {selectedGroupIds.length} Group{selectedGroupIds.length !== 1 ? 's' : ''} Linked
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {selectedGroupIds.slice(0, 3).map(id => {
                      const group = sessionGroups.find(g => g.id === id);
                      return group ? (
                        <div key={id} className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {group.group_name}
                        </div>
                      ) : null;
                    })}
                    {selectedGroupIds.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{selectedGroupIds.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Message Checkpoints Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Message Checkpoints</h3>
            <p className="text-xs text-muted-foreground">
              Status updates automatically in real-time
            </p>
            <MessageCheckpoints 
              checkpoints={checkpoints}
              isLoading={messagesLoading}
              timezone={orgTimezone}
            />
          </section>

          <Separator />

          {/* Messaging Actions */}
          <MessagingActions
            onRunSequence={() => runMessaging({ workshopId: workshop.id, workshop, groupIds: selectedGroupIds })}
            onSendNow={() => setSendNowDialogOpen(true)}
            isRunningSequence={isRunningMessaging}
            isSendingNow={isSendingNow}
            hasGroups={selectedGroupIds.length > 0}
            groupCount={selectedGroupIds.length}
            hasSession={!!workshop.whatsapp_session_id}
            hasSequence={hasSequence}
          />
        </div>
      </SheetContent>

      {/* Send Message Now Dialog - use first selected group for immediate send */}
      {selectedGroupIds.length > 0 && workshop.whatsapp_session_id && (
        <SendMessageNowDialog
          open={sendNowDialogOpen}
          onOpenChange={setSendNowDialogOpen}
          workshopTitle={workshop.title}
          workshopStartDate={workshop.start_date}
          timezone={orgTimezone}
          onSend={async ({ templateId, content, mediaUrl }) => {
            // Send to all selected groups
            for (const groupId of selectedGroupIds) {
              await sendMessageNow({
                workshopId: workshop.id,
                groupId: groupId,
                sessionId: workshop.whatsapp_session_id!,
                templateId,
                content,
                mediaUrl,
              });
            }
            setSendNowDialogOpen(false);
          }}
          isSending={isSendingNow}
          groupCount={selectedGroupIds.length}
        />
      )}
    </Sheet>
  );
}
