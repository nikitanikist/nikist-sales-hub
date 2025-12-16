import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart } from "lucide-react";

interface PreferencesStepProps {
  data: {
    referral_source: string;
    primary_goal: string;
    preferred_communication: string;
    preferred_contact_time: string;
    interests: string[];
    monthly_budget: string;
    decision_factors: string[];
  };
  onChange: (field: string, value: any) => void;
}

const referralSources = [
  "Social Media (Facebook/Instagram)",
  "YouTube",
  "Google Search",
  "Friend/Family Referral",
  "LinkedIn",
  "Email",
  "Advertisement",
  "Other",
];

const primaryGoals = [
  "Learn Crypto Trading",
  "Generate Passive Income",
  "Build Wealth",
  "Career Change",
  "Start a Business",
  "Improve Financial Literacy",
  "Other",
];

const communicationMethods = [
  "WhatsApp",
  "Phone Call",
  "Email",
  "SMS",
];

const contactTimes = [
  "Morning (9 AM - 12 PM)",
  "Afternoon (12 PM - 4 PM)",
  "Evening (4 PM - 8 PM)",
  "Night (8 PM - 10 PM)",
  "Any Time",
];

const interestOptions = [
  "Cryptocurrency",
  "Stock Market",
  "Forex Trading",
  "Real Estate",
  "Mutual Funds",
  "Digital Marketing",
  "E-commerce",
  "Freelancing",
];

const budgetRanges = [
  "Less than ₹5,000",
  "₹5,000 - ₹15,000",
  "₹15,000 - ₹30,000",
  "₹30,000 - ₹50,000",
  "₹50,000 - ₹1,00,000",
  "₹1,00,000+",
];

const decisionFactorOptions = [
  "Price/Value",
  "Quality of Content",
  "Trainer's Experience",
  "Reviews/Testimonials",
  "Certification",
  "Community Support",
  "Time Commitment",
];

export function PreferencesStep({ data, onChange }: PreferencesStepProps) {
  const handleInterestToggle = (interest: string) => {
    const newInterests = data.interests.includes(interest)
      ? data.interests.filter((i) => i !== interest)
      : [...data.interests, interest];
    onChange("interests", newInterests);
  };

  const handleDecisionFactorToggle = (factor: string) => {
    const newFactors = data.decision_factors.includes(factor)
      ? data.decision_factors.filter((f) => f !== factor)
      : [...data.decision_factors, factor];
    onChange("decision_factors", newFactors);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-full">
          <Heart className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Preferences & Interests</h2>
          <p className="text-sm text-muted-foreground">Help us personalize your experience</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="referral_source">How did you hear about us?</Label>
          <Select value={data.referral_source} onValueChange={(value) => onChange("referral_source", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {referralSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_goal">Primary Goal</Label>
          <Select value={data.primary_goal} onValueChange={(value) => onChange("primary_goal", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select your goal" />
            </SelectTrigger>
            <SelectContent>
              {primaryGoals.map((goal) => (
                <SelectItem key={goal} value={goal}>
                  {goal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="preferred_communication">Preferred Communication</Label>
          <Select value={data.preferred_communication} onValueChange={(value) => onChange("preferred_communication", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {communicationMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="preferred_contact_time">Preferred Contact Time</Label>
          <Select value={data.preferred_contact_time} onValueChange={(value) => onChange("preferred_contact_time", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {contactTimes.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly_budget">Monthly Learning Budget</Label>
          <Select value={data.monthly_budget} onValueChange={(value) => onChange("monthly_budget", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select budget" />
            </SelectTrigger>
            <SelectContent>
              {budgetRanges.map((range) => (
                <SelectItem key={range} value={range}>
                  {range}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Areas of Interest (Select all that apply)</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {interestOptions.map((interest) => (
            <div key={interest} className="flex items-center space-x-2">
              <Checkbox
                id={interest}
                checked={data.interests.includes(interest)}
                onCheckedChange={() => handleInterestToggle(interest)}
              />
              <label
                htmlFor={interest}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {interest}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>What factors influence your decision? (Select all that apply)</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {decisionFactorOptions.map((factor) => (
            <div key={factor} className="flex items-center space-x-2">
              <Checkbox
                id={factor}
                checked={data.decision_factors.includes(factor)}
                onCheckedChange={() => handleDecisionFactorToggle(factor)}
              />
              <label
                htmlFor={factor}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {factor}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
