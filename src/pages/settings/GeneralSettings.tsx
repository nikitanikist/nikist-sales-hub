import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Building2, Save, Loader2 } from "lucide-react";

export function GeneralSettings() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState(currentOrganization?.name || "");
  const [logoUrl, setLogoUrl] = useState(currentOrganization?.logo_url || "");

  // Sync state when organization changes
  useEffect(() => {
    if (currentOrganization) {
      setName(currentOrganization.name);
      setLogoUrl(currentOrganization.logo_url || "");
    }
  }, [currentOrganization?.id]);

  // Update organization mutation
  const updateMutation = useMutation({
    mutationFn: async ({ name, logoUrl }: { name: string; logoUrl: string }) => {
      if (!currentOrganization?.id) throw new Error("No organization selected");

      const { error } = await supabase
        .from("organizations")
        .update({
          name,
          logo_url: logoUrl || null,
        })
        .eq("id", currentOrganization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast({ title: "Organization updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Name is required",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ name: name.trim(), logoUrl: logoUrl.trim() });
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          General Settings
        </CardTitle>
        <CardDescription>
          Basic information about your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter organization name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug (Read-only)</Label>
            <Input
              id="org-slug"
              value={currentOrganization.slug}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              The slug is used for internal identification and cannot be changed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-logo">Logo URL</Label>
            <Input
              id="org-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted-foreground">
              Enter a URL to your organization's logo image.
            </p>
          </div>

          {logoUrl && (
            <div className="space-y-2">
              <Label>Logo Preview</Label>
              <div className="w-16 h-16 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={logoUrl}
                  alt="Organization logo"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
