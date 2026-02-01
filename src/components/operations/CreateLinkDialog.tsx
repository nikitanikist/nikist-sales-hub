import { useState, useEffect, useMemo } from 'react';
import { Link as LinkIcon, MessageCircle, Search, Check, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useDynamicLinks, DynamicLink } from '@/hooks/useDynamicLinks';
import { useWhatsAppGroups, WhatsAppGroup } from '@/hooks/useWhatsAppGroups';

interface CreateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLink?: DynamicLink | null;
}

type DestinationType = 'url' | 'whatsapp';

export function CreateLinkDialog({ open, onOpenChange, editingLink }: CreateLinkDialogProps) {
  const { createLink, isCreating, updateLink, isUpdating } = useDynamicLinks();
  const { groups, groupsLoading } = useWhatsAppGroups();

  // Form state
  const [slug, setSlug] = useState('');
  const [destinationType, setDestinationType] = useState<DestinationType>('url');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or editing link changes
  useEffect(() => {
    if (open) {
      if (editingLink) {
        setSlug(editingLink.slug);
        if (editingLink.whatsapp_group_id) {
          setDestinationType('whatsapp');
          setSelectedGroupId(editingLink.whatsapp_group_id);
          setDestinationUrl('');
        } else {
          setDestinationType('url');
          setDestinationUrl(editingLink.destination_url || '');
          setSelectedGroupId(null);
        }
      } else {
        setSlug('');
        setDestinationType('url');
        setDestinationUrl('');
        setSelectedGroupId(null);
      }
      setGroupSearch('');
      setError(null);
    }
  }, [open, editingLink]);

  // Filter groups based on search and only show those with invite links
  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    
    return groups.filter(group => {
      const matchesSearch = group.group_name.toLowerCase().includes(groupSearch.toLowerCase());
      return matchesSearch;
    });
  }, [groups, groupSearch]);

  // Groups with invite links vs without
  const groupsWithInvite = filteredGroups.filter(g => g.invite_link);
  const groupsWithoutInvite = filteredGroups.filter(g => !g.invite_link);

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
      // Check if selected group has invite link
      const selectedGroup = groups?.find(g => g.id === selectedGroupId);
      if (!selectedGroup?.invite_link) {
        setError('Selected group has no invite link. Please fetch the invite link first.');
        return;
      }
    }

    if (editingLink) {
      // Update existing link
      updateLink({
        id: editingLink.id,
        slug: slug.trim(),
        destination_url: destinationType === 'url' ? destinationUrl.trim() : null,
        whatsapp_group_id: destinationType === 'whatsapp' ? selectedGroupId : null,
      });
    } else {
      // Create new link
      createLink({
        slug: slug.trim(),
        destination_url: destinationType === 'url' ? destinationUrl.trim() : undefined,
        whatsapp_group_id: destinationType === 'whatsapp' ? selectedGroupId! : undefined,
      });
    }

    onOpenChange(false);
  };

  const baseUrl = window.location.origin;
  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingLink ? 'Edit Dynamic Link' : 'Create Dynamic Link'}</DialogTitle>
          <DialogDescription>
            {editingLink 
              ? 'Update where this link redirects to.' 
              : 'Create a permanent link that redirects to any destination.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
            <div className="space-y-3">
              <Label>Select WhatsApp Group</Label>
              
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

              {/* Groups List */}
              <ScrollArea className="h-48 rounded-md border">
                {groupsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Loading groups...
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {groups?.length === 0 
                      ? 'No WhatsApp groups synced. Sync groups first in WhatsApp settings.'
                      : 'No groups match your search.'}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {/* Groups with invite links */}
                    {groupsWithInvite.map((group) => (
                      <GroupItem
                        key={group.id}
                        group={group}
                        isSelected={selectedGroupId === group.id}
                        onSelect={() => setSelectedGroupId(group.id)}
                        hasInviteLink={true}
                      />
                    ))}
                    
                    {/* Groups without invite links */}
                    {groupsWithoutInvite.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-2 pt-2">
                          No invite link (fetch in Workshop settings)
                        </div>
                        {groupsWithoutInvite.map((group) => (
                          <GroupItem
                            key={group.id}
                            group={group}
                            isSelected={selectedGroupId === group.id}
                            onSelect={() => {}}
                            hasInviteLink={false}
                            disabled
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </ScrollArea>
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

        <DialogFooter>
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

// Group item component
interface GroupItemProps {
  group: WhatsAppGroup;
  isSelected: boolean;
  onSelect: () => void;
  hasInviteLink: boolean;
  disabled?: boolean;
}

function GroupItem({ group, isSelected, onSelect, hasInviteLink, disabled }: GroupItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`
        w-full flex items-center justify-between p-2 rounded-md text-left text-sm
        transition-colors
        ${isSelected 
          ? 'bg-primary/10 border border-primary' 
          : 'hover:bg-muted border border-transparent'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MessageCircle className={`h-4 w-4 flex-shrink-0 ${hasInviteLink ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="truncate">{group.group_name}</span>
        {group.participant_count > 0 && (
          <Badge variant="secondary" className="text-xs">
            {group.participant_count}
          </Badge>
        )}
      </div>
      {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
    </button>
  );
}
