import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, RefreshCw, Filter, ChevronDown, ChevronRight, Pencil, Trash2, Eye } from "lucide-react";
import { TableSkeleton, MobileCardSkeleton } from "@/components/skeletons";
import WorkshopExpandedRow from "./WorkshopExpandedRow";
import { CallCategory } from "./hooks/useWorkshopsData";

interface WorkshopTableProps {
  filteredWorkshops: any[] | undefined;
  isLoading: boolean;
  error: Error | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  expandedRows: Set<string>;
  onToggleExpand: (workshopId: string) => void;
  isManager: boolean;
  onEdit: (workshop: any) => void;
  onDelete: (workshop: any) => void;
  onRefresh: () => void;
  openCallsDialog: (workshopTitle: string, category: CallCategory) => void;
  formatOrg: (date: string, fmt: string) => string;
}

const WorkshopTable = React.memo(function WorkshopTable({
  filteredWorkshops,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
  expandedRows,
  onToggleExpand,
  isManager,
  onEdit,
  onDelete,
  onRefresh,
  openCallsDialog,
  formatOrg,
}: WorkshopTableProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg sm:text-xl">All Workshops</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Manage and track workshop performance</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={onRefresh} className="h-10 w-10 sm:h-9 sm:w-9">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workshops..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-11 sm:h-10"
          />
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {error && (
          <div className="text-center py-4 text-red-500 bg-red-50 rounded-md mb-4 text-sm">
            Error loading workshops: {error.message}
          </div>
        )}
        {isLoading ? (
          <>
            <div className="hidden sm:block">
              <TableSkeleton columns={8} rows={5} />
            </div>
            <div className="sm:hidden">
              <MobileCardSkeleton count={3} />
            </div>
          </>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Workshop Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Registrations</TableHead>
                    {!isManager && <TableHead className="text-right">Ad Spend</TableHead>}
                    <TableHead className="text-right">Workshop Sales</TableHead>
                    {!isManager && <TableHead className="text-right">P&L</TableHead>}
                    {!isManager && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkshops?.map((workshop) => {
                    const isExpanded = expandedRows.has(workshop.id);
                    
                    return (
                      <React.Fragment key={workshop.id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/workshops/${workshop.id}`)}>
                          <TableCell className="w-[40px]" onClick={(e) => { e.stopPropagation(); onToggleExpand(workshop.id); }}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div>{workshop.start_date ? formatOrg(workshop.start_date, "MMM dd, yyyy") : "N/A"}</div>
                                <div className="text-xs text-muted-foreground">{workshop.start_date ? formatOrg(workshop.start_date, "h:mm a") : ""}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{workshop.title}</TableCell>
                          <TableCell>
                            {Number(workshop.amount || 0) === 0 ? (
                              <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200">
                                Free
                              </Badge>
                            ) : (
                              <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-blue-200">
                                Paid ₹{Number(workshop.amount).toLocaleString("en-IN")}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {workshop.registration_count || 0}
                          </TableCell>
                          {!isManager && (
                            <TableCell className="text-right">
                              ₹{Number(workshop.ad_spend || 0).toLocaleString("en-IN")}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            {workshop.sales_count || 0}
                          </TableCell>
                          {!isManager && (
                            <TableCell className="text-right">
                              <span className={(workshop.total_pl || 0) >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                ₹{Number(workshop.total_pl || 0).toLocaleString("en-IN")}
                              </span>
                            </TableCell>
                          )}
                          {!isManager && (
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/workshops/${workshop.id}`)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(workshop)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(workshop)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                        
                        {/* Expanded Row with Call Statistics and Revenue */}
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={isManager ? 6 : 9} className="p-4">
                              <WorkshopExpandedRow
                                workshop={workshop}
                                isManager={isManager}
                                colSpan={isManager ? 6 : 9}
                                openCallsDialog={openCallsDialog}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {filteredWorkshops?.map((workshop) => {
                const isExpanded = expandedRows.has(workshop.id);
                return (
                  <div
                    key={workshop.id}
                    className="rounded-lg border bg-card overflow-hidden"
                  >
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => onToggleExpand(workshop.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{workshop.title}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <div>
                              {workshop.start_date ? formatOrg(workshop.start_date, "MMM dd, yyyy") : "N/A"}
                              {workshop.start_date && <span className="ml-1">• {formatOrg(workshop.start_date, "h:mm a")}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {Number(workshop.amount || 0) === 0 ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200 text-xs">
                              Free
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-blue-200 text-xs">
                              ₹{Number(workshop.amount).toLocaleString("en-IN")}
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center mt-3">
                        <div className="bg-muted/50 rounded-md p-2">
                          <div className="text-sm font-semibold">{workshop.registration_count || 0}</div>
                          <div className="text-[10px] text-muted-foreground">Registrations</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2">
                          <div className="text-sm font-semibold">{workshop.sales_count || 0}</div>
                          <div className="text-[10px] text-muted-foreground">Sales</div>
                        </div>
                        {!isManager && (
                          <div className="bg-muted/50 rounded-md p-2">
                            <div className={`text-sm font-semibold ${(workshop.total_pl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ₹{Number(workshop.total_pl || 0).toLocaleString("en-IN")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">P&L</div>
                          </div>
                        )}
                      </div>
                      
                      {!isManager && (
                        <div className="flex justify-end gap-1 mt-3 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => onEdit(workshop)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => onDelete(workshop)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Mobile Expanded Content */}
                    {isExpanded && (
                      <WorkshopExpandedRow
                        workshop={workshop}
                        isManager={isManager}
                        colSpan={0}
                        openCallsDialog={openCallsDialog}
                        isMobile
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

export default WorkshopTable;
