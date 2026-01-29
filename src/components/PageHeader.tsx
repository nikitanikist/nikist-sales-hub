import * as React from "react";

interface PageHeaderProps {
  greeting?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  gradientTitle?: boolean;
}

export function PageHeader({ 
  greeting, 
  title, 
  subtitle, 
  action,
  gradientTitle = false 
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-6">
      <div>
        {greeting && (
          <p className="text-sm text-muted-foreground mb-1">{greeting}</p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {gradientTitle ? (
            <span className="gradient-text">{title}</span>
          ) : (
            title
          )}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
