import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { PersonalInfoStep } from "@/components/onboarding/PersonalInfoStep";
import { LocationStep } from "@/components/onboarding/LocationStep";
import { OccupationStep } from "@/components/onboarding/OccupationStep";
import { FinancialStep } from "@/components/onboarding/FinancialStep";
import { PreferencesStep } from "@/components/onboarding/PreferencesStep";
import { ConsentStep } from "@/components/onboarding/ConsentStep";

const TOTAL_STEPS = 6;

interface OnboardingData {
  // Personal
  full_name: string;
  email: string;
  phone: string;
  gender: string;
  age_group: string;
  date_of_birth: Date | null;
  marital_status: string;
  // Location
  country: string;
  state: string;
  city: string;
  area_type: string;
  // Occupation
  occupation: string;
  industry: string;
  job_title: string;
  years_experience: string;
  company_size: string;
  business_type: string;
  business_years: string;
  team_size: string;
  annual_revenue: string;
  education_level: string;
  field_of_study: string;
  // Financial
  monthly_income: string;
  income_source: string;
  dependents: string;
  // Preferences
  referral_source: string;
  primary_goal: string;
  preferred_communication: string;
  preferred_contact_time: string;
  interests: string[];
  monthly_budget: string;
  decision_factors: string[];
  // Consent
  marketing_consent: boolean;
  terms_accepted: boolean;
}

const initialData: OnboardingData = {
  full_name: "",
  email: "",
  phone: "",
  gender: "",
  age_group: "",
  date_of_birth: null,
  marital_status: "",
  country: "",
  state: "",
  city: "",
  area_type: "",
  occupation: "",
  industry: "",
  job_title: "",
  years_experience: "",
  company_size: "",
  business_type: "",
  business_years: "",
  team_size: "",
  annual_revenue: "",
  education_level: "",
  field_of_study: "",
  monthly_income: "",
  income_source: "",
  dependents: "",
  referral_source: "",
  primary_goal: "",
  preferred_communication: "",
  preferred_contact_time: "",
  interests: [],
  monthly_budget: "",
  decision_factors: [],
  marketing_consent: false,
  terms_accepted: false,
};

