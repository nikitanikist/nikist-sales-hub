import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Calendar, Search, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  planned: "bg-blue-500",
  confirmed: "bg-green-500",
  completed: "bg-gray-500",
  cancelled: "bg-red-500",
};

const Workshops = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: workshops, isLoading, refetch } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      const { data: workshopsData, error } = await supabase
        .from("workshops")
        .select("*")
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      
      // Fetch sales data for each workshop to calculate metrics
      const workshopsWithMetrics = await Promise.all(
        workshopsData.map(async (workshop) => {
          // Get sales for this workshop's lead
          const { data: salesData } = await supabase
            .from("sales")
            .select("amount")
            .eq("lead_id", workshop.lead_id || "");
          
          const salesCount = salesData?.length || 0;
          const totalRevenue = salesData?.reduce((sum, sale) => sum + Number(sale.amount || 0), 0) || 0;
          const adSpend = Number(workshop.ad_spend || 0);
          const roughPL = totalRevenue - adSpend;
          
          return {
            ...workshop,
            sales_count: salesCount,
            total_revenue: totalRevenue,
            rough_pl: roughPL,
          };
        })
      );
      
      return workshopsWithMetrics;
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name")
        .order("company_name");

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newWorkshop: any) => {
      const { error } = await supabase.from("workshops").insert([{
        ...newWorkshop,
        created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Workshop created successfully");
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("workshops").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Workshop updated successfully");
      setIsOpen(false);
      setEditingWorkshop(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workshops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops"] });
      toast.success("Workshop deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
      location: formData.get("location"),
      max_participants: formData.get("max_participants") ? Number(formData.get("max_participants")) : null,
      ad_spend: formData.get("ad_spend") ? Number(formData.get("ad_spend")) : 0,
      status: formData.get("status"),
      lead_id: formData.get("lead_id") || null,
    };

    if (editingWorkshop) {
      updateMutation.mutate({ id: editingWorkshop.id, updates: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Workshops data refreshed");
  };

  const filteredWorkshops = workshops?.filter((workshop) => {
    const query = searchQuery.toLowerCase();
    return workshop.title.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Workshops</h1>
          <p className="text-muted-foreground">Schedule and manage your workshops</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingWorkshop(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Workshop
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingWorkshop ? "Edit Workshop" : "Add New Workshop"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={editingWorkshop?.title}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingWorkshop?.description}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="datetime-local"
                      defaultValue={editingWorkshop?.start_date ? format(new Date(editingWorkshop.start_date), "yyyy-MM-dd'T'HH:mm") : ""}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      name="end_date"
                      type="datetime-local"
                      defaultValue={editingWorkshop?.end_date ? format(new Date(editingWorkshop.end_date), "yyyy-MM-dd'T'HH:mm") : ""}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      defaultValue={editingWorkshop?.location}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_participants">Max Participants</Label>
                    <Input
                      id="max_participants"
                      name="max_participants"
                      type="number"
                      defaultValue={editingWorkshop?.max_participants}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad_spend">Ad Spend ($)</Label>
                  <Input
                    id="ad_spend"
                    name="ad_spend"
                    type="number"
                    step="0.01"
                    defaultValue={editingWorkshop?.ad_spend || 0}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue={editingWorkshop?.status || "planned"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_id">Related Lead (Optional)</Label>
                    <Select name="lead_id" defaultValue={editingWorkshop?.lead_id || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a lead" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {leads?.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {editingWorkshop ? "Update" : "Create"} Workshop
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Workshops</CardTitle>
              <CardDescription>Manage and track workshop performance</CardDescription>
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
              placeholder="Search workshops by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Workshop Name</TableHead>
                  <TableHead className="text-right">Total Registrations</TableHead>
                  <TableHead className="text-right">Ad Spend</TableHead>
                  <TableHead className="text-right">Number of Workshop Sales</TableHead>
                  <TableHead className="text-right">Rough P&L</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkshops?.map((workshop) => (
                  <TableRow key={workshop.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(workshop.start_date), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{workshop.title}</TableCell>
                    <TableCell className="text-right">
                      {workshop.current_participants || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{Number(workshop.ad_spend || 0).toLocaleString("en-US", { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {workshop.sales_count || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={workshop.rough_pl >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        ₹{Number(workshop.rough_pl || 0).toLocaleString("en-US", { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingWorkshop(workshop);
                          setIsOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(workshop.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Workshops;
