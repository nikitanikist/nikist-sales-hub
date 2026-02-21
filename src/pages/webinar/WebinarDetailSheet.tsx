import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Tag, MessageCircle, Smartphone, Info, Clock, Plus, Link2, Copy, ExternalLink, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useWebinarNotification, useWebinarMessages, useWebinarGroups, WebinarWithDetails } from '@/hooks/useWebinarNotification';
import { useWorkshopTags } from '@/hooks/useWorkshopTags';
import { useWhatsAppSession } from '@/hooks/useWhatsAppSession';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { WorkshopTagBadge } from '@/components/operations/WorkshopTagBadge';
import { MessageCheckpoints, toCheckpoints } from '@/components/operations/MessageCheckpoints';
import { MessagingActions } from '@/components/operations/MessagingActions';
import { SendMessageNowDialog } from '@/components/operations/SendMessageNowDialog';
import { MultiGroupSelect } from '@/components/operations/MultiGroupSelect';
import { CollapsibleSection } from '@/components/operations/CollapsibleSection';
import { SequenceVariablesDialog } from '@/components/operations/SequenceVariablesDialog';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import { extractSequenceVariables } from '@/lib/templateVariables';
import { supabase } from '@/integrations/supabase/client';

interface WebinarDetailSheetProps {
  webinar: WebinarWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WebinarDetailSheet({ webinar, open, onOpenChange }: WebinarDetailSheetProps) {
  const [sendNowDialogOpen, setSendNowDialogOpen] = useState(false);
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false);
  const [pendingManualVariables, setPendingManualVariables] = useState<string[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const {
    updateTag, isUpdatingTag, updateSession, updateGroups, isUpdatingGroups,
    runMessaging, isRunningMessaging, sendMessageNow, isSendingNow,
    cancelMessage, isCancellingMessage, subscribeToMessages, orgTimezone,
    createCommunity, isCreatingCommunity,
  } = useWebinarNotification();

  const { tags } = useWorkshopTags();
  const { sessions } = useWhatsAppSession();
  const { groups, syncGroups, isSyncing, fetchInviteLink, isFetchingInviteLink, fetchingInviteLinkGroupId } = useWhatsAppGroups();

  const { data: messages, isLoading: messagesLoading } = useWebinarMessages(webinar?.id || null);
  const { data: linkedGroups } = useWebinarGroups(webinar?.id || null);

  // Simple variables map (could add a useWebinarSequenceVariables hook later)
  const variablesMap: Record<string, string> = {};

  useEffect(() => {
    if (!webinar?.id || !open) return;
    return subscribeToMessages(webinar.id);
  }, [webinar?.id, open, subscribeToMessages]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(webinar?.whatsapp_session_id || null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!webinar || !open) return;
    const initial = new Set<string>();
    initial.add('overview');
    if (!webinar.tag_id) initial.add('tag');
    if (!webinar.whatsapp_session_id || !webinar.automation_status?.whatsapp_group_linked) initial.add('whatsapp');
    if (messages && messages.length > 0) initial.add('checkpoints');
    setExpandedSections(initial);
  }, [webinar?.id, open]);

  useEffect(() => {
    if (linkedGroups && linkedGroups.length > 0) {
      setSelectedGroupIds(linkedGroups.map(g => g.group_id));
    } else if (webinar?.whatsapp_group_id) {
      setSelectedGroupIds([webinar.whatsapp_group_id]);
    } else {
      setSelectedGroupIds([]);
    }
  }, [linkedGroups, webinar?.whatsapp_group_id]);

  useEffect(() => {
    if (webinar?.whatsapp_session_id) setSelectedSessionId(webinar.whatsapp_session_id);
  }, [webinar?.whatsapp_session_id]);

  const sessionGroups = useMemo(() =>
    (groups || [])
      .filter(g => !selectedSessionId || g.session_id === selectedSessionId)
      .map(g => ({ ...g, is_admin: g.is_admin ?? false })),
    [groups, selectedSessionId]
  );

  const connectedSessions = sessions?.filter(s => s.status === 'connected') || [];

  const handleGroupSelectionChange = (groupIds: string[]) => {
    setSelectedGroupIds(groupIds);
    if (webinar) updateGroups({ webinarId: webinar.id, groupIds });
  };

