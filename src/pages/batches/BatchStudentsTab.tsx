import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Loader2, Search, Download, ChevronDown, ChevronRight, IndianRupee, Filter, X, MoreHorizontal, RefreshCcw, FileText, Pencil, HandCoins, Calendar, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Batch, BatchStudent, EmiPayment } from "./hooks/useBatchesData";
import { CLASSES_ACCESS_LABELS } from "./hooks/useBatchesData";

interface BatchStudentsTabProps {
  // Role flags
  isAdmin: boolean;
  isManager: boolean;
  isCloser: boolean;
  // Data
  batchStudents: BatchStudent[] | undefined;
  filteredStudents: BatchStudent[];
  studentEmiPayments: EmiPayment[] | undefined;
  emiLoading: boolean;
  selectedBatch: Batch;
  batches: Batch[] | undefined;
  // Filter state
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
  selectedClosers: string[];
  selectedClasses: string[];
  dateFrom: Date | undefined;
  setDateFrom: (d: Date | undefined) => void;
  dateTo: Date | undefined;
  setDateTo: (d: Date | undefined) => void;
  paymentTypeFilter: "all" | "initial" | "emi";
  setPaymentTypeFilter: (f: "all" | "initial" | "emi") => void;
  isDateFromOpen: boolean;
  setIsDateFromOpen: (open: boolean) => void;
  isDateToOpen: boolean;
  setIsDateToOpen: (open: boolean) => void;
  uniqueClosers: { id: string; name: string }[];
  uniqueClasses: number[];
  activeFilterCount: number;
  clearAllFilters: () => void;
  toggleCloser: (id: string) => void;
  toggleClass: (classNum: string) => void;
  handleExportStudents: () => void;
  // Summary data
  allStudentsTotals: any;
  closerBreakdown: any[];
  totals: any;
  todayFollowUpCount: number;
  // Filter toggle state
  filterTodayFollowUp: boolean;
  setFilterTodayFollowUp: (v: boolean) => void;
  filterRefunded: boolean;
  setFilterRefunded: (v: boolean) => void;
  filterDiscontinued: boolean;
  setFilterDiscontinued: (v: boolean) => void;
  filterFullPayment: boolean;
  setFilterFullPayment: (v: boolean) => void;
  filterRemaining: boolean;
  setFilterRemaining: (v: boolean) => void;
  filterPAE: boolean;
  setFilterPAE: (v: boolean) => void;
  // Expanded state
  expandedStudentId: string | null;
  toggleStudentExpand: (id: string) => void;
  studentsLoading: boolean;
  // Handlers
  onEditStudent: (student: BatchStudent) => void;
  onRefundStudent: (student: BatchStudent) => void;
  onDiscontinueStudent: (student: BatchStudent) => void;
  onNotesStudent: (student: BatchStudent) => void;
  onViewNotesStudent: (student: BatchStudent) => void;
  onEmiStudent: (student: BatchStudent) => void;
  onDeleteStudent: (student: BatchStudent) => void;
}

