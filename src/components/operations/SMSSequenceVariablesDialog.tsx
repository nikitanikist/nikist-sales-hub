import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Info, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface SMSVariable {
  key: string;
  label: string;
}

interface SMSSequenceVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopTitle: string;
  workshopStartDate: string;
  timezone: string;
  manualVariables: SMSVariable[];
  onSubmit: (variables: Record<string, string>) => void;
  isSubmitting: boolean;
}

export function SMSSequenceVariablesDialog({
  open,
  onOpenChange,
  workshopTitle,
  workshopStartDate,
  timezone,
  manualVariables,
  onSubmit,
  isSubmitting,
}: SMSSequenceVariablesDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  // Initialize values
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      manualVariables.forEach(v => {
        initial[v.key] = '';
      });
      setValues(initial);
    }
  }, [open, manualVariables]);

  // Calculate auto-filled values
  const workshopDateInOrgTz = toZonedTime(new Date(workshopStartDate), timezone);
  const autoFilledValues = {
    'Workshop Name': workshopTitle,
    'Date': format(workshopDateInOrgTz, 'MMMM d, yyyy'),
    'Time': format(workshopDateInOrgTz, 'h:mm a'),
  };

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const allFilled = manualVariables.every(v => values[v.key]?.trim());
    if (!allFilled) return;
    onSubmit(values);
  };

  const allFilled = manualVariables.every(v => values[v.key]?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure SMS Variables</DialogTitle>
          <DialogDescription className="text-sm">
            {workshopTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Auto-filled variables (read-only) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Auto-filled from workshop data
            </Label>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              {Object.entries(autoFilledValues).map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Manual variables */}
          {manualVariables.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Enter values for these variables:
              </Label>
              
              {manualVariables.map(v => (
                <div key={v.key} className="space-y-1.5">
                  <Label htmlFor={v.key} className="text-sm font-medium">
                    {v.label} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={v.key}
                    placeholder={`Enter ${v.label.toLowerCase()}...`}
                    value={values[v.key] || ''}
                    onChange={(e) => handleChange(v.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/70">
              These values will be used for all SMS messages in this sequence for this workshop.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allFilled || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              'Save & Run Sequence'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