export default function Onboarding() {
  const { currentOrganization } = useOrganization();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [data, setData] = useState<OnboardingData>(initialData);

  const handleChange = (field: string, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!data.full_name.trim() || !data.email.trim()) {
          toast({
            title: "Required fields missing",
            description: "Please fill in your name and email",
            variant: "destructive",
          });
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          toast({
            title: "Invalid email",
            description: "Please enter a valid email address",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case 2:
        if (!data.country || !data.state || !data.city) {
          toast({
            title: "Required fields missing",
            description: "Please fill in country, state, and city",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case 3:
        if (!data.occupation) {
          toast({
            title: "Required field missing",
            description: "Please select your occupation",
            variant: "destructive",
          });
          return false;
        }
        if (data.occupation === "Salaried" && (!data.industry || !data.job_title)) {
          toast({
            title: "Required fields missing",
            description: "Please fill in industry and job title",
            variant: "destructive",
          });
          return false;
        }
        if (data.occupation === "Business Owner" && !data.business_type) {
          toast({
            title: "Required field missing",
            description: "Please select your business type",
            variant: "destructive",
          });
          return false;
        }
        if (data.occupation === "Student" && (!data.education_level || !data.field_of_study)) {
          toast({
            title: "Required fields missing",
            description: "Please fill in education level and field of study",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        if (!data.terms_accepted) {
          toast({
            title: "Terms required",
            description: "Please accept the terms and conditions to continue",
            variant: "destructive",
          });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      // Step 1: Create lead in leads table
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .insert({
          contact_name: data.full_name,
          email: data.email,
          phone: data.phone || null,
          country: data.country || null,
          company_name: data.occupation || "Individual",
          source: "customer_insights_form",
          status: "new",
        })
        .select("id")
        .single();

      if (leadError) throw leadError;

      // Step 2: Store detailed responses in customer_onboarding
      const { error: onboardingError } = await supabase.from("customer_onboarding").insert({
        lead_id: leadData.id,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        gender: data.gender || null,
        age_group: data.age_group || null,
        date_of_birth: data.date_of_birth?.toISOString().split("T")[0] || null,
        marital_status: data.marital_status || null,
        country: data.country || null,
        state: data.state || null,
        city: data.city || null,
        area_type: data.area_type || null,
        occupation: data.occupation || null,
        industry: data.industry || null,
        job_title: data.job_title || null,
        years_experience: data.years_experience || null,
        company_size: data.company_size || null,
        business_type: data.business_type || null,
        business_years: data.business_years || null,
        team_size: data.team_size || null,
        annual_revenue: data.annual_revenue || null,
        education_level: data.education_level || null,
        field_of_study: data.field_of_study || null,
        monthly_income: data.monthly_income || null,
        income_source: data.income_source || null,
        dependents: data.dependents || null,
        referral_source: data.referral_source || null,
        primary_goal: data.primary_goal || null,
        preferred_communication: data.preferred_communication || null,
        preferred_contact_time: data.preferred_contact_time || null,
        interests: data.interests.length > 0 ? data.interests : null,
        monthly_budget: data.monthly_budget || null,
        decision_factors: data.decision_factors.length > 0 ? data.decision_factors : null,
        marketing_consent: data.marketing_consent,
        terms_accepted: data.terms_accepted,
        current_step: TOTAL_STEPS,
        completed_at: new Date().toISOString(),
      });

      if (onboardingError) throw onboardingError;

      // Step 3: Get Customer Insights product and create lead_assignment
      const { data: productData } = await supabase
        .from("products")
        .select("id, funnel_id")
        .eq("product_name", "Customer Insights")
        .maybeSingle();

      if (productData) {
        await supabase.from("lead_assignments").insert({
          lead_id: leadData.id,
          product_id: productData.id,
          funnel_id: productData.funnel_id,
        });
      }

      setIsComplete(true);
    } catch (error: any) {
      console.error("Error submitting onboarding:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalInfoStep
            data={{
              full_name: data.full_name,
              email: data.email,
              phone: data.phone,
              gender: data.gender,
              age_group: data.age_group,
              date_of_birth: data.date_of_birth,
              marital_status: data.marital_status,
            }}
            onChange={handleChange}
          />
        );
      case 2:
        return (
          <LocationStep
            data={{
              country: data.country,
              state: data.state,
              city: data.city,
              area_type: data.area_type,
            }}
            onChange={handleChange}
          />
        );
      case 3:
        return (
          <OccupationStep
            data={{
              occupation: data.occupation,
              industry: data.industry,
              job_title: data.job_title,
              years_experience: data.years_experience,
              company_size: data.company_size,
              business_type: data.business_type,
              business_years: data.business_years,
              team_size: data.team_size,
              annual_revenue: data.annual_revenue,
              education_level: data.education_level,
              field_of_study: data.field_of_study,
            }}
            onChange={handleChange}
          />
        );
      case 4:
        return (
          <FinancialStep
            data={{
              monthly_income: data.monthly_income,
              income_source: data.income_source,
              dependents: data.dependents,
            }}
            onChange={handleChange}
          />
        );
      case 5:
        return (
          <PreferencesStep
            data={{
              referral_source: data.referral_source,
              primary_goal: data.primary_goal,
              preferred_communication: data.preferred_communication,
              preferred_contact_time: data.preferred_contact_time,
              interests: data.interests,
              monthly_budget: data.monthly_budget,
              decision_factors: data.decision_factors,
            }}
            onChange={handleChange}
          />
        );
      case 6:
        return (
          <ConsentStep
            data={{
              marketing_consent: data.marketing_consent,
              terms_accepted: data.terms_accepted,
            }}
            onChange={handleChange}
          />
        );
      default:
        return null;
    }
  };

  // Thank you screen
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-2xl border-0">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">Thank You!</h1>
            <p className="text-muted-foreground mb-6">
              Your information has been submitted successfully. Our team will review your details and get in touch with you soon.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-foreground mb-2">What happens next?</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Our team will review your submission</li>
                <li>• You'll receive a confirmation email</li>
                <li>• A representative will contact you within 24-48 hours</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">{currentOrganization?.name || "Welcome"}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Customer Insights</h1>
          <p className="text-muted-foreground">Help us understand you better to serve you best</p>
        </div>

        <OnboardingProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        <Card className="shadow-2xl border-0">
          <CardContent className="p-6 md:p-8">
            {renderStep()}

            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              {currentStep < TOTAL_STEPS ? (
                <Button onClick={handleNext} className="gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Complete"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your data is secure and will only be used to improve your experience.
        </p>
      </div>
    </div>
  );
}
