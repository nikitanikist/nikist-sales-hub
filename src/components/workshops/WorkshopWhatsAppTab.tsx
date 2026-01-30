import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare, Send, Link2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WorkshopWhatsAppTabProps {
  workshopId: string;
  workshopTitle: string;
}

export function WorkshopWhatsAppTab({ workshopId, workshopTitle }: WorkshopWhatsAppTabProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const { groups, linkToWorkshop, isLinking, unlinkedGroups, getWorkshopGroups } = useWhatsAppGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');

  const linkedGroups = getWorkshopGroups(workshopId);

  // Fetch scheduled messages for this workshop
  const { data: scheduledMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['workshop-whatsapp-messages', workshopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_whatsapp_messages')
        .select('*')
        .eq('workshop_id', workshopId)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!workshopId,
  });

  // Fetch message templates
  const { data: templates } = useQuery({
    queryKey: ['whatsapp-templates', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from('whatsapp_message_templates')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  // Link group to workshop
  const handleLinkGroup = () => {
    if (!selectedGroupId) return;
    linkToWorkshop({ groupId: selectedGroupId, workshopId });
    setSelectedGroupId('');
  };

  // Unlink group from workshop
  const handleUnlinkGroup = (groupId: string) => {
    linkToWorkshop({ groupId, workshopId: null });
  };

  // Send immediate message
  const sendMessageMutation = useMutation({
    mutationFn: async ({ groupId, message }: { groupId: string; message: string }) => {
      // Get session from whatsapp_sessions
      const { data: sessions } = await supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('organization_id', currentOrganization?.id)
        .eq('status', 'connected')
        .single();

      if (!sessions) throw new Error('No connected WhatsApp session');

      // Get group JID
      const { data: group } = await supabase
        .from('whatsapp_groups')
        .select('group_jid')
        .eq('id', groupId)
        .single();

      if (!group) throw new Error('Group not found');

      const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'send',
          sessionId: sessions.id,
          groupId: group.group_jid,
          message,
          organizationId: currentOrganization?.id,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success('Message sent successfully!');
      setCustomMessage('');
    },
    onError: (error: Error) => {
      toast.error('Failed to send message: ' + error.message);
    },
  });

  const handleSendMessage = (groupId: string) => {
    if (!customMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }
    sendMessageMutation.mutate({ groupId, message: customMessage });
  };

  const applyTemplate = (content: string) => {
    // Replace placeholders with workshop data
    const processed = content
      .replace(/\{workshop_name\}/g, workshopTitle)
      .replace(/\{date\}/g, format(new Date(), 'PPP'));
    setCustomMessage(processed);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Linked Groups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Linked WhatsApp Groups
          </CardTitle>
          <CardDescription>
            Messages will be sent to these groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedGroups.length > 0 ? (
            <div className="space-y-2">
              {linkedGroups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium text-sm">{group.group_name}</p>
                    <p className="text-xs text-muted-foreground">{group.participant_count} participants</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlinkGroup(group.id)}
                    disabled={isLinking}
                  >
                    Unlink
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No groups linked to this workshop</p>
          )}

          {/* Link new group */}
          {unlinkedGroups.length > 0 && (
            <div className="flex gap-2 mt-4">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a group to link" />
                </SelectTrigger>
                <SelectContent>
                  {unlinkedGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleLinkGroup} disabled={!selectedGroupId || isLinking}>
                {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Message */}
      {linkedGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Send Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template selection */}
            {templates && templates.length > 0 && (
              <Select onValueChange={(value) => {
                const template = templates.find(t => t.id === value);
                if (template) applyTemplate(template.content);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Use a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Textarea
              placeholder="Type your message..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
            />

            <div className="flex gap-2">
              {linkedGroups.map((group) => (
                <Button
                  key={group.id}
                  onClick={() => handleSendMessage(group.id)}
                  disabled={sendMessageMutation.isPending || !customMessage.trim()}
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send to {group.group_name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Messages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Scheduled Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messagesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : scheduledMessages && scheduledMessages.length > 0 ? (
            <div className="space-y-2">
              {scheduledMessages.map((msg) => (
                <div key={msg.id} className="flex items-start justify-between p-2 border rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{msg.message_type}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{msg.message_content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scheduled: {format(new Date(msg.scheduled_for), 'PPP p')}
                    </p>
                  </div>
                  {getStatusBadge(msg.status)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No scheduled messages</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
