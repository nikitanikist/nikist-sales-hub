import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Tag, MessageCircle, Smartphone, Info, Clock, Plus, Link2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkshopNotification, useWorkshopMessages, useWorkshopGroups, WorkshopWithDetails } from '@/hooks/useWorkshopNotification';
import { useWorkshopTags } from '@/hooks/useWorkshopTags';
import { useWhatsAppSession } from '@/hooks/useWhatsAppSession';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useSequenceVariables } from '@/hooks/useSequenceVariables';
import { WorkshopTagBadge } from './WorkshopTagBadge';
import { MessageCheckpoints, toCheckpoints } from './MessageCheckpoints';
import { MessagingActions } from './MessagingActions';
import { SendMessageNowDialog } from './SendMessageNowDialog';
import { MultiGroupSelect } from './MultiGroupSelect';
import { CollapsibleSection } from './CollapsibleSection';
import { SequenceVariablesDialog } from './SequenceVariablesDialog';
import { formatInOrgTime } from '@/lib/timezoneUtils';
import { extractSequenceVariables } from '@/lib/templateVariables';
import { supabase } from '@/integrations/supabase/client';

interface WorkshopDetailSheetProps {
  workshop: WorkshopWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkshopDetailSheet({ workshop, open, onOpenChange }: WorkshopDetailSheetProps) {
  const [sendNowDialogOpen, setSendNowDialogOpen] = useState(false);
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false);
  const [pendingManualVariables, setPendingManualVariables] = useState<string[]>([]);
  
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
    cancelMessage,
    isCancellingMessage,
    subscribeToMessages,
    orgTimezone,
    createCommunity,
    isCreatingCommunity,
  } = useWorkshopNotification();
  
  const { tags } = useWorkshopTags();
  const { sessions } = useWhatsAppSession();
  const { groups, syncGroups, isSyncing } = useWhatsAppGroups();
  const { variablesMap, saveVariables, isSaving } = useSequenceVariables(workshop?.id || null);
  
  // Fetch messages for this workshop (standalone hook)
  const { data: messages, isLoading: messagesLoading } = useWorkshopMessages(workshop?.id || null);
  
  // Fetch linked groups for this workshop from junction table (standalone hook)
  const { data: linkedGroups } = useWorkshopGroups(workshop?.id || null);
  
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

  // Track expanded sections - compute defaults based on completion status
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  // Initialize expanded sections based on what's incomplete
  useEffect(() => {
    if (!workshop || !open) return;
    
    const initial = new Set<string>();
    
    // Always expand overview when first opened
    initial.add('overview');
    
    // Auto-expand incomplete sections
    if (!workshop.tag_id) {
      initial.add('tag');
    }
    if (!workshop.whatsapp_session_id || !workshop.automation_status?.whatsapp_group_linked) {
      initial.add('whatsapp');
    }
    // Expand checkpoints if there are messages
    if (messages && messages.length > 0) {
      initial.add('checkpoints');
    }
    
    setExpandedSections(initial);
  }, [workshop?.id, open]);
  
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

  const toggleSection = (id: string) => (expanded: boolean) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  if (!workshop) return null;

  const checkpoints = toCheckpoints(messages || [], orgTimezone);
  const hasSequence = !!(workshop.tag?.template_sequence_id);
  
  // Handle Run Sequence - check for manual variables first
  const handleRunSequence = async () => {
    if (!workshop.tag?.template_sequence_id) {
      runMessaging({ workshopId: workshop.id, workshop, groupIds: selectedGroupIds, manualVariables: {} });
      return;
    }

    // Fetch the sequence steps to extract variables
    const { data: sequenceData } = await supabase
      .from('template_sequences')
      .select(`
        steps:template_sequence_steps(
          template:whatsapp_message_templates(content)
        )
      `)
      .eq('id', workshop.tag.template_sequence_id)
      .single();

    if (sequenceData?.steps) {
      const { manual } = extractSequenceVariables(sequenceData.steps);
      
      if (manual.length > 0) {
        // Show dialog for manual variables
        setPendingManualVariables(manual);
        setVariablesDialogOpen(true);
        return;
      }
    }

    // No manual variables needed, run directly
    runMessaging({ workshopId: workshop.id, workshop, groupIds: selectedGroupIds, manualVariables: {} });
  };

  // Handle variables dialog submission
  const handleVariablesSubmit = async (variables: Record<string, string>) => {
    // Save variables to database
    await saveVariables({ workshopId: workshop.id, variables });
    
    // Run messaging with the variables
    runMessaging({ 
      workshopId: workshop.id, 
      workshop, 
      groupIds: selectedGroupIds, 
      manualVariables: variables 
    });
    
    setVariablesDialogOpen(false);
    setPendingManualVariables([]);
  };
  
  // Calculate summaries for collapsed state
  const tagSummary = workshop.tag 
    ? `${workshop.tag.name}${hasSequence ? ' · Has sequence' : ' · No sequence'}`
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
          <SheetTitle className="text-left pr-8 line-clamp-2 text-base sm:text-lg">{workshop.title}</SheetTitle>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatInOrgTime(workshop.start_date, orgTimezone, 'EEEE, MMM d · h:mm a')}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-2">
          {/* Overview Section */}
          <CollapsibleSection
            id="overview"
            title="Overview"
            icon={Info}
            status="neutral"
            summary={`${workshop.registrations_count || 0} registrations`}
            isExpanded={expandedSections.has('overview')}
            onToggle={toggleSection('overview')}
          >
            <div className="grid grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
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
          </CollapsibleSection>

          <Separator className="my-1" />

          {/* Workshop Tag Section */}
          <CollapsibleSection
            id="tag"
            title="Workshop Tag"
            icon={Tag}
            status={workshop.tag_id ? (hasSequence ? 'complete' : 'incomplete') : 'incomplete'}
            summary={tagSummary}
            isExpanded={expandedSections.has('tag')}
            onToggle={toggleSection('tag')}
          >
            <div className="space-y-3">
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
                <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                  <WorkshopTagBadge 
                    name={workshop.tag.name} 
                    color={workshop.tag.color} 
                  />
                  {hasSequence ? (
                    <span className="text-xs text-muted-foreground">
                      → Has template sequence
                    </span>
                  ) : (
                    <span className="text-xs text-destructive">
                      → No sequence configured
                    </span>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          <Separator className="my-1" />

          {/* WhatsApp Settings Section */}
          <CollapsibleSection
            id="whatsapp"
            title="WhatsApp Settings"
            icon={MessageCircle}
            status={selectedSessionId && selectedGroupIds.length > 0 ? 'complete' : 'incomplete'}
            summary={whatsappSummary}
            isExpanded={expandedSections.has('whatsapp')}
            onToggle={toggleSection('whatsapp')}
          >
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

              {/* Create WhatsApp Group Button - show when session selected but no groups linked */}
              {selectedSessionId && selectedGroupIds.length === 0 && (
                <div className="p-3 border border-dashed border-muted-foreground/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Info className="h-4 w-4" />
                    <span>No WhatsApp group linked to this workshop</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => createCommunity({ workshopId: workshop.id, workshopTitle: workshop.title })}
                    disabled={isCreatingCommunity}
                  >
                    {isCreatingCommunity ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create WhatsApp Group
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Show linked groups summary with invite links */}
              {selectedGroupIds.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {selectedGroupIds.length} Group{selectedGroupIds.length !== 1 ? 's' : ''} Linked
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {selectedGroupIds.slice(0, 3).map(id => {
                      const group = sessionGroups.find(g => g.id === id);
                      if (!group) return null;
                      const shortId = group.group_jid.split('@')[0].slice(-6);
                      return (
                        <div key={id} className="space-y-1">
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Users className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{group.group_name}</span>
                            <span className="text-muted-foreground/60 font-mono flex-shrink-0">#{shortId}</span>
                          </div>
                          {group.invite_link && (
                            <div className="flex items-center gap-1 ml-4">
                              <Link2 className="h-3 w-3 text-muted-foreground/60" />
                              <a 
                                href={group.invite_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline truncate max-w-[180px]"
                              >
                                {group.invite_link.replace('https://chat.whatsapp.com/', '')}
                              </a>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(group.invite_link!);
                                  toast.success('Invite link copied');
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <a
                                href={group.invite_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-5 w-5 p-0 inline-flex items-center justify-center hover:bg-muted rounded"
                              >
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {selectedGroupIds.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{selectedGroupIds.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Create additional group button when groups already exist */}
              {selectedSessionId && selectedGroupIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => createCommunity({ workshopId: workshop.id, workshopTitle: workshop.title })}
                  disabled={isCreatingCommunity}
                >
                  {isCreatingCommunity ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Additional Group
                    </>
                  )}
                </Button>
              )}
            </div>
          </CollapsibleSection>

          <Separator className="my-1" />

          {/* Message Checkpoints Section */}
          <CollapsibleSection
            id="checkpoints"
            title="Message Checkpoints"
            icon={Calendar}
            status={messages && messages.length > 0 ? 'neutral' : 'neutral'}
            summary={checkpointsSummary}
            isExpanded={expandedSections.has('checkpoints')}
            onToggle={toggleSection('checkpoints')}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Status updates automatically in real-time
              </p>
              <MessageCheckpoints 
                checkpoints={checkpoints}
                isLoading={messagesLoading}
                timezone={orgTimezone}
                onCancel={cancelMessage}
                isCancelling={isCancellingMessage}
              />
            </div>
          </CollapsibleSection>
        </div>

        {/* Sticky Footer with Messaging Actions */}
        <SheetFooter className="border-t bg-background px-4 sm:px-6 py-3 sm:py-4 mt-auto">
          <div className="w-full">
            <MessagingActions
              onRunSequence={handleRunSequence}
              onSendNow={() => setSendNowDialogOpen(true)}
              isRunningSequence={isRunningMessaging || isSaving}
              isSendingNow={isSendingNow}
              hasGroups={selectedGroupIds.length > 0}
              groupCount={selectedGroupIds.length}
              hasSession={!!workshop.whatsapp_session_id}
              hasSequence={hasSequence}
              messages={messages}
            />
          </div>
        </SheetFooter>
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
          savedVariables={variablesMap}
        />
      )}

      {/* Sequence Variables Dialog */}
      <SequenceVariablesDialog
        open={variablesDialogOpen}
        onOpenChange={setVariablesDialogOpen}
        workshopTitle={workshop.title}
        workshopStartDate={workshop.start_date}
        timezone={orgTimezone}
        manualVariables={pendingManualVariables}
        savedValues={variablesMap}
        onSubmit={handleVariablesSubmit}
        isSubmitting={isRunningMessaging || isSaving}
      />
    </Sheet>
  );
}
