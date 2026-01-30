import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

interface WhatsAppSession {
  id: string;
  organization_id: string;
  status: string;
  phone_number: string | null;
  display_name: string | null;
  qr_code: string | null;
  qr_expires_at: string | null;
  connected_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ConnectionState {
  isConnecting: boolean;
  sessionId: string | null;
  qrCode: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

interface VpsErrorResponse {
  error?: string;
  upstream?: string;
  status?: number;
  hint?: string;
  suggestion?: string;
  responsePreview?: string;
  debug?: {
    vpsUrlConfigured?: boolean;
    apiKeyLength?: number;
    endpoint?: string;
  };
}

interface TestVpsResult {
  success: boolean;
  status?: number;
  message: string;
  hint?: string;
  debug?: Record<string, unknown>;
}

// Helper function to parse VPS error response body from supabase.functions.invoke
async function parseInvokeError(error: unknown, response?: Response): Promise<VpsErrorResponse> {
  // Try to read the response body if available
  if (response) {
    try {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { error: text || 'Unknown error' };
      }
    } catch {
      // Couldn't read response
    }
  }
  
  // Fallback to error message
  if (error instanceof Error) {
    return { error: error.message };
  }
  
  return { error: 'Unknown error occurred' };
}

// Helper function to handle VPS error responses (outside component to avoid hook issues)
function parseVpsError(data: VpsErrorResponse, context: string): { title: string; description: string } {
  console.error(`${context} VPS error:`, data);
  
  let title = 'Connection Error';
  let description = data.error || 'An unknown error occurred';
  
  // Check if this is a VPS upstream error
  if (data.upstream === 'vps') {
    if (data.status === 401) {
      title = 'VPS Authentication Failed (401)';
      description = data.hint || 'The VPS rejected the API key. Please verify the WHATSAPP_VPS_API_KEY secret is correct.';
      
      // Log debug info
      if (data.debug) {
        console.info('VPS Debug info:', data.debug);
      }
      if (data.suggestion) {
        console.info('Suggestion:', data.suggestion);
      }
    } else if (data.status === 404) {
      title = 'VPS Endpoint Not Found (404)';
      description = data.hint || 'The VPS endpoint was not found. Check VPS configuration.';
    } else if (data.status && data.status >= 500) {
      title = `VPS Server Error (${data.status})`;
      description = data.hint || 'The WhatsApp VPS service is experiencing issues. Please try again later.';
    }
    
    // Log response preview for debugging
    if (data.responsePreview) {
      console.debug('VPS response preview:', data.responsePreview);
    }
  }
  
  return { title, description };
}

export function useWhatsAppSession() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  
  // Use ref to store current organization ID to avoid stale closures
  const orgIdRef = useRef<string | undefined>(currentOrganization?.id);
  useEffect(() => {
    orgIdRef.current = currentOrganization?.id;
  }, [currentOrganization?.id]);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnecting: false,
    sessionId: null,
    qrCode: null,
    status: 'disconnected',
    error: null,
  });
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);

  // Fetch existing sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['whatsapp-sessions', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WhatsAppSession[];
    },
    enabled: !!currentOrganization,
  });

  // Test VPS Connection mutation
  const testVpsMutation = useMutation({
    mutationFn: async (): Promise<TestVpsResult> => {
      const organizationId = orgIdRef.current;
      if (!organizationId) throw new Error('No organization selected');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'health',
          organizationId,
        },
      });

      // Handle invoke-level errors
      if (response.error) {
        // Try to parse error body
        const errorData = await parseInvokeError(response.error, (response as any).response);
        
        if (errorData.upstream === 'vps') {
          return {
            success: false,
            status: errorData.status,
            message: errorData.error || 'VPS request failed',
            hint: errorData.hint,
            debug: errorData.debug,
          };
        }
        
        throw new Error(errorData.error || response.error.message);
      }
      
      // Check for upstream VPS errors in the response data
      if (response.data?.upstream === 'vps' && response.data?.status && response.data.status >= 400) {
        return {
          success: false,
          status: response.data.status,
          message: response.data.error || 'VPS request failed',
          hint: response.data.hint,
          debug: response.data.debug,
        };
      }
      
      return {
        success: true,
        status: 200,
        message: 'VPS connection successful!',
      };
    },
  });

  // Start connection mutation - defined before any callbacks that might use it
  const connectMutation = useMutation({
    mutationFn: async () => {
      const organizationId = orgIdRef.current;
      if (!organizationId) throw new Error('No organization selected');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'connect',
          organizationId,
        },
      });

      if (response.error) {
        // Try to get more details from the response
        const errorData = await parseInvokeError(response.error, (response as any).response);
        
        if (errorData.upstream === 'vps') {
          const { title, description } = parseVpsError(errorData, 'connect');
          toast.error(title, { description });
          throw new Error(description);
        }
        
        throw response.error;
      }
      
      // Check for upstream VPS errors in the response
      if (response.data?.upstream === 'vps' && response.data?.status && response.data.status >= 400) {
        const { title, description } = parseVpsError(response.data, 'connect');
        toast.error(title, { description });
        throw new Error(description);
      }
      
      return response.data;
    },
    onSuccess: (data) => {
      setConnectionState(prev => ({
        ...prev,
        isConnecting: true,
        sessionId: data.sessionId,
        status: 'connecting',
        error: null,
      }));
      // Start polling for QR code and status
      setPollingInterval(3000);
    },
    onError: (error: Error) => {
      setConnectionState(prev => ({
        ...prev,
        isConnecting: false,
        status: 'error',
        error: error.message,
      }));
      // Only show toast if not already shown by parseVpsError
      if (!error.message.includes('VPS rejected') && !error.message.includes('VPS endpoint')) {
        toast.error('Failed to start connection', { description: error.message });
      }
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const organizationId = orgIdRef.current;
      if (!organizationId) throw new Error('No organization selected');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'disconnect',
          organizationId,
          sessionId,
        },
      });

      if (response.error) {
        const errorData = await parseInvokeError(response.error, (response as any).response);
        if (errorData.upstream === 'vps') {
          const { title, description } = parseVpsError(errorData, 'disconnect');
          toast.error(title, { description });
          throw new Error(description);
        }
        throw response.error;
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
      toast.success('WhatsApp disconnected');
    },
    onError: (error: Error) => {
      if (!error.message.includes('VPS')) {
        toast.error('Failed to disconnect', { description: error.message });
      }
    },
  });

  // Helper to call VPS proxy - defined after mutations to avoid hook order issues
  const callVPSProxy = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const organizationId = orgIdRef.current;
    if (!organizationId) throw new Error('No organization selected');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
      body: {
        action,
        organizationId,
        ...params,
      },
    });

    if (response.error) {
      const errorData = await parseInvokeError(response.error, (response as any).response);
      if (errorData.upstream === 'vps') {
        const { title, description } = parseVpsError(errorData, action);
        toast.error(title, { description });
        throw new Error(description);
      }
      throw response.error;
    }
    
    // Check for upstream VPS errors in the response
    if (response.data?.upstream === 'vps' && response.data?.status && response.data.status >= 400) {
      const { title, description } = parseVpsError(response.data, action);
      toast.error(title, { description });
      throw new Error(description);
    }
    
    return response.data;
  }, []);

  // Check status (also extracts QR code from the same response since VPS doesn't have a separate /qr endpoint)
  const checkStatus = useCallback(async (sessionId: string) => {
    try {
      const data = await callVPSProxy('status', { sessionId });
      
      // VPS returns { status: "...", qr?: "...", phoneNumber?: "..." }
      // Note: VPS uses "qr" field, not "qrCode"
      if (data.status === 'connected') {
        setConnectionState(prev => ({
          ...prev,
          isConnecting: false,
          status: 'connected',
          qrCode: null,
        }));
        setPollingInterval(null);
        queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
        toast.success('WhatsApp connected successfully!');
      } else if (data.status === 'disconnected' || data.status === 'error') {
        setConnectionState(prev => ({
          ...prev,
          isConnecting: false,
          status: data.status,
          error: data.error || null,
          qrCode: null,
        }));
        setPollingInterval(null);
      } else {
        // Still connecting - extract QR code from the status response
        // VPS returns "qr" field (not "qrCode")
        setConnectionState(prev => ({
          ...prev,
          qrCode: data.qr || prev.qrCode,
          status: 'connecting',
        }));
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  }, [callVPSProxy, queryClient]);

  // Polling effect - only calls checkStatus (which now returns both status AND QR code)
  useEffect(() => {
    if (!pollingInterval || !connectionState.sessionId) return;

    const interval = setInterval(() => {
      if (connectionState.sessionId) {
        checkStatus(connectionState.sessionId);
      }
    }, pollingInterval);

    // Initial fetch
    checkStatus(connectionState.sessionId);

    return () => clearInterval(interval);
  }, [pollingInterval, connectionState.sessionId, checkStatus]);

  // Cancel connection attempt
  const cancelConnection = useCallback(() => {
    setPollingInterval(null);
    setConnectionState({
      isConnecting: false,
      sessionId: null,
      qrCode: null,
      status: 'disconnected',
      error: null,
    });
  }, []);

  return {
    sessions,
    sessionsLoading,
    connectionState,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending || connectionState.isConnecting,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    cancelConnection,
    // Test VPS Connection
    testVpsConnection: testVpsMutation.mutateAsync,
    isTestingVps: testVpsMutation.isPending,
  };
}
