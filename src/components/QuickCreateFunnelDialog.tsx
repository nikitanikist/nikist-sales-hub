import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";

interface QuickCreateFunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (funnelId: string, funnelName: string) => void;
}

export function QuickCreateFunnelDialog({
  open,
  onOpenChange,
  onSuccess,
}: QuickCreateFunnelDialogProps) {
  const [funnelName, setFunnelName] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();

  const resetForm = () => {
    setFunnelName("");
    setError("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganization) throw new Error("No organization selected");
      if (!funnelName.trim()) throw new Error("Funnel name is required");

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("funnels")
        .insert([{
          funnel_name: funnelName.trim(),
          amount: 0,
          total_leads: 0,
          created_by: user?.id,
          organization_id: currentOrganization.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      toast.success(`Funnel "${funnelName}" created successfully`);
      onSuccess?.(data.id, data.funnel_name);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!funnelName.trim()) {
      setError("Please enter a funnel name");
      return;
    }
    
    createMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create New Funnel</DialogTitle>
          <DialogDescription>
            Quickly create a new funnel to organize your products and workshops.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="funnel-name">
              Funnel Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="funnel-name"
              placeholder="e.g., Sales Funnel Q1"
              value={funnelName}
              onChange={(e) => {
                setFunnelName(e.target.value);
                if (error) setError("");
              }}
              className={error ? "border-destructive" : ""}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Funnel"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
