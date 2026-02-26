import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, PhoneCall, Check, Calendar, XCircle, PhoneOff, AlertTriangle, Ban, IndianRupee, Clock } from "lucide-react";
import type { VoiceCampaign } from "@/types/voice-campaign";
import { formatCost, formatDuration } from "./index";

interface Props {
  campaign: VoiceCampaign;
  avgDuration: number;
}

export function CampaignAnalyticsCards({ campaign, avgDuration }: Props) {
  const cards = [
    { title: "Total Contacts", value: campaign.total_contacts, icon: Users, color: "text-foreground" },
    { title: "Calls Completed", value: `${campaign.calls_completed} / ${campaign.total_contacts}`, icon: PhoneCall, color: "text-blue-500" },
    { title: "Confirmed", value: campaign.calls_confirmed, icon: Check, color: "text-green-500" },
    { title: "Rescheduled", value: campaign.calls_rescheduled, icon: Calendar, color: "text-blue-500" },
    { title: "Not Interested", value: campaign.calls_not_interested, icon: XCircle, color: "text-destructive" },
    { title: "No Answer", value: campaign.calls_no_answer, icon: PhoneOff, color: "text-orange-500" },
    { title: "Failed", value: campaign.calls_failed, icon: AlertTriangle, color: "text-destructive" },
    { title: "Total Cost", value: formatCost(campaign.total_cost), icon: IndianRupee, color: "text-foreground" },
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
