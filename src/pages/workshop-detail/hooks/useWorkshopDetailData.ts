import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useWorkshopParticipants } from "@/hooks/useWorkshopParticipants";
import { format } from "date-fns";
import { toast } from "sonner";

export type CallCategory = 
  | "converted" 
  | "not_converted" 
  | "rescheduled_remaining" 
  | "rescheduled_done" 
  | "booking_amount" 
  | "remaining"
  | "all_booked"
  | "refunded"
  | "rejoin"
  | "cross_workshop";

export const statusColors: Record<string, string> = {
  planned: "bg-sky-100 text-sky-700 border-sky-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

export function useWorkshopDetailData(
  workshopId: string | undefined,
  organizationId: string | null
) {
  const { format: formatOrg } = useOrgTimezone();
  const [searchQuery, setSearchQuery] = useState("");
  const [leftSearchQuery, setLeftSearchQuery] = useState("");
  const [unregisteredSearchQuery, setUnregisteredSearchQuery] = useState("");
  const [callsDialogOpen, setCallsDialogOpen] = useState(false);
  const [selectedCallCategory, setSelectedCallCategory] = useState<CallCategory>("converted");

  // Fetch workshop details with WhatsApp group info
  const { data: workshop, isLoading: workshopLoading, error: workshopError } = useQuery({
    queryKey: ["workshop-detail", workshopId],
    queryFn: async () => {
      if (!workshopId) return null;
      
      const { data: workshopData, error: workshopErr } = await supabase
        .from("workshops")
        .select("*")
        .eq("id", workshopId)
        .single();

      if (workshopErr) throw workshopErr;
      
      let whatsappGroup = null;
      const { data: linkedGroup } = await supabase
        .from("workshop_whatsapp_groups")
        .select(`
          group_id,
          whatsapp_groups!inner (
            id, group_jid, group_name, session_id
          )
        `)
        .eq("workshop_id", workshopId)
        .limit(1)
        .maybeSingle();

      if (linkedGroup?.whatsapp_groups) {
        whatsappGroup = linkedGroup.whatsapp_groups;
      }

      return { ...workshopData, whatsapp_group: whatsappGroup };
    },
    enabled: !!workshopId,
  });

  // Fetch workshop metrics
  const { data: metrics } = useQuery({
    queryKey: ["workshop-metrics", workshopId],
    queryFn: async () => {
      if (!workshopId) return null;
      
      const { data, error } = await supabase.rpc("get_workshop_metrics");
      if (error) throw error;
      
      const workshopMetrics = data?.find((m: any) => m.workshop_id === workshopId);
      return workshopMetrics || null;
    },
    enabled: !!workshopId,
  });

  // Get WhatsApp group details
  const whatsappGroup = workshop?.whatsapp_group;
  const sessionId = whatsappGroup?.session_id;
  const groupJid = whatsappGroup?.group_jid;

  // Fetch participants comparison
  const { 
    data: participantsData, 
    isLoading: participantsLoading, 
    syncMembers,
    isSyncing 
  } = useWorkshopParticipants(
    workshopId || '',
    sessionId,
    groupJid,
    organizationId,
    !!groupJid
  );

  // Filter missing members by search
  const filteredMissing = useMemo(() => {
    if (!participantsData?.missing) return [];
    const query = searchQuery.toLowerCase();
    return participantsData.missing.filter(lead => 
      lead.contact_name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.includes(query)
    );
  }, [participantsData?.missing, searchQuery]);

  // Filter left group members by search
  const filteredLeftGroup = useMemo(() => {
    if (!participantsData?.leftGroup) return [];
    const query = leftSearchQuery.toLowerCase();
    return participantsData.leftGroup.filter(member => 
      member.contact_name?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.phone_number?.includes(query) ||
      member.full_phone?.includes(query)
    );
  }, [participantsData?.leftGroup, leftSearchQuery]);

  // Filter unregistered members by search
  const filteredUnregistered = useMemo(() => {
    if (!participantsData?.unregistered) return [];
    const query = unregisteredSearchQuery.toLowerCase();
    return participantsData.unregistered.filter(member => 
      member.phone?.includes(query) ||
      member.fullPhone?.includes(query)
    );
  }, [participantsData?.unregistered, unregisteredSearchQuery]);

  // Download CSV helpers
  const downloadMissingCSV = () => {
    if (!participantsData?.missing || participantsData.missing.length === 0) {
      toast.error("No missing members to download");
      return;
    }
    const headers = ['Name', 'Phone', 'Email', 'Registered Date'];
    const rows = participantsData.missing.map(m => [
      m.contact_name || '', m.phone || '', m.email || '',
      m.created_at ? format(new Date(m.created_at), 'MMM dd, yyyy') : ''
    ]);
    downloadCSV([headers, ...rows], `missing-members-${workshop?.title || 'workshop'}.csv`);
    toast.success(`Downloaded ${participantsData.missing.length} missing members`);
  };

  const downloadLeftGroupCSV = () => {
    if (!participantsData?.leftGroup || participantsData.leftGroup.length === 0) {
      toast.error("No left group members to download");
      return;
    }
    const headers = ['Name', 'Phone', 'Email', 'Joined Date', 'Left Date'];
    const rows = participantsData.leftGroup.map(m => [
      m.contact_name || 'Unknown', m.full_phone || m.phone_number || '', m.email || '',
      m.joined_at ? format(new Date(m.joined_at), 'MMM dd, yyyy') : '',
      m.left_at ? format(new Date(m.left_at), 'MMM dd, yyyy HH:mm') : ''
    ]);
    downloadCSV([headers, ...rows], `left-group-members-${workshop?.title || 'workshop'}.csv`);
    toast.success(`Downloaded ${participantsData.leftGroup.length} left group members`);
  };

  const downloadUnregisteredCSV = () => {
    if (!participantsData?.unregistered || participantsData.unregistered.length === 0) {
      toast.error("No unregistered members to download");
      return;
    }
    const headers = ['Phone'];
    const rows = participantsData.unregistered.map(m => [m.fullPhone || m.phone || '']);
    downloadCSV([headers, ...rows], `unregistered-members-${workshop?.title || 'workshop'}.csv`);
    toast.success(`Downloaded ${participantsData.unregistered.length} unregistered members`);
  };

  const openCallsDialog = (category: CallCategory) => {
    setSelectedCallCategory(category);
    setCallsDialogOpen(true);
  };

  const hasWhatsAppGroup = !!sessionId && !!groupJid;

  const PRODUCT_PRICE = 497;
  const freshRevenue = (metrics?.fresh_sales_count || 0) * PRODUCT_PRICE;
  const rejoinRevenue = (metrics?.rejoin_sales_count || 0) * PRODUCT_PRICE;
  const totalRevenue = freshRevenue + rejoinRevenue;
  const adSpend = Number(workshop?.ad_spend || 0);
  const totalCashReceived = (metrics?.fresh_cash_received || 0) + (metrics?.rejoin_cash_received || 0);
  const totalPL = totalRevenue + totalCashReceived - adSpend;

  return {
    // Data
    workshop, workshopLoading, workshopError, metrics,
    participantsData, participantsLoading, isSyncing,
    hasWhatsAppGroup, sessionId, groupJid,
    // Search
    searchQuery, setSearchQuery,
    leftSearchQuery, setLeftSearchQuery,
    unregisteredSearchQuery, setUnregisteredSearchQuery,
    // Filtered
    filteredMissing, filteredLeftGroup, filteredUnregistered,
    // CSV
    downloadMissingCSV, downloadLeftGroupCSV, downloadUnregisteredCSV,
    // Calls dialog
    callsDialogOpen, setCallsDialogOpen,
    selectedCallCategory, openCallsDialog,
    // Sync
    syncMembers,
    // Computed
    totalRevenue, adSpend, totalCashReceived, totalPL,
    // Utils
    formatOrg,
  };
}

function downloadCSV(data: string[][], filename: string) {
  const csv = data.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
