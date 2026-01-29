import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface CardSkeletonProps {
  showHeader?: boolean;
  headerHeight?: string;
  contentHeight?: string;
}

export const CardSkeleton = ({ 
  showHeader = true, 
  headerHeight = "h-6",
  contentHeight = "h-24"
}: CardSkeletonProps) => {
  return (
    <Card>
      {showHeader && (
        <CardHeader className="pb-2">
          <Skeleton className={`${headerHeight} w-1/3`} />
        </CardHeader>
      )}
      <CardContent>
        <Skeleton className={`${contentHeight} w-full`} />
      </CardContent>
    </Card>
  );
};

interface StatsCardSkeletonProps {
  count?: number;
}

export const StatsCardsSkeleton = ({ count = 4 }: StatsCardSkeletonProps) => {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-4 sm:px-6 pt-4 sm:pt-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const ChartCardSkeleton = () => {
  return (
    <Card>
      <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
        <div className="flex items-end justify-around h-[200px] sm:h-[300px] gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="w-8 sm:w-12" 
              style={{ height: `${Math.random() * 60 + 40}%` }} 
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
