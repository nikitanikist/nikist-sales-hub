import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  id: string;
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface VPSParticipantsResponse {
  success: boolean;
  groupName: string;
  groupJid: string;
  totalParticipants: number;
  participants: Participant[];
}

interface RegisteredLead {
  id: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface WorkshopParticipantsData {
  registered: RegisteredLead[];
  inGroup: RegisteredLead[];
  missing: RegisteredLead[];
  groupMembers: Participant[];
  joinRate: number;
  totalRegistered: number;
  totalInGroup: number;
  totalMissing: number;
  groupName: string | null;
  lastSynced: Date;
}

// Normalize phone number to last 10 digits for comparison
function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

export function useWorkshopParticipants(
  workshopId: string,
  sessionId: string | null,
  groupJid: string | null,
  enabled: boolean = true
) {
  return useQuery<WorkshopParticipantsData | null>({
    queryKey: ['workshop-participants', workshopId, sessionId, groupJid],
    queryFn: async () => {
      if (!workshopId || !sessionId || !groupJid) {
        return null;
      }

      // 1. Fetch registered leads for this workshop
      const { data: assignments, error: assignmentsError } = await supabase
        .from('lead_assignments')
        .select(`
          lead_id,
          created_at,
          leads:lead_id (
            id,
            contact_name,
            email,
            phone
          )
        `)
        .eq('workshop_id', workshopId);

      if (assignmentsError) {
        console.error('Error fetching lead assignments:', assignmentsError);
        throw assignmentsError;
      }

      // Extract unique leads with phone numbers
      const registeredLeads: RegisteredLead[] = (assignments || [])
        .filter(a => a.leads)
        .map(a => ({
          id: (a.leads as any).id,
          contact_name: (a.leads as any).contact_name,
          email: (a.leads as any).email,
          phone: (a.leads as any).phone,
          created_at: a.created_at,
        }));

      // 2. Fetch group participants from VPS
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'get-participants',
          sessionId,
          groupJid,
        },
      });

      if (response.error) {
        console.error('Error fetching participants:', response.error);
        throw response.error;
      }

      const vpsData = response.data as VPSParticipantsResponse;
      
      if (!vpsData?.success || !vpsData.participants) {
        console.warn('VPS returned unsuccessful response:', vpsData);
        return {
          registered: registeredLeads,
          inGroup: [],
          missing: registeredLeads,
          groupMembers: [],
          joinRate: 0,
          totalRegistered: registeredLeads.length,
          totalInGroup: 0,
          totalMissing: registeredLeads.length,
          groupName: null,
          lastSynced: new Date(),
        };
      }

      // 3. Create a set of normalized phone numbers from VPS participants
      const groupPhoneSet = new Set(
        vpsData.participants.map(p => normalizePhone(p.phone))
      );

      // 4. Compare registered leads against group members
      const inGroup: RegisteredLead[] = [];
      const missing: RegisteredLead[] = [];

      for (const lead of registeredLeads) {
        const normalizedPhone = normalizePhone(lead.phone);
        if (normalizedPhone && groupPhoneSet.has(normalizedPhone)) {
          inGroup.push(lead);
        } else {
          missing.push(lead);
        }
      }

      // 5. Calculate join rate
      const joinRate = registeredLeads.length > 0 
        ? (inGroup.length / registeredLeads.length) * 100 
        : 0;

      return {
        registered: registeredLeads,
        inGroup,
        missing,
        groupMembers: vpsData.participants,
        joinRate,
        totalRegistered: registeredLeads.length,
        totalInGroup: inGroup.length,
        totalMissing: missing.length,
        groupName: vpsData.groupName,
        lastSynced: new Date(),
      };
    },
    enabled: enabled && !!workshopId && !!sessionId && !!groupJid,
    refetchInterval: 30000, // 30 seconds polling for real-time updates
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}
