import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { formatInOrgTime, getTimezoneAbbreviation } from "@/lib/timezoneUtils";
import { toast } from "sonner";

interface WorkshopFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingWorkshop: any;
  setEditingWorkshop: (workshop: any) => void;
  isManager: boolean;
  leads: any[] | undefined;
  funnels: any[] | undefined;
  funnelsLoading: boolean;
  products: any[] | undefined;
  productsLoading: boolean;
  tags: any[] | undefined;
  tagsLoading: boolean;
  currentOrganization: any;
  createMutation: any;
  updateMutation: any;
  createFunnelMutation: any;
  createProductMutation: any;
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    editingWorkshop: any,
    selectedTagId: string | null,
    callbacks: { onSuccess: () => void }
  ) => void;
  queryClient: any;
}

export default function WorkshopFormDialog({
  isOpen,
  onOpenChange,
  editingWorkshop,
  setEditingWorkshop,
  isManager,
  leads,
  funnels,
  funnelsLoading,
  products,
  productsLoading,
  tags,
  tagsLoading,
  currentOrganization,
  createMutation,
  updateMutation,
  createFunnelMutation,
  createProductMutation,
  handleSubmit,
  queryClient,
}: WorkshopFormDialogProps) {
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Sync selectedFunnelId and selectedTagId when editingWorkshop changes
  useEffect(() => {
    setSelectedFunnelId(editingWorkshop?.funnel_id || null);
    setSelectedTagId(editingWorkshop?.tag_id || null);
  }, [editingWorkshop]);

  if (isManager) return null;

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e, editingWorkshop, selectedTagId, {
      onSuccess: () => {
        onOpenChange(false);
        setEditingWorkshop(null);
      },
    });
  };

  const onCreateFunnel = async () => {
    const newFunnel = await createFunnelMutation.mutateAsync(editingWorkshop);
    // Update the workshop with the new funnel_id
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase
      .from("workshops")
      .update({ funnel_id: newFunnel.id })
      .eq("id", editingWorkshop.id);
    queryClient.invalidateQueries({ queryKey: ["workshops"] });
    queryClient.invalidateQueries({ queryKey: ["funnels-list"] });
    toast.success("Funnel created and linked to workshop!");
    setEditingWorkshop({ ...editingWorkshop, funnel_id: newFunnel.id });
    setSelectedFunnelId(newFunnel.id);
  };

  const onCreateProduct = async () => {
    const newProduct = await createProductMutation.mutateAsync({
      workshopTitle: editingWorkshop.title,
      funnelId: selectedFunnelId!,
    });
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase
      .from("workshops")
      .update({ product_id: newProduct.id })
      .eq("id", editingWorkshop.id);
    queryClient.invalidateQueries({ queryKey: ["workshops"] });
    queryClient.invalidateQueries({ queryKey: ["products-list"] });
    toast.success("Product created and linked to workshop!");
    setEditingWorkshop({ ...editingWorkshop, product_id: newProduct.id });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={() => setEditingWorkshop(null)} className="w-full sm:w-auto h-11 sm:h-10">
          <Plus className="mr-2 h-4 w-4" />
          Add Workshop
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{editingWorkshop ? "Edit Workshop" : "Add New Workshop"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onFormSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={editingWorkshop?.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={editingWorkshop?.description} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">
                  Start Date & Time{" "}
                  <span className="text-muted-foreground text-xs">
                    ({getTimezoneAbbreviation(currentOrganization?.timezone || 'Asia/Kolkata')})
                  </span>
                </Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="datetime-local"
                  defaultValue={editingWorkshop?.start_date 
                    ? formatInOrgTime(editingWorkshop.start_date, currentOrganization?.timezone || 'Asia/Kolkata', "yyyy-MM-dd'T'HH:mm") 
                    : ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">
                  End Date & Time{" "}
                  <span className="text-muted-foreground text-xs">
                    ({getTimezoneAbbreviation(currentOrganization?.timezone || 'Asia/Kolkata')})
                  </span>
                </Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="datetime-local"
                  defaultValue={editingWorkshop?.end_date 
                    ? formatInOrgTime(editingWorkshop.end_date, currentOrganization?.timezone || 'Asia/Kolkata', "yyyy-MM-dd'T'HH:mm") 
                    : ""}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" defaultValue={editingWorkshop?.location} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_participants">Max Participants</Label>
                <Input id="max_participants" name="max_participants" type="number" defaultValue={editingWorkshop?.max_participants} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ad_spend">Ad Spend (₹)</Label>
                <Input id="ad_spend" name="ad_spend" type="number" step="0.01" defaultValue={editingWorkshop?.ad_spend || 0} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" defaultValue={editingWorkshop?.amount || 0} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="funnel_id">Associated Funnel</Label>
                <Select 
                  name="funnel_id" 
                  value={selectedFunnelId ?? "none"}
                  onValueChange={(value) => setSelectedFunnelId(value === "none" ? null : value)}
                  disabled={funnelsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={funnelsLoading ? "Loading..." : "Select a funnel"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {funnels && funnels.length > 0 ? (
                      funnels.map((funnel) => (
                        <SelectItem key={funnel.id} value={funnel.id}>
                          {funnel.funnel_name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="py-3 px-2 text-center text-sm text-muted-foreground">
                        No funnels available. Create one in the Funnels page first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_id">Associated Product</Label>
                <Select 
                  name="product_id" 
                  defaultValue={editingWorkshop?.product_id ?? undefined}
                  disabled={productsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={productsLoading ? "Loading..." : "Select a product"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {products && products.length > 0 ? (
                      products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.product_name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="py-3 px-2 text-center text-sm text-muted-foreground">
                        No products available. Create one in the Products page first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
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
                <Label htmlFor="tag_id">Tag (Optional)</Label>
                <Select 
                  name="tag_id" 
                  value={selectedTagId ?? "none"}
                  onValueChange={(value) => setSelectedTagId(value === "none" ? null : value)}
                  disabled={tagsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tagsLoading ? "Loading..." : "Select a tag"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {tags && tags.length > 0 ? (
                      tags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <span 
                              className="h-2 w-2 rounded-full" 
                              style={{ backgroundColor: tag.color || '#8B5CF6' }} 
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="py-3 px-2 text-center text-sm text-muted-foreground">
                        No tags available. Create tags in Settings → Notifications.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead_id">Related Lead (Optional)</Label>
              <Select name="lead_id" defaultValue={editingWorkshop?.lead_id || "none"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {leads?.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {editingWorkshop && (
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium mb-3 block">Quick Actions</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCreateFunnel}
                  disabled={createFunnelMutation.isPending || editingWorkshop.funnel_id}
                >
                  {editingWorkshop.funnel_id ? "Funnel Already Linked" : "Convert Workshop to Funnel"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCreateProduct}
                  disabled={createProductMutation.isPending || !selectedFunnelId || editingWorkshop.product_id}
                >
                  {editingWorkshop.product_id ? "Product Already Linked" : "Convert Workshop to Product"}
                </Button>
              </div>
              {!selectedFunnelId && !editingWorkshop.product_id && (
                <p className="text-xs text-muted-foreground mt-2">
                  👆 Select an associated funnel above to enable product creation
                </p>
              )}
            </div>
          )}
          
          <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingWorkshop ? "Update Workshop" : "Create Workshop"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
