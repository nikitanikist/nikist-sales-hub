import React from "react";
import { Link2, MoreVertical, Edit, Calendar, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { hasIntegrationForCloser } from "@/hooks/useOrgClosers";
import { formatPhoneDisplay } from "./hooks/useLeadsData";

interface LeadsTableProps {
  paginatedAssignments: any[];
  isManager: boolean;
  salesClosers: any[] | undefined;
  integrations: any[];
  onEdit: (lead: any, assignments: any[]) => void;
  onScheduleCall: (lead: any, closer: any) => void;
  onMarkRefund: (lead: any, assignment?: any) => void;
  onUndoRefund: (assignmentId: string) => void;
  onDelete: (lead: any) => void;
}

export const LeadsTable = React.memo(function LeadsTable({
  paginatedAssignments,
  isManager,
  salesClosers,
  integrations,
  onEdit,
  onScheduleCall,
  onMarkRefund,
  onUndoRefund,
  onDelete,
}: LeadsTableProps) {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden sm:block">
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
              {!isManager && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAssignments.map((group: any) => {
              const lead = group.lead;

              if (group.assignments.length === 0) {
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{lead.contact_name}</div>
                        {(() => {
                          const { countryInfo } = formatPhoneDisplay(lead.phone, lead.country);
                          return countryInfo ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-base">{countryInfo.flag}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-muted/50 border-muted-foreground/20">
                                {countryInfo.name}
                              </Badge>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm text-blue-600">{formatPhoneDisplay(lead.phone, lead.country).display}</div>
                        <div className="text-sm text-blue-600">{lead.email}</div>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-sm text-muted-foreground">-</span></TableCell>
                    <TableCell><span className="text-sm text-muted-foreground">-</span></TableCell>
                    <TableCell><div className="text-sm">{lead.assigned_profile?.full_name || "-"}</div></TableCell>
                    <TableCell>
                      <div className="text-sm">{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">ACTIVE</Badge>
                    </TableCell>
                    {!isManager && (
                      <TableCell>
                        <ActionMenu
                          lead={lead}
                          assignment={null}
                          assignments={[]}
                          salesClosers={salesClosers}
                          integrations={integrations}
                          onEdit={onEdit}
                          onScheduleCall={onScheduleCall}
                          onMarkRefund={onMarkRefund}
                          onUndoRefund={onUndoRefund}
                          onDelete={onDelete}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              }

              return group.assignments.map((assignment: any) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{lead.contact_name}</div>
                      {(() => {
                        const { countryInfo } = formatPhoneDisplay(lead.phone, lead.country);
                        return countryInfo ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-base">{countryInfo.flag}</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-muted/50 border-muted-foreground/20">
                              {countryInfo.name}
                            </Badge>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm text-blue-600">{formatPhoneDisplay(lead.phone, lead.country).display}</div>
                      <div className="text-sm text-blue-600">{lead.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{assignment.workshop?.title || "-"}</span>
                      {assignment.is_connected && <Link2 className="h-3 w-3 text-primary" />}
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
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="text-sm">{lead.assigned_profile?.full_name || "-"}</div>
                      {lead.previous_assigned_profile?.full_name && (
                        <div className="text-xs text-muted-foreground">
                          Previously: {lead.previous_assigned_profile.full_name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}</div>
                  </TableCell>
                  <TableCell>
                    {assignment.is_refunded ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">REFUNDED</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">ACTIVE</Badge>
                    )}
                  </TableCell>
                  {!isManager && (
                    <TableCell>
                      <ActionMenu
                        lead={lead}
                        assignment={assignment}
                        assignments={group.assignments}
                        salesClosers={salesClosers}
                        integrations={integrations}
                        onEdit={onEdit}
                        onScheduleCall={onScheduleCall}
                        onMarkRefund={onMarkRefund}
                        onUndoRefund={onUndoRefund}
                        onDelete={onDelete}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3 p-4">
        {paginatedAssignments.map((group: any) => {
          const lead = group.lead;

          if (group.assignments.length === 0) {
            return (
              <div key={lead.id} className="p-4 rounded-lg border bg-card space-y-2">
                <div className="flex justify-between items-start">
                  <div className="font-medium">{lead.contact_name}</div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">ACTIVE</Badge>
                </div>
                <div className="text-xs text-blue-600 space-y-0.5">
                  {lead.email && <div className="truncate">{lead.email}</div>}
                  {lead.phone && <div>{formatPhoneDisplay(lead.phone, lead.country).display}</div>}
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                  <span>{lead.assigned_profile?.full_name || "-"}</span>
                  <span>{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}</span>
                </div>
              </div>
            );
          }

          return group.assignments.map((assignment: any) => (
            <div key={assignment.id} className="p-4 rounded-lg border bg-card space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{lead.contact_name}</div>
                  {assignment.workshop?.title && (
                    <div className="text-xs text-muted-foreground truncate">{assignment.workshop.title}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {assignment.is_refunded ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs">REFUNDED</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">ACTIVE</Badge>
                  )}
                  {!isManager && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-background border shadow-lg z-50">
                        <DropdownMenuItem
                          className="cursor-pointer text-sm"
                          onClick={() => onEdit(lead, group.assignments)}
                        >
                          <Edit className="mr-2 h-3 w-3" />
                          Edit
                        </DropdownMenuItem>
                        {!assignment.is_refunded && !assignment.id?.startsWith('consolidated-') && (
                          <DropdownMenuItem
                            className="text-amber-600 cursor-pointer text-sm"
                            onClick={() => onMarkRefund(lead, assignment)}
                          >
                            <RotateCcw className="mr-2 h-3 w-3" />
                            Mark Refund
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <div className="text-xs text-blue-600 space-y-0.5">
                {lead.email && <div className="truncate">{lead.email}</div>}
                {lead.phone && <div>{formatPhoneDisplay(lead.phone, lead.country).display}</div>}
              </div>
              {assignment.product && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{assignment.product.product_name}</span>
                  <span className="font-medium text-primary">₹{assignment.product.price?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t">
                <span>{lead.assigned_profile?.full_name || "-"}</span>
                <span>{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}</span>
              </div>
            </div>
          ));
        })}
      </div>
    </>
  );
});

// --- Action Menu (extracted to reduce duplication) ---

interface ActionMenuProps {
  lead: any;
  assignment: any | null;
  assignments: any[];
  salesClosers: any[] | undefined;
  integrations: any[];
  onEdit: (lead: any, assignments: any[]) => void;
  onScheduleCall: (lead: any, closer: any) => void;
  onMarkRefund: (lead: any, assignment?: any) => void;
  onUndoRefund: (assignmentId: string) => void;
  onDelete: (lead: any) => void;
}

function ActionMenu({ lead, assignment, assignments, salesClosers, integrations, onEdit, onScheduleCall, onMarkRefund, onUndoRefund, onDelete }: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-background border shadow-lg z-50">
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onEdit(lead, assignments)}
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Call
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-background border shadow-lg z-50">
            {salesClosers?.map((closer: any) => {
              const hasSchedulingIntegration =
                hasIntegrationForCloser(integrations, closer.email, 'zoom') ||
                hasIntegrationForCloser(integrations, closer.email, 'calendly');
              return (
                <DropdownMenuItem
                  key={closer.id}
                  className={hasSchedulingIntegration ? "cursor-pointer" : "cursor-not-allowed opacity-50"}
                  disabled={!hasSchedulingIntegration}
                  onClick={() => {
                    if (!hasSchedulingIntegration) return;
                    onScheduleCall(lead, closer);
                  }}
                >
                  <span className="flex items-center gap-2">
                    {closer.full_name}
                    {!hasSchedulingIntegration && <span className="text-xs text-muted-foreground">(No integration)</span>}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {assignment && !assignment.is_refunded && !assignment.id?.startsWith('consolidated-') ? (
          <DropdownMenuItem
            className="text-amber-600 cursor-pointer"
            onClick={() => onMarkRefund(lead, assignment)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Mark as Refund
          </DropdownMenuItem>
        ) : assignment && assignment.is_refunded && !assignment.id?.startsWith('consolidated-') ? (
          <DropdownMenuItem
            className="text-green-600 cursor-pointer"
            onClick={() => onUndoRefund(assignment.id)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Undo Refund
          </DropdownMenuItem>
        ) : !assignment ? (
          <DropdownMenuItem
            className="text-amber-600 cursor-pointer"
            onClick={() => onMarkRefund(lead)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Mark as Refund
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 cursor-pointer"
          onClick={() => onDelete(lead)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete customer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
