import { LucideIcon, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

interface TableEmptyStateProps {
  colSpan: number;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function TableEmptyState({
  colSpan,
  icon: Icon = Package,
  title = "No items found",
  description = "Get started by creating your first item.",
  actionLabel,
  onAction,
}: TableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-48">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {description}
          </p>
          {actionLabel && onAction && (
            <Button onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
