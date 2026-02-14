import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, IndianRupee, MessageSquare } from "lucide-react";
import { WorkshopWhatsAppTab } from "@/components/workshops/WorkshopWhatsAppTab";
import { CallCategory } from "./hooks/useWorkshopsData";

interface WorkshopExpandedRowProps {
  workshop: any;
  isManager: boolean;
  colSpan: number;
  openCallsDialog: (workshopTitle: string, category: CallCategory) => void;
  isMobile?: boolean;
}

const WorkshopExpandedRow = React.memo(function WorkshopExpandedRow({
  workshop,
  isManager,
  colSpan,
  openCallsDialog,
  isMobile = false,
}: WorkshopExpandedRowProps) {
  if (isMobile) {
    return (
      <div className="border-t bg-muted/30 p-4 space-y-4">
        {/* Fresh Calls */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" /> Fresh Calls
          </p>
          <div className="grid grid-cols-4 gap-2">
            <div 
              className="bg-background rounded-md p-2 text-center border cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "all_booked"); }}
            >
              <div className="text-sm font-bold">{workshop.total_calls_booked || 0}</div>
              <div className="text-[10px] text-muted-foreground">Booked</div>
            </div>
            <div 
              className="bg-background rounded-md p-2 text-center border cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "converted"); }}
            >
              <div className="text-sm font-bold text-green-600">{workshop.converted_calls || 0}</div>
              <div className="text-[10px] text-muted-foreground">Converted</div>
            </div>
            <div 
              className="bg-background rounded-md p-2 text-center border cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "not_converted"); }}
            >
              <div className="text-sm font-bold text-red-500">{workshop.not_converted_calls || 0}</div>
              <div className="text-[10px] text-muted-foreground">Not Conv.</div>
            </div>
            <div 
              className="bg-background rounded-md p-2 text-center border cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "remaining"); }}
            >
              <div className="text-sm font-bold text-blue-500">{workshop.remaining_calls || 0}</div>
              <div className="text-[10px] text-muted-foreground">Remaining</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div 
              className="bg-background rounded-md p-2 text-center border cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_remaining"); }}
            >
              <div className="text-sm font-bold text-orange-500">{workshop.rescheduled_remaining || 0}</div>
              <div className="text-[10px] text-muted-foreground">Resch. Rem</div>
            </div>
            <div 
              className="bg-background rounded-md p-2 text-center border cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_done"); }}
            >
              <div className="text-sm font-bold text-teal-500">{workshop.rescheduled_done || 0}</div>
              <div className="text-[10px] text-muted-foreground">Resch. Done</div>
            </div>
            <div 
              className="bg-background rounded-md p-2 text-center border cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "booking_amount"); }}
            >
              <div className="text-sm font-bold text-purple-600">{workshop.booking_amount_calls || 0}</div>
              <div className="text-[10px] text-muted-foreground">Booking</div>
            </div>
            <div 
              className="bg-background rounded-md p-2 text-center border cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "refunded"); }}
            >
              <div className="text-sm font-bold text-amber-600">{workshop.refunded_calls || 0}</div>
              <div className="text-[10px] text-muted-foreground">Refunded</div>
            </div>
          </div>
        </div>
        
        {/* Rejoin Calls */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
            <Phone className="h-3 w-3" /> Rejoin Calls
          </p>
          <div className="grid grid-cols-4 gap-2">
            <div 
              className="bg-amber-50 dark:bg-amber-900/20 rounded-md p-2 text-center border border-amber-200 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
            >
              <div className="text-sm font-bold text-amber-700">{workshop.rejoin_sales_count || 0}</div>
              <div className="text-[10px] text-amber-600">Total</div>
            </div>
            <div className="bg-background rounded-md p-2 text-center border border-amber-200">
              <div className="text-sm font-bold text-green-600">{workshop.rejoin_converted || 0}</div>
              <div className="text-[10px] text-muted-foreground">Converted</div>
            </div>
            <div className="bg-background rounded-md p-2 text-center border border-amber-200">
              <div className="text-sm font-bold text-red-500">{workshop.rejoin_not_converted || 0}</div>
              <div className="text-[10px] text-muted-foreground">Not Conv.</div>
            </div>
            <div className="bg-background rounded-md p-2 text-center border border-amber-200">
              <div className="text-sm font-bold text-blue-500">{workshop.rejoin_remaining || 0}</div>
              <div className="text-[10px] text-muted-foreground">Remaining</div>
            </div>
          </div>
        </div>
        
        {/* Revenue Breakdown - Hidden for managers */}
        {!isManager && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <IndianRupee className="h-3 w-3" /> Revenue
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-background rounded-md p-2 border">
                <div className="text-sm font-bold">₹{Number(workshop.fresh_revenue || 0).toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-muted-foreground">Fresh Revenue</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-md p-2 border border-amber-200">
                <div className="text-sm font-bold text-amber-700">₹{Number(workshop.rejoin_revenue || 0).toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-amber-600">Rejoin Revenue</div>
              </div>
              <div className="bg-background rounded-md p-2 border">
                <div className="text-sm font-bold text-green-600">₹{Number(workshop.total_cash_received || 0).toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-muted-foreground">Cash Collected</div>
              </div>
              <div className="bg-background rounded-md p-2 border">
                <div className="text-sm font-bold">₹{Number(workshop.ad_spend || 0).toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-muted-foreground">Ad Spend</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop expanded row content
  return (
    <Tabs defaultValue="stats" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="stats" className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Call Statistics
        </TabsTrigger>
        <TabsTrigger value="whatsapp" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          WhatsApp
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="stats" className="space-y-6">
        {/* Fresh Call Statistics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Phone className="h-4 w-4" />
            Fresh Calls (Paid During This Workshop)
          </div>
          <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
            <div 
              className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-2 border-slate-300 dark:border-slate-600 cursor-pointer hover:border-slate-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "all_booked"); }}
            >
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{workshop.total_calls_booked || 0}</div>
              <div className="text-xs text-muted-foreground font-medium">Total Calls Booked</div>
            </div>
            <div 
              className="bg-background rounded-lg p-3 border cursor-pointer hover:border-green-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "converted"); }}
            >
              <div className="text-2xl font-bold text-green-600">{workshop.fresh_converted || 0}</div>
              <div className="text-xs text-muted-foreground">Converted</div>
            </div>
            <div 
              className="bg-background rounded-lg p-3 border cursor-pointer hover:border-red-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "not_converted"); }}
            >
              <div className="text-2xl font-bold text-red-600">{workshop.fresh_not_converted || 0}</div>
              <div className="text-xs text-muted-foreground">Not Converted</div>
            </div>
            <div 
              className="bg-background rounded-lg p-3 border cursor-pointer hover:border-yellow-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "remaining"); }}
            >
              <div className="text-2xl font-bold text-yellow-600">{workshop.fresh_remaining || 0}</div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
            <div 
              className="bg-background rounded-lg p-3 border cursor-pointer hover:border-orange-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_remaining"); }}
            >
              <div className="text-2xl font-bold text-orange-600">{workshop.fresh_rescheduled_remaining || 0}</div>
              <div className="text-xs text-muted-foreground">Reschedule (Upcoming)</div>
            </div>
            <div 
              className="bg-background rounded-lg p-3 border cursor-pointer hover:border-orange-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rescheduled_done"); }}
            >
              <div className="text-2xl font-bold text-orange-500">{workshop.fresh_rescheduled_done || 0}</div>
              <div className="text-xs text-muted-foreground">Reschedule (Done)</div>
            </div>
            <div 
              className="bg-background rounded-lg p-3 border cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "booking_amount"); }}
            >
              <div className="text-2xl font-bold text-blue-600">{workshop.fresh_booking_amount || 0}</div>
              <div className="text-xs text-muted-foreground">Booking Amount</div>
            </div>
            <div 
              className="bg-background rounded-lg p-3 border cursor-pointer hover:border-gray-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "refunded"); }}
            >
              <div className="text-2xl font-bold text-gray-600">{workshop.refunded_calls || 0}</div>
              <div className="text-xs text-muted-foreground">Refunded</div>
            </div>
          </div>
        </div>
        
        {/* Rejoin Calls Statistics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
            <Phone className="h-4 w-4" />
            Rejoin Calls (Paid in Previous Workshop)
          </div>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            <div 
              className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
            >
              <div className="text-2xl font-bold text-amber-600">{workshop.rejoin_converted || 0}</div>
              <div className="text-xs text-amber-600">Converted</div>
            </div>
            <div 
              className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
            >
              <div className="text-2xl font-bold text-amber-600">{workshop.rejoin_not_converted || 0}</div>
              <div className="text-xs text-amber-600">Not Converted</div>
            </div>
            <div 
              className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
            >
              <div className="text-2xl font-bold text-amber-600">{workshop.rejoin_remaining || 0}</div>
              <div className="text-xs text-amber-600">Remaining</div>
            </div>
            <div 
              className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
            >
              <div className="text-2xl font-bold text-amber-600">{workshop.rejoin_rescheduled_remaining || 0}</div>
              <div className="text-xs text-amber-600">Reschedule (Upcoming)</div>
            </div>
            <div 
              className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
            >
              <div className="text-2xl font-bold text-amber-600">{workshop.rejoin_rescheduled_done || 0}</div>
              <div className="text-xs text-amber-600">Reschedule (Done)</div>
            </div>
            <div 
              className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "rejoin"); }}
            >
              <div className="text-2xl font-bold text-amber-600">{workshop.rejoin_booking_amount || 0}</div>
              <div className="text-xs text-amber-600">Booking Amount</div>
            </div>
          </div>
        </div>
        
        {/* Cross-Workshop Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <IndianRupee className="h-4 w-4" />
            Cross-Workshop Payments (Revenue counted at original workshop)
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div 
              className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border-2 border-slate-300 dark:border-slate-600 cursor-pointer hover:border-slate-400 hover:shadow-sm transition-all"
              onClick={(e) => { e.stopPropagation(); openCallsDialog(workshop.title, "cross_workshop"); }}
            >
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{workshop.cross_workshop_count || 0}</div>
              <div className="text-xs text-slate-500 font-medium">Cross-Workshop Payments</div>
              <div className="text-xs text-slate-400 mt-1">Revenue credited to their original workshop</div>
            </div>
          </div>
        </div>
        
        {/* Revenue Breakdown - Hidden for managers */}
        {!isManager && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IndianRupee className="h-4 w-4" />
              Revenue Breakdown
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background rounded-lg p-3 border">
                <div className="text-lg font-bold text-foreground">
                  ₹{Number(workshop.fresh_revenue || 0).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-muted-foreground">Fresh Workshop Revenue (₹497 × {workshop.fresh_sales_count})</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200">
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  ₹{Number(workshop.rejoin_revenue || 0).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-amber-600">Rejoin Revenue (₹497 × {workshop.rejoin_sales_count || 0})</div>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <div className="text-lg font-bold text-foreground">
                  ₹{Number(workshop.total_offer_amount || 0).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-muted-foreground">High Ticket Offer Amount</div>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <div className="text-lg font-bold text-green-600">
                  ₹{Number(workshop.total_cash_received || 0).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-muted-foreground">Total Cash Collected</div>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <div className={`text-lg font-bold ${(workshop.rough_pl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{Number(workshop.rough_pl || 0).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-muted-foreground">Workshop P&L (Total Revenue - Ad Spend)</div>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
      
      <TabsContent value="whatsapp">
        <WorkshopWhatsAppTab workshopId={workshop.id} workshopTitle={workshop.title} />
      </TabsContent>
    </Tabs>
  );
});

export default WorkshopExpandedRow;
