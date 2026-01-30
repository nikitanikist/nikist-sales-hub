import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Tag, MessageCircle, Smartphone, RefreshCw } from 'lucide-react';
import { useWorkshopNotification, WorkshopWithDetails } from '@/hooks/useWorkshopNotification';
import { useWorkshopTags } from '@/hooks/useWorkshopTags';
import { useWhatsAppSession } from '@/hooks/useWhatsAppSession';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { WorkshopTagBadge } from './WorkshopTagBadge';
import { MessageCheckpoints, toCheckpoints } from './MessageCheckpoints';
import { MessagingActions } from './MessagingActions';
import { SendMessageNowDialog } from './SendMessageNowDialog';
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
    updateGroup, 
    isUpdatingGroup,
    runMessaging,
    isRunningMessaging,
    sendMessageNow,
    isSendingNow,
    useWorkshopMessages,
    subscribeToMessages,
    orgTimezone,
  } = useWorkshopNotification();
  
  const { tags } = useWorkshopTags();
  const { sessions } = useWhatsAppSession();
  const { groups, syncGroups, isSyncing } = useWhatsAppGroups();
  
  // Fetch messages for this workshop
  const { data: messages, isLoading: messagesLoading } = useWorkshopMessages(workshop?.id || null);
  
  // Subscribe to real-time updates
  useEffect(() => {
    if (!workshop?.id || !open) return;
    return subscribeToMessages(workshop.id);
  }, [workshop?.id, open, subscribeToMessages]);

  // Filter groups by selected session
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    workshop?.whatsapp_session_id || null
  );
  
  useEffect(() => {
    if (workshop?.whatsapp_session_id) {
      setSelectedSessionId(workshop.whatsapp_session_id);
    }
  }, [workshop?.whatsapp_session_id]);

  const sessionGroups = groups?.filter(g => 
    !selectedSessionId || g.session_id === selectedSessionId
  ) || [];

  const connectedSessions = sessions?.filter(s => s.status === 'connected') || [];

  if (!workshop) return null;

  // Extract date portion to prevent timezone shifting (e.g., Jan 31 UTC showing as Feb 1 in IST)
  const datePart = workshop.start_date.split('T')[0];
  const workshopDate = new Date(datePart + 'T12:00:00');
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
                  {formatInOrgTime(workshopDate, orgTimezone, 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatInOrgTime(workshopDate, orgTimezone, 'EEEE')}
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

              {/* Group Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Group</Label>
                  {selectedSessionId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncGroups(selectedSessionId)}
                      disabled={isSyncing}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                      Sync
                    </Button>
                  )}
                </div>
                <Select
                  value={workshop.whatsapp_group_id || 'none'}
                  onValueChange={(value) => {
                    updateGroup({ workshopId: workshop.id, groupId: value === 'none' ? null : value });
                  }}
                  disabled={!selectedSessionId || isUpdatingGroup}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group..." />
                  </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" className="z-[100]">
                    <SelectItem value="none">No group</SelectItem>
                    {sessionGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {group.group_name}
                          <span className="text-xs text-muted-foreground">
                            ({group.participant_count || 0})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {workshop.whatsapp_group && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg text-sm">
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    Linked
                  </Badge>
                  <span className="font-medium">{workshop.whatsapp_group.group_name}</span>
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
            onRunSequence={() => runMessaging({ workshopId: workshop.id, workshop })}
            onSendNow={() => setSendNowDialogOpen(true)}
            isRunningSequence={isRunningMessaging}
            isSendingNow={isSendingNow}
            hasGroup={!!workshop.whatsapp_group_id}
            hasSession={!!workshop.whatsapp_session_id}
            hasSequence={hasSequence}
          />
        </div>
      </SheetContent>

      {/* Send Message Now Dialog */}
      {workshop.whatsapp_group_id && workshop.whatsapp_session_id && (
        <SendMessageNowDialog
          open={sendNowDialogOpen}
          onOpenChange={setSendNowDialogOpen}
          workshopTitle={workshop.title}
          workshopDate={workshopDate}
          onSend={async ({ templateId, content, mediaUrl }) => {
            await sendMessageNow({
              workshopId: workshop.id,
              groupId: workshop.whatsapp_group_id!,
              sessionId: workshop.whatsapp_session_id!,
              templateId,
              content,
              mediaUrl,
            });
            setSendNowDialogOpen(false);
          }}
          isSending={isSendingNow}
        />
      )}
    </Sheet>
  );
}
