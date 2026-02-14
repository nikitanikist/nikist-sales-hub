import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Users, 
  UserCheck, 
  UserX, 
  UserMinus,
  UserPlus,
  TrendingUp, 
  RefreshCw, 
  Download, 
  Search,
  Calendar,
  Phone,
  MessageSquare,
  Loader2,
  AlertCircle,
  UsersRound
} from "lucide-react";
import { format } from "date-fns";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useOrganization } from "@/hooks/useOrganization";
import { useWorkshopParticipants } from "@/hooks/useWorkshopParticipants";
import { WorkshopWhatsAppTab } from "@/components/workshops/WorkshopWhatsAppTab";
import { WorkshopCallsDialog } from "@/components/WorkshopCallsDialog";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";

type CallCategory = 
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

const statusColors: Record<string, string> = {
  planned: "bg-sky-100 text-sky-700 border-sky-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const WorkshopDetail = () => {
  const { workshopId } = useParams<{ workshopId: string }>();
  const navigate = useNavigate();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
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
      
      // First fetch the workshop
      const { data: workshopData, error: workshopErr } = await supabase
        .from("workshops")
        .select("*")
        .eq("id", workshopId)
        .single();

      if (workshopErr) throw workshopErr;
      
      // Fetch linked WhatsApp group from junction table (source of truth)
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

  // Fetch participants comparison (now from database, not VPS polling)
  const { 
    data: participantsData, 
    isLoading: participantsLoading, 
    syncMembers,
    isSyncing 
  } = useWorkshopParticipants(
    workshopId || '',
    sessionId,
    groupJid,
    currentOrganization?.id || null,
    !!groupJid // Only enabled if we have a group JID
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

  // Download CSV of missing members
  const downloadMissingCSV = () => {
    if (!participantsData?.missing || participantsData.missing.length === 0) {
      toast.error("No missing members to download");
      return;
    }

    const headers = ['Name', 'Phone', 'Email', 'Registered Date'];
    const rows = participantsData.missing.map(m => [
      m.contact_name || '',
      m.phone || '',
      m.email || '',
      m.created_at ? format(new Date(m.created_at), 'MMM dd, yyyy') : ''
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-members-${workshop?.title || 'workshop'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Downloaded ${participantsData.missing.length} missing members`);
  };

  // Download CSV of left group members
  const downloadLeftGroupCSV = () => {
    if (!participantsData?.leftGroup || participantsData.leftGroup.length === 0) {
      toast.error("No left group members to download");
      return;
    }

    const headers = ['Name', 'Phone', 'Email', 'Joined Date', 'Left Date'];
    const rows = participantsData.leftGroup.map(m => [
      m.contact_name || 'Unknown',
      m.full_phone || m.phone_number || '',
      m.email || '',
      m.joined_at ? format(new Date(m.joined_at), 'MMM dd, yyyy') : '',
      m.left_at ? format(new Date(m.left_at), 'MMM dd, yyyy HH:mm') : ''
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `left-group-members-${workshop?.title || 'workshop'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Downloaded ${participantsData.leftGroup.length} left group members`);
  };

  // Download CSV of unregistered members
  const downloadUnregisteredCSV = () => {
    if (!participantsData?.unregistered || participantsData.unregistered.length === 0) {
      toast.error("No unregistered members to download");
      return;
    }

    const headers = ['Phone'];
    const rows = participantsData.unregistered.map(m => [
      m.fullPhone || m.phone || ''
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unregistered-members-${workshop?.title || 'workshop'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Downloaded ${participantsData.unregistered.length} unregistered members`);
  };

  const openCallsDialog = (category: CallCategory) => {
    setSelectedCallCategory(category);
    setCallsDialogOpen(true);
  };

  const handleSyncMembers = () => {
    syncMembers();
  };

  // Loading states
  if (orgLoading) {
    return <OrganizationLoadingState />;
  }

  if (!currentOrganization) {
    return (
      <EmptyState
        icon={Calendar}
        title="No Organization Selected"
        description="Please select an organization to view workshop details."
      />
    );
  }

  if (workshopLoading) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (workshopError || !workshop) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-xl font-semibold mb-2">Workshop Not Found</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          The workshop you're looking for doesn't exist or you don't have access to it.
        </p>
        <Button onClick={() => navigate("/workshops")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Workshops
        </Button>
      </div>
    );
  }

  const hasWhatsAppGroup = !!sessionId && !!groupJid;
  const PRODUCT_PRICE = 497;
  const freshRevenue = (metrics?.fresh_sales_count || 0) * PRODUCT_PRICE;
  const rejoinRevenue = (metrics?.rejoin_sales_count || 0) * PRODUCT_PRICE;
  const totalRevenue = freshRevenue + rejoinRevenue;
  const adSpend = Number(workshop.ad_spend || 0);
  const totalCashReceived = (metrics?.fresh_cash_received || 0) + (metrics?.rejoin_cash_received || 0);
  const totalPL = totalRevenue + totalCashReceived - adSpend;

  return (
    <div className="space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/workshops")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{workshop.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {workshop.start_date 
                  ? formatOrg(workshop.start_date, "MMM dd, yyyy 'at' h:mm a") 
                  : "No date set"}
              </span>
              <Badge className={statusColors[workshop.status || 'planned']}>
                {workshop.status || 'planned'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Simplified 3-Card Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Registration */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {participantsData?.totalRegistered || metrics?.registration_count || 0}
                </p>
                <p className="text-sm text-muted-foreground">Registered</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: WhatsApp Group - 2 columns */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-base font-semibold">WhatsApp Group</CardTitle>
              </div>
              {isSyncing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              {/* Total in Group */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Total in Group</span>
                <span className="text-lg font-semibold">
                  {participantsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    participantsData?.totalInGroupRaw || 0
                  )}
                </span>
              </div>
              
              {/* Missing */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5">
                <span className="text-sm text-destructive">Missing</span>
                <span className="text-lg font-semibold text-destructive">
                  {participantsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    participantsData?.totalMissing || 0
                  )}
                </span>
              </div>
              
              {/* Unregistered */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                <span className="text-sm text-amber-600">Unregistered</span>
                <span className="text-lg font-semibold text-amber-600">
                  {participantsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    participantsData?.totalUnregistered || 0
                  )}
                </span>
              </div>
              
              {/* Left Group */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Left Group</span>
                <span className="text-lg font-semibold text-muted-foreground">
                  {participantsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    participantsData?.leftGroup?.length || 0
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Join Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">
                    {participantsLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      `${participantsData?.joinRate?.toFixed(0) || 0}%`
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">Join Rate</p>
                </div>
              </div>
              <Progress 
                value={participantsData?.joinRate || 0} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {participantsData?.totalInGroupRaw || 0} of {participantsData?.totalRegistered || 0} joined
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {hasWhatsAppGroup && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Group Join Progress</span>
                  {participantsData?.groupName && (
                    <Badge variant="outline">{participantsData.groupName}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {participantsData?.lastSynced && (
                    <span>Last synced: {format(participantsData.lastSynced, 'h:mm:ss a')}</span>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSyncMembers}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Members'}
                  </Button>
                </div>
              </div>
              <Progress value={participantsData?.joinRate || 0} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                {participantsData?.totalInGroupRaw || 0} of {participantsData?.totalRegistered || 0} registered members have joined the WhatsApp group
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No WhatsApp Group Warning */}
      {!hasWhatsAppGroup && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">No WhatsApp Group Linked</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Link a WhatsApp group to this workshop to track member participation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="missing" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="missing" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Missing
            {participantsData?.totalMissing ? (
              <Badge variant="secondary" className="ml-1">{participantsData.totalMissing}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="left" className="flex items-center gap-2">
            <UserMinus className="h-4 w-4" />
            Left Group
            {participantsData?.totalLeftGroup ? (
              <Badge variant="secondary" className="ml-1">{participantsData.totalLeftGroup}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="unregistered" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Unregistered
            {participantsData?.totalUnregistered ? (
              <Badge variant="secondary" className="ml-1">{participantsData.totalUnregistered}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Call Statistics
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* Missing Members Tab */}
        <TabsContent value="missing" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Missing Members</CardTitle>
                  <CardDescription>
                    People who registered but haven't joined the WhatsApp group
                  </CardDescription>
                </div>
                <Button 
                  onClick={downloadMissingCSV} 
                  disabled={!participantsData?.missing?.length}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {participantsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !hasWhatsAppGroup ? (
                <div className="text-center py-8 text-muted-foreground">
                  Link a WhatsApp group to see missing members
                </div>
              ) : filteredMissing.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No matching members found" : "All registered members are in the WhatsApp group! 🎉"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMissing.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.contact_name || 'N/A'}</TableCell>
                        <TableCell>{lead.phone || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.email || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.created_at ? format(new Date(lead.created_at), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Left Group Tab */}
        <TabsContent value="left" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Left Group Members</CardTitle>
                  <CardDescription>
                    People who joined the WhatsApp group but have since left
                  </CardDescription>
                </div>
                <Button 
                  onClick={downloadLeftGroupCSV} 
                  disabled={!participantsData?.leftGroup?.length}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or email..."
                  value={leftSearchQuery}
                  onChange={(e) => setLeftSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {participantsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !hasWhatsAppGroup ? (
                <div className="text-center py-8 text-muted-foreground">
                  Link a WhatsApp group to track members who left
                </div>
              ) : filteredLeftGroup.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {leftSearchQuery ? "No matching members found" : "No one has left the group yet 🎉"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Left</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeftGroup.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.contact_name || 'Unknown'}</TableCell>
                        <TableCell>{member.full_phone || member.phone_number || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.joined_at ? format(new Date(member.joined_at), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.left_at ? format(new Date(member.left_at), 'MMM dd, yyyy HH:mm') : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unregistered Members Tab */}
        <TabsContent value="unregistered" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Unregistered Members</CardTitle>
                  <CardDescription>
                    People in the WhatsApp group who didn't register (admins excluded)
                  </CardDescription>
                </div>
                <Button 
                  onClick={downloadUnregisteredCSV} 
                  disabled={!participantsData?.unregistered?.length}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone..."
                  value={unregisteredSearchQuery}
                  onChange={(e) => setUnregisteredSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {participantsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !hasWhatsAppGroup ? (
                <div className="text-center py-8 text-muted-foreground">
                  Link a WhatsApp group to see unregistered members
                </div>
              ) : filteredUnregistered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {unregisteredSearchQuery ? "No matching members found" : "All group members are registered! 🎉"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnregistered.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.fullPhone || member.phone || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          {/* Fresh Call Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Fresh Calls (Paid During This Workshop)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-8 gap-3">
                <div 
                  className="bg-muted rounded-lg p-3 border-2 border-border cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => openCallsDialog("all_booked")}
                >
                  <div className="text-2xl font-bold">{metrics?.total_calls_booked || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Booked</div>
                </div>
                <div 
                  className="bg-background rounded-lg p-3 border cursor-pointer hover:border-emerald-400 transition-all"
                  onClick={() => openCallsDialog("converted")}
                >
                  <div className="text-2xl font-bold text-emerald-600">{metrics?.fresh_converted || 0}</div>
                  <div className="text-xs text-muted-foreground">Converted</div>
                </div>
                <div 
                  className="bg-background rounded-lg p-3 border cursor-pointer hover:border-destructive transition-all"
                  onClick={() => openCallsDialog("not_converted")}
                >
                  <div className="text-2xl font-bold text-destructive">{metrics?.fresh_not_converted || 0}</div>
                  <div className="text-xs text-muted-foreground">Not Converted</div>
                </div>
                <div 
                  className="bg-background rounded-lg p-3 border cursor-pointer hover:border-amber-400 transition-all"
                  onClick={() => openCallsDialog("remaining")}
                >
                  <div className="text-2xl font-bold text-amber-600">{metrics?.fresh_remaining || 0}</div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                </div>
                <div 
                  className="bg-background rounded-lg p-3 border cursor-pointer hover:border-orange-400 transition-all"
                  onClick={() => openCallsDialog("rescheduled_remaining")}
                >
                  <div className="text-2xl font-bold text-orange-600">{metrics?.fresh_rescheduled_remaining || 0}</div>
                  <div className="text-xs text-muted-foreground">Reschedule</div>
                </div>
                <div 
                  className="bg-background rounded-lg p-3 border cursor-pointer hover:border-primary transition-all"
                  onClick={() => openCallsDialog("booking_amount")}
                >
                  <div className="text-2xl font-bold text-primary">{metrics?.fresh_booking_amount || 0}</div>
                  <div className="text-xs text-muted-foreground">Booking Amt</div>
                </div>
                <div 
                  className="bg-background rounded-lg p-3 border cursor-pointer hover:border-muted-foreground transition-all"
                  onClick={() => openCallsDialog("refunded")}
                >
                  <div className="text-2xl font-bold text-muted-foreground">{metrics?.refunded_calls || 0}</div>
                  <div className="text-xs text-muted-foreground">Refunded</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-lg font-bold">₹{totalRevenue.toLocaleString("en-IN")}</div>
                  <div className="text-xs text-muted-foreground">Total Revenue</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-lg font-bold">₹{adSpend.toLocaleString("en-IN")}</div>
                  <div className="text-xs text-muted-foreground">Ad Spend</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-lg font-bold">₹{totalCashReceived.toLocaleString("en-IN")}</div>
                  <div className="text-xs text-muted-foreground">Cash Received</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-lg font-bold">₹{(metrics?.total_offer_amount || 0).toLocaleString("en-IN")}</div>
                  <div className="text-xs text-muted-foreground">Offered Amount</div>
                </div>
                <div className={`p-4 rounded-lg ${totalPL >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-destructive/10'}`}>
                  <div className={`text-lg font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    ₹{totalPL.toLocaleString("en-IN")}
                  </div>
                  <div className="text-xs text-muted-foreground">Total P&L</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp">
          <WorkshopWhatsAppTab 
            workshopId={workshopId || ''} 
            workshopTitle={workshop.title} 
          />
        </TabsContent>
      </Tabs>

      {/* Calls Dialog */}
      <WorkshopCallsDialog
        open={callsDialogOpen}
        onOpenChange={setCallsDialogOpen}
        workshopTitle={workshop.title}
        category={selectedCallCategory}
      />
    </div>
  );
};

export default WorkshopDetail;
