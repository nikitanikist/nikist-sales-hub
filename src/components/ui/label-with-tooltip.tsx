import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LabelWithTooltipProps {
  label: string;
  tooltip: string;
  required?: boolean;
  className?: string;
}

export const LabelWithTooltip = ({ 
  label, 
  tooltip, 
  required = false,
  className = ""
}: LabelWithTooltipProps) => {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px]">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

interface TableHeaderWithTooltipProps {
  label: string;
  tooltip: string;
  className?: string;
}

export const TableHeaderWithTooltip = ({ 
  label, 
  tooltip,
  className = ""
}: TableHeaderWithTooltipProps) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span>{label}</span>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px]">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
