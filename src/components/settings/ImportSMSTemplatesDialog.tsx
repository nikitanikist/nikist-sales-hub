import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, Check, Loader2, X } from 'lucide-react';
import { SMSTemplateVariable, CreateSMSTemplateInput } from '@/hooks/useSMSTemplates';

interface ParsedTemplate {
  dlt_template_id: string;
  name: string;
  content_preview: string;
  variables: SMSTemplateVariable[];
  isDuplicate: boolean;
}

interface ImportSMSTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTemplateIds: string[];
  onImport: (templates: CreateSMSTemplateInput[]) => Promise<any>;
  isImporting: boolean;
}

// Expected columns from Fast2SMS Excel export
const EXPECTED_COLUMNS = {
  templateId: 'TEMPLATE_ID',
  templateName: 'TEMPLATE_NAME',
  templateContent: 'TEMPLATE_CONTENT',
  variableCount: 'VARIABLE_COUNT',
};

// Auto-generate variables based on count
function generateVariables(count: number): SMSTemplateVariable[] {
  if (!count || count <= 0) return [];
  return Array.from({ length: count }, (_, i) => ({
    key: `var${i + 1}`,
    label: `Variable ${i + 1}`,
  }));
}

type Step = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportSMSTemplatesDialog({
  open,
  onOpenChange,
  existingTemplateIds,
  onImport,
  isImporting,
}: ImportSMSTemplatesDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parsedTemplates, setParsedTemplates] = useState<ParsedTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setParsedTemplates([]);
    setError(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    onOpenChange(isOpen);
  };

  const parseExcelFile = async (file: File) => {
    setIsParsing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with header row
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      
      if (rows.length === 0) {
        throw new Error('No data found in the Excel file');
      }

      // Check for required columns
      const firstRow = rows[0];
      const missingColumns: string[] = [];
      if (!(EXPECTED_COLUMNS.templateId in firstRow)) missingColumns.push(EXPECTED_COLUMNS.templateId);
      if (!(EXPECTED_COLUMNS.templateName in firstRow)) missingColumns.push(EXPECTED_COLUMNS.templateName);
      if (!(EXPECTED_COLUMNS.templateContent in firstRow)) missingColumns.push(EXPECTED_COLUMNS.templateContent);

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      // Parse templates
      const templates: ParsedTemplate[] = [];
      const existingSet = new Set(existingTemplateIds);

      for (const row of rows) {
        const templateId = String(row[EXPECTED_COLUMNS.templateId] || '').trim();
        const templateName = String(row[EXPECTED_COLUMNS.templateName] || '').trim();
        const templateContent = String(row[EXPECTED_COLUMNS.templateContent] || '').trim();
        const variableCount = parseInt(String(row[EXPECTED_COLUMNS.variableCount] || '0'), 10);

        // Skip rows with empty template IDs
        if (!templateId) continue;

        templates.push({
          dlt_template_id: templateId,
          name: templateName || `Template ${templateId}`,
          content_preview: templateContent,
          variables: generateVariables(variableCount),
          isDuplicate: existingSet.has(templateId),
        });
      }

      if (templates.length === 0) {
        throw new Error('No valid templates found in the file');
      }

      setParsedTemplates(templates);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.xlsx')) {
      parseExcelFile(file);
    } else {
      setError('Please upload a .xlsx file');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleImport = async () => {
    const templatesToImport = parsedTemplates.filter(t => !t.isDuplicate);
    if (templatesToImport.length === 0) return;

    setStep('importing');
    try {
      await onImport(templatesToImport.map(t => ({
        dlt_template_id: t.dlt_template_id,
        name: t.name,
        content_preview: t.content_preview,
        variables: t.variables,
      })));
      setImportResult({
        imported: templatesToImport.length,
        skipped: parsedTemplates.filter(t => t.isDuplicate).length,
      });
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import templates');
      setStep('preview');
    }
  };

  const readyCount = parsedTemplates.filter(t => !t.isDuplicate).length;
  const duplicateCount = parsedTemplates.filter(t => t.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import SMS Templates</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload your DLT-approved templates from Fast2SMS Excel export.'}
            {step === 'preview' && `Found ${parsedTemplates.length} templates to review.`}
            {step === 'importing' && 'Importing templates...'}
            {step === 'complete' && 'Import complete!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {isParsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">Parsing Excel file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Drop your Excel file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Supports .xlsx from Fast2SMS DLT export
                  </Badge>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Expected columns:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>TEMPLATE_ID (required)</li>
                <li>TEMPLATE_NAME (required)</li>
                <li>TEMPLATE_CONTENT (required)</li>
                <li>VARIABLE_COUNT (optional)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>{readyCount} ready to import</span>
              </div>
              {duplicateCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <X className="h-4 w-4" />
                  <span>{duplicateCount} already exist (will skip)</span>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>DLT ID</TableHead>
                    <TableHead className="w-20">Vars</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTemplates.map((t, idx) => (
                    <TableRow key={idx} className={t.isDuplicate ? 'opacity-50' : ''}>
                      <TableCell>
                        {t.isDuplicate ? (
                          <X className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Check className="h-4 w-4 text-success" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.name}
                          {t.isDuplicate && (
                            <Badge variant="secondary" className="text-xs">Exists</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {t.dlt_template_id.slice(0, 12)}...
                      </TableCell>
                      <TableCell className="text-center">
                        {t.variables.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Importing {readyCount} templates...</p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && importResult && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-success" />
            </div>
            <div className="text-center">
              <p className="font-medium text-lg">Import Complete!</p>
              <p className="text-muted-foreground">
                {importResult.imported} templates imported
                {importResult.skipped > 0 && `, ${importResult.skipped} duplicates skipped`}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={readyCount === 0 || isImporting}>
                {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {readyCount} Templates
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
