import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, AlertCircle, XCircle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ImportCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshops: any[];
  products: any[];
  salesClosers: any[];
  onSuccess: () => void;
}

interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  mango_id: string;
  transaction_date: string;
  product_name: string;
  assigned_to_email: string;
  status: "ready" | "duplicate" | "error";
  error?: string;
}

const SAMPLE_CSV = `name,email,phone,mango_id,transaction_date,product_name,assigned_to_email
Rahul Kumar,rahul@gmail.com,919876543210,TM12345,2026-01-05,,
Priya Sharma,priya@email.com,918765432109,TM12346,2025-12-20,,`;

export const ImportCustomersDialog = ({
  open,
  onOpenChange,
  workshops,
  products,
  salesClosers,
  onSuccess,
}: ImportCustomersDialogProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedAssignTo, setSelectedAssignTo] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("new");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, duplicates: 0, errors: 0 });

  const resetDialog = () => {
    setStep("upload");
    setSelectedWorkshop("");
    setSelectedProduct("");
    setSelectedAssignTo("");
    setSelectedStatus("new");
    setParsedRows([]);
    setImportProgress(0);
    setImportResults({ success: 0, duplicates: 0, errors: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_customers.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of line) {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (!headers.includes("name") || !headers.includes("email")) {
      toast.error("CSV must have 'name' and 'email' columns");
      return;
    }

    // Get existing emails for duplicate detection
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("email")
      .order("email");
    
    const existingEmails = new Set(existingLeads?.map(l => l.email.toLowerCase()) || []);
    const seenEmails = new Set<string>();

    const nameIdx = headers.indexOf("name");
    const emailIdx = headers.indexOf("email");
    const phoneIdx = headers.indexOf("phone");
    const mangoIdIdx = headers.indexOf("mango_id");
    const transactionDateIdx = headers.indexOf("transaction_date");
    const productNameIdx = headers.indexOf("product_name");
    const assignedToEmailIdx = headers.indexOf("assigned_to_email");

    const parsed: ParsedRow[] = rows.map(row => {
      const name = row[nameIdx] || "";
      const email = row[emailIdx] || "";
      const phone = row[phoneIdx] || "";
      const mango_id = row[mangoIdIdx] || "";
      const transaction_date = row[transactionDateIdx] || "";
      const product_name = row[productNameIdx] || "";
      const assigned_to_email = row[assignedToEmailIdx] || "";

      let status: ParsedRow["status"] = "ready";
      let error: string | undefined;

      if (!name.trim()) {
        status = "error";
        error = "Missing name";
      } else if (!email.trim()) {
        status = "error";
        error = "Missing email";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status = "error";
        error = "Invalid email format";
      } else if (existingEmails.has(email.toLowerCase())) {
        status = "duplicate";
        error = "Email exists in CRM";
      } else if (seenEmails.has(email.toLowerCase())) {
        status = "duplicate";
        error = "Duplicate in file";
      }

      if (status === "ready") {
        seenEmails.add(email.toLowerCase());
      }

      return { name, email, phone, mango_id, transaction_date, product_name, assigned_to_email, status, error };
    });

    setParsedRows(parsed);
    setStep("preview");
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.status === "ready");
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setStep("importing");
    let success = 0;
    let errors = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        // Find product by name if specified
        let productId = selectedProduct || null;
        if (row.product_name && !productId) {
          const matchedProduct = products.find(
            p => p.product_name.toLowerCase() === row.product_name.toLowerCase()
          );
          if (matchedProduct) productId = matchedProduct.id;
        }

        // Find assigned_to by email if specified
        let assignedTo = selectedAssignTo || null;
        if (row.assigned_to_email && !assignedTo) {
          const matchedCloser = salesClosers.find(
            c => c.email?.toLowerCase() === row.assigned_to_email.toLowerCase()
          );
          if (matchedCloser) assignedTo = matchedCloser.id;
        }

        // Extract country from phone
        let country: string | null = null;
        const cleanPhone = row.phone.replace(/\D/g, "");
        if (cleanPhone.startsWith("91") && cleanPhone.length > 10) {
          country = "91";
        } else if (cleanPhone.length === 10) {
          country = "91"; // Default to India for 10-digit
        }

        // Parse transaction date
        let createdAt: string | undefined;
        if (row.transaction_date) {
          const parsed = new Date(row.transaction_date);
          if (!isNaN(parsed.getTime())) {
            createdAt = parsed.toISOString();
          }
        }

        // Insert lead
        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert({
            contact_name: row.name,
            company_name: row.name,
            email: row.email,
            phone: row.phone || null,
            country,
            mango_id: row.mango_id || null,
            status: selectedStatus as any,
            source: "import",
            assigned_to: assignedTo,
            created_by: user?.id,
            created_at: createdAt,
          })
          .select()
          .single();

        if (leadError) throw leadError;

        // Create lead assignment if workshop or product selected
        if (selectedWorkshop || productId) {
          const funnelId = productId 
            ? products.find(p => p.id === productId)?.funnel_id 
            : null;

          await supabase.from("lead_assignments").insert({
            lead_id: newLead.id,
            workshop_id: selectedWorkshop || null,
            product_id: productId,
            funnel_id: funnelId,
            is_connected: !!(selectedWorkshop && productId),
            created_by: user?.id,
          });
        }

        success++;
      } catch (err) {
        console.error("Error importing row:", err);
        errors++;
      }

      setImportProgress(((i + 1) / validRows.length) * 100);
    }

    const duplicates = parsedRows.filter(r => r.status === "duplicate").length;
    setImportResults({ success, duplicates, errors: errors + parsedRows.filter(r => r.status === "error").length });
    setStep("complete");
    
    if (success > 0) {
      onSuccess();
    }
  };

  const readyCount = parsedRows.filter(r => r.status === "ready").length;
  const duplicateCount = parsedRows.filter(r => r.status === "duplicate").length;
  const errorCount = parsedRows.filter(r => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[90vh] max-h-[90vh] min-h-0 overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "complete" ? "Import Complete" : "Add customers"}
          </DialogTitle>
        </DialogHeader>

        {step === "complete" ? (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">{importResults.success} customers imported successfully</span>
              </p>
              {importResults.duplicates > 0 && (
                <p className="flex items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span>{importResults.duplicates} duplicates skipped</span>
                </p>
              )}
              {importResults.errors > 0 && (
                <p className="flex items-center justify-center gap-2 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span>{importResults.errors} rows had errors</span>
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-4">Close</Button>
          </div>
        ) : step === "importing" ? (
          <div className="py-12 space-y-6">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Importing customers...</p>
              <p className="text-muted-foreground">Please wait while we import your customers.</p>
            </div>
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              {Math.round(importProgress)}% complete
            </p>
          </div>
        ) : (
          <Tabs defaultValue="import" className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <TabsList className="w-fit">
              <TabsTrigger value="import">Import CSV</TabsTrigger>
              <TabsTrigger value="manual" disabled>Manually</TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="flex-1 min-h-0 flex flex-col overflow-hidden mt-4">
              {step === "upload" ? (
                <div className="flex-1 min-h-0 overflow-y-auto pr-4">
                  <div className="space-y-6 pb-4">
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="font-medium mb-2">Add customers in bulk</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Import CSV of customers and enroll them into any service.
                      </p>
                      <button 
                        className="text-sm text-primary hover:underline mb-4 block mx-auto"
                        onClick={downloadSampleCSV}
                      >
                        Click here to download sample CSV before uploading.
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Button onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload CSV
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Select a workshop</Label>
                        <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select workshop" />
                          </SelectTrigger>
                          <SelectContent>
                            {workshops?.map(w => (
                              <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Select a product</Label>
                        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Assign to</Label>
                        <Select value={selectedAssignTo} onValueChange={setSelectedAssignTo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select person" />
                          </SelectTrigger>
                          <SelectContent>
                            {salesClosers?.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="won">Won</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      {readyCount} ready to import
                    </span>
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      {duplicateCount} duplicates
                    </span>
                    <span className="flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-red-500" />
                      {errorCount} errors
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Select a workshop</Label>
                      <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select workshop" />
                        </SelectTrigger>
                        <SelectContent>
                          {workshops?.map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Select a product</Label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assign to</Label>
                      <Select value={selectedAssignTo} onValueChange={setSelectedAssignTo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesClosers?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 border rounded-lg overflow-auto">
                    <table className="min-w-[1100px] w-full caption-bottom text-sm">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Status</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Workshop</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Assigned To</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedRows.map((row, idx) => {
                          const workshopName = selectedWorkshop 
                            ? workshops.find(w => w.id === selectedWorkshop)?.title 
                            : "-";
                          const productName = row.product_name || 
                            (selectedProduct ? products.find(p => p.id === selectedProduct)?.product_name : "-");
                          const assignedName = row.assigned_to_email ||
                            (selectedAssignTo ? salesClosers.find(c => c.id === selectedAssignTo)?.full_name : "-");

                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                {row.status === "ready" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                {row.status === "duplicate" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                                {row.status === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                              </TableCell>
                              <TableCell>
                                <div>
                                  {row.name || <span className="text-red-500">(empty)</span>}
                                  {row.error && <p className="text-xs text-red-500">{row.error}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{row.email || "-"}</TableCell>
                              <TableCell className="whitespace-nowrap">{row.phone || "-"}</TableCell>
                              <TableCell>{workshopName}</TableCell>
                              <TableCell>{productName || "-"}</TableCell>
                              <TableCell>{assignedName || "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setStep("upload"); setParsedRows([]); }}>
                      Back
                    </Button>
                    <Button onClick={handleImport} disabled={readyCount === 0}>
                      Import {readyCount} Customers
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
