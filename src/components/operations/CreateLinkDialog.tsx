import { useState, useEffect, useMemo } from 'react';
import { Link as LinkIcon, MessageCircle, Search, Check, AlertCircle, RefreshCw, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDynamicLinks, DynamicLink } from '@/hooks/useDynamicLinks';
import { useWhatsAppGroups, WhatsAppGroup } from '@/hooks/useWhatsAppGroups';
import { useWhatsAppSession } from '@/hooks/useWhatsAppSession';

interface CreateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLink?: DynamicLink | null;
}

type DestinationType = 'url' | 'whatsapp';

export function CreateLinkDialog({ open, onOpenChange, editingLink }: CreateLinkDialogProps) {
  const { createLink, isCreating, updateLink, isUpdating } = useDynamicLinks();
  const { groups, groupsLoading, syncGroups, isSyncing, fetchInviteLinkAsync, isFetchingInviteLink } = useWhatsAppGroups();
  const { sessions, sessionsLoading } = useWhatsAppSession();

  // Form state
  const [slug, setSlug] = useState('');
  const [destinationType, setDestinationType] = useState<DestinationType>('url');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fetchedInviteLink, setFetchedInviteLink] = useState<string | null>(null);

  // Get only connected sessions
  const connectedSessions = useMemo(() => {
    return sessions?.filter(s => s.status === 'connected') || [];
  }, [sessions]);

  // Auto-select first connected session if only one exists
  useEffect(() => {
    if (connectedSessions.length === 1 && !selectedSessionId) {
      setSelectedSessionId(connectedSessions[0].id);
    }
  }, [connectedSessions, selectedSessionId]);

  // Reset form when dialog opens/closes or editing link changes
  useEffect(() => {
    if (open) {
      if (editingLink) {
        setSlug(editingLink.slug);
        // Always treat existing links as custom URLs - the invite URL is stored directly
        setDestinationType('url');
        setDestinationUrl(editingLink.destination_url || '');
        setSelectedGroupId(null);
        setFetchedInviteLink(null);
      } else {
        setSlug('');
        setDestinationType('url');
        setDestinationUrl('');
        setSelectedGroupId(null);
        setFetchedInviteLink(null);
        // Keep selected session if already set
      }
      setGroupSearch('');
      setError(null);
    }
  }, [open, editingLink]);


  // Filter groups based on selected session and search
  const filteredGroups = useMemo(() => {
    if (!groups || !selectedSessionId) return [];
    
    return groups.filter(group => {
      const matchesSession = group.session_id === selectedSessionId;
      const matchesSearch = group.group_name.toLowerCase().includes(groupSearch.toLowerCase());
      return matchesSession && matchesSearch;
    });
  }, [groups, selectedSessionId, groupSearch]);

  // Handler for selecting a group - auto-fetches invite link if not present
  const handleGroupSelect = async (groupId: string) => {
    const group = filteredGroups.find(g => g.id === groupId);
    if (!group) return;

    setSelectedGroupId(groupId);
    
    // Use invite_link stored in database if available
    if (group.invite_link) {
      setFetchedInviteLink(group.invite_link);
    } else if (selectedSessionId && group.group_jid) {
      // No link stored - auto-fetch from VPS
      setFetchedInviteLink(null);
      
      try {
        const result = await fetchInviteLinkAsync({
          sessionId: selectedSessionId,
          groupId: group.id,
          groupJid: group.group_jid,
        });
        
        if (result?.invite_link) {
          setFetchedInviteLink(result.invite_link);
        }
      } catch (error) {
        console.error('Failed to auto-fetch invite link:', error);
        // Error already shown by hook's onError
      }
    } else {
      setFetchedInviteLink(null);
    }
  };

  // Get display name for selected group
  const selectedGroup = filteredGroups.find(g => g.id === selectedGroupId);

  // Get session display info
  const getSessionDisplayName = (session: { phone_number: string | null; display_name: string | null }) => {
    if (session.display_name) return session.display_name;
    if (session.phone_number) return session.phone_number;
    return 'Unknown';
  };

  // Validate slug format
  const validateSlug = (value: string): boolean => {
    const slugRegex = /^[a-z0-9-]+$/;
    return slugRegex.test(value);
  };

  const handleSlugChange = (value: string) => {
    // Auto-format: lowercase and replace spaces with hyphens
    const formatted = value.toLowerCase().replace(/\s+/g, '-');
    setSlug(formatted);
    
    if (formatted && !validateSlug(formatted)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens');
    } else {
      setError(null);
    }
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSelectedGroupId(null); // Reset group selection when session changes
    setFetchedInviteLink(null);
    setGroupSearch('');
  };

  const handleSyncGroups = () => {
    if (selectedSessionId) {
      syncGroups(selectedSessionId);
    }
  };

  const handleSubmit = () => {
    // Validation
    if (!slug.trim()) {
      setError('Please enter a slug');
      return;
    }
    if (!validateSlug(slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    if (destinationType === 'url') {
      if (!destinationUrl.trim()) {
        setError('Please enter a destination URL');
        return;
      }
      // Basic URL validation
      try {
        new URL(destinationUrl);
      } catch {
        setError('Please enter a valid URL (including http:// or https://)');
        return;
      }
    } else {
      if (!selectedGroupId) {
        setError('Please select a WhatsApp group');
        return;
      }
      // Check if we have the invite link
      if (!fetchedInviteLink) {
        setError('Invite link not yet fetched. Please wait or select another group.');
        return;
      }
    }

    if (editingLink) {
      // Update existing link - store invite link directly as destination_url
      updateLink({
        id: editingLink.id,
        slug: slug.trim(),
        destination_url: destinationType === 'url' ? destinationUrl.trim() : fetchedInviteLink!,
      });
    } else {
      // Create new link - store invite link directly as destination_url
      createLink({
        slug: slug.trim(),
        destination_url: destinationType === 'url' ? destinationUrl.trim() : fetchedInviteLink!,
        // No whatsapp_group_id needed - the invite URL is self-contained
      });
    }

    onOpenChange(false);
  };

  const baseUrl = window.location.origin;
  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{editingLink ? 'Edit Dynamic Link' : 'Create Dynamic Link'}</DialogTitle>
          <DialogDescription>
            {editingLink 
              ? 'Update where this link redirects to.' 
              : 'Create a permanent link that redirects to any destination.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain space-y-6 py-3 pr-1">
          {/* Slug Input */}
          <div className="space-y-2">
            <Label htmlFor="slug">Link Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="whatsapp-group"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {baseUrl}/link/<span className="font-semibold">{slug || 'your-slug'}</span>
            </p>
          </div>

          {/* Destination Type Selection */}
          <div className="space-y-3">
            <Label>Destination Type</Label>
            <RadioGroup
              value={destinationType}
              onValueChange={(value) => setDestinationType(value as DestinationType)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="url" id="url" className="peer sr-only" />
                <Label
                  htmlFor="url"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <LinkIcon className="mb-2 h-5 w-5" />
                  <span className="text-sm font-medium">Custom URL</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="whatsapp" id="whatsapp" className="peer sr-only" />
                <Label
                  htmlFor="whatsapp"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <MessageCircle className="mb-2 h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">WhatsApp Group</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* URL Input */}
          {destinationType === 'url' && (
            <div className="space-y-2">
              <Label htmlFor="destination">Destination URL</Label>
              <Input
                id="destination"
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://example.com/your-page"
              />
            </div>
          )}

          {/* WhatsApp Group Selection */}
          {destinationType === 'whatsapp' && (
            <div className="space-y-4">
              {/* No connected sessions warning */}
              {!sessionsLoading && connectedSessions.length === 0 && (
                <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    No WhatsApp accounts connected. Connect one in{' '}
                    <span className="font-medium">Settings → WhatsApp Connection</span>.
                  </p>
                </div>
              )}

              {/* Session Selection */}
              {connectedSessions.length > 0 && (
                <div className="space-y-2">
                  <Label>Select WhatsApp Account</Label>
                  <Select
                    value={selectedSessionId || ''}
                    onValueChange={handleSessionChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select WhatsApp account" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedSessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            <span>{getSessionDisplayName(session)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Groups Selection */}
              {selectedSessionId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Select Group</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSyncGroups}
                      disabled={isSyncing}
                      className="h-8"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync Groups'}
                    </Button>
                  </div>
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="Search groups..."
                      className="pl-9"
                    />
                  </div>

                  {/* Groups Dropdown */}
                  <Select
                    value={selectedGroupId || ''}
                    onValueChange={handleGroupSelect}
                    disabled={groupsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={groupsLoading ? "Loading groups..." : "Choose a group..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredGroups.length === 0 ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          {groupSearch 
                            ? 'No groups match your search.'
                            : 'No groups found. Click "Sync Groups" to fetch.'}
                        </div>
                      ) : (
                        filteredGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            <div className="flex items-center gap-2 w-full">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${group.invite_link ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                              <span className="truncate flex-1">{group.group_name}</span>
                              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {group.participant_count || 0}
                              </span>
                              {selectedGroupId === group.id && fetchedInviteLink && (
                                <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  
                  {/* Helper text for invite link status */}
                  {selectedGroup && isFetchingInviteLink && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Fetching invite link...
                    </p>
                  )}
                  {selectedGroup && !isFetchingInviteLink && !fetchedInviteLink && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3" />
                      Invite link not available. Bot needs admin rights.
                    </p>
                  )}
                  {selectedGroup && !isFetchingInviteLink && fetchedInviteLink && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <Check className="h-3 w-3" />
                      Invite link ready
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : editingLink ? 'Save Changes' : 'Create Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
