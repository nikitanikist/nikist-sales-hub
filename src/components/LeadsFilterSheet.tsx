import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// Country list with dial codes
const countries = [
  { code: "91", name: "India", flag: "🇮🇳" },
  { code: "1", name: "USA", flag: "🇺🇸" },
  { code: "44", name: "UK", flag: "🇬🇧" },
  { code: "61", name: "Australia", flag: "🇦🇺" },
  { code: "971", name: "UAE", flag: "🇦🇪" },
  { code: "65", name: "Singapore", flag: "🇸🇬" },
  { code: "60", name: "Malaysia", flag: "🇲🇾" },
  { code: "966", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "974", name: "Qatar", flag: "🇶🇦" },
  { code: "968", name: "Oman", flag: "🇴🇲" },
  { code: "973", name: "Bahrain", flag: "🇧🇭" },
  { code: "965", name: "Kuwait", flag: "🇰🇼" },
  { code: "977", name: "Nepal", flag: "🇳🇵" },
  { code: "94", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "92", name: "Pakistan", flag: "🇵🇰" },
  { code: "49", name: "Germany", flag: "🇩🇪" },
  { code: "33", name: "France", flag: "🇫🇷" },
  { code: "39", name: "Italy", flag: "🇮🇹" },
  { code: "34", name: "Spain", flag: "🇪🇸" },
];

export interface LeadsFilters {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  productIds: string[];
  workshopIds: string[];
  country: string;
  status: string;
}

interface LeadsFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: LeadsFilters;
  onFiltersChange: (filters: LeadsFilters) => void;
  products: Array<{
    id: string;
    product_name: string;
    funnel?: { funnel_name: string } | null;
  }>;
  workshops: Array<{
    id: string;
    title: string;
  }>;
}

export function LeadsFilterSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  products,
  workshops,
}: LeadsFilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<LeadsFilters>(filters);

  // Reset local filters when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalFilters(filters);
    }
    onOpenChange(isOpen);
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleClearAll = () => {
    const clearedFilters: LeadsFilters = {
      dateFrom: undefined,
      dateTo: undefined,
      productIds: [],
      workshopIds: [],
      country: "all",
      status: "all",
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Join Date Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Join Date</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !localFilters.dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {localFilters.dateFrom ? format(localFilters.dateFrom, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={localFilters.dateFrom}
                        onSelect={(date) =>
                          setLocalFilters((prev) => ({ ...prev, dateFrom: date }))
                        }
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !localFilters.dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {localFilters.dateTo ? format(localFilters.dateTo, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={localFilters.dateTo}
                        onSelect={(date) =>
                          setLocalFilters((prev) => ({ ...prev, dateTo: date }))
                        }
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Products Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Products</Label>
              <Select
                value={localFilters.productIds[0] || "all"}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ 
                    ...prev, 
                    productIds: value === "all" ? [] : [value] 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Workshops Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Workshops</Label>
              <Select
                value={localFilters.workshopIds[0] || "all"}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ 
                    ...prev, 
                    workshopIds: value === "all" ? [] : [value] 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Workshops" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workshops</SelectItem>
                  {workshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Country Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Country</Label>
              <Select
                value={localFilters.country}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ ...prev, country: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <span className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Status</Label>
              <Select
                value={localFilters.status}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClearAll} className="flex-1">
            Clear All
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
