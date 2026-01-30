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
import { getVariableLabel, AUTO_FILLED_VARIABLES } from '@/lib/templateVariables';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface SequenceVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopTitle: string;
  workshopStartDate: string;
  timezone: string;
  manualVariables: string[];
  savedValues: Record<string, string>;
  onSubmit: (variables: Record<string, string>) => void;
  isSubmitting: boolean;
}

export function SequenceVariablesDialog({
  open,
  onOpenChange,
  workshopTitle,
  workshopStartDate,
  timezone,
  manualVariables,
  savedValues,
  onSubmit,
  isSubmitting,
}: SequenceVariablesDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  // Initialize values from saved values or empty
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      manualVariables.forEach(key => {
        initial[key] = savedValues[key] || '';
      });
      setValues(initial);
    }
  }, [open, manualVariables, savedValues]);

  // Calculate auto-filled values
  const workshopDateInOrgTz = toZonedTime(new Date(workshopStartDate), timezone);
  const autoFilledValues: Record<string, string> = {
    workshop_name: workshopTitle,
    date: format(workshopDateInOrgTz, 'MMMM d, yyyy'),
    time: format(workshopDateInOrgTz, 'h:mm a'),
  };

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    // Validate all fields are filled
    const allFilled = manualVariables.every(key => values[key]?.trim());
    if (!allFilled) {
      return; // Button is disabled anyway
    }
    onSubmit(values);
  };

  const allFilled = manualVariables.every(key => values[key]?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Message Variables</DialogTitle>
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
              {AUTO_FILLED_VARIABLES.map(key => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{getVariableLabel(key)}</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {autoFilledValues[key]}
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
              
              {manualVariables.map(key => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key} className="text-sm font-medium">
                    {getVariableLabel(key)} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={key}
                    placeholder={`Enter ${getVariableLabel(key).toLowerCase()}...`}
                    value={values[key] || ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/70">
              These values will be used for all messages in this sequence for this workshop only.
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
                Running...
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
