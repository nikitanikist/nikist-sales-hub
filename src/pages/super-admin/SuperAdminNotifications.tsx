import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEffect } from "react";

const SuperAdminNotifications = () => {
  const { isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!orgLoading && !isSuperAdmin) { navigate("/"); }
  }, [isSuperAdmin, orgLoading, navigate]);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["subscription-notifications-full", filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_notifications")
        .select("id, title, message, type, is_read, created_at, organization_id, organizations!subscription_notifications_organization_id_fkey (name)")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      const results = data || [];
      if (filter !== "all") {
        return results.filter((n: any) => n.type === filter);
      }
      return results;
    },
    enabled: !!isSuperAdmin,
  });

  const markAsRead = async (id: string) => {
    await supabase.from("subscription_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    refetch();
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n: any) => !n.is_read).map((n: any) => n.id);
    if (unread.length === 0) return;
    await supabase.from("subscription_notifications").update({ is_read: true, read_at: new Date().toISOString() }).in("id", unread);
    toast.success("All marked as read");
    refetch();
  };

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] bg-background"><SelectValue placeholder="Filter" /></SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="trial_expiring">Trial Expiring</SelectItem>
              <SelectItem value="trial_expired">Trial Expired</SelectItem>
              <SelectItem value="payment_due">Payment Due</SelectItem>
              <SelectItem value="limit_approaching">Limit Approaching</SelectItem>
            </SelectContent>
          </Select>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read ({unreadCount})</Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No notifications</div>
          ) : (
            <div className="divide-y">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{n.title}</p>
                        {!n.is_read && <Badge className="h-5 text-[10px]">New</Badge>}
                      </div>
                      {n.message && <p className="text-sm text-muted-foreground">{n.message}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{format(new Date(n.created_at), "PP p")}</span>
                        {n.organizations?.name && <Badge variant="outline" className="text-[10px]">{n.organizations.name}</Badge>}
                        {n.type && <Badge variant="secondary" className="text-[10px]">{n.type}</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminNotifications;
