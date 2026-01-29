import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, RefreshCw, Filter, Plus, Users, CheckCircle, XCircle, RotateCcw } from "lucide-react";
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
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();

  const { data: closers, isLoading, refetch } = useQuery({
    queryKey: ["sales-closers", profileId, isCloser, currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];

      // Get only users with sales_rep role in current organization
      const { data: orgMembers, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", currentOrganization.id)
        .eq("role", "sales_rep");

      if (membersError) throw membersError;

      let userIds = orgMembers.map(m => m.user_id);

      // If user is a closer (not admin), filter to only their ID
      if (isCloser && !isAdmin && profileId) {
        userIds = userIds.filter(id => id === profileId);
      }

      if (userIds.length === 0) return [];

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Get metrics for each closer from call_appointments (filtered by org)
      const closersWithMetrics: CloserMetrics[] = await Promise.all(
        profiles.map(async (profile) => {
          // Get all call appointments for this closer in current org
          const { data: appointments, error: apptError } = await supabase
            .from("call_appointments")
            .select("status, cash_received")
            .eq("closer_id", profile.id)
            .eq("organization_id", currentOrganization.id);

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
    enabled: !roleLoading && !!currentOrganization,
  });

  // Calculate totals for summary cards
  const totals = useMemo(() => {
    if (!closers) return { assigned: 0, converted: 0, not_converted: 0, rescheduled: 0 };
    return closers.reduce((acc, closer) => ({
      assigned: acc.assigned + closer.assigned,
      converted: acc.converted + closer.converted,
      not_converted: acc.not_converted + closer.not_converted,
      rescheduled: acc.rescheduled + closer.rescheduled,
    }), { assigned: 0, converted: 0, not_converted: 0, rescheduled: 0 });
  }, [closers]);

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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Sales Closers</h1>
          <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
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

      {/* Summary Cards - Only for admins and managers */}
      {(isAdmin || isManager) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card 
            className="cursor-pointer card-lift overflow-hidden"
            onClick={() => navigate("/sales-closers/all-calls")}
          >
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1 sm:gap-2">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-violet-600" />
                </div>
                <span className="hidden sm:inline">All Assigned Calls</span>
                <span className="sm:hidden">Assigned</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{totals.assigned}</div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer card-lift overflow-hidden"
            onClick={() => navigate("/sales-closers/all-calls?status=converted")}
          >
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1 sm:gap-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                </div>
                <span className="hidden sm:inline">All Converted Calls</span>
                <span className="sm:hidden">Converted</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-emerald-600">{totals.converted}</div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer card-lift overflow-hidden"
            onClick={() => navigate("/sales-closers/all-calls?status=not_converted")}
          >
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1 sm:gap-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                </div>
                <span className="hidden sm:inline">Not Converted</span>
                <span className="sm:hidden">Not Conv.</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-red-600">{totals.not_converted}</div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer card-lift overflow-hidden"
            onClick={() => navigate("/sales-closers/all-calls?status=reschedule")}
          >
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1 sm:gap-2">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 text-violet-600" />
                </div>
                <span className="hidden sm:inline">All Rescheduled</span>
                <span className="sm:hidden">Resch.</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-violet-600">{totals.rescheduled}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">
                {isCloser && !isAdmin ? "Your Performance" : "Closers Performance"}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
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
        <CardContent className="px-0 sm:px-6">
          {isLoading || roleLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading closers...</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block rounded-md border">
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
                        <TableCell colSpan={isManager ? 6 : 7}>
                          <div className="flex flex-col items-center justify-center text-center py-8">
                            <div className="rounded-full bg-muted p-4 mb-4">
                              <Users className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-lg mb-1">No sales closers found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                              Sales closers with assigned calls will appear here.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3 px-4">
                {filteredClosers && filteredClosers.length > 0 ? (
                  filteredClosers.map((closer) => (
                    <div key={closer.id} className="p-4 rounded-lg border bg-card space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{closer.full_name}</div>
                          <div className="text-xs text-blue-600 truncate max-w-[180px]">{closer.email}</div>
                        </div>
                        {!isManager && (
                          <Link
                            to={`/sales-closers/${closer.id}/calls?status=converted`}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            ₹{(closer.earnings ?? 0).toLocaleString("en-IN")}
                          </Link>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        <Link to={`/sales-closers/${closer.id}/calls`} className="block">
                          <div className="text-xs text-muted-foreground">Assigned</div>
                          <div className="font-medium text-primary">{closer.assigned}</div>
                        </Link>
                        <Link to={`/sales-closers/${closer.id}/calls?status=converted`} className="block">
                          <div className="text-xs text-muted-foreground">Conv.</div>
                          <div className="font-medium text-green-600">{closer.converted}</div>
                        </Link>
                        <Link to={`/sales-closers/${closer.id}/calls?status=not_converted`} className="block">
                          <div className="text-xs text-muted-foreground">Not Conv.</div>
                          <div className="font-medium text-red-600">{closer.not_converted}</div>
                        </Link>
                        <Link to={`/sales-closers/${closer.id}/calls?status=reschedule`} className="block">
                          <div className="text-xs text-muted-foreground">Resch.</div>
                          <div className="font-medium text-purple-600">{closer.rescheduled}</div>
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-muted p-3 mb-3">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium mb-1">No sales closers found</p>
                    <p className="text-sm text-muted-foreground">
                      Sales closers with assigned calls will appear here.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesClosers;
