import { cn } from "@/lib/utils";

interface TextLogoProps {
  collapsed?: boolean;
  className?: string;
}

export const TextLogo = ({ collapsed = false, className }: TextLogoProps) => {
  if (collapsed) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <span className="text-xl font-extrabold text-sidebar-foreground">T</span>
        <span className="text-xl font-extrabold gradient-text">f</span>
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div className="logo-text-container relative overflow-hidden">
        <span className="text-xl font-extrabold tracking-tight text-sidebar-foreground">tag</span>
        <span className="text-xl font-extrabold tracking-tight gradient-text">funnel</span>
        <span className="text-xl font-extrabold tracking-tight text-muted-foreground">.ai</span>
        
        {/* Shimmer overlay */}
        <div className="logo-shimmer absolute inset-0 pointer-events-none" />
      </div>
    </div>
  );
};
