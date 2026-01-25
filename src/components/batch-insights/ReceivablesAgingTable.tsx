import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { BarChart3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReceivablesAging {
  bracket: string;
  students: any[];
  amount: number;
  percentage: number;
}

interface ReceivablesAgingTableProps {
  receivablesAging: ReceivablesAging[];
  onBracketClick: (bracket: string, students: any[]) => void;
}

export const ReceivablesAgingTable: React.FC<ReceivablesAgingTableProps> = ({
  receivablesAging,
  onBracketClick,
}) => {
  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const getBracketColor = (bracket: string) => {
    if (bracket.includes("0-30")) return "bg-green-500";
    if (bracket.includes("31-60")) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base sm:text-lg">Receivables Aging</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {/* Mobile Card View */}
        <div className="sm:hidden space-y-2 p-4 pt-0">
          {receivablesAging.map((aging) => (
            <div
              key={aging.bracket}
              onClick={() => aging.students.length > 0 && onBracketClick(aging.bracket, aging.students)}
              className={cn(
                "p-3 border rounded-lg transition-all",
                aging.students.length > 0 ? "cursor-pointer hover:shadow-md" : "opacity-60"
              )}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm">{aging.bracket}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{formatAmount(aging.amount)}</span>
                  {aging.students.length > 0 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={aging.percentage} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {aging.percentage.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {aging.students.length} {aging.students.length === 1 ? "student" : "students"}
              </p>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Age Bracket</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead className="text-right">Amount Due</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
                <TableHead className="w-32">Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivablesAging.map((aging) => (
                <TableRow
                  key={aging.bracket}
                  onClick={() => aging.students.length > 0 && onBracketClick(aging.bracket, aging.students)}
                  className={cn(
                    "transition-all",
                    aging.students.length > 0 ? "cursor-pointer hover:bg-muted/50" : "opacity-60"
                  )}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", getBracketColor(aging.bracket))} />
                      {aging.bracket}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{aging.students.length}</TableCell>
                  <TableCell className="text-right font-medium">{formatAmount(aging.amount)}</TableCell>
                  <TableCell className="text-right">{aging.percentage.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Progress value={aging.percentage} className="h-2" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
