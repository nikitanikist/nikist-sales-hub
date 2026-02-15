import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useWhatsAppSession } from "@/hooks/useWhatsAppSession";
import { useCommunityTemplates } from "@/hooks/useCommunityTemplates";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Users,
  MessageSquare,
  Upload,
  X,
  Shield,
  Megaphone,
  ImageIcon,
} from "lucide-react";

type CreationType = "community" | "group";

interface SuccessResult {
  inviteLink: string;
  communityId?: string;
  announcementGroupId?: string;
}

const CreateCommunity = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { sessions } = useWhatsAppSession();
  const { templates, templatesLoading } = useCommunityTemplates();
  const queryClient = useQueryClient();

  const [type, setType] = useState<CreationType>("community");
  const [sessionId, setSessionId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("none");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [announcement, setAnnouncement] = useState(false);
  const [restrict, setRestrict] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState<SuccessResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connectedSessions = useMemo(
    () => sessions?.filter((s) => s.status === "connected") || [],
    [sessions]
  );

  const effectiveSessionId = connectedSessions.length === 1 ? connectedSessions[0].id : sessionId;

  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    if (value !== "none") {
      const tpl = templates.find((t) => t.id === value);
      if (tpl) {
        const tagName = tpl.tag?.name || "";
        setName(tagName);
        setDescription(tpl.description_template);
        setProfilePictureUrl(tpl.profile_picture_url || null);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `profile-pictures/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("community-templates")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("community-templates")
        .getPublicUrl(filePath);

      setProfilePictureUrl(publicUrl);
      toast.success("Image uploaded");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreate = async () => {
    if (!currentOrganization || !effectiveSessionId || !name.trim()) return;

    if (type === "group") {
      toast.info("Group creation coming soon", {
        description: "This feature requires a VPS update. Please create a Community for now.",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await supabase.functions.invoke("vps-whatsapp-proxy", {
        body: {
          action: "create-community-standalone",
          sessionId: effectiveSessionId,
          organizationId: currentOrganization.id,
          name: name.trim(),
          description: description.trim() || name.trim(),
          announcement,
          restrict,
          profilePictureUrl: profilePictureUrl || undefined,
        },
      });

      if (response.error) throw new Error(response.error.message || "Failed to create community");

      const data = response.data;
      if (!data?.success) throw new Error(data?.error || "Creation failed");

      setSuccess({
        inviteLink: data.inviteLink || "",
        communityId: data.communityId,
        announcementGroupId: data.announcementGroupId,
      });

      queryClient.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      toast.success("Community created successfully!");
    } catch (err: any) {
      console.error("Create community error:", err);
      toast.error("Failed to create community", { description: err.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!success?.inviteLink) return;
    await navigator.clipboard.writeText(success.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isValid = name.trim().length > 0 && effectiveSessionId;

  // Success state
  if (success) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Community Created</h1>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-6 space-y-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Your community is ready!</h2>
                <p className="text-sm text-muted-foreground">Share the invite link below to add members.</p>
              </div>
            </div>

            <div className="rounded-lg border bg-background p-4">
              <Label className="text-xs text-muted-foreground mb-1 block">Invite Link</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm break-all select-all">
                  {success.inviteLink || "No invite link returned"}
                </code>
                {success.inviteLink && (
                  <Button variant="ghost" size="icon" onClick={handleCopy} className="shrink-0">
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>

            <Button onClick={() => navigate("/whatsapp")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">
          Create {type === "community" ? "Community" : "Group"}
        </h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-5">
          {/* Type Selection */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <Label className="text-sm font-medium">Type</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as CreationType)}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  htmlFor="type-community"
                  className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    type === "community"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <RadioGroupItem value="community" id="type-community" />
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      Community
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">With announcement group</p>
                  </div>
                </label>
                <label
                  htmlFor="type-group"
                  className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    type === "group"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <RadioGroupItem value="group" id="type-group" />
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Group
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Standard WhatsApp group</p>
                  </div>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Main Form */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              {/* WhatsApp Number */}
              {connectedSessions.length > 1 && (
                <div className="space-y-2">
                  <Label>WhatsApp Number</Label>
                  <Select value={sessionId} onValueChange={setSessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a number" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedSessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.display_name || s.phone_number || s.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Template */}
              {type === "community" && templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Template (optional)</Label>
                  <Select value={templateId} onValueChange={handleTemplateChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None – enter manually</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.tag?.name || t.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Profile Picture */}
              {type === "community" && (
                <div className="space-y-2">
                  <Label>Profile Picture (optional)</Label>
                  <div className="flex items-center gap-3">
                    {profilePictureUrl ? (
                      <div className="relative">
                        <img
                          src={profilePictureUrl}
                          alt="Profile"
                          className="h-16 w-16 rounded-full object-cover border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5"
                          onClick={() => setProfilePictureUrl(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Image
                      </Button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Square image recommended. Max 2MB.</p>
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`${type === "community" ? "Community" : "Group"} name`}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          {type === "community" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Community Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="sw-announcement" className="font-medium text-sm flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      Announcement only
                    </Label>
                    <p className="text-xs text-muted-foreground pl-6">
                      Only admins can send messages in the group
                    </p>
                  </div>
                  <Switch
                    id="sw-announcement"
                    checked={announcement}
                    onCheckedChange={setAnnouncement}
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="sw-restrict" className="font-medium text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      Restrict settings
                    </Label>
                    <p className="text-xs text-muted-foreground pl-6">
                      Only admins can edit community name, icon, description, create groups inside the community, and add new members
                    </p>
                  </div>
                  <Switch
                    id="sw-restrict"
                    checked={restrict}
                    onCheckedChange={setRestrict}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {type === "group" && (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground text-center">
                  Group creation requires a VPS update and is coming soon.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/whatsapp")} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!isValid || isCreating || type === "group"}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                `Create ${type === "community" ? "Community" : "Group"}`
              )}
            </Button>
          </div>
        </div>

        {/* Right Column - Live Preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <Card className="overflow-hidden bg-[#efeae2]">
            <CardHeader className="pb-3 bg-background">
              <CardTitle className="text-sm font-medium">Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="bg-background rounded-xl shadow-sm overflow-hidden">
                {/* Community header */}
                <div className="bg-gradient-to-b from-primary/10 to-transparent p-6 flex flex-col items-center text-center gap-3">
                  {profilePictureUrl ? (
                    <img
                      src={profilePictureUrl}
                      alt="Community"
                      className="h-20 w-20 rounded-full object-cover border-2 border-background shadow-md"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-background shadow-md">
                      {type === "community" ? (
                        <Users className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-base">
                      {name || (type === "community" ? "Community Name" : "Group Name")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {type === "community" ? "Community" : "Group"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="px-5 py-3 border-t">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Description</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {description || "No description"}
                  </p>
                </div>

                {/* Announcement Group (if community + announcement) */}
                {type === "community" && announcement && (
                  <div className="px-5 py-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Megaphone className="h-4 w-4 text-primary" />
                      <span className="font-medium">Announcement Group</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 pl-6">
                      Only admins can send messages
                    </p>
                  </div>
                )}

                {/* Settings summary */}
                {type === "community" && (
                  <div className="px-5 py-3 border-t space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Settings</p>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <Megaphone className="h-3.5 w-3.5" />
                        <span>Announcement:</span>
                        <span className={announcement ? "text-primary font-medium" : "text-muted-foreground"}>
                          {announcement ? "On" : "Off"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Shield className="h-3.5 w-3.5" />
                        <span>Restricted:</span>
                        <span className={restrict ? "text-primary font-medium" : "text-muted-foreground"}>
                          {restrict ? "On" : "Off"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateCommunity;
