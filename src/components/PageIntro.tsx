import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageIntroProps {
  icon: LucideIcon;
  tagline: string;
  description: string;
  variant?: "violet" | "emerald" | "amber" | "sky" | "rose";
  className?: string;
}

const variantStyles = {
  violet: {
    bg: "from-violet-50 via-purple-50 to-fuchsia-50",
    border: "border-violet-100/50",
    iconBg: "from-violet-500 to-purple-600",
  },
  emerald: {
    bg: "from-emerald-50 via-green-50 to-teal-50",
    border: "border-emerald-100/50",
    iconBg: "from-emerald-500 to-green-600",
  },
  amber: {
    bg: "from-amber-50 via-yellow-50 to-orange-50",
    border: "border-amber-100/50",
    iconBg: "from-amber-500 to-orange-600",
  },
  sky: {
    bg: "from-sky-50 via-blue-50 to-indigo-50",
    border: "border-sky-100/50",
    iconBg: "from-sky-500 to-blue-600",
  },
  rose: {
    bg: "from-rose-50 via-pink-50 to-fuchsia-50",
    border: "border-rose-100/50",
    iconBg: "from-rose-500 to-pink-600",
  },
};

export const PageIntro = ({
  icon: Icon,
  tagline,
  description,
  variant = "violet",
  className,
}: PageIntroProps) => {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-r border p-4 sm:p-5 mb-4 sm:mb-6",
        styles.bg,
        styles.border,
        className
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={cn(
            "p-2.5 sm:p-3 bg-gradient-to-br rounded-xl shadow-lg shrink-0",
            styles.iconBg
          )}
        >
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            {tagline}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};
