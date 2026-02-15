import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useWhatsAppSession } from "@/hooks/useWhatsAppSession";
import { useCommunityTemplates } from "@/hooks/useCommunityTemplates";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Loader2, Copy, Check, Users, MessageSquare } from "lucide-react";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CreationType = "community" | "group";

interface SuccessResult {
  inviteLink: string;
  communityId?: string;
  announcementGroupId?: string;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
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

  const connectedSessions = useMemo(
    () => sessions?.filter((s) => s.status === "connected") || [],
    [sessions]
  );

  // Auto-select if only one session
  const effectiveSessionId = connectedSessions.length === 1 ? connectedSessions[0].id : sessionId;

  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    if (value !== "none") {
      const tpl = templates.find((t) => t.id === value);
      if (tpl) {
        const tagName = tpl.tag?.name || "";
        setName(tagName);
        setDescription(tpl.description_template);
      }
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

  const handleClose = () => {
    // Reset state on close
    setType("community");
    setSessionId("");
    setTemplateId("none");
    setName("");
    setDescription("");
    setAnnouncement(false);
    setRestrict(false);
    setSuccess(null);
    setCopied(false);
    onOpenChange(false);
  };

  const isValid = name.trim().length > 0 && effectiveSessionId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{success ? "Community Created" : "Create New"}</DialogTitle>
          <DialogDescription>
            {success
              ? "Your community is ready. Share the invite link below."
              : "Create a WhatsApp Community or Group."}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <Label className="text-xs text-muted-foreground mb-1 block">Invite Link</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm break-all select-all">
                  {success.inviteLink || "No invite link returned"}
                </code>
                {success.inviteLink && (
                  <Button variant="ghost" size="icon" onClick={handleCopy} className="shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as CreationType)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="community" id="type-community" />
                  <Label htmlFor="type-community" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Community
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="group" id="type-group" />
                  <Label htmlFor="type-group" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Group
                  </Label>
                </div>
              </RadioGroup>
            </div>

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

            {/* Template (community only) */}
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
                rows={3}
              />
            </div>

            {/* Settings (community only) */}
            {type === "community" && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium text-muted-foreground">Community Settings</p>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sw-announcement" className="font-normal text-sm">
                    Announcement only
                  </Label>
                  <Switch
                    id="sw-announcement"
                    checked={announcement}
                    onCheckedChange={setAnnouncement}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sw-restrict" className="font-normal text-sm">
                    Restrict settings
                  </Label>
                  <Switch
                    id="sw-restrict"
                    checked={restrict}
                    onCheckedChange={setRestrict}
                  />
                </div>
              </div>
            )}

            {type === "group" && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Group creation requires a VPS update and is coming soon.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!isValid || isCreating || type === "group"}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
