import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

interface ParsedContact {
  name: string;
  phone: string;
}

interface Props {
  onContactsParsed: (contacts: ParsedContact[]) => void;
}

export function CsvUploader({ onContactsParsed }: Props) {
  const [fileName, setFileName] = useState<string>("");
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      setErrors(["CSV must have a header row and at least one data row"]);
      return;
    }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
    const nameIdx = header.findIndex((h) => ["name", "contact_name", "lead_name"].includes(h));
    const phoneIdx = header.findIndex((h) => ["phone", "contact_number", "mobile", "phone_number"].includes(h));

    if (nameIdx === -1 || phoneIdx === -1) {
      setErrors(["CSV must have 'name' and 'phone' columns"]);
      return;
    }

    const parsed: ParsedContact[] = [];
    const errs: string[] = [];
    const seen = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
      const name = cols[nameIdx] || "";
      let phone = cols[phoneIdx]?.replace(/\s/g, "") || "";

      if (!name || !phone) {
        errs.push(`Row ${i + 1}: Missing name or phone`);
        continue;
      }

      // Normalize phone
      phone = phone.replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
      if (!/^\d{10}$/.test(phone)) {
        errs.push(`Row ${i + 1}: Invalid phone number`);
        continue;
      }

      if (seen.has(phone)) {
        errs.push(`Row ${i + 1}: Duplicate phone ${phone}`);
        continue;
      }
      seen.add(phone);
      parsed.push({ name, phone: `+91${phone}` });
    }

    if (parsed.length > 10000) {
      errs.push("Maximum 10,000 contacts allowed per campaign");
      parsed.length = 10000;
    }

    setContacts(parsed);
    setErrors(errs);
    if (parsed.length > 0) onContactsParsed(parsed);
  }, [onContactsParsed]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <Label>Upload CSV File</Label>
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-2">CSV with columns: name, phone</p>
        <Input type="file" accept=".csv" onChange={handleFile} className="max-w-xs mx-auto" />
      </div>
      {fileName && (
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          <span>{fileName}</span>
          {contacts.length > 0 && (
            <span className="text-green-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" />{contacts.length} contacts parsed</span>
          )}
        </div>
      )}
      {errors.length > 0 && (
        <div className="bg-destructive/10 rounded-md p-3 space-y-1">
          {errors.slice(0, 5).map((err, i) => (
            <p key={i} className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p>
          ))}
          {errors.length > 5 && <p className="text-xs text-destructive">...and {errors.length - 5} more errors</p>}
        </div>
      )}
    </div>
  );
}
