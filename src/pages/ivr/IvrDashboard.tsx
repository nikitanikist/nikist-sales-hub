import { useIvrCampaigns } from "@/hooks/useIvrCampaigns";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { PhoneCall, ThumbsUp, DollarSign, BarChart3 } from "lucide-react";
import type { IvrCampaign } from "@/types/ivr-campaign";

export default function IvrDashboard() {
  const { data: campaigns = [], isLoading } = useIvrCampaigns();

  const totals = campaigns.reduce(
    (acc, c: IvrCampaign) => ({
      campaigns: acc.campaigns + 1,
      contacts: acc.contacts + c.total_contacts,
      answered: acc.answered + c.calls_answered,
      cost: acc.cost + (c.total_cost || 0),
    }),
    { campaigns: 0, contacts: 0, interested: 0, cost: 0 }
  );

  const stats = [
    { label: "Total Campaigns", value: totals.campaigns, icon: BarChart3, color: "text-primary" },
    { label: "Total Calls", value: totals.contacts, icon: PhoneCall, color: "text-foreground" },
    { label: "Total Interested", value: totals.interested, icon: ThumbsUp, color: "text-green-600" },
    { label: "Total Cost", value: `₹${totals.cost.toFixed(2)}`, icon: DollarSign, color: "text-foreground" },
  ];

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="IVR Dashboard" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Recent Campaigns</h3>
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No IVR campaigns yet. Create one from the Campaigns page.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 5).map((c: IvrCampaign) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.total_contacts} contacts • {c.calls_interested} interested</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">₹{(c.total_cost || 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
