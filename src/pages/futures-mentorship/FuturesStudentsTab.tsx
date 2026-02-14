import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Download, ChevronDown, ChevronRight, IndianRupee, Filter, X, MoreHorizontal, RefreshCcw, FileText, Pencil, Trash2, Calendar, Loader2, HandCoins } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { FuturesStudent, FuturesEmiPayment } from "./hooks/useFuturesData";

interface FuturesStudentsTabProps {
  // Data
  batchStudents: FuturesStudent[] | undefined;
  filteredStudents: FuturesStudent[];
  studentEmiPayments: FuturesEmiPayment[] | undefined;
  studentsLoading: boolean;
  emiLoading: boolean;
  expandedStudentId: string | null;
  // Totals
  closerBreakdown: { closerId: string; closerName: string; offered: number; received: number; due: number; count: number }[];
  allStudentsTotals: {
    offered: number; received: number; due: number; count: number;
    fullPaymentCount: number; duePaymentCount: number;
    refundedCount: number; refundedReceived: number;
    discontinuedCount: number; discontinuedReceived: number;
    paeAmount: number; paeCount: number;
  };
  todayFollowUpCount: number;
  // Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
  dateFrom: Date | undefined;
  setDateFrom: (d: Date | undefined) => void;
  dateTo: Date | undefined;
  setDateTo: (d: Date | undefined) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  isDateFromOpen: boolean;
  setIsDateFromOpen: (open: boolean) => void;
  isDateToOpen: boolean;
  setIsDateToOpen: (open: boolean) => void;
  filterRefunded: boolean;
  setFilterRefunded: (v: boolean) => void;
  filterDiscontinued: boolean;
  setFilterDiscontinued: (v: boolean) => void;
  filterFullPayment: boolean;
  setFilterFullPayment: (v: boolean) => void;
  filterRemaining: boolean;
  setFilterRemaining: (v: boolean) => void;
  filterTodayFollowUp: boolean;
  setFilterTodayFollowUp: (v: boolean) => void;
  filterPAE: boolean;
  setFilterPAE: (v: boolean) => void;
  activeFilterCount: number;
  clearAllFilters: () => void;
  exportStudentsCSV: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  formatOrg: (date: string, fmt: string) => string;
  // Permissions
  isAdmin: boolean;
  // Actions
  setExpandedStudentId: (id: string | null) => void;
  setEmiStudent: (s: FuturesStudent | null) => void;
  setNotesStudent: (s: FuturesStudent | null) => void;
  setNotesText: (t: string) => void;
  setFollowUpDate: (d: Date | undefined) => void;
  setPayAfterEarning: (v: boolean) => void;
  setRefundingStudent: (s: FuturesStudent | null) => void;
  setDiscontinuingStudent: (s: FuturesStudent | null) => void;
  setDeletingStudent: (s: FuturesStudent | null) => void;
  setViewingNotesStudent: (s: FuturesStudent | null) => void;
  setAddStudentOpen: (open: boolean) => void;
}

