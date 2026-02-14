import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppSession } from "@/hooks/useWhatsAppSession";
import { useWhatsAppGroups, WhatsAppGroup } from "@/hooks/useWhatsAppGroups";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Users, MessageSquare, Search, RefreshCw, Phone } from "lucide-react";

const WhatsAppDashboard = () => {
  const navigate = useNavigate();
  const { sessions, sessionsLoading } = useWhatsAppSession();
  const { groups, groupsLoading, syncGroups, isSyncing } = useWhatsAppGroups();
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Only connected sessions
  const connectedSessions = useMemo(
    () => sessions?.filter((s) => s.status === "connected") || [],
    [sessions]
  );

  // Filter groups: admin-only + selected session + search
  const filteredGroups = useMemo(() => {
    let result = (groups || []).filter((g) => g.is_admin);
    if (selectedSessionId !== "all") {
      result = result.filter((g) => g.session_id === selectedSessionId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((g) => g.group_name.toLowerCase().includes(q));
    }
    return result;
  }, [groups, selectedSessionId, search]);

  const totalMembers = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + (g.participant_count || 0), 0),
    [filteredGroups]
  );

  if (sessionsLoading || groupsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (connectedSessions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="WhatsApp" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Connected WhatsApp Numbers</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Connect a WhatsApp number from Settings → WhatsApp Connection to start managing groups and sending notifications.
            </p>
            <Button onClick={() => navigate("/settings")} variant="outline">
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      label: "Admin Groups",
      value: filteredGroups.length,
      icon: MessageSquare,
      gradient: "from-primary/10 to-primary/5",
      iconColor: "text-primary",
    },
    {
      label: "Total Members",
      value: totalMembers.toLocaleString(),
      icon: Users,
      gradient: "from-emerald-500/10 to-emerald-500/5",
      iconColor: "text-emerald-500",
    },
    {
      label: "Connected Numbers",
      value: connectedSessions.length,
      icon: Phone,
      gradient: "from-blue-500/10 to-blue-500/5",
      iconColor: "text-blue-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="WhatsApp Dashboard" />
        <Button onClick={() => navigate("/whatsapp/send-notification")} className="gap-2">
          <Send className="h-4 w-4" />
          Send Notification
        </Button>
      </div>

      {/* Session selector + Sync */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
          <SelectTrigger className="w-full sm:w-[260px]">
            <SelectValue placeholder="All Numbers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Numbers</SelectItem>
            {connectedSessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.display_name || s.phone_number || s.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSessionId !== "all" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncGroups(selectedSessionId)}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Groups
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={`bg-gradient-to-br ${stat.gradient} border-0 shadow-sm`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Groups table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Group Name</TableHead>
                <TableHead className="text-right">Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    {search ? "No groups match your search" : "No admin groups found. Sync groups first."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group, idx) => (
                  <TableRow key={group.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{group.group_name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {group.participant_count}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppDashboard;
