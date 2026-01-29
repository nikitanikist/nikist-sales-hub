import { Card, CardContent } from "@/components/ui/card";

interface MobileCardSkeletonProps {
  count?: number;
}

export const MobileCardSkeleton = ({ count = 3 }: MobileCardSkeletonProps) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-2 flex-1">
                <div className="skeleton-shimmer rounded h-5 w-3/4" />
                <div className="skeleton-shimmer rounded h-4 w-1/2" />
              </div>
              <div className="skeleton-shimmer rounded-full h-6 w-16" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="skeleton-shimmer rounded h-4 w-full" />
              <div className="skeleton-shimmer rounded h-4 w-full" />
            </div>
            <div className="flex gap-2 mt-3">
              <div className="skeleton-shimmer rounded h-8 w-8" />
              <div className="skeleton-shimmer rounded h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
