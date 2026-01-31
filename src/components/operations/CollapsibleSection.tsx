import { ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: React.ElementType;
  status: 'complete' | 'incomplete' | 'neutral';
  summary: string;
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
  children: ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  status,
  summary,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={cn(
              "p-1 sm:p-1.5 rounded-md",
              status === 'complete' && "bg-emerald-100 dark:bg-emerald-900/30",
              status === 'incomplete' && "bg-amber-100 dark:bg-amber-900/30",
              status === 'neutral' && "bg-muted"
            )}>
              <Icon className={cn(
                "h-3.5 w-3.5 sm:h-4 sm:w-4",
                status === 'complete' && "text-emerald-600 dark:text-emerald-400",
                status === 'incomplete' && "text-amber-600 dark:text-amber-400",
                status === 'neutral' && "text-muted-foreground"
              )} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm font-medium">{title}</span>
                {status === 'complete' && (
                  <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />
                )}
                {status === 'incomplete' && (
                  <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500" />
                )}
              </div>
              {!isExpanded && (
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{summary}</p>
              )}
            </div>
          </div>
          <ChevronDown 
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180"
            )} 
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-2 sm:px-3 pb-3 sm:pb-4 pt-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
