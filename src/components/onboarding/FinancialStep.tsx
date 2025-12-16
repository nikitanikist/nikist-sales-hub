import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet } from "lucide-react";

interface FinancialStepProps {
  data: {
    monthly_income: string;
    income_source: string;
    dependents: string;
  };
  onChange: (field: string, value: string) => void;
}

const incomeRanges = [
  "Less than ₹25,000",
  "₹25,000 - ₹50,000",
  "₹50,000 - ₹1,00,000",
  "₹1,00,000 - ₹2,00,000",
  "₹2,00,000 - ₹5,00,000",
  "₹5,00,000+",
  "Prefer not to say",
];

const incomeSources = [
  "Salary/Wages",
  "Business Income",
  "Investments",
  "Rental Income",
  "Freelance/Consulting",
  "Multiple Sources",
  "Other",
];

const dependentsOptions = ["None", "1", "2", "3", "4", "5+"];

export function FinancialStep({ data, onChange }: FinancialStepProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-full">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Financial Information</h2>
          <p className="text-sm text-muted-foreground">Help us understand your financial profile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="monthly_income">Monthly Income</Label>
          <Select value={data.monthly_income} onValueChange={(value) => onChange("monthly_income", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select income range" />
            </SelectTrigger>
            <SelectContent>
              {incomeRanges.map((range) => (
                <SelectItem key={range} value={range}>
                  {range}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="income_source">Primary Income Source</Label>
          <Select value={data.income_source} onValueChange={(value) => onChange("income_source", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select income source" />
            </SelectTrigger>
            <SelectContent>
              {incomeSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dependents">Number of Dependents</Label>
          <Select value={data.dependents} onValueChange={(value) => onChange("dependents", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select dependents" />
            </SelectTrigger>
            <SelectContent>
              {dependentsOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 mt-4">
        <p className="text-sm text-muted-foreground">
          💡 Your financial information helps us provide personalized recommendations that match your investment capacity.
        </p>
      </div>
    </div>
  );
}