const BatchStudentsTab = React.memo<BatchStudentsTabProps>(({
  isAdmin, isManager, isCloser,
  batchStudents, filteredStudents, studentEmiPayments, emiLoading,
  selectedBatch, batches,
  searchQuery, setSearchQuery,
  isFilterOpen, setIsFilterOpen,
  selectedClosers, selectedClasses,
  dateFrom, setDateFrom, dateTo, setDateTo,
  paymentTypeFilter, setPaymentTypeFilter,
  isDateFromOpen, setIsDateFromOpen, isDateToOpen, setIsDateToOpen,
  uniqueClosers, uniqueClasses,
  activeFilterCount, clearAllFilters, toggleCloser, toggleClass,
  handleExportStudents,
  allStudentsTotals, closerBreakdown, totals, todayFollowUpCount,
  filterTodayFollowUp, setFilterTodayFollowUp,
  filterRefunded, setFilterRefunded,
  filterDiscontinued, setFilterDiscontinued,
  filterFullPayment, setFilterFullPayment,
  filterRemaining, setFilterRemaining,
  filterPAE, setFilterPAE,
  expandedStudentId, toggleStudentExpand, studentsLoading,
  onEditStudent, onRefundStudent, onDiscontinueStudent,
  onNotesStudent, onViewNotesStudent, onEmiStudent, onDeleteStudent,
}) => {
  return (
    <>
      {!isManager && (
        <>
          {paymentTypeFilter === "emi" ? (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                <div className="p-4 flex flex-col justify-center bg-purple-50">
                  <p className="text-sm text-muted-foreground">EMI Collected</p>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-700 break-words">
                    ₹{totals.emiCollected.toLocaleString('en-IN')}
                  </div>
                  {(dateFrom || dateTo) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {dateFrom && dateTo 
                        ? `${format(dateFrom, "dd MMM")} - ${format(dateTo, "dd MMM yyyy")}`
                        : dateFrom 
                          ? `From ${format(dateFrom, "dd MMM yyyy")}`
                          : `Until ${format(dateTo!, "dd MMM yyyy")}`
                      }
                    </p>
                  )}
                </div>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs text-muted-foreground font-medium">By Closer</p>
                  {closerBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No EMI data</p>
                  ) : (
                    closerBreakdown.map((closer, idx) => (
                      <div key={closer.closerId} className={cn(
                        "flex justify-between items-baseline text-sm gap-2",
                        idx < closerBreakdown.length - 1 && "border-b pb-1"
                      )}>
                        <span className="truncate min-w-0 flex-1" title={closer.closerName}>{closer.closerName}</span>
                        <span className="font-medium whitespace-nowrap">
                          ₹{closer.emiCollected.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Row 1: Active Student Cards (3 columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Offered Amount Card */}
                <Card className="overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                    <div className="p-4 flex flex-col justify-center bg-blue-50">
                      <p className="text-sm text-muted-foreground">Total Offered</p>
                      <div className="text-base sm:text-lg font-bold text-blue-700 whitespace-nowrap">
                        ₹{allStudentsTotals.offered.toLocaleString('en-IN')}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {allStudentsTotals.count} students
                      </p>
                    </div>
                    <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-xs text-muted-foreground font-medium">By Closer</p>
                      {closerBreakdown.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data</p>
                      ) : (
                        closerBreakdown.map((closer, idx) => (
                          <div key={closer.closerId} className={cn(
                            "flex justify-between items-baseline text-sm gap-2",
                            idx < closerBreakdown.length - 1 && "border-b pb-1"
                          )}>
                            <span className="truncate min-w-0 flex-1" title={closer.closerName}>{closer.closerName}</span>
                            <span className="font-medium whitespace-nowrap">
                              ₹{closer.offered.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Card>

                {/* Cash Received Card */}
                <Card className="overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                    <div className="p-4 flex flex-col justify-center bg-green-50">
                      <p className="text-sm text-muted-foreground">Cash Received</p>
                      <div className="text-base sm:text-lg font-bold text-green-700 whitespace-nowrap">
                        ₹{allStudentsTotals.received.toLocaleString('en-IN')}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {allStudentsTotals.count} students
                      </p>
                    </div>
                    <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-xs text-muted-foreground font-medium">By Closer</p>
                      {closerBreakdown.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data</p>
                      ) : (
                        closerBreakdown.map((closer, idx) => (
                          <div key={closer.closerId} className={cn(
                            "flex justify-between items-baseline text-sm gap-2",
                            idx < closerBreakdown.length - 1 && "border-b pb-1"
                          )}>
                            <span className="truncate min-w-0 flex-1" title={closer.closerName}>{closer.closerName}</span>
                            <span className="font-medium whitespace-nowrap">
                              ₹{closer.received.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Card>

                {/* Remaining Amount Card */}
                <Card 
                  className={cn(
                    "overflow-hidden cursor-pointer transition-all hover:shadow-md",
                    filterRemaining && "ring-2 ring-orange-500"
                  )}
                  onClick={() => {
                    if (filterRemaining) {
                      setFilterRemaining(false);
                    } else {
                      setFilterRemaining(true);
                      setFilterRefunded(false);
                      setFilterDiscontinued(false);
                      setFilterTodayFollowUp(false);
                      setFilterFullPayment(false);
                    }
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                    <div className="p-4 flex flex-col justify-center bg-orange-50">
                      <p className="text-sm text-muted-foreground">Remaining Amount</p>
                      <div className="text-base sm:text-lg font-bold text-orange-700 whitespace-nowrap">
                        ₹{allStudentsTotals.due.toLocaleString('en-IN')}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {allStudentsTotals.duePaymentCount} students
                      </p>
                      {filterRemaining && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 mt-2 w-fit">
                          Filter Active
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-xs text-muted-foreground font-medium">By Closer</p>
                      {closerBreakdown.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data</p>
                      ) : (
                        closerBreakdown.map((closer, idx) => (
                          <div key={closer.closerId} className={cn(
                            "flex justify-between items-baseline text-sm gap-2",
                            idx < closerBreakdown.length - 1 && "border-b pb-1"
                          )}>
                            <span className="truncate min-w-0 flex-1" title={closer.closerName}>{closer.closerName}</span>
                            <span className="font-medium whitespace-nowrap">
                              ₹{closer.due.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Row 2: Refunded, Discontinued, Full Payment, Today's Follow-up, PAE */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Refunded Card */}
                <Card 
                  className={cn("overflow-hidden cursor-pointer transition-all hover:shadow-md", filterRefunded && "ring-2 ring-amber-500")}
                  onClick={() => {
                    if (filterRefunded) { setFilterRefunded(false); } 
                    else { setFilterRefunded(true); setFilterDiscontinued(false); setFilterTodayFollowUp(false); setFilterFullPayment(false); setFilterRemaining(false); }
                  }}
                >
                  <div className="p-4 bg-amber-50 h-full">
                    <p className="text-sm text-muted-foreground">Refunded</p>
                    <div className="text-xl font-bold text-amber-700">₹{allStudentsTotals.refundedReceived.toLocaleString('en-IN')}</div>
                    <p className="text-xs text-muted-foreground mt-1">{allStudentsTotals.refundedCount} students</p>
                    {filterRefunded && <Badge variant="secondary" className="bg-amber-100 text-amber-700 mt-2 w-fit">Filter Active</Badge>}
                  </div>
                </Card>

                {/* Discontinued Card */}
                <Card 
                  className={cn("overflow-hidden cursor-pointer transition-all hover:shadow-md", filterDiscontinued && "ring-2 ring-red-500")}
                  onClick={() => {
                    if (filterDiscontinued) { setFilterDiscontinued(false); }
                    else { setFilterDiscontinued(true); setFilterRefunded(false); setFilterTodayFollowUp(false); setFilterFullPayment(false); setFilterRemaining(false); }
                  }}
                >
                  <div className="p-4 bg-red-50 h-full">
                    <p className="text-sm text-muted-foreground">Discontinued</p>
                    <div className="text-xl font-bold text-red-700">₹{allStudentsTotals.discontinuedReceived.toLocaleString('en-IN')}</div>
                    <p className="text-xs text-muted-foreground mt-1">{allStudentsTotals.discontinuedCount} students</p>
                    {filterDiscontinued && <Badge variant="secondary" className="bg-red-100 text-red-700 mt-2 w-fit">Filter Active</Badge>}
                  </div>
                </Card>

                {/* Full Payment Card */}
                <Card 
                  className={cn("overflow-hidden cursor-pointer transition-all hover:shadow-md", filterFullPayment && "ring-2 ring-emerald-500")}
                  onClick={() => {
                    if (filterFullPayment) { setFilterFullPayment(false); }
                    else { setFilterFullPayment(true); setFilterRefunded(false); setFilterDiscontinued(false); setFilterTodayFollowUp(false); setFilterRemaining(false); }
                  }}
                >
                  <div className="p-4 bg-emerald-50 h-full">
                    <p className="text-sm text-muted-foreground">Full Payment</p>
                    <div className="text-xl font-bold text-emerald-700">{allStudentsTotals.fullPaymentCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">Students with no dues</p>
                    {filterFullPayment && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 mt-2 w-fit">Filter Active</Badge>}
                  </div>
                </Card>

                {/* Today's Follow-up Card */}
                <Card 
                  className={cn("overflow-hidden cursor-pointer transition-all hover:shadow-md", filterTodayFollowUp && "ring-2 ring-purple-500")}
                  onClick={() => {
                    if (filterTodayFollowUp) { setFilterTodayFollowUp(false); }
                    else { setFilterTodayFollowUp(true); setFilterRefunded(false); setFilterDiscontinued(false); setFilterFullPayment(false); setFilterRemaining(false); setFilterPAE(false); }
                  }}
                >
                  <div className="p-4 bg-purple-50 h-full">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Today's Follow-ups</p>
                        <div className="text-xl font-bold text-purple-700">{todayFollowUpCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Students to contact</p>
                      </div>
                      <Calendar className="h-6 w-6 text-purple-400" />
                    </div>
                    {filterTodayFollowUp && <Badge variant="secondary" className="bg-purple-100 text-purple-700 mt-2 w-fit">Filter Active</Badge>}
                  </div>
                </Card>
              </div>

              {/* PAE Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card 
                  className={cn("overflow-hidden cursor-pointer transition-all hover:shadow-md", filterPAE && "ring-2 ring-violet-500")}
                  onClick={() => {
                    if (filterPAE) { setFilterPAE(false); }
                    else { setFilterPAE(true); setFilterRefunded(false); setFilterDiscontinued(false); setFilterFullPayment(false); setFilterRemaining(false); setFilterTodayFollowUp(false); }
                  }}
                >
                  <div className="p-4 bg-violet-50 h-full">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pay After Earning</p>
                        <div className="text-xl font-bold text-violet-700">₹{allStudentsTotals.paeAmount.toLocaleString('en-IN')}</div>
                        <p className="text-xs text-muted-foreground mt-1">{allStudentsTotals.paeCount} students</p>
                      </div>
                      <HandCoins className="h-6 w-6 text-violet-400" />
                    </div>
                    {filterPAE && <Badge variant="secondary" className="bg-violet-100 text-violet-700 mt-2 w-fit">Filter Active</Badge>}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Students</CardTitle>
            <CardDescription>{filteredStudents.length} of {batchStudents?.length || 0} students</CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4 mr-1" />Clear All
              </Button>
            )}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <Filter className="h-4 w-4 mr-2" />Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">{activeFilterCount}</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="space-y-6 py-6">
                  {!isManager && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Payment Type</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="payment-all" name="paymentType" checked={paymentTypeFilter === "all"} onChange={() => setPaymentTypeFilter("all")} className="h-4 w-4" />
                          <label htmlFor="payment-all" className="text-sm cursor-pointer">All Payments</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="payment-initial" name="paymentType" checked={paymentTypeFilter === "initial"} onChange={() => setPaymentTypeFilter("initial")} className="h-4 w-4" />
                          <label htmlFor="payment-initial" className="text-sm cursor-pointer">Initial Payment Only</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="payment-emi" name="paymentType" checked={paymentTypeFilter === "emi"} onChange={() => setPaymentTypeFilter("emi")} className="h-4 w-4" />
                          <label htmlFor="payment-emi" className="text-sm cursor-pointer">EMI Only</label>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Date Range</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                              <Calendar className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, "dd MMM yyyy") : "From"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent mode="single" selected={dateFrom} onSelect={(date) => { setDateFrom(date); setIsDateFromOpen(false); }} initialFocus className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex-1">
                        <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                              <Calendar className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, "dd MMM yyyy") : "To"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent mode="single" selected={dateTo} onSelect={(date) => { setDateTo(date); setIsDateToOpen(false); }} initialFocus className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    {(dateFrom || dateTo) && (
                      <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} className="text-xs">
                        <X className="h-3 w-3 mr-1" />Clear dates
                      </Button>
                    )}
                  </div>

                  {!isCloser && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Closers</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        {uniqueClosers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No closers available</p>
                        ) : (
                          uniqueClosers.map(closer => (
                            <div key={closer.id} className="flex items-center space-x-2">
                              <Checkbox id={`closer-${closer.id}`} checked={selectedClosers.includes(closer.id)} onCheckedChange={() => toggleCloser(closer.id)} />
                              <label htmlFor={`closer-${closer.id}`} className="text-sm cursor-pointer flex-1">{closer.name}</label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Classes Access</Label>
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                      {uniqueClasses.map(classNum => (
                        <div key={classNum} className="flex items-center space-x-2">
                          <Checkbox id={`class-${classNum}`} checked={selectedClasses.includes(classNum.toString())} onCheckedChange={() => toggleClass(classNum.toString())} />
                          <label htmlFor={`class-${classNum}`} className="text-xs cursor-pointer">{CLASSES_ACCESS_LABELS[classNum] || `${classNum}`}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <SheetFooter className="flex gap-2">
                  <Button variant="outline" onClick={clearAllFilters}>Clear All</Button>
                  <Button onClick={() => setIsFilterOpen(false)}>Apply Filters</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {batchStudents && batchStudents.length > 0 && (
              <Button variant="outline" onClick={handleExportStudents}>
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
            )}
          </div>
        </CardHeader>
        
        <div className="px-6 pb-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Active:</span>
              {!isManager && paymentTypeFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {paymentTypeFilter === "emi" ? "EMI Only" : "Initial Only"}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setPaymentTypeFilter("all")} />
                </Badge>
              )}
              {(dateFrom || dateTo) && (
                <Badge variant="secondary" className="gap-1">
                  {dateFrom && dateTo ? `${format(dateFrom, "dd MMM")} - ${format(dateTo, "dd MMM")}` : dateFrom ? `From ${format(dateFrom, "dd MMM")}` : `Until ${format(dateTo!, "dd MMM")}`}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} />
                </Badge>
              )}
              {selectedClosers.map(closerId => {
                const closer = uniqueClosers.find(c => c.id === closerId);
                return closer ? (
                  <Badge key={closerId} variant="secondary" className="gap-1">
                    {closer.name}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => toggleCloser(closerId)} />
                  </Badge>
                ) : null;
              })}
              {selectedClasses.map(classNum => (
                <Badge key={classNum} variant="secondary" className="gap-1">
                  {CLASSES_ACCESS_LABELS[Number(classNum)] || `${classNum} Classes`}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggleClass(classNum)} />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 text-xs">Clear all</Button>
            </div>
          )}
        </div>
        
        <CardContent>
          {studentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !batchStudents?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No students enrolled in this batch yet</p>
            </div>
          ) : !filteredStudents.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No students match your search or filters</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isManager && <TableHead className="w-10"></TableHead>}
                    {isManager && <TableHead className="w-10"></TableHead>}
                    <TableHead>Conversion Date</TableHead>
                    <TableHead>Student Name</TableHead>
                    {!isManager && <TableHead>Offered Amount</TableHead>}
                    {!isManager && <TableHead>Cash Received</TableHead>}
                    {!isManager && <TableHead>Due Amount</TableHead>}
                    {!isCloser && <TableHead>Closer</TableHead>}
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Classes Access</TableHead>
                    <TableHead>Status</TableHead>
                    {!isManager && !isCloser && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <React.Fragment key={student.id}>
                      <TableRow 
                        className={cn(
                          "cursor-pointer",
                          expandedStudentId === student.id && "bg-muted/50",
                          student.status === "refunded" && "bg-amber-50/70",
                          student.status === "discontinued" && "bg-red-50/70"
                        )}
                        onClick={() => !isManager && toggleStudentExpand(student.id)}
                      >
                        {!isManager ? (
                          <TableCell>
                            {expandedStudentId === student.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                        ) : (
                          <TableCell></TableCell>
                        )}
                        <TableCell className="text-sm text-muted-foreground">
                          {student.scheduled_date ? format(new Date(student.scheduled_date), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {student.contact_name}
                            {student.pay_after_earning && (student.due_amount || 0) > 0 && (
                              <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">PAE</Badge>
                            )}
                            {(student.additional_comments || student.next_follow_up_date) && (
                              <FileText 
                                className="h-4 w-4 text-blue-500 cursor-pointer hover:text-blue-700 transition-colors" 
                                onClick={(e) => { e.stopPropagation(); onViewNotesStudent(student); }}
                              />
                            )}
                          </div>
                        </TableCell>
                        {!isManager && (
                          <TableCell className="text-sm font-medium">
                            {student.offer_amount ? `₹${student.offer_amount.toLocaleString('en-IN')}` : "-"}
                          </TableCell>
                        )}
                        {!isManager && (
                          <TableCell className="text-sm font-medium">
                            {student.cash_received ? `₹${student.cash_received.toLocaleString('en-IN')}` : "-"}
                          </TableCell>
                        )}
                        {!isManager && (
                          <TableCell className="text-sm font-medium text-orange-600">
                            {student.due_amount ? `₹${student.due_amount.toLocaleString('en-IN')}` : "-"}
                          </TableCell>
                        )}
                        {!isCloser && (
                          <TableCell className="text-sm text-muted-foreground">
                            {student.closer_name || <span className="italic">Added Manually</span>}
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-muted-foreground">{student.email}</TableCell>
                        <TableCell className="text-sm">{student.phone || "-"}</TableCell>
                        <TableCell>
                          {student.classes_access ? (
                            <Badge variant="outline">{CLASSES_ACCESS_LABELS[student.classes_access] || `${student.classes_access} Classes`}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            student.status === "refunded" 
                              ? "bg-amber-100 text-amber-800 border-amber-200" 
                              : student.status === "discontinued"
                                ? "bg-red-100 text-red-800 border-red-200"
                                : student.status === "converted" || student.status.startsWith("converted_")
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-slate-100 text-slate-800"
                          }>
                            {student.status.charAt(0).toUpperCase() + student.status.slice(1).replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        {!isManager && !isCloser && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditStudent(student); }}>
                                  <Edit className="h-4 w-4 mr-2" />Change Batch
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRefundStudent(student); }} disabled={student.status === "refunded" || student.status === "discontinued"}>
                                  <RefreshCcw className="h-4 w-4 mr-2" />Mark as Refunded
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDiscontinueStudent(student); }} disabled={student.status === "discontinued" || student.status === "refunded"}>
                                  <X className="h-4 w-4 mr-2" />Mark as Discontinued
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onNotesStudent(student); }}>
                                  <FileText className="h-4 w-4 mr-2" />{student.additional_comments ? "Edit Notes" : "Add Notes"}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => { e.stopPropagation(); onEmiStudent(student); }}
                                  disabled={!["converted", "converted_beginner", "converted_intermediate", "converted_advance", "booking_amount"].includes(student.status)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />Update EMI & Course Access
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteStudent(student); }} className="text-destructive focus:text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />Delete Student
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                      {!isManager && expandedStudentId === student.id && (
                        <TableRow>
                          <TableCell colSpan={isCloser ? 10 : 12} className="bg-muted/30 p-0">
                            <div className="p-4 border-t">
                              {student.status === "refunded" && student.refund_reason && (
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                  <div className="flex items-center gap-2 mb-1">
                                    <RefreshCcw className="h-4 w-4 text-amber-600" />
                                    <span className="font-medium text-sm text-amber-800">Refund Reason</span>
                                  </div>
                                  <p className="text-sm text-amber-700 whitespace-pre-wrap">{student.refund_reason}</p>
                                </div>
                              )}
                              {student.status === "discontinued" && student.refund_reason && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                  <div className="flex items-center gap-2 mb-1">
                                    <X className="h-4 w-4 text-red-600" />
                                    <span className="font-medium text-sm text-red-800">Discontinued Reason</span>
                                  </div>
                                  <p className="text-sm text-red-700 whitespace-pre-wrap">{student.refund_reason}</p>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2 mb-3">
                                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">EMI Payment History</span>
                              </div>
                              
                              {emiLoading ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : (() => {
                                const studentEmiList = studentEmiPayments?.filter(emi => emi.appointment_id === student.id) || [];
                                const totalEmiCollected = studentEmiList.reduce((sum, emi) => sum + Number(emi.amount), 0);
                                
                                return !studentEmiList.length ? (
                                  <p className="text-sm text-muted-foreground py-2">No EMI payments recorded yet</p>
                                ) : (
                                  <div className="space-y-3">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="py-2">EMI #</TableHead>
                                          <TableHead className="py-2">Amount</TableHead>
                                          <TableHead className="py-2">Date</TableHead>
                                          <TableHead className="py-2">Classes</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {studentEmiList.map((emi) => (
                                          <TableRow key={emi.id}>
                                            <TableCell className="py-2">EMI {emi.emi_number}</TableCell>
                                            <TableCell className="py-2 font-medium">₹{Number(emi.amount).toLocaleString('en-IN')}</TableCell>
                                            <TableCell className="py-2 text-muted-foreground">{format(new Date(emi.payment_date), "dd MMM yyyy")}</TableCell>
                                            <TableCell className="py-2 text-sm text-muted-foreground">
                                              {emi.previous_classes_access && emi.new_classes_access && emi.previous_classes_access !== emi.new_classes_access
                                                ? `${CLASSES_ACCESS_LABELS[emi.previous_classes_access] || emi.previous_classes_access} → ${CLASSES_ACCESS_LABELS[emi.new_classes_access] || emi.new_classes_access}`
                                                : emi.new_classes_access ? CLASSES_ACCESS_LABELS[emi.new_classes_access] || emi.new_classes_access : "-"}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                        <TableRow className="bg-muted/50">
                                          <TableCell className="py-2 font-medium">Total</TableCell>
                                          <TableCell className="py-2 font-bold text-green-600">₹{totalEmiCollected.toLocaleString('en-IN')}</TableCell>
                                          <TableCell className="py-2"></TableCell>
                                          <TableCell className="py-2"></TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>
                                );
                              })()}
                              
                              <div className="flex items-center gap-4 pt-3 mt-3 border-t">
                                <Button 
                                  size="sm" variant="outline"
                                  onClick={(e) => { e.stopPropagation(); onEmiStudent(student); }}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />Update EMI & Course Access
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
});

BatchStudentsTab.displayName = "BatchStudentsTab";

export default BatchStudentsTab;
