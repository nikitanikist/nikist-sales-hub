import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, PhoneCall, Check, Calendar, XCircle, PhoneOff, AlertTriangle, IndianRupee, Clock } from "lucide-react";
import type { VoiceCampaign } from "@/types/voice-campaign";
import { formatCost, formatDuration } from "./index";

interface ComputedStats {
  completed: number;
  confirmed: number;
  rescheduled: number;
  notInterested: number;
  noAnswer: number;
  failed: number;
  totalCost: number;
}

interface Props {
  campaign: VoiceCampaign;
  computedStats: ComputedStats;
  avgDuration: number;
}

export function CampaignAnalyticsCards({ campaign, computedStats, avgDuration }: Props) {
  const cards = [
    { title: "Total Contacts", value: campaign.total_contacts, icon: Users, color: "text-foreground" },
    { title: "Calls Completed", value: `${computedStats.completed} / ${campaign.total_contacts}`, icon: PhoneCall, color: "text-blue-500" },
    { title: "Confirmed", value: computedStats.confirmed, icon: Check, color: "text-green-500" },
    { title: "Rescheduled", value: computedStats.rescheduled, icon: Calendar, color: "text-blue-500" },
    { title: "Not Interested", value: computedStats.notInterested, icon: XCircle, color: "text-destructive" },
    { title: "No Answer", value: computedStats.noAnswer, icon: PhoneOff, color: "text-orange-500" },
    { title: "Failed", value: computedStats.failed, icon: AlertTriangle, color: "text-destructive" },
    { title: "Total Cost", value: formatCost(computedStats.totalCost), icon: IndianRupee, color: "text-foreground" },
    { title: "Avg Duration", value: formatDuration(avgDuration), icon: Clock, color: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <Card key={card.title} className="border border-border">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-lg font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