  const toggleSection = (id: string) => (expanded: boolean) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (expanded) next.add(id); else next.delete(id);
      return next;
    });
  };

  if (!webinar) return null;

  const checkpoints = toCheckpoints((messages || []) as any[], orgTimezone);
  const hasSequence = !!(webinar.tag?.template_sequence_id);

  const handleRunSequence = async () => {
    if (!webinar.tag?.template_sequence_id) {
      runMessaging({ webinarId: webinar.id, webinar, groupIds: selectedGroupIds, manualVariables: {} });
      return;
    }

    const { data: sequenceData } = await supabase
      .from('template_sequences')
      .select(`steps:template_sequence_steps(template:whatsapp_message_templates(content))`)
      .eq('id', webinar.tag.template_sequence_id)
      .single();

    if (sequenceData?.steps) {
      const { manual } = extractSequenceVariables(sequenceData.steps);
      if (manual.length > 0) {
        setPendingManualVariables(manual);
        setVariablesDialogOpen(true);
        return;
      }
    }

    runMessaging({ webinarId: webinar.id, webinar, groupIds: selectedGroupIds, manualVariables: {} });
  };

  const handleVariablesSubmit = async (variables: Record<string, string>) => {
    runMessaging({
      webinarId: webinar.id, webinar, groupIds: selectedGroupIds, manualVariables: variables,
    });
    setVariablesDialogOpen(false);
    setPendingManualVariables([]);
  };

  const tagSummary = webinar.tag
    ? `${webinar.tag.name}${hasSequence ? ' · Has sequence' : ' · No sequence'}`
    : 'Not assigned';

  const whatsappSummary = selectedSessionId
    ? `${connectedSessions.find(s => s.id === selectedSessionId)?.display_name || 'Connected'} · ${selectedGroupIds.length} group${selectedGroupIds.length !== 1 ? 's' : ''}`
    : 'Not configured';

  const checkpointsSummary = messages && messages.length > 0
    ? `${messages.filter(m => m.status === 'sent').length}/${messages.length} sent`
    : 'No messages scheduled';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
          <SheetTitle className="text-left pr-8 line-clamp-2 text-base sm:text-lg">{webinar.title}</SheetTitle>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatInOrgTime(webinar.start_date, orgTimezone, 'EEEE, MMM d · h:mm a')}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-2">
          {/* Overview */}
          <CollapsibleSection
            id="overview" title="Overview" icon={Info} status="neutral"
            summary="Webinar details" isExpanded={expandedSections.has('overview')}
            onToggle={toggleSection('overview')}
          >
            <div className="grid grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Start</p>
                <p className="text-sm font-medium">{formatInOrgTime(webinar.start_date, orgTimezone, 'MMM d, yyyy h:mm a')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End</p>
                <p className="text-sm font-medium">{formatInOrgTime(webinar.end_date, orgTimezone, 'MMM d, yyyy h:mm a')}</p>
              </div>
            </div>
          </CollapsibleSection>

          <Separator className="my-1" />

          {/* Tag */}
          <CollapsibleSection
            id="tag" title="Webinar Tag" icon={Tag}
            status={webinar.tag_id ? (hasSequence ? 'complete' : 'incomplete') : 'incomplete'}
            summary={tagSummary} isExpanded={expandedSections.has('tag')}
            onToggle={toggleSection('tag')}
          >
            <div className="space-y-3">
              <Select
                value={webinar.tag_id || 'none'}
                onValueChange={(value) => updateTag({ webinarId: webinar.id, tagId: value === 'none' ? null : value })}
                disabled={isUpdatingTag}
              >
                <SelectTrigger><SelectValue placeholder="Select a tag..." /></SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" className="z-[100]">
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
              {webinar.tag && (
                <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                  <WorkshopTagBadge name={webinar.tag.name} color={webinar.tag.color} />
                  {hasSequence ? (
                    <span className="text-xs text-muted-foreground">→ Has template sequence</span>
                  ) : (
                    <span className="text-xs text-destructive">→ No sequence configured</span>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          <Separator className="my-1" />

          {/* WhatsApp */}
          <CollapsibleSection
            id="whatsapp" title="WhatsApp Settings" icon={MessageCircle}
            status={selectedSessionId && selectedGroupIds.length > 0 ? 'complete' : 'incomplete'}
            summary={whatsappSummary} isExpanded={expandedSections.has('whatsapp')}
            onToggle={toggleSection('whatsapp')}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Account</Label>
                <Select
                  value={selectedSessionId || 'none'}
                  onValueChange={(value) => {
                    const sessionId = value === 'none' ? null : value;
                    setSelectedSessionId(sessionId);
                    updateSession({ webinarId: webinar.id, sessionId });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
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

              {/* Linked Groups Cards */}
              {selectedGroupIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Linked Groups ({selectedGroupIds.length})
                  </Label>
                  <div className="space-y-2">
                    {selectedGroupIds.map(id => {
                      const group = sessionGroups.find(g => g.id === id);
                      if (!group) return null;
                      return (
                        <div key={id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card">
                          <div className="flex items-center gap-2 min-w-0">
                            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{group.group_name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="secondary" className="text-xs">
                              {group.participant_count ?? 0} members
                            </Badge>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                const newIds = selectedGroupIds.filter(gId => gId !== id);
                                handleGroupSelectionChange(newIds);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Toggle Group Picker */}
              {selectedSessionId && (
                <Button
                  variant="outline" size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowGroupPicker(prev => !prev)}
                >
                  {showGroupPicker ? (
                    <><ChevronUp className="h-4 w-4" />Hide Group Picker</>
                  ) : (
                    <><Plus className="h-4 w-4" />Add / Change Groups</>
                  )}
                </Button>
              )}

              {showGroupPicker && selectedSessionId && (
                <MultiGroupSelect
                  groups={sessionGroups}
                  selectedGroupIds={selectedGroupIds}
                  onSelectionChange={handleGroupSelectionChange}
                  onSync={() => syncGroups(selectedSessionId)}
                  isSyncing={isSyncing}
                  disabled={isUpdatingGroups}
                  sessionId={selectedSessionId}
                />
              )}

              {selectedSessionId && selectedGroupIds.length === 0 && !showGroupPicker && (
                <div className="p-3 border border-dashed border-muted-foreground/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Info className="h-4 w-4" />
                    <span>No WhatsApp group linked to this webinar</span>
                  </div>
                  <Button
                    variant="outline" size="sm" className="w-full gap-2"
                    onClick={() => createCommunity({ webinarId: webinar.id, webinarTitle: webinar.title })}
                    disabled={isCreatingCommunity}
                  >
                    {isCreatingCommunity ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Creating...</>
                    ) : (
                      <><Plus className="h-4 w-4" />Create WhatsApp Group</>
                    )}
                  </Button>
                </div>
              )}

              {selectedSessionId && selectedGroupIds.length > 0 && (
                <Button
                  variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => createCommunity({ webinarId: webinar.id, webinarTitle: webinar.title })}
                  disabled={isCreatingCommunity}
                >
                  {isCreatingCommunity ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Creating...</>
                  ) : (
                    <><Plus className="h-4 w-4" />Create Additional Group</>
                  )}
                </Button>
              )}
            </div>
          </CollapsibleSection>

          <Separator className="my-1" />

          {/* Checkpoints */}
          <CollapsibleSection
            id="checkpoints" title="Message Checkpoints" icon={Calendar}
            status="neutral" summary={checkpointsSummary}
            isExpanded={expandedSections.has('checkpoints')}
            onToggle={toggleSection('checkpoints')}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Status updates automatically in real-time</p>
              <MessageCheckpoints
                checkpoints={checkpoints}
                isLoading={messagesLoading}
                timezone={orgTimezone}
                onCancel={cancelMessage}
                isCancelling={isCancellingMessage}
                showAnalytics={true}
              />
            </div>
          </CollapsibleSection>
        </div>

        <SheetFooter className="border-t bg-background px-4 sm:px-6 py-3 sm:py-4 mt-auto">
          <div className="w-full">
            <MessagingActions
              onRunSequence={handleRunSequence}
              onSendNow={() => setSendNowDialogOpen(true)}
              isRunningSequence={isRunningMessaging}
              isSendingNow={isSendingNow}
              hasGroups={selectedGroupIds.length > 0}
              groupCount={selectedGroupIds.length}
              hasSession={!!webinar.whatsapp_session_id}
              hasSequence={hasSequence}
              messages={messages as any}
            />
          </div>
        </SheetFooter>
      </SheetContent>

      {selectedGroupIds.length > 0 && webinar.whatsapp_session_id && (
        <SendMessageNowDialog
          open={sendNowDialogOpen}
          onOpenChange={setSendNowDialogOpen}
          workshopTitle={webinar.title}
          workshopStartDate={webinar.start_date}
          timezone={orgTimezone}
          onSend={async ({ templateId, content, mediaUrl }) => {
            for (const groupId of selectedGroupIds) {
              await sendMessageNow({
                webinarId: webinar.id,
                groupId,
                sessionId: webinar.whatsapp_session_id!,
                templateId,
                content,
                mediaUrl,
              });
            }
            setSendNowDialogOpen(false);
          }}
          isSending={isSendingNow}
          groupCount={selectedGroupIds.length}
          savedVariables={variablesMap}
        />
      )}

      <SequenceVariablesDialog
        open={variablesDialogOpen}
        onOpenChange={setVariablesDialogOpen}
        workshopTitle={webinar.title}
        workshopStartDate={webinar.start_date}
        timezone={orgTimezone}
        manualVariables={pendingManualVariables}
        savedValues={variablesMap}
        onSubmit={handleVariablesSubmit}
        isSubmitting={isRunningMessaging}
      />
    </Sheet>
  );
}
