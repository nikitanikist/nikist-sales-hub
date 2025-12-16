import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, CheckCircle } from "lucide-react";

interface ConsentStepProps {
  data: {
    marketing_consent: boolean;
    terms_accepted: boolean;
  };
  onChange: (field: string, value: boolean) => void;
}

export function ConsentStep({ data, onChange }: ConsentStepProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-full">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Consent & Agreement</h2>
          <p className="text-sm text-muted-foreground">Almost done! Review and accept our terms</p>
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-6 space-y-4">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="marketing_consent"
            checked={data.marketing_consent}
            onCheckedChange={(checked) => onChange("marketing_consent", checked as boolean)}
          />
          <div className="space-y-1">
            <label
              htmlFor="marketing_consent"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Marketing Communications
            </label>
            <p className="text-sm text-muted-foreground">
              I agree to receive promotional emails, WhatsApp messages, and updates about new courses, 
              offers, and educational content from Nikist. I understand I can unsubscribe at any time.
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Checkbox
            id="terms_accepted"
            checked={data.terms_accepted}
            onCheckedChange={(checked) => onChange("terms_accepted", checked as boolean)}
          />
          <div className="space-y-1">
            <label
              htmlFor="terms_accepted"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Terms & Conditions <span className="text-destructive">*</span>
            </label>
            <p className="text-sm text-muted-foreground">
              I have read and agree to the{" "}
              <a href="#" className="text-primary hover:underline">Terms of Service</a> and{" "}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
              I consent to the collection and processing of my personal data as described.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-primary/5 rounded-lg p-6 border border-primary/20">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">What happens next?</h3>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Our team will review your profile within 24 hours
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            You'll receive personalized course recommendations
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            A dedicated advisor will reach out to discuss your goals
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Get exclusive access to free webinars and resources
          </li>
        </ul>
      </div>
    </div>
  );
}
