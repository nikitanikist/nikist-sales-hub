import { Progress } from "@/components/ui/progress";

interface Props {
  completed: number;
  total: number;
}

export function CampaignProgressBar({ completed, total }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">{pct}% ({completed}/{total})</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
