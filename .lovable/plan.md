

## Problem Analysis

From the screenshot and database query, you have **3 stale sessions** stuck in "connecting" status:
- `19aec740-1add-4da7-9...` - Last active: null
- `32b178de-c23d-4083-9...` - Last active: null  
- `a08c1e45-4abd-4580-8...` - Last active: null

These sessions were created when you clicked "Connect Device" but then cancelled or navigated away before completing the connection. They are:
1. Cluttering the UI with useless entries
2. Potentially still being polled by the VPS (wasting resources)

---

## Solution Overview

We will implement **automatic cleanup of stale sessions** and add a **delete button** for manual cleanup:

### 1. Add a "Delete Session" button for each non-connected session
Users should be able to manually delete abandoned sessions from the history list.

### 2. Clean up sessions when user cancels connection
When the user clicks "Cancel" in the QR dialog, we should delete the session from the database (not just stop polling).

### 3. Auto-cleanup stale sessions on page load
Sessions that have been in "connecting" status for more than 5 minutes with no activity should be automatically cleaned up.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useWhatsAppSession.ts` | Add `deleteSession` mutation, update `cancelConnection` to delete DB record, add auto-cleanup logic |
| `src/pages/settings/WhatsAppConnection.tsx` | Add delete button for non-connected sessions in the session history list |

---

## Technical Details

### 1. Hook Changes (`useWhatsAppSession.ts`)

**Add a delete session mutation:**
```typescript
const deleteSessionMutation = useMutation({
  mutationFn: async (sessionId: string) => {
    const { error } = await supabase
      .from('whatsapp_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
    toast.success('Session removed');
  },
});
```

**Update `cancelConnection` to delete the current session:**
```typescript
const cancelConnection = useCallback(async () => {
  const currentSessionId = connectionState.sessionId;
  
  setPollingInterval(null);
  setConnectionState({
    isConnecting: false,
    sessionId: null,
    qrCode: null,
    status: 'disconnected',
    error: null,
  });
  
  // Delete the abandoned session from DB
  if (currentSessionId) {
    await supabase
      .from('whatsapp_sessions')
      .delete()
      .eq('id', currentSessionId);
    queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
  }
}, [connectionState.sessionId, queryClient]);
```

**Add auto-cleanup effect for stale sessions:**
```typescript
// Auto-cleanup stale sessions (connecting for >5 minutes with no activity)
useEffect(() => {
  if (!sessions || !currentOrganization) return;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const staleSessions = sessions.filter(s => 
    s.status === 'connecting' && 
    s.created_at < fiveMinutesAgo &&
    !s.last_active_at
  );
  
  if (staleSessions.length > 0) {
    // Clean up stale sessions
    supabase
      .from('whatsapp_sessions')
      .delete()
      .in('id', staleSessions.map(s => s.id))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
      });
  }
}, [sessions, currentOrganization, queryClient]);
```

### 2. UI Changes (`WhatsAppConnection.tsx`)

**Add delete button for non-connected sessions:**
```tsx
{sessions.map((session) => (
  <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
    <div className="flex items-center gap-3">
      <Smartphone className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">
          {session.phone_number || session.display_name || session.id.slice(0, 20) + '...'}
        </p>
        <p className="text-xs text-muted-foreground">
          Last active: {format(new Date(session.updated_at), 'PP p')}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant={session.status === 'connected' ? 'default' : 'secondary'}>
        {session.status}
      </Badge>
      {session.status !== 'connected' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteSession(session.id)}
          disabled={isDeletingSession}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  </div>
))}
```

---

## Expected Behavior After Fix

1. **Manual cleanup**: Each session in the history (except "connected" ones) will have a trash icon button to delete it
2. **Cancel cleanup**: When user clicks "Cancel" in the QR dialog, the abandoned session is deleted from the database
3. **Auto cleanup**: On page load, any session stuck in "connecting" status for more than 5 minutes (without activity) will be automatically deleted
4. **Better UX**: The session history will only show meaningful entries (connected sessions or active connection attempts)

---

## Visual Change

```text
Before:
+----------------------------------+-------------+
| 19aec740-1add-4da7-9...          | connecting  |
+----------------------------------+-------------+
| 32b178de-c23d-4083-9...          | connecting  |
+----------------------------------+-------------+
| a08c1e45-4abd-4580-8...          | connecting  |
+----------------------------------+-------------+

After (with delete buttons):
+----------------------------------+-------------+------+
| 19aec740-1add-4da7-9...          | connecting  | [X]  |
+----------------------------------+-------------+------+
| 32b178de-c23d-4083-9...          | connecting  | [X]  |
+----------------------------------+-------------+------+
| a08c1e45-4abd-4580-8...          | connecting  | [X]  |
+----------------------------------+-------------+------+

After auto-cleanup runs (or user deletes):
(Empty - all stale sessions removed)
```

