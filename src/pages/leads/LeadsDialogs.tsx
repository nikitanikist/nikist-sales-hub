import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

// --- Edit/Create Customer Dialog ---

interface EditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingLead: any;
  workshops: any[] | undefined;
  products: any[] | undefined;
  funnels: any[] | undefined;
  profiles: any[] | undefined;
  selectedWorkshops: string[];
  setSelectedWorkshops: (v: string[]) => void;
  selectedProducts: string[];
  setSelectedProducts: (v: string[]) => void;
  connectWorkshopFunnel: boolean;
  setConnectWorkshopFunnel: (v: boolean) => void;
  selectedConvertedFromWorkshop: string | null;
  setSelectedConvertedFromWorkshop: (v: string | null) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
}

export function EditCustomerDialog({
  isOpen, onOpenChange, editingLead, workshops, products, funnels, profiles,
  selectedWorkshops, setSelectedWorkshops, selectedProducts, setSelectedProducts,
  connectWorkshopFunnel, setConnectWorkshopFunnel,
  selectedConvertedFromWorkshop, setSelectedConvertedFromWorkshop,
  onSubmit, isPending,
}: EditDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{editingLead ? "Edit Customer Details" : "Add New Customer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Customer Name <span className="text-destructive">*</span></Label>
                <Input id="contact_name" name="contact_name" defaultValue={editingLead?.contact_name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" defaultValue={editingLead?.country} placeholder="e.g., INDIA, USA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input id="email" name="email" type="email" defaultValue={editingLead?.email} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={editingLead?.phone} placeholder="+91-9876543210" />
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <Label>Workshops & Products</Label>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Select Workshops</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                  {workshops && workshops.length > 0 ? (
                    workshops.map((workshop) => (
                      <div key={workshop.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`workshop-${workshop.id}`}
                          checked={selectedWorkshops.includes(workshop.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedWorkshops([...selectedWorkshops, workshop.id]);
                            else setSelectedWorkshops(selectedWorkshops.filter(id => id !== workshop.id));
                          }}
                        />
                        <label htmlFor={`workshop-${workshop.id}`} className="text-sm cursor-pointer">{workshop.title}</label>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-4 text-center text-muted-foreground">
                      <p className="text-sm">No workshops created yet</p>
                      <Link to="/workshops" onClick={() => onOpenChange(false)} className="text-sm text-primary hover:underline mt-1 inline-block">
                        Go to Workshops to create one →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Select Products</Label>
                <div className="space-y-3 max-h-64 overflow-y-auto p-2 border rounded-md">
                  {products && products.length > 0 ? (
                    funnels?.map((funnel) => {
                      const funnelProducts = products?.filter((p: any) => p.funnel_id === funnel.id);
                      if (!funnelProducts || funnelProducts.length === 0) return null;
                      return (
                        <div key={funnel.id} className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{funnel.funnel_name}</div>
                          <div className="grid grid-cols-2 gap-2 pl-2">
                            {funnelProducts.map((product: any) => (
                              <div key={product.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`product-${product.id}`}
                                  checked={selectedProducts.includes(product.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) setSelectedProducts([...selectedProducts, product.id]);
                                    else setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                                  }}
                                />
                                <label htmlFor={`product-${product.id}`} className="text-sm cursor-pointer">
                                  {product.product_name} <span className="text-xs text-muted-foreground">(₹{product.price?.toLocaleString('en-IN')})</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-muted-foreground">
                      <p className="text-sm">No products created yet</p>
                      <p className="text-xs mt-1">Create a funnel first, then add products.</p>
                      <Link to="/funnels" onClick={() => onOpenChange(false)} className="text-sm text-primary hover:underline mt-1 inline-block">
                        Go to Funnels to get started →
                      </Link>
                    </div>
                  )}
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
              {selectedProducts.length > 0 && selectedWorkshops.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label className="text-sm">Sale From Workshop (Revenue Attribution)</Label>
                  <Select
                    value={selectedConvertedFromWorkshop || "auto"}
                    onValueChange={(value) => setSelectedConvertedFromWorkshop(value === "auto" ? null : value)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select workshop for revenue credit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Earliest Workshop)</SelectItem>
                      {workshops?.filter(w => selectedWorkshops.includes(w.id))
                        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                        .map((workshop) => (
                          <SelectItem key={workshop.id} value={workshop.id}>
                            {workshop.title} ({new Date(workshop.start_date).toLocaleDateString()})
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This workshop will receive the revenue credit for this sale. Useful for rejoin tracking.
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To</Label>
                <Select name="assigned_to" defaultValue={editingLead?.assigned_to || "none"}>
                  <SelectTrigger><SelectValue placeholder="Select a closer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>{profile.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value (₹)</Label>
                <Input id="value" name="value" type="number" step="0.01" defaultValue={editingLead?.value} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={editingLead?.status || "new"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Textarea id="notes" name="notes" defaultValue={editingLead?.notes} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingLead ? "Update Customer" : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Refund Dialog ---

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refundMode: 'appointment' | 'assignment';
  selectedLeadForRefund: any;
  leadAppointments: any[];
  selectedAppointmentForRefund: any;
  setSelectedAppointmentForRefund: (v: any) => void;
  leadAssignmentsForRefund: any[];
  selectedAssignmentForRefund: any;
  setSelectedAssignmentForRefund: (v: any) => void;
  refundReason: string;
  setRefundReason: (v: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function RefundDialog({
  open, onOpenChange, refundMode, selectedLeadForRefund,
  leadAppointments, selectedAppointmentForRefund, setSelectedAppointmentForRefund,
  leadAssignmentsForRefund, selectedAssignmentForRefund, setSelectedAssignmentForRefund,
  refundReason, setRefundReason, onConfirm, isPending,
}: RefundDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Refunded</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            You are about to mark {refundMode === 'appointment' ? 'a call' : 'an assignment'} for{' '}
            <span className="font-medium text-foreground">{selectedLeadForRefund?.contact_name}</span> as refunded.
          </div>

          {refundMode === 'appointment' && leadAppointments.length > 1 && (
            <div className="space-y-2">
              <Label>Select Appointment</Label>
              <Select
                value={selectedAppointmentForRefund?.id || ""}
                onValueChange={(value) => {
                  const apt = leadAppointments.find(a => a.id === value);
                  setSelectedAppointmentForRefund(apt);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select an appointment to refund" /></SelectTrigger>
                <SelectContent>
                  {leadAppointments.map((apt) => (
                    <SelectItem key={apt.id} value={apt.id}>
                      {apt.scheduled_date ? new Date(apt.scheduled_date).toLocaleDateString() : "No date"} - {apt.scheduled_time || "No time"} ({apt.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {refundMode === 'appointment' && leadAppointments.length === 1 && selectedAppointmentForRefund && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <div><span className="font-medium">Date:</span> {selectedAppointmentForRefund.scheduled_date ? new Date(selectedAppointmentForRefund.scheduled_date).toLocaleDateString() : "No date"}</div>
              <div><span className="font-medium">Time:</span> {selectedAppointmentForRefund.scheduled_time || "No time"}</div>
              <div><span className="font-medium">Status:</span> {selectedAppointmentForRefund.status}</div>
            </div>
          )}

          {refundMode === 'assignment' && leadAssignmentsForRefund.length > 1 && (
            <div className="space-y-2">
              <Label>Select Assignment to Refund</Label>
              <Select
                value={selectedAssignmentForRefund?.id || ""}
                onValueChange={(value) => {
                  const assignment = leadAssignmentsForRefund.find(a => a.id === value);
                  setSelectedAssignmentForRefund(assignment);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select an assignment to refund" /></SelectTrigger>
                <SelectContent>
                  {leadAssignmentsForRefund.map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.id}>
                      {assignment.workshop?.title || assignment.product?.product_name || "Unknown"}
                      {assignment.product?.price ? ` - ₹${assignment.product.price}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {refundMode === 'assignment' && leadAssignmentsForRefund.length === 1 && selectedAssignmentForRefund && (
            <div className="p-3 bg-muted rounded-md text-sm">
              {selectedAssignmentForRefund.workshop && (
                <div><span className="font-medium">Workshop:</span> {selectedAssignmentForRefund.workshop.title}</div>
              )}
              {selectedAssignmentForRefund.product && (
                <>
                  <div><span className="font-medium">Product:</span> {selectedAssignmentForRefund.product.product_name}</div>
                  <div><span className="font-medium">Price:</span> ₹{selectedAssignmentForRefund.product.price}</div>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Refund Reason <span className="text-red-500">*</span></Label>
            <Textarea
              id="refund-reason"
              placeholder="Enter the reason for refund..."
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={
              isPending ||
              !refundReason.trim() ||
              (refundMode === 'appointment' && !selectedAppointmentForRefund) ||
              (refundMode === 'assignment' && !selectedAssignmentForRefund)
            }
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isPending ? "Processing..." : "Confirm Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
