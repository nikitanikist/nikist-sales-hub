import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ImportMoneyFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  date: string;
  total_revenue: number;
  cash_collected: number;
  notes: string;
  status: "ready" | "duplicate" | "error" | "will_update";
  error?: string;
}

type Step = "upload" | "preview" | "importing" | "complete";

export function ImportMoneyFlowDialog({ open, onOpenChange }: ImportMoneyFlowDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, updated: 0, errors: 0 });
  const queryClient = useQueryClient();

  const resetDialog = useCallback(() => {
    setStep("upload");
    setParsedRows([]);
    setImportProgress(0);
    setImportResults({ success: 0, updated: 0, errors: 0 });
  }, []);

  const handleClose = useCallback(() => {
    resetDialog();
    onOpenChange(false);
  }, [onOpenChange, resetDialog]);

  const downloadSampleCSV = () => {
    const sampleData = `date,total_revenue,cash_collected,notes
2024-06-01,150000,125000,Workshop batch 1
2024-06-02,85000,72000,
2024-06-03,210000,180000,High conversion day
2024-06-04,95000,80000,Regular day
2024-06-05,175000,150000,Good sales`;

    const blob = new Blob([sampleData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "money_flow_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });

    return { headers, rows };
  };

  const validateDate = (dateStr: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    // Validate required columns
    const requiredColumns = ["date", "total_revenue", "cash_collected"];
    const missingColumns = requiredColumns.filter((col) => !headers.includes(col));

    if (missingColumns.length > 0) {
      toast.error(`Missing required columns: ${missingColumns.join(", ")}`);
      return;
    }

    const dateIndex = headers.indexOf("date");
    const revenueIndex = headers.indexOf("total_revenue");
    const cashIndex = headers.indexOf("cash_collected");
    const notesIndex = headers.indexOf("notes");

    // Fetch existing dates to check for duplicates
    const { data: existingEntries } = await supabase
      .from("daily_money_flow")
      .select("date");

    const existingDates = new Set(existingEntries?.map((e) => e.date) || []);

    const parsed: ParsedRow[] = rows
      .filter((row) => row.some((cell) => cell.trim() !== ""))
      .map((row) => {
        const date = row[dateIndex]?.trim() || "";
        const revenueStr = row[revenueIndex]?.trim() || "";
        const cashStr = row[cashIndex]?.trim() || "";
        const notes = notesIndex >= 0 ? row[notesIndex]?.trim() || "" : "";

        // Validate date
        if (!validateDate(date)) {
          return {
            date,
            total_revenue: 0,
            cash_collected: 0,
            notes,
            status: "error" as const,
            error: "Invalid date format (use YYYY-MM-DD)",
          };
        }

        // Validate numbers
        const revenue = parseFloat(revenueStr.replace(/,/g, ""));
        const cash = parseFloat(cashStr.replace(/,/g, ""));

        if (isNaN(revenue) || isNaN(cash)) {
          return {
            date,
            total_revenue: revenue || 0,
            cash_collected: cash || 0,
            notes,
            status: "error" as const,
            error: "Invalid number format for revenue or cash",
          };
        }

        // Check for duplicates
        if (existingDates.has(date)) {
          return {
            date,
            total_revenue: revenue,
            cash_collected: cash,
            notes,
            status: "will_update" as const,
          };
        }

        return {
          date,
          total_revenue: revenue,
          cash_collected: cash,
          notes,
          status: "ready" as const,
        };
      });

    setParsedRows(parsed);
    setStep("preview");
  };

  const handleImport = async () => {
    setStep("importing");
    let success = 0;
    let updated = 0;
    let errors = 0;

    const validRows = parsedRows.filter((row) => row.status !== "error");
    const total = validRows.length;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      try {
        const { error } = await supabase.from("daily_money_flow").upsert(
          {
            date: row.date,
            total_revenue: row.total_revenue,
            cash_collected: row.cash_collected,
            notes: row.notes || null,
          },
          { onConflict: "date" }
        );

        if (error) {
          errors++;
        } else if (row.status === "will_update") {
          updated++;
        } else {
          success++;
        }
      } catch {
        errors++;
      }

      setImportProgress(Math.round(((i + 1) / total) * 100));
    }

    setImportResults({ success, updated, errors });
    queryClient.invalidateQueries({ queryKey: ["daily-money-flow"] });
    setStep("complete");
  };

  const readyCount = parsedRows.filter((r) => r.status === "ready").length;
  const updateCount = parsedRows.filter((r) => r.status === "will_update").length;
  const errorCount = parsedRows.filter((r) => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Bulk Import Money Flow Data"}
            {step === "preview" && "Preview Import Data"}
            {step === "importing" && "Importing Data..."}
            {step === "complete" && "Import Complete"}
          </DialogTitle>
        </DialogHeader>

        {step === "complete" && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h3 className="text-xl font-semibold">Import Completed!</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                <p className="text-sm text-muted-foreground">New Entries</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{importResults.updated}</p>
                <p className="text-sm text-muted-foreground">Updated</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{importResults.errors}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-6 py-8">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing entries...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
            <p className="text-center text-muted-foreground">Please wait while we import your data...</p>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium">CSV Format Requirements:</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><strong>date</strong> - Date in YYYY-MM-DD format (e.g., 2024-06-15)</li>
                  <li><strong>total_revenue</strong> - Revenue amount (number)</li>
                  <li><strong>cash_collected</strong> - Cash collected amount (number)</li>
                  <li><strong>notes</strong> - Optional notes (text)</li>
                </ul>
              </div>

              <Button variant="outline" onClick={downloadSampleCSV} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Sample CSV
              </Button>

              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Click to upload CSV</p>
                  <p className="text-sm text-muted-foreground">or drag and drop</p>
                </label>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {readyCount} Ready to import
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {updateCount} Will be updated
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive">
                  {errorCount} Errors
                </Badge>
              )}
            </div>

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cash Collected</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, index) => (
                    <TableRow key={index} className={row.status === "error" ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <TableCell>
                        {row.status === "ready" && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {row.status === "will_update" && (
                          <AlertCircle className="h-4 w-4 text-blue-500" />
                        )}
                        {row.status === "error" && (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-red-500">{row.error}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right">
                        ₹{row.total_revenue.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{row.cash_collected.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetDialog}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={readyCount + updateCount === 0}
              >
                Import {readyCount + updateCount} Entries
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
