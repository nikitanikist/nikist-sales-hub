import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, RefreshCw, MoreVertical, Ban, Edit, MessageSquare, Users, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  contacted: "bg-yellow-500",
  qualified: "bg-purple-500",
  proposal: "bg-indigo-500",
  negotiation: "bg-orange-500",
  won: "bg-green-500",
  lost: "bg-red-500",
};

const Leads = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkshops, setSelectedWorkshops] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [connectWorkshopFunnel, setConnectWorkshopFunnel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Real-time subscription for leads and assignments
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-leads"] });
        queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_assignments' }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: leadAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["lead-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_assignments")
        .select(`
          *,
          lead:leads(
            id,
            contact_name,
            company_name,
            email,
            phone,
            country,
            status,
            updated_at,
            assigned_to:profiles!leads_assigned_to_fkey(full_name)
          ),
          workshop:workshops(id, title),
          funnel:funnels(id, funnel_name),
          product:products(id, product_name, price)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: allLeads, isLoading: isLoadingLeads } = useQuery({
    queryKey: ["all-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          assigned_to:profiles!leads_assigned_to_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingAssignments || isLoadingLeads;

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  const { data: workshops } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("*")
        .order("title");

      if (error) throw error;
      return data;
    },
  });

  const { data: funnels } = useQuery({
    queryKey: ["funnels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnels")
        .select("*")
        .order("funnel_name");

      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          funnel:funnels(id, funnel_name)
        `)
        .eq("is_active", true)
        .order("product_name");

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ leadData, workshopIds, productIds, isConnected }: any) => {
      // Upsert lead basic info
      let leadId = editingLead?.id;
      if (editingLead) {
        const { error } = await supabase
          .from("leads")
          .update(leadData)
          .eq("id", leadId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("leads")
          .insert([{ ...leadData, created_by: user?.id }])
          .select()
          .single();
        if (error) throw error;
        leadId = data.id;
      }

      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from("lead_assignments")
        .delete()
        .eq("lead_id", leadId);
      if (deleteError) throw deleteError;

      // Create new assignments
      const assignments = [];
      
      // Map product IDs to their funnel IDs
      const productToFunnelMap = new Map<string, string>();
      productIds.forEach((productId: string) => {
        const product = products?.find(p => p.id === productId);
        if (product?.funnel_id) {
          productToFunnelMap.set(productId, product.funnel_id);
        }
      });
      
      if (isConnected && workshopIds.length > 0 && productIds.length > 0) {
        // Create connected pair
        const firstProduct = productIds[0];
        const firstFunnelId = productToFunnelMap.get(firstProduct);
        assignments.push({
          lead_id: leadId,
          workshop_id: workshopIds[0],
          product_id: firstProduct,
          funnel_id: firstFunnelId,
          is_connected: true,
          created_by: user?.id,
        });
        
        // Add remaining workshops as separate assignments
        for (let i = 1; i < workshopIds.length; i++) {
          assignments.push({
            lead_id: leadId,
            workshop_id: workshopIds[i],
            product_id: null,
            funnel_id: null,
            is_connected: false,
            created_by: user?.id,
          });
        }
        
        // Add remaining products as separate assignments
        for (let i = 1; i < productIds.length; i++) {
          const productId = productIds[i];
          const funnelId = productToFunnelMap.get(productId);
          assignments.push({
            lead_id: leadId,
            product_id: productId,
            funnel_id: funnelId,
            workshop_id: null,
            is_connected: false,
            created_by: user?.id,
          });
        }
      } else {
        // Create separate assignments
        workshopIds.forEach((wId: string) => {
          assignments.push({
            lead_id: leadId,
            workshop_id: wId,
            product_id: null,
            funnel_id: null,
            is_connected: false,
            created_by: user?.id,
          });
        });
        
        productIds.forEach((productId: string) => {
          const funnelId = productToFunnelMap.get(productId);
          assignments.push({
            lead_id: leadId,
            product_id: productId,
            funnel_id: funnelId,
            workshop_id: null,
            is_connected: false,
            created_by: user?.id,
          });
        });
      }

      if (assignments.length > 0) {
        const { error: insertError } = await supabase
          .from("lead_assignments")
          .insert(assignments);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      toast.success(editingLead ? "Customer updated successfully" : "Customer created successfully");
      setIsOpen(false);
      setEditingLead(null);
      setSelectedWorkshops([]);
      setSelectedProducts([]);
      setConnectWorkshopFunnel(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      toast.success("Customer deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ leadId, assignedTo }: { leadId: string; assignedTo: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: assignedTo })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads"] });
      toast.success("Customer assigned successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const leadData = {
      company_name: formData.get("company_name"),
      contact_name: formData.get("contact_name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      country: formData.get("country"),
      status: formData.get("status"),
      value: formData.get("value") ? Number(formData.get("value")) : null,
      notes: formData.get("notes"),
      assigned_to: formData.get("assigned_to") || null,
    };

    saveMutation.mutate({
      leadData,
      workshopIds: selectedWorkshops,
      productIds: selectedProducts,
      isConnected: connectWorkshopFunnel,
    });
  };

  const filteredAssignments = leadAssignments?.filter((assignment) => {
    const query = searchQuery.toLowerCase();
    const lead = assignment.lead;
    return (
      lead?.contact_name?.toLowerCase().includes(query) ||
      lead?.email?.toLowerCase().includes(query) ||
      lead?.phone?.toLowerCase().includes(query)
    );
  });

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Filter all leads by search query
  const filteredLeads = allLeads?.filter((lead) => {
    const query = searchQuery.toLowerCase();
    return (
      lead.contact_name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query)
    );
  });

  // Group assignments by customer for display
  const groupedAssignments = filteredAssignments?.reduce((acc: any, assignment) => {
    const leadId = assignment.lead?.id;
    if (!leadId) return acc;
    
    if (!acc[leadId]) {
      acc[leadId] = {
        lead: assignment.lead,
        assignments: [],
      };
    }
    acc[leadId].assignments.push(assignment);
    return acc;
  }, {});

  // Add leads without assignments
  filteredLeads?.forEach((lead) => {
    if (!groupedAssignments?.[lead.id]) {
      if (!groupedAssignments) return;
      groupedAssignments[lead.id] = {
        lead: {
          ...lead,
          assigned_to: lead.assigned_to,
        },
        assignments: [],
      };
    }
  });

  // Paginate grouped assignments - sort by newest first
  const groupedAssignmentsArray = Object.values(groupedAssignments || {}).sort((a: any, b: any) => {
    const dateA = new Date(a.lead?.created_at || 0).getTime();
    const dateB = new Date(b.lead?.created_at || 0).getTime();
    return dateB - dateA;
  });
  const totalPages = Math.ceil(groupedAssignmentsArray.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAssignments = groupedAssignmentsArray.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or email"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["lead-assignments"] });
            queryClient.invalidateQueries({ queryKey: ["all-leads"] });
          }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => {
            setEditingLead(null);
            setSelectedWorkshops([]);
            setSelectedProducts([]);
            setConnectWorkshopFunnel(false);
            setIsOpen(true);
          }}>
            Add Customer
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Workshop</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Last Transaction Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssignments.map((group: any) => {
                  const lead = group.lead;
                  
                  // If no assignments, show lead with empty assignment columns
                  if (group.assignments.length === 0) {
                    return (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{lead.contact_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              {lead.country && <span>{lead.country}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm text-blue-600">{lead.phone || "-"}</div>
                            <div className="text-sm text-blue-600">{lead.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{lead.assigned_to?.full_name || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                            ACTIVE
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-background border shadow-lg z-50">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  setEditingLead(lead);
                                  setSelectedWorkshops([]);
                                  setSelectedProducts([]);
                                  setConnectWorkshopFunnel(false);
                                  setIsOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit details
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="cursor-pointer">
                                  <Users className="mr-2 h-4 w-4" />
                                  Assign affiliate
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="bg-background border shadow-lg z-50">
                                  {profiles?.map((profile) => (
                                    <DropdownMenuItem
                                      key={profile.id}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        assignMutation.mutate({
                                          leadId: lead.id,
                                          assignedTo: profile.id,
                                        });
                                      }}
                                    >
                                      {profile.full_name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 cursor-pointer"
                                onClick={() => deleteMutation.mutate(lead.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete customer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  return group.assignments.map((assignment: any, idx: number) => (
                    <TableRow key={assignment.id} className={idx > 0 ? "bg-muted/30" : ""}>
                      {idx === 0 ? (
                        <TableCell rowSpan={group.assignments.length}>
                          <div className="space-y-1">
                            <div className="font-medium">{lead.contact_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              {lead.country && <span>{lead.country}</span>}
                            </div>
                          </div>
                        </TableCell>
                      ) : null}
                      {idx === 0 ? (
                        <TableCell rowSpan={group.assignments.length}>
                          <div className="space-y-1">
                            <div className="text-sm text-blue-600">{lead.phone || "-"}</div>
                            <div className="text-sm text-blue-600">{lead.email}</div>
                          </div>
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{assignment.workshop?.title || "-"}</span>
                          {assignment.is_connected && (
                            <Link2 className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.product ? (
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium">{assignment.product.product_name}</div>
                            <div className="text-xs text-muted-foreground">{assignment.funnel?.funnel_name}</div>
                            <div className="text-xs text-primary">₹{assignment.product.price?.toLocaleString('en-IN')}</div>
                          </div>
                        ) : (
                          <span className="text-sm">-</span>
                        )}
                      </TableCell>
                      {idx === 0 ? (
                        <TableCell rowSpan={group.assignments.length}>
                          <div className="text-sm">{lead.assigned_to?.full_name || "-"}</div>
                        </TableCell>
                      ) : null}
                      {idx === 0 ? (
                        <TableCell rowSpan={group.assignments.length}>
                          <div className="text-sm">
                            {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}
                          </div>
                        </TableCell>
                      ) : null}
                      {idx === 0 ? (
                        <TableCell rowSpan={group.assignments.length}>
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                            ACTIVE
                          </Badge>
                        </TableCell>
                      ) : null}
                      {idx === 0 ? (
                        <TableCell rowSpan={group.assignments.length}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-background border shadow-lg z-50">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  setEditingLead(lead);
                                  // Load existing assignments
                                  const workshopIds = group.assignments
                                    .filter((a: any) => a.workshop_id)
                                    .map((a: any) => a.workshop_id);
                                  const productIds = group.assignments
                                    .filter((a: any) => a.product_id)
                                    .map((a: any) => a.product_id);
                                  setSelectedWorkshops(workshopIds);
                                  setSelectedProducts(productIds);
                                  setConnectWorkshopFunnel(group.assignments.some((a: any) => a.is_connected));
                                  setIsOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit details
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="cursor-pointer">
                                  <Users className="mr-2 h-4 w-4" />
                                  Assign affiliate
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="bg-background border shadow-lg z-50">
                                  {profiles?.map((profile) => (
                                    <DropdownMenuItem
                                      key={profile.id}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        assignMutation.mutate({
                                          leadId: lead.id,
                                          assignedTo: profile.id,
                                        });
                                      }}
                                    >
                                      {profile.full_name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 cursor-pointer"
                                onClick={() => deleteMutation.mutate(lead.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete customer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {!isLoading && groupedAssignmentsArray.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, groupedAssignmentsArray.length)} of {groupedAssignmentsArray.length} customers
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? "Edit Customer Details" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Customer Name</Label>
                  <Input
                    id="contact_name"
                    name="contact_name"
                    defaultValue={editingLead?.contact_name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    defaultValue={editingLead?.country}
                    placeholder="e.g., INDIA, USA"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingLead?.email}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={editingLead?.phone}
                    placeholder="+91-9876543210"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  defaultValue={editingLead?.company_name}
                />
              </div>
              <div className="space-y-3 border-t pt-4">
                <Label>Workshops & Products</Label>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Select Workshops</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                    {workshops?.map((workshop) => (
                      <div key={workshop.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`workshop-${workshop.id}`}
                          checked={selectedWorkshops.includes(workshop.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedWorkshops([...selectedWorkshops, workshop.id]);
                            } else {
                              setSelectedWorkshops(selectedWorkshops.filter(id => id !== workshop.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`workshop-${workshop.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {workshop.title}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Select Products</Label>
                  <div className="space-y-3 max-h-64 overflow-y-auto p-2 border rounded-md">
                    {funnels?.map((funnel) => {
                      const funnelProducts = products?.filter(p => p.funnel_id === funnel.id);
                      if (!funnelProducts || funnelProducts.length === 0) return null;
                      return (
                        <div key={funnel.id} className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {funnel.funnel_name}
                          </div>
                          <div className="grid grid-cols-2 gap-2 pl-2">
                            {funnelProducts.map((product) => (
                              <div key={product.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`product-${product.id}`}
                                  checked={selectedProducts.includes(product.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedProducts([...selectedProducts, product.id]);
                                    } else {
                                      setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`product-${product.id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {product.product_name} <span className="text-xs text-muted-foreground">(₹{product.price?.toLocaleString('en-IN')})</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="connect"
                    checked={connectWorkshopFunnel}
                    onCheckedChange={(checked) => setConnectWorkshopFunnel(checked as boolean)}
                  />
                  <Label htmlFor="connect" className="text-sm cursor-pointer">
                    Connect first workshop with first product (e.g., Free Workshop + Free Product)
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Select name="assigned_to" defaultValue={editingLead?.assigned_to || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a closer" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Value (₹)</Label>
                  <Input
                    id="value"
                    name="value"
                    type="number"
                    step="0.01"
                    defaultValue={editingLead?.value}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editingLead?.status || "new"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingLead?.notes}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">
                {editingLead ? "Update" : "Create"} Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
