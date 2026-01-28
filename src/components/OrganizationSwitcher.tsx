import { Check, ChevronsUpDown, Building2, Plus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useOrganization } from "@/hooks/useOrganization";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, switchOrganization, isSuperAdmin } = useOrganization();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!currentOrganization) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between gap-2 px-3"
        >
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="truncate text-sm font-medium">
              {currentOrganization.name}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0 z-50 bg-popover" align="start">
        <Command>
          <CommandInput placeholder="Search organization..." className="h-9" />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup heading="Organizations">
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => {
                    switchOrganization(org.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="ml-2 truncate">{org.name}</span>
                  {!org.is_active && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      Inactive
                    </Badge>
                  )}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      currentOrganization.id === org.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {isSuperAdmin && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Super Admin">
                  <CommandItem
                    onSelect={() => {
                      navigate("/super-admin");
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Shield className="mr-2 h-4 w-4 text-primary" />
                    <span>Manage Organizations</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      navigate("/super-admin/create-org");
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Create Organization</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
