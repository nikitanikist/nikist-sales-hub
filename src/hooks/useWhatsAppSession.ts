import { useState, useCallback, useEffect } from 'react';
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

export function useWhatsAppSession() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
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

  const callVPSProxy = async (action: string, params: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
      body: {
        action,
        organizationId: currentOrganization?.id,
        ...params,
      },
    });

    if (response.error) throw response.error;
    return response.data;
  };

  // Start connection
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganization) throw new Error('No organization selected');
      return callVPSProxy('connect');
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
      toast.error('Failed to start connection: ' + error.message);
    },
  });

  // Get QR code
  const fetchQRCode = useCallback(async (sessionId: string) => {
    try {
      const data = await callVPSProxy('qr', { sessionId });
      if (data.qrCode) {
        setConnectionState(prev => ({
          ...prev,
          qrCode: data.qrCode,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch QR code:', error);
    }
  }, [currentOrganization]);

  // Check status
  const checkStatus = useCallback(async (sessionId: string) => {
    try {
      const data = await callVPSProxy('status', { sessionId });
      
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
        }));
        setPollingInterval(null);
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  }, [currentOrganization, queryClient]);

  // Polling effect
  useEffect(() => {
    if (!pollingInterval || !connectionState.sessionId) return;

    const interval = setInterval(() => {
      if (connectionState.sessionId) {
        fetchQRCode(connectionState.sessionId);
        checkStatus(connectionState.sessionId);
      }
    }, pollingInterval);

    // Initial fetch
    fetchQRCode(connectionState.sessionId);
    checkStatus(connectionState.sessionId);

    return () => clearInterval(interval);
  }, [pollingInterval, connectionState.sessionId, fetchQRCode, checkStatus]);

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return callVPSProxy('disconnect', { sessionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
      toast.success('WhatsApp disconnected');
    },
    onError: (error: Error) => {
      toast.error('Failed to disconnect: ' + error.message);
    },
  });

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
  };
}
