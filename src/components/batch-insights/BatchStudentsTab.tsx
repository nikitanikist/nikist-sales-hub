import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { ChevronDown, ChevronRight, Search, Download, Filter, X, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BatchStudentsTabProps {
  // Data
  filteredStudents: any[];
  allStudents: any[];
  studentsLoading: boolean;
  expandedStudentId: string | null;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Filter state
  activeFilterCount: number;
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
  clearAllFilters: () => void;
  
  // Actions
  toggleStudentExpand: (studentId: string) => void;
  onExport: () => void;
  
  // Role flags
  isManager: boolean;
  isCloser: boolean;
  isAdmin: boolean;
  
  // Filter content component (passed as children)
  filterContent: React.ReactNode;
  activeFiltersDisplay: React.ReactNode;
  
  // Table row renderer (passed as function)
  renderStudentRow: (student: any) => React.ReactNode;
  renderExpandedRow: (student: any) => React.ReactNode;
  
  // Table headers (passed as function)
  renderTableHeaders: () => React.ReactNode;
  
  // Summary cards (passed as children for above table)
  summaryCards?: React.ReactNode;
}

export const BatchStudentsTab: React.FC<BatchStudentsTabProps> = ({
  filteredStudents,
  allStudents,
  studentsLoading,
  expandedStudentId,
  searchQuery,
  setSearchQuery,
  activeFilterCount,
  isFilterOpen,
  setIsFilterOpen,
  clearAllFilters,
  toggleStudentExpand,
  onExport,
  isManager,
  isCloser,
  isAdmin,
  filterContent,
  activeFiltersDisplay,
  renderStudentRow,
  renderExpandedRow,
  renderTableHeaders,
  summaryCards,
}) => {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summaryCards}
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Students</CardTitle>
            <CardDescription>
              {filteredStudents.length} of {allStudents?.length || 0} students
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            {/* Clear All Button */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            
            {/* Filter Button with Sheet */}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 py-6">
                  {filterContent}
                </div>
                <SheetFooter className="flex gap-2">
                  <Button variant="outline" onClick={clearAllFilters}>
                    Clear All
                  </Button>
                  <Button onClick={() => setIsFilterOpen(false)}>
                    Apply Filters
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {allStudents && allStudents.length > 0 && (
              <Button variant="outline" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Search and Active Filters Section */}
        <div className="px-6 pb-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Active:</span>
              {activeFiltersDisplay}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        <CardContent>
          {studentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !allStudents?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No students enrolled yet</p>
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
                    {renderTableHeaders()}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <React.Fragment key={student.id}>
                      {renderStudentRow(student)}
                      {expandedStudentId === student.id && renderExpandedRow(student)}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
