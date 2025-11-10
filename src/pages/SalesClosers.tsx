import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, RefreshCw, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CloserMetrics {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  assigned: number;
  converted: number;
  not_converted: number;
  rescheduled: number;
  earnings: number;
}

const SalesClosers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: closers, isLoading, refetch } = useQuery({
    queryKey: ["sales-closers"],
    queryFn: async () => {
      // Get all users with sales_rep or admin roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["sales_rep", "admin"]);

      if (rolesError) throw rolesError;

      const userIds = userRoles.map(ur => ur.user_id);

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Get metrics for each closer
      const closersWithMetrics: CloserMetrics[] = await Promise.all(
        profiles.map(async (profile) => {
          // Count assigned leads
          const { count: assignedCount } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", profile.id);

          // Count converted (sales)
          const { data: sales, count: convertedCount } = await supabase
            .from("sales")
            .select("amount", { count: "exact" })
            .eq("sales_rep", profile.id);

          // Calculate total earnings
          const earnings = sales?.reduce((sum, sale) => sum + Number(sale.amount || 0), 0) || 0;

          // TODO: Add rescheduled status tracking when enum is updated
          // For now, set rescheduled to 0
          const rescheduledCount = 0;

          const assigned = assignedCount || 0;
          const converted = convertedCount || 0;

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            assigned,
            converted,
            not_converted: assigned - converted,
            rescheduled: rescheduledCount,
            earnings,
          };
        })
      );

      return closersWithMetrics;
    },
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Sales closers data has been refreshed",
    });
  };

  const filteredClosers = closers?.filter((closer) => {
    const query = searchQuery.toLowerCase();
    return (
      closer.full_name.toLowerCase().includes(query) ||
      closer.email.toLowerCase().includes(query) ||
      (closer.phone && closer.phone.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Closers</h1>
        <p className="text-muted-foreground mt-2">
          View and manage sales team performance metrics
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Closers Performance</CardTitle>
              <CardDescription>Track sales team metrics and performance</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
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
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading closers...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Converted</TableHead>
                    <TableHead className="text-right">Not Converted</TableHead>
                    <TableHead className="text-right">Rescheduled</TableHead>
                    <TableHead className="text-right">Earning Till Now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClosers && filteredClosers.length > 0 ? (
                    filteredClosers.map((closer) => (
                      <TableRow key={closer.id}>
                        <TableCell className="font-medium">{closer.full_name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm text-blue-600">{closer.email}</div>
                            {closer.phone && (
                              <div className="text-sm text-blue-600">{closer.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{closer.assigned}</TableCell>
                        <TableCell className="text-right">{closer.converted}</TableCell>
                        <TableCell className="text-right">{closer.not_converted}</TableCell>
                        <TableCell className="text-right">{closer.rescheduled}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${closer.earnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No sales closers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesClosers;
