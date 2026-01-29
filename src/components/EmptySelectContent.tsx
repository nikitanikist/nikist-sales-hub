import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptySelectContentProps {
  entityName: string;
  navigateTo?: string;
  onCreateClick?: () => void;
  createLabel?: string;
}

export function EmptySelectContent({
  entityName,
  navigateTo,
  onCreateClick,
  createLabel,
}: EmptySelectContentProps) {
  const label = createLabel || `Create ${entityName}`;

  return (
    <div className="py-4 px-2 text-center">
      <p className="text-sm text-muted-foreground mb-2">
        No {entityName.toLowerCase()}s available
      </p>
      {onCreateClick ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCreateClick();
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          {label}
        </Button>
      ) : navigateTo ? (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to={navigateTo}>
            <Plus className="h-4 w-4 mr-1" />
            {label}
          </Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Create one in the {entityName}s page first.
        </p>
      )}
    </div>
  );
}
