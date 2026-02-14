import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Users } from "lucide-react";
import type { Batch, BatchStudent } from "./hooks/useBatchesData";

interface BatchDetailHeaderProps {
  selectedBatch: Batch;
  formatOrg: (date: string, fmt: string) => string;
  isAdmin: boolean;
  isManager: boolean;
  activeFilterCount: number;
  filteredStudentsCount: number;
  batchStudentsCount: number;
  onBack: () => void;
  onAddStudent: () => void;
}

const BatchDetailHeader: React.FC<BatchDetailHeaderProps> = ({
  selectedBatch, formatOrg, isAdmin, isManager,
  activeFilterCount, filteredStudentsCount, batchStudentsCount,
  onBack, onAddStudent,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold">{selectedBatch.name}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Start: {formatOrg(selectedBatch.start_date, "dd MMM yyyy")} • 
            {selectedBatch.is_active ? " Active" : " Inactive"}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-3 justify-end">
        {(isAdmin || isManager) && (
          <Button onClick={onAddStudent} size="sm" className="sm:h-10">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Student</span>
          </Button>
        )}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-2 sm:py-3 px-3 sm:px-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-full bg-primary/10">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Students</p>
                <p className="text-base sm:text-xl font-bold">
                  {activeFilterCount > 0 
                    ? `${filteredStudentsCount}/${batchStudentsCount}` 
                    : batchStudentsCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BatchDetailHeader;
