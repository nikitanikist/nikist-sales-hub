import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, RefreshCw, Filter, Plus } from "lucide-react";
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", email: "", phone: "" });
  const { toast } = useToast();
  const { isAdmin, isCloser, isManager, profileId, isLoading: roleLoading } = useUserRole();

  const { data: closers, isLoading, refetch } = useQuery({
    queryKey: ["sales-closers", profileId, isCloser],
    queryFn: async () => {
      // Get all users with sales_rep or admin roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["sales_rep", "admin"]);

      if (rolesError) throw rolesError;

      let userIds = userRoles.map(ur => ur.user_id);

      // If user is a closer (not admin), filter to only their ID
      if (isCloser && !isAdmin && profileId) {
        userIds = userIds.filter(id => id === profileId);
      }

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Get metrics for each closer from call_appointments
      const closersWithMetrics: CloserMetrics[] = await Promise.all(
        profiles.map(async (profile) => {
          // Get all call appointments for this closer
          const { data: appointments, error: apptError } = await supabase
            .from("call_appointments")
            .select("status, cash_received")
            .eq("closer_id", profile.id);

          if (apptError) throw apptError;

          const allCalls = appointments || [];
          
          // Total assigned = all appointments for this closer
          const assigned = allCalls.length;
          
          // Converted = statuses starting with "converted_" OR exactly "converted"
          const converted = allCalls.filter(apt => 
            apt.status.startsWith('converted_') || apt.status === 'converted'
          ).length;
          
          // Not Converted = only "not_converted" status
          const not_converted = allCalls.filter(apt => 
            apt.status === 'not_converted'
          ).length;
          
          // Rescheduled = "reschedule" status
          const rescheduled = allCalls.filter(apt => 
            apt.status === 'reschedule'
          ).length;
          
          // Earnings = sum of cash_received from all appointments
          const earnings = allCalls.reduce((sum, apt) => 
            sum + Number(apt.cash_received || 0), 0
          );

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            assigned,
            converted,
            not_converted,
            rescheduled,
            earnings,
          };
        })
      );

      return closersWithMetrics;
    },
    enabled: !roleLoading,
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Sales closers data has been refreshed",
    });
  };

  const handleAddCloser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim() || !formData.email.trim()) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("add-closer", {
        body: {
          email: formData.email.trim(),
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          role: "sales_rep",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: `${formData.full_name} has been added as a closer`,
      });
      setFormData({ full_name: "", email: "", phone: "" });
      setIsAddDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add closer",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Closers</h1>
          <p className="text-muted-foreground mt-2">
            {isCloser && !isAdmin 
              ? "View your performance metrics" 
              : "View and manage sales team performance metrics"
            }
          </p>
        </div>
        {/* Only show Add Closer button for admins */}
        {isAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Closer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Closer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCloser} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    placeholder="Enter full name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="Enter phone number (optional)"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Closer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {isCloser && !isAdmin ? "Your Performance" : "Closers Performance"}
              </CardTitle>
              <CardDescription>
                {isCloser && !isAdmin 
                  ? "Track your sales metrics and performance" 
                  : "Track sales team metrics and performance"
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              {/* Only show filter button for admins */}
              {isAdmin && (
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {/* Only show search for admins */}
          {isAdmin && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading || roleLoading ? (
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
                    {!isManager && <TableHead className="text-right">Earning Till Now</TableHead>}
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
                        <TableCell className="text-right">
                          <Link
                            to={`/sales-closers/${closer.id}/calls`}
                            className="font-medium text-primary hover:underline"
                          >
                            {closer.assigned}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={`/sales-closers/${closer.id}/calls?status=converted`}
                            className="font-medium text-green-600 hover:underline"
                          >
                            {closer.converted}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={`/sales-closers/${closer.id}/calls?status=not_converted`}
                            className="font-medium text-red-600 hover:underline"
                          >
                            {closer.not_converted}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={`/sales-closers/${closer.id}/calls?status=reschedule`}
                            className="font-medium text-purple-600 hover:underline"
                          >
                            {closer.rescheduled}
                          </Link>
                        </TableCell>
                        {!isManager && (
                          <TableCell className="text-right font-semibold">
                            <Link
                              to={`/sales-closers/${closer.id}/calls?status=converted`}
                              className="text-primary hover:underline"
                            >
                              ₹{(closer.earnings ?? 0).toLocaleString("en-IN")}
                            </Link>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isManager ? 6 : 7} className="text-center py-8 text-muted-foreground">
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
