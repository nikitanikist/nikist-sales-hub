import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Smartphone, QrCode, RefreshCw, Unplug, MessageSquare, CheckCircle, XCircle, AlertTriangle, Activity, Trash2, Users, Plus, UserPlus, X } from 'lucide-react';
import { useWhatsAppSession } from '@/hooks/useWhatsAppSession';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useCommunitySession } from '@/hooks/useCommunitySession';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CommunityTemplateEditor } from '@/components/settings/CommunityTemplateEditor';

export function WhatsAppConnection() {
  const {
    sessions,
    sessionsLoading,
    connectionState,
    connect,
    isConnecting,
    disconnect,
    isDisconnecting,
    cancelConnection,
    deleteSession,
    isDeletingSession,
    testVpsConnection,
    isTestingVps,
    verifyingSessionIds,
    verifiedStatuses,
    refreshSession,
  } = useWhatsAppSession();

  const { groups, syncGroups, isSyncing } = useWhatsAppGroups();
  const { 
    communitySessionId, 
    communityAdminNumbers,
    connectedSessions: communityConnectedSessions, 
    setCommunitySession,
    addAdminNumber,
    removeAdminNumber,
    isUpdating: isUpdatingCommunitySession 
  } = useCommunitySession();
  
  const [newAdminNumber, setNewAdminNumber] = useState('');
  
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status?: number;
    message: string;
    hint?: string;
  } | null>(null);

  const handleConnect = () => {
    connect();
    setQrDialogOpen(true);
  };

  const handleCancelConnection = () => {
    cancelConnection();
    setQrDialogOpen(false);
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const result = await testVpsConnection();
      setTestResult(result);
      if (result.success) {
        toast.success('VPS connection test passed!');
      } else {
        toast.error(`VPS test failed: ${result.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({
        success: false,
        message,
      });
      toast.error('VPS test failed: ' + message);
    }
  };

  const connectedSessions = sessions?.filter(s => s.status === 'connected') || [];
  const hasConnectedSession = connectedSessions.length > 0;

  return (
    <div className="space-y-6">
      {/* VPS Connection Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            VPS Connection Test
          </CardTitle>
          <CardDescription>
            Test the connection to your WhatsApp VPS before connecting a device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTestingVps}
            >
              {isTestingVps ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Test VPS Connection
            </Button>
            
            {testResult && (
              <Badge variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Connected</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> Failed ({testResult.status || 'Error'})</>
                )}
              </Badge>
            )}
          </div>

          {testResult && !testResult.success && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>VPS Connection Failed</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>{testResult.message}</p>
                {testResult.hint && (
                  <p className="text-sm opacity-90">{testResult.hint}</p>
                )}
                {testResult.status === 401 && (
                  <div className="mt-3 p-3 bg-background/50 rounded text-sm">
                    <p className="font-medium mb-2">How to fix:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Open your backend panel (click "View Backend" below)</li>
                      <li>Navigate to Secrets / Environment Variables</li>
                      <li>Update <code className="bg-muted px-1 rounded">WHATSAPP_VPS_API_KEY</code> with the correct API key</li>
                      <li>Make sure there are no quotes or extra spaces around the value</li>
                      <li>Wait ~30 seconds for the change to take effect, then test again</li>
                    </ol>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {testResult?.success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>VPS Connection Successful</AlertTitle>
              <AlertDescription>
                Your backend can reach the WhatsApp VPS. You can now connect a device.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Community Creation Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Creation Settings
          </CardTitle>
          <CardDescription>
            Select which WhatsApp number should be used to automatically create communities when new workshops are added
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select
                value={communitySessionId || "none"}
                onValueChange={(value) => setCommunitySession(value === "none" ? null : value)}
                disabled={isUpdatingCommunitySession}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a connected number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No automatic community creation</SelectItem>
                  {communityConnectedSessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.phone_number || session.display_name || `Session ${session.id.slice(0, 8)}...`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isUpdatingCommunitySession && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
          
          {communityConnectedSessions.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Connected Sessions</AlertTitle>
              <AlertDescription>
                Connect a WhatsApp device first to enable automatic community creation for workshops.
              </AlertDescription>
            </Alert>
          )}

          {communitySessionId && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Auto-Creation Enabled</AlertTitle>
              <AlertDescription>
                When new workshops are created, a WhatsApp community will automatically be created and linked to the workshop.
              </AlertDescription>
            </Alert>
          )}

          {/* Community Admin Numbers */}
          <div className="pt-4 border-t space-y-4">
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Community Admin Numbers
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                These numbers will be automatically added as admins when new communities are created.
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="+919876543210"
                value={newAdminNumber}
                onChange={(e) => setNewAdminNumber(e.target.value)}
                className="flex-1"
                disabled={isUpdatingCommunitySession}
              />
              <Button
                onClick={() => {
                  if (newAdminNumber.trim()) {
                    addAdminNumber(newAdminNumber);
                    setNewAdminNumber('');
                  } else {
                    toast.error('Please enter a valid phone number');
                  }
                }}
                disabled={isUpdatingCommunitySession || !newAdminNumber.trim()}
              >
                {isUpdatingCommunitySession ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add
              </Button>
            </div>

            {communityAdminNumbers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {communityAdminNumbers.map((number) => (
                  <Badge key={number} variant="secondary" className="pr-1 gap-1">
                    {number}
                    <button
                      onClick={() => removeAdminNumber(number)}
                      disabled={isUpdatingCommunitySession}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No admin numbers configured yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Community Creation Templates */}
      <CommunityTemplateEditor />

      {/* Main WhatsApp Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            WhatsApp Connections
          </CardTitle>
          <CardDescription>
            Connect multiple WhatsApp accounts for different purposes (community creation, messaging, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected Sessions List */}
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {connectedSessions.length > 0 ? (
                <div className="space-y-3">
                  {connectedSessions.map((session) => {
                    const isVerifying = verifyingSessionIds.has(session.id);
                    const vpsStatus = verifiedStatuses.get(session.id);
                    const isVpsDisconnected = vpsStatus && vpsStatus !== 'connected';
                    const lastError = (session as any).last_error;

                    return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        {isVerifying ? (
                          <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                        ) : isVpsDisconnected ? (
                          <div className="h-3 w-3 rounded-full bg-destructive" />
                        ) : (
                          <div className="h-3 w-3 rounded-full bg-primary" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {session.phone_number || session.display_name || `Session ${session.id.slice(0, 8)}...`}
                            </p>
                            {isVerifying && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                                Verifying...
                              </Badge>
                            )}
                            {isVpsDisconnected && (
                              <Badge variant="destructive" className="text-xs">
                                Disconnected — Reconnect needed
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Last active: {format(new Date(session.updated_at), 'PP p')}
                          </p>
                          {lastError && (
                            <p className="text-xs text-destructive mt-1">{lastError}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isVpsDisconnected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              connect();
                              setQrDialogOpen(true);
                            }}
                            disabled={isConnecting}
                          >
                            {isConnecting ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <QrCode className="h-4 w-4 mr-2" />
                            )}
                            Reconnect
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncGroups(session.id)}
                            disabled={isSyncing}
                          >
                            {isSyncing ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Sync Groups
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => disconnect(session.id)}
                          disabled={isDisconnecting}
                        >
                          {isDisconnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Unplug className="h-4 w-4 mr-2" />
                          )}
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No WhatsApp accounts connected</p>
                  <p className="text-sm">Connect your first device to get started</p>
                </div>
              )}

              {/* Always visible Add WhatsApp button */}
              <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {connectedSessions.length > 0 ? 'Connect Another WhatsApp' : 'Connect WhatsApp Device'}
              </Button>
            </>
          )}

          {/* Session History - Only disconnected sessions */}
          {!sessionsLoading && sessions && sessions.filter(s => s.status !== 'connected').length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground">Session History</h4>
              <div className="space-y-2">
                {sessions.filter(s => s.status !== 'connected').map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
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
                      <Badge variant="secondary">
                        {session.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => refreshSession(session.id)}
                        disabled={verifyingSessionIds.has(session.id)}
                        className="h-8 w-8"
                        title="Re-check VPS status"
                      >
                        {verifyingSessionIds.has(session.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSession(session.id)}
                        disabled={isDeletingSession}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Synced Groups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Groups
          </CardTitle>
          <CardDescription>
            Groups synced from your connected WhatsApp device
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups && groups.length > 0 ? (
            <div className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{group.group_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.participant_count} participants
                    </p>
                  </div>
                  {group.workshop_id ? (
                    <Badge variant="secondary">Linked to Workshop</Badge>
                  ) : (
                    <Badge variant="outline">Not Linked</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No groups synced yet</p>
              <p className="text-sm">Connect your WhatsApp and click "Sync Groups"</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code to Connect</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {connectionState.status === 'connecting' ? (
              <>
                {connectionState.qrCode ? (
                  <div className="p-4 bg-background rounded-lg border">
                    <img
                      src={connectionState.qrCode}
                      alt="WhatsApp QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-muted-foreground">Generating QR code...</p>
                  </div>
                )}
                <p className="mt-4 text-sm text-muted-foreground text-center">
                  Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleCancelConnection}
                >
                  Cancel
                </Button>
              </>
            ) : connectionState.status === 'connected' ? (
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <p className="font-medium">Connected Successfully!</p>
                <Button className="mt-4" onClick={() => setQrDialogOpen(false)}>
                  Done
                </Button>
              </div>
            ) : connectionState.status === 'error' ? (
              <div className="text-center">
                <p className="text-destructive">{connectionState.error}</p>
                <Button className="mt-4" onClick={handleCancelConnection}>
                  Try Again
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
