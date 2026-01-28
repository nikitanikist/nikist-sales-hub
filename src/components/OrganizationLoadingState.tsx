import { Loader2 } from "lucide-react";

export const OrganizationLoadingState = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Loading organization data...</p>
    </div>
  </div>
);

export default OrganizationLoadingState;
