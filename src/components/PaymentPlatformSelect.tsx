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
  "Raz",
  "Razorpay",
  "Bitcoin",
] as const;

// Helper function to get platform fee rate
export const getPlatformFeeRate = (platform: string): number => {
  switch (platform) {
    case "Raz":
      return 0.035; // 3.5%
    case "Razorpay":
    case "TagMango":
      return 0.025; // 2.5%
    default:
      return 0; // UPI (IDFC), UPI (Deepanshu), Bitcoin
  }
};

// Helper function to get hint text for platform fees
export const getPlatformFeesHint = (platform: string): string => {
  switch (platform) {
    case "Raz":
      return "3.5% of Cash";
    case "Razorpay":
    case "TagMango":
      return "2.5% of Cash";
    default:
      return "";
  }
};

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
