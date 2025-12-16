import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase } from "lucide-react";

interface OccupationStepProps {
  data: {
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
  };
  onChange: (field: string, value: string) => void;
}

const occupationTypes = ["Salaried", "Business Owner", "Student", "Retired", "Homemaker", "Unemployed"];
const industries = [
  "IT/Software", "Healthcare", "Finance/Banking", "Education", "Manufacturing",
  "Retail", "Real Estate", "Media/Entertainment", "Government", "Agriculture",
  "Hospitality", "Legal", "Consulting", "E-commerce", "Other",
];
const experienceRanges = ["0-2 years", "3-5 years", "6-10 years", "11-15 years", "15+ years"];
const companySizes = ["1-10 employees", "11-50 employees", "51-200 employees", "201-500 employees", "500+ employees"];
const businessTypes = ["Sole Proprietorship", "Partnership", "Private Limited", "LLP", "Public Limited", "Other"];
const businessYearsRanges = ["Less than 1 year", "1-3 years", "3-5 years", "5-10 years", "10+ years"];
const teamSizes = ["Just me", "2-5 members", "6-10 members", "11-25 members", "25+ members"];
const revenueRanges = ["Less than ₹5 Lakhs", "₹5-25 Lakhs", "₹25-50 Lakhs", "₹50 Lakhs - 1 Crore", "₹1-5 Crores", "₹5+ Crores"];
const educationLevels = ["High School", "Diploma", "Bachelor's Degree", "Master's Degree", "PhD", "Other"];
const fieldsOfStudy = [
  "Engineering", "Medicine", "Business/Commerce", "Arts/Humanities", "Science",
  "Law", "Design", "Agriculture", "Other",
];

export function OccupationStep({ data, onChange }: OccupationStepProps) {
  const renderSalariedFields = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="industry">
          Industry <span className="text-destructive">*</span>
        </Label>
        <Select value={data.industry} onValueChange={(value) => onChange("industry", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select industry" />
          </SelectTrigger>
          <SelectContent>
            {industries.map((industry) => (
              <SelectItem key={industry} value={industry}>
                {industry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="job_title">
          Job Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="job_title"
          placeholder="e.g., Software Engineer, Manager"
          value={data.job_title}
          onChange={(e) => onChange("job_title", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="years_experience">Years of Experience</Label>
        <Select value={data.years_experience} onValueChange={(value) => onChange("years_experience", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select experience" />
          </SelectTrigger>
          <SelectContent>
            {experienceRanges.map((range) => (
              <SelectItem key={range} value={range}>
                {range}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company_size">Company Size</Label>
        <Select value={data.company_size} onValueChange={(value) => onChange("company_size", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select company size" />
          </SelectTrigger>
          <SelectContent>
            {companySizes.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const renderBusinessOwnerFields = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="business_type">
          Business Type <span className="text-destructive">*</span>
        </Label>
        <Select value={data.business_type} onValueChange={(value) => onChange("business_type", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select business type" />
          </SelectTrigger>
          <SelectContent>
            {businessTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="business_years">Years in Business</Label>
        <Select value={data.business_years} onValueChange={(value) => onChange("business_years", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select years" />
          </SelectTrigger>
          <SelectContent>
            {businessYearsRanges.map((range) => (
              <SelectItem key={range} value={range}>
                {range}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="team_size">Team Size</Label>
        <Select value={data.team_size} onValueChange={(value) => onChange("team_size", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select team size" />
          </SelectTrigger>
          <SelectContent>
            {teamSizes.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="annual_revenue">Annual Revenue</Label>
        <Select value={data.annual_revenue} onValueChange={(value) => onChange("annual_revenue", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select revenue range" />
          </SelectTrigger>
          <SelectContent>
            {revenueRanges.map((range) => (
              <SelectItem key={range} value={range}>
                {range}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const renderStudentFields = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="education_level">
          Education Level <span className="text-destructive">*</span>
        </Label>
        <Select value={data.education_level} onValueChange={(value) => onChange("education_level", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select education level" />
          </SelectTrigger>
          <SelectContent>
            {educationLevels.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="field_of_study">
          Field of Study <span className="text-destructive">*</span>
        </Label>
        <Select value={data.field_of_study} onValueChange={(value) => onChange("field_of_study", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select field" />
          </SelectTrigger>
          <SelectContent>
            {fieldsOfStudy.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-full">
          <Briefcase className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Occupation Details</h2>
          <p className="text-sm text-muted-foreground">Tell us about your work</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="occupation">
          Current Occupation <span className="text-destructive">*</span>
        </Label>
        <Select value={data.occupation} onValueChange={(value) => onChange("occupation", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select your occupation" />
          </SelectTrigger>
          <SelectContent>
            {occupationTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.occupation && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fade-in">
          {data.occupation === "Salaried" && renderSalariedFields()}
          {data.occupation === "Business Owner" && renderBusinessOwnerFields()}
          {data.occupation === "Student" && renderStudentFields()}
        </div>
      )}
    </div>
  );
}
