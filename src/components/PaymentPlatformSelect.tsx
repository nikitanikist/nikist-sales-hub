import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PAYMENT_PLATFORMS = [
  "UPI (IDFC)",
  "UPI (Deepanshu)",
  "TagMango",
  "Razorpay",
  "Bitcoin",
] as const;

interface PaymentPlatformSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PaymentPlatformSelect({
  value,
  onValueChange,
  placeholder = "Select platform",
  disabled = false,
}: PaymentPlatformSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_PLATFORMS.map((platform) => (
          <SelectItem key={platform} value={platform}>
            {platform}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
