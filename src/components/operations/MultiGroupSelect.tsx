import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Shield, AlertTriangle, RefreshCw, CheckSquare } from 'lucide-react';
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
  // Filter groups by session
  const sessionGroups = useMemo(() => 
    groups.filter(g => !sessionId || g.session_id === sessionId),
    [groups, sessionId]
  );

  // Separate admin and non-admin groups
  const adminGroups = useMemo(() => 
    sessionGroups.filter(g => g.is_admin),
    [sessionGroups]
  );
  
  const nonAdminGroups = useMemo(() => 
    sessionGroups.filter(g => !g.is_admin),
    [sessionGroups]
  );

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      onSelectionChange(selectedGroupIds.filter(id => id !== groupId));
    } else {
      onSelectionChange([...selectedGroupIds, groupId]);
    }
  };

  const selectAllAdminGroups = () => {
    const adminIds = adminGroups.map(g => g.id);
    // Merge with existing selection (in case non-admin groups were selected)
    const newSelection = [...new Set([...selectedGroupIds, ...adminIds])];
    onSelectionChange(newSelection);
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const selectedAdminCount = selectedGroupIds.filter(id => 
    adminGroups.some(g => g.id === id)
  ).length;

  const selectedNonAdminCount = selectedGroupIds.filter(id => 
    nonAdminGroups.some(g => g.id === id)
  ).length;

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
            onClick={selectAllAdminGroups}
            disabled={disabled || adminGroups.length === 0}
            className="h-7 text-xs"
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            Select All Admin ({adminGroups.length})
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
        <ScrollArea className="h-[250px] rounded-lg border bg-background">
          <div className="p-2 space-y-1">
            {/* Admin groups first */}
            {adminGroups.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-emerald-600" />
                  Admin Groups ({adminGroups.length})
                </div>
                {adminGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    isSelected={selectedGroupIds.includes(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    disabled={disabled}
                  />
                ))}
              </>
            )}
            
            {/* Non-admin groups */}
            {nonAdminGroups.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Not Admin ({nonAdminGroups.length})
                </div>
                {nonAdminGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    isSelected={selectedGroupIds.includes(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    disabled={disabled}
                    isNonAdmin
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Selection summary */}
      {selectedGroupIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedGroupIds.length}</span> group{selectedGroupIds.length !== 1 ? 's' : ''} selected
          {selectedNonAdminCount > 0 && (
            <span className="text-amber-600 ml-1">
              ({selectedNonAdminCount} without admin rights)
            </span>
          )}
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
  isNonAdmin?: boolean;
}

function GroupItem({ group, isSelected, onToggle, disabled, isNonAdmin }: GroupItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/5 border border-primary/20",
        isNonAdmin && "opacity-70",
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
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium truncate",
            isNonAdmin && "text-muted-foreground"
          )}>
            {group.group_name}
          </span>
          {!isNonAdmin && (
            <Badge 
              variant="outline" 
              className="h-5 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0"
            >
              <Shield className="h-2.5 w-2.5 mr-0.5" />
              Admin
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {group.participant_count} members
        </div>
      </div>
    </div>
  );
}
