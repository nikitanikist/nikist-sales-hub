import { Search, Filter, RefreshCw, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LeadsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  onOpenFilter: () => void;
  onRefresh: () => void;
  onImport: () => void;
  onAddCustomer: () => void;
  isAdmin: boolean;
  isManager: boolean;
}

export function LeadsToolbar({
  searchQuery,
  onSearchChange,
  hasActiveFilters,
  onOpenFilter,
  onRefresh,
  onImport,
  onAddCustomer,
  isAdmin,
  isManager,
}: LeadsToolbarProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or email"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onOpenFilter} className="relative">
            <Filter className="h-4 w-4" />
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-primary rounded-full" />
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={onImport} className="hidden sm:flex">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="icon" onClick={onImport} className="sm:hidden">
              <Upload className="h-4 w-4" />
            </Button>
          )}
          {!isManager && (
            <Button onClick={onAddCustomer} className="hidden sm:flex">
              Add Customer
            </Button>
          )}
          {!isManager && (
            <Button onClick={onAddCustomer} size="icon" className="sm:hidden">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
