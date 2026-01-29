import { LucideIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
    <div className="relative mb-6">
      {/* Gradient background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-[hsl(280,83%,58%)]/20 rounded-full blur-xl" />
      <div className="relative p-5 bg-gradient-to-br from-violet-100 to-violet-50 rounded-2xl border border-violet-200">
        <Icon className="h-10 w-10 text-violet-600" />
      </div>
    </div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground text-center max-w-md mb-6">{description}</p>
    {actionLabel && onAction && (
      <Button onClick={onAction} variant="gradient">
        <Plus className="h-4 w-4 mr-2" />
        {actionLabel}
      </Button>
    )}
  </div>
);

export default EmptyState;
