import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Phone } from "lucide-react";
import type { CallCategory } from "./hooks/useWorkshopDetailData";

interface WorkshopStatsTabProps {
  metrics: any;
  totalRevenue: number;
  adSpend: number;
  totalCashReceived: number;
  totalPL: number;
  openCallsDialog: (category: CallCategory) => void;
}

const WorkshopStatsTab = React.memo(function WorkshopStatsTab({
  metrics, totalRevenue, adSpend, totalCashReceived, totalPL, openCallsDialog,
}: WorkshopStatsTabProps) {
  return (
    <TabsContent value="stats" className="space-y-6">
      {/* Fresh Call Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Fresh Calls (Paid During This Workshop)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-8 gap-3">
            <div className="bg-muted rounded-lg p-3 border-2 border-border cursor-pointer hover:border-primary/50 transition-all" onClick={() => openCallsDialog("all_booked")}>
              <div className="text-2xl font-bold">{metrics?.total_calls_booked || 0}</div>
              <div className="text-xs text-muted-foreground">Total Booked</div>
            </div>
            <div className="bg-background rounded-lg p-3 border cursor-pointer hover:border-emerald-400 transition-all" onClick={() => openCallsDialog("converted")}>
              <div className="text-2xl font-bold text-emerald-600">{metrics?.fresh_converted || 0}</div>
              <div className="text-xs text-muted-foreground">Converted</div>
            </div>
            <div className="bg-background rounded-lg p-3 border cursor-pointer hover:border-destructive transition-all" onClick={() => openCallsDialog("not_converted")}>
              <div className="text-2xl font-bold text-destructive">{metrics?.fresh_not_converted || 0}</div>
              <div className="text-xs text-muted-foreground">Not Converted</div>
            </div>
            <div className="bg-background rounded-lg p-3 border cursor-pointer hover:border-amber-400 transition-all" onClick={() => openCallsDialog("remaining")}>
              <div className="text-2xl font-bold text-amber-600">{metrics?.fresh_remaining || 0}</div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
            <div className="bg-background rounded-lg p-3 border cursor-pointer hover:border-orange-400 transition-all" onClick={() => openCallsDialog("rescheduled_remaining")}>
              <div className="text-2xl font-bold text-orange-600">{metrics?.fresh_rescheduled_remaining || 0}</div>
              <div className="text-xs text-muted-foreground">Reschedule</div>
            </div>
            <div className="bg-background rounded-lg p-3 border cursor-pointer hover:border-primary transition-all" onClick={() => openCallsDialog("booking_amount")}>
              <div className="text-2xl font-bold text-primary">{metrics?.fresh_booking_amount || 0}</div>
              <div className="text-xs text-muted-foreground">Booking Amt</div>
            </div>
            <div className="bg-background rounded-lg p-3 border cursor-pointer hover:border-muted-foreground transition-all" onClick={() => openCallsDialog("refunded")}>
              <div className="text-2xl font-bold text-muted-foreground">{metrics?.refunded_calls || 0}</div>
              <div className="text-xs text-muted-foreground">Refunded</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-lg font-bold">₹{totalRevenue.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground">Total Revenue</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-lg font-bold">₹{adSpend.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground">Ad Spend</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-lg font-bold">₹{totalCashReceived.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground">Cash Received</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-lg font-bold">₹{(metrics?.total_offer_amount || 0).toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground">Offered Amount</div>
            </div>
            <div className={`p-4 rounded-lg ${totalPL >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-destructive/10'}`}>
              <div className={`text-lg font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                ₹{totalPL.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-muted-foreground">Total P&L</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
});

export default WorkshopStatsTab;
