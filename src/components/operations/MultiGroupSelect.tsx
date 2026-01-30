import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Users, RefreshCw, CheckSquare, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppGroup {
  id: string;
  group_jid: string;
  group_name: string;
  participant_count: number;
  is_admin: boolean;
  session_id: string;
}

interface MultiGroupSelectProps {
  groups: WhatsAppGroup[];
  selectedGroupIds: string[];
  onSelectionChange: (groupIds: string[]) => void;
  onSync?: () => void;
  isSyncing?: boolean;
  disabled?: boolean;
  sessionId: string | null;
}

export function MultiGroupSelect({
  groups,
  selectedGroupIds,
  onSelectionChange,
  onSync,
  isSyncing,
  disabled,
  sessionId,
}: MultiGroupSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter groups by session
  const sessionGroups = useMemo(() => 
    groups.filter(g => !sessionId || g.session_id === sessionId),
    [groups, sessionId]
  );

  // Filter by search query and sort alphabetically
  const filteredGroups = useMemo(() => 
    sessionGroups
      .filter(g => g.group_name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.group_name.localeCompare(b.group_name)),
    [sessionGroups, searchQuery]
  );

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      onSelectionChange(selectedGroupIds.filter(id => id !== groupId));
    } else {
      onSelectionChange([...selectedGroupIds, groupId]);
    }
  };

  const selectAll = () => {
    // Select all visible (filtered) groups
    const visibleIds = filteredGroups.map(g => g.id);
    const newSelection = [...new Set([...selectedGroupIds, ...visibleIds])];
    onSelectionChange(newSelection);
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  // Clear search when session changes
  useMemo(() => {
    setSearchQuery('');
  }, [sessionId]);

  return (
    <div className="space-y-3">
      {/* Header with Sync button */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">WhatsApp Groups</Label>
        <div className="flex items-center gap-2">
          {sessionId && onSync && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSync}
              disabled={isSyncing || disabled}
              className="h-7 text-xs"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isSyncing && "animate-spin")} />
              Sync
            </Button>
          )}
        </div>
      </div>

      {/* Quick actions */}
      {sessionGroups.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={disabled || filteredGroups.length === 0}
            className="h-7 text-xs"
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            Select All ({filteredGroups.length})
          </Button>
          {selectedGroupIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={disabled}
              className="h-7 text-xs text-muted-foreground"
            >
              Clear ({selectedGroupIds.length})
            </Button>
          )}
        </div>
      )}

      {/* Groups list */}
      {sessionGroups.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
          {!sessionId ? 'Select a WhatsApp account first' : 'No groups found. Try syncing.'}
        </div>
      ) : (
        <div className="rounded-lg border bg-background">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
                disabled={disabled}
              />
            </div>
          </div>
          
          <ScrollArea className="h-[220px]">
            <div className="p-2 space-y-1">
              {filteredGroups.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No groups match "{searchQuery}"
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    isSelected={selectedGroupIds.includes(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    disabled={disabled}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Selection summary */}
      {selectedGroupIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedGroupIds.length}</span> group{selectedGroupIds.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

interface GroupItemProps {
  group: WhatsAppGroup;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function GroupItem({ group, isSelected, onToggle, disabled }: GroupItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/5 border border-primary/20",
        disabled && "pointer-events-none opacity-50"
      )}
      onClick={onToggle}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle()}
        disabled={disabled}
        className="pointer-events-none"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">
          {group.group_name}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {group.participant_count} members
        </div>
      </div>
    </div>
  );
}