const FuturesStudentsTab = React.memo(function FuturesStudentsTab({
  batchStudents,
  filteredStudents,
  studentEmiPayments,
  studentsLoading,
  emiLoading,
  expandedStudentId,
  closerBreakdown,
  allStudentsTotals,
  todayFollowUpCount,
  searchQuery,
  setSearchQuery,
  isFilterOpen,
  setIsFilterOpen,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  statusFilter,
  setStatusFilter,
  isDateFromOpen,
  setIsDateFromOpen,
  isDateToOpen,
  setIsDateToOpen,
  filterRefunded,
  setFilterRefunded,
  filterDiscontinued,
  setFilterDiscontinued,
  filterFullPayment,
  setFilterFullPayment,
  filterRemaining,
  setFilterRemaining,
  filterTodayFollowUp,
  setFilterTodayFollowUp,
  filterPAE,
  setFilterPAE,
  activeFilterCount,
  clearAllFilters,
  exportStudentsCSV,
  getStatusBadge,
  formatOrg,
  isAdmin,
  setExpandedStudentId,
  setEmiStudent,
  setNotesStudent,
  setNotesText,
  setFollowUpDate,
  setPayAfterEarning,
  setRefundingStudent,
  setDiscontinuingStudent,
  setDeletingStudent,
  setViewingNotesStudent,
  setAddStudentOpen,
}: FuturesStudentsTabProps) {
  return (
    <>
      {/* Row 1: Financial Cards with Closer Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Offered Card */}
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

        {/* Remaining Amount Card - Clickable filter */}
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

      {/* Row 2: Status Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Refunded Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterRefunded && "ring-2 ring-amber-500"
          )}
          onClick={() => {
            if (filterRefunded) {
              setFilterRefunded(false);
            } else {
              setFilterRefunded(true);
              setFilterDiscontinued(false);
              setFilterTodayFollowUp(false);
              setFilterFullPayment(false);
              setFilterRemaining(false);
            }
          }}
        >
          <div className="p-4 bg-amber-50 h-full">
            <p className="text-sm text-muted-foreground">Refunded</p>
            <div className="text-xl font-bold text-amber-700">
              ₹{allStudentsTotals.refundedReceived.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {allStudentsTotals.refundedCount} students
            </p>
            {filterRefunded && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>

        {/* Discontinued Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterDiscontinued && "ring-2 ring-red-500"
          )}
          onClick={() => {
            if (filterDiscontinued) {
              setFilterDiscontinued(false);
            } else {
              setFilterDiscontinued(true);
              setFilterRefunded(false);
              setFilterTodayFollowUp(false);
              setFilterFullPayment(false);
              setFilterRemaining(false);
            }
          }}
        >
          <div className="p-4 bg-red-50 h-full">
            <p className="text-sm text-muted-foreground">Discontinued</p>
            <div className="text-xl font-bold text-red-700">
              ₹{allStudentsTotals.discontinuedReceived.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {allStudentsTotals.discontinuedCount} students
            </p>
            {filterDiscontinued && (
              <Badge variant="secondary" className="bg-red-100 text-red-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>

        {/* Full Payment Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterFullPayment && "ring-2 ring-emerald-500"
          )}
          onClick={() => {
            if (filterFullPayment) {
              setFilterFullPayment(false);
            } else {
              setFilterFullPayment(true);
              setFilterRefunded(false);
              setFilterDiscontinued(false);
              setFilterTodayFollowUp(false);
              setFilterRemaining(false);
            }
          }}
        >
          <div className="p-4 bg-emerald-50 h-full">
            <p className="text-sm text-muted-foreground">Full Payment</p>
            <div className="text-xl font-bold text-emerald-700">
              {allStudentsTotals.fullPaymentCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Students with no dues
            </p>
            {filterFullPayment && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>

        {/* Today's Follow-up Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterTodayFollowUp && "ring-2 ring-purple-500"
          )}
          onClick={() => {
            if (filterTodayFollowUp) {
              setFilterTodayFollowUp(false);
            } else {
              setFilterTodayFollowUp(true);
              setFilterRefunded(false);
              setFilterDiscontinued(false);
              setFilterFullPayment(false);
              setFilterRemaining(false);
              setFilterPAE(false);
            }
          }}
        >
          <div className="p-4 bg-purple-50 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Follow-ups</p>
                <div className="text-xl font-bold text-purple-700">
                  {todayFollowUpCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  To contact today
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-300" />
            </div>
            {filterTodayFollowUp && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>

        {/* Pay After Earning Card */}
        <Card 
          className={cn(
            "overflow-hidden cursor-pointer transition-all hover:shadow-md",
            filterPAE && "ring-2 ring-violet-500"
          )}
          onClick={() => {
            if (filterPAE) {
              setFilterPAE(false);
            } else {
              setFilterPAE(true);
              setFilterRefunded(false);
              setFilterDiscontinued(false);
              setFilterFullPayment(false);
              setFilterRemaining(false);
              setFilterTodayFollowUp(false);
            }
          }}
        >
          <div className="p-4 bg-violet-50 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pay After Earning</p>
                <div className="text-xl font-bold text-violet-700">
                  ₹{allStudentsTotals.paeAmount.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {allStudentsTotals.paeCount} students
                </p>
              </div>
              <HandCoins className="h-8 w-8 text-violet-300" />
            </div>
            {filterPAE && (
              <Badge variant="secondary" className="bg-violet-100 text-violet-700 mt-2 w-fit">
                Filter Active
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Students Section */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 sm:pb-6">
          <div>
            <CardTitle className="text-lg sm:text-xl">Students</CardTitle>
            <CardDescription>{filteredStudents.length} of {batchStudents?.length || 0} students</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearAllFilters} className="h-11 sm:h-10">
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Clear All</span>
              </Button>
            )}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative h-11 sm:h-10">
                  <Filter className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 sm:ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:w-[400px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 py-6">
                  <div className="space-y-3">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-11 sm:h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                        <SelectItem value="discontinued">Discontinued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label>Date Range</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("flex-1 justify-start h-11 sm:h-10", !dateFrom && "text-muted-foreground")}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateFrom ? format(dateFrom, "dd MMM yyyy") : "From"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={dateFrom}
                            onSelect={(d) => { setDateFrom(d); setIsDateFromOpen(false); }}
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("flex-1 justify-start h-11 sm:h-10", !dateTo && "text-muted-foreground")}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateTo ? format(dateTo, "dd MMM yyyy") : "To"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={dateTo}
                            onSelect={(d) => { setDateTo(d); setIsDateToOpen(false); }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                <SheetFooter className="flex-row gap-2">
                  <Button variant="outline" onClick={clearAllFilters} className="flex-1 h-11 sm:h-10">Clear All</Button>
                  <Button onClick={() => setIsFilterOpen(false)} className="flex-1 h-11 sm:h-10">Apply</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Button variant="outline" onClick={exportStudentsCSV} className="h-11 sm:h-10">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button onClick={() => setAddStudentOpen(true)} className="h-11 sm:h-10">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Student</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="mb-4">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-11 sm:h-10"
              />
            </div>
          </div>
          
          {studentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Conversion Date</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Amount Offered</TableHead>
                      <TableHead>Cash Received</TableHead>
                      <TableHead>Due Amount</TableHead>
                      <TableHead>Closer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No students found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => (
                        <React.Fragment key={student.id}>
                          <TableRow 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                          >
                            <TableCell>
                              {expandedStudentId === student.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell>{formatOrg(student.conversion_date, "dd MMM yyyy")}</TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {student.contact_name}
                                {student.pay_after_earning && (student.due_amount || 0) > 0 && (
                                  <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                                    PAE
                                  </Badge>
                                )}
                                {(student.notes || student.next_follow_up_date) && (
                                  <FileText 
                                    className="h-4 w-4 text-blue-500 cursor-pointer hover:text-blue-700 transition-colors" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingNotesStudent(student);
                                    }}
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>₹{student.offer_amount.toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-green-600">₹{student.cash_received.toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-orange-600">₹{student.due_amount.toLocaleString('en-IN')}</TableCell>
                            <TableCell>{student.closer_name || "Added Manually"}</TableCell>
                            <TableCell>{getStatusBadge(student.status)}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEmiStudent(student)}>
                                    <IndianRupee className="h-4 w-4 mr-2" />
                                    Update EMI
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setNotesStudent(student);
                                    setNotesText(student.notes || "");
                                    setFollowUpDate(student.next_follow_up_date ? new Date(student.next_follow_up_date) : undefined);
                                    setPayAfterEarning(student.pay_after_earning || false);
                                  }}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Edit Notes
                                  </DropdownMenuItem>
                                  {student.status === "active" && (
                                    <>
                                      <DropdownMenuItem onClick={() => setRefundingStudent(student)}>
                                        <RefreshCcw className="h-4 w-4 mr-2" />
                                        Mark as Refunded
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setDiscontinuingStudent(student)}>
                                        <X className="h-4 w-4 mr-2" />
                                        Discontinued
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {isAdmin && (
                                    <DropdownMenuItem 
                                      onClick={() => setDeletingStudent(student)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Student
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                          {/* Expanded EMI Row */}
                          {expandedStudentId === student.id && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={9} className="py-4">
                                <div className="pl-8">
                                  <h4 className="font-medium mb-3">EMI Payment History</h4>
                                  {emiLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : studentEmiPayments && studentEmiPayments.length > 0 ? (
                                    <div className="rounded-md border overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-[80px]">EMI #</TableHead>
                                            <TableHead>Cash Collected</TableHead>
                                            <TableHead>No Cost EMI</TableHead>
                                            <TableHead>GST</TableHead>
                                            <TableHead>Platform Fees</TableHead>
                                            <TableHead>Platform</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Remarks</TableHead>
                                            <TableHead>Updated By</TableHead>
                                            <TableHead className="w-[100px]">Actions</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {studentEmiPayments.map((emi) => (
                                            <TableRow key={emi.id}>
                                              <TableCell className="font-medium">EMI {emi.emi_number}</TableCell>
                                              <TableCell className="text-green-600">₹{Number(emi.amount).toLocaleString('en-IN')}</TableCell>
                                              <TableCell>₹{Number(emi.no_cost_emi || 0).toLocaleString('en-IN')}</TableCell>
                                              <TableCell>₹{Number(emi.gst_fees || 0).toLocaleString('en-IN')}</TableCell>
                                              <TableCell>₹{Number(emi.platform_fees || 0).toLocaleString('en-IN')}</TableCell>
                                              <TableCell>{emi.payment_platform || "-"}</TableCell>
                                              <TableCell>{formatOrg(emi.payment_date, "dd MMM yyyy")}</TableCell>
                                              <TableCell className="max-w-[150px] truncate" title={emi.remarks || undefined}>
                                                {emi.remarks || "-"}
                                              </TableCell>
                                              <TableCell>{emi.created_by_profile?.full_name || "Unknown"}</TableCell>
                                              <TableCell>
                                                <div className="flex gap-1">
                                                  <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEmiStudent(student);
                                                    }}
                                                  >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                  </Button>
                                                  <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEmiStudent(student);
                                                    }}
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <p className="text-muted-foreground text-sm">No EMI payments recorded</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {filteredStudents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No students found</p>
                ) : (
                  filteredStudents.map((student) => (
                    <div key={student.id} className="rounded-lg border bg-card overflow-hidden">
                      <div 
                        className="p-4 cursor-pointer active:bg-muted/50"
                        onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {expandedStudentId === student.id ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{student.contact_name}</p>
                                {(student.notes || student.next_follow_up_date) && (
                                  <FileText 
                                    className="h-4 w-4 text-blue-500 cursor-pointer hover:text-blue-700 transition-colors flex-shrink-0" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingNotesStudent(student);
                                    }}
                                  />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{formatOrg(student.conversion_date, "dd MMM yyyy")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {getStatusBadge(student.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEmiStudent(student)}>
                                  <IndianRupee className="h-4 w-4 mr-2" />
                                  Update EMI
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setNotesStudent(student);
                                  setNotesText(student.notes || "");
                                  setFollowUpDate(student.next_follow_up_date ? new Date(student.next_follow_up_date) : undefined);
                                }}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Edit Notes
                                </DropdownMenuItem>
                                {student.status === "active" && (
                                  <>
                                    <DropdownMenuItem onClick={() => setRefundingStudent(student)}>
                                      <RefreshCcw className="h-4 w-4 mr-2" />
                                      Mark as Refunded
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setDiscontinuingStudent(student)}>
                                      <X className="h-4 w-4 mr-2" />
                                      Discontinued
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {isAdmin && (
                                  <DropdownMenuItem 
                                    onClick={() => setDeletingStudent(student)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Student
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Offered</p>
                            <p className="font-medium">₹{student.offer_amount.toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Received</p>
                            <p className="font-medium text-green-600">₹{student.cash_received.toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Due</p>
                            <p className="font-medium text-orange-600">₹{student.due_amount.toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Closer: {student.closer_name || "Added Manually"}
                        </div>
                      </div>
                      
                      {/* Mobile Expanded EMI Section */}
                      {expandedStudentId === student.id && (
                        <div className="border-t bg-muted/30 p-4">
                          <h4 className="font-medium mb-3 text-sm">EMI Payment History</h4>
                          {emiLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : studentEmiPayments && studentEmiPayments.length > 0 ? (
                            <div className="space-y-2">
                              {studentEmiPayments.map((emi) => (
                                <div key={emi.id} className="p-3 rounded-md border bg-background text-sm">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="font-medium">EMI {emi.emi_number}</span>
                                    <span className="text-green-600 font-medium">₹{Number(emi.amount).toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                    <span>Date: {formatOrg(emi.payment_date, "dd MMM yyyy")}</span>
                                    <span>Platform: {emi.payment_platform || "-"}</span>
                                    <span>GST: ₹{Number(emi.gst_fees || 0).toLocaleString('en-IN')}</span>
                                    <span>Fees: ₹{Number(emi.platform_fees || 0).toLocaleString('en-IN')}</span>
                                  </div>
                                  {emi.remarks && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">Remarks: {emi.remarks}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm">No EMI payments recorded</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
});

export default FuturesStudentsTab;
