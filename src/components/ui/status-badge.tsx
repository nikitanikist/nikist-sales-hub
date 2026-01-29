import { cn } from "@/lib/utils";

const statusStyles = {
  // Lead/Sales statuses
  new: "bg-sky-100 text-sky-700 border-sky-200",
  contacted: "bg-violet-100 text-violet-700 border-violet-200",
  qualified: "bg-amber-100 text-amber-700 border-amber-200",
  proposal: "bg-pink-100 text-pink-700 border-pink-200",
  negotiation: "bg-orange-100 text-orange-700 border-orange-200",
  won: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-red-100 text-red-700 border-red-200",
  
  // Call/Appointment statuses
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  rescheduled: "bg-violet-100 text-violet-700 border-violet-200",
  no_show: "bg-red-100 text-red-700 border-red-200",
  
  // General statuses
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
  converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  refunded: "bg-red-100 text-red-700 border-red-200",
  
  // Workshop/Event statuses
  upcoming: "bg-blue-100 text-blue-700 border-blue-200",
  ongoing: "bg-violet-100 text-violet-700 border-violet-200",
  past: "bg-slate-100 text-slate-700 border-slate-200",
  
  // Payment statuses
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  
  // Default
  default: "bg-slate-100 text-slate-700 border-slate-200",
};

export type StatusType = keyof typeof statusStyles;

interface StatusBadgeProps {
  status: StatusType | string;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/[- ]/g, '_') as StatusType;
  const style = statusStyles[normalizedStatus] || statusStyles.default;
  
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        style,
        className
      )}
    >
      {children}
    </span>
  );
}

export { statusStyles };
