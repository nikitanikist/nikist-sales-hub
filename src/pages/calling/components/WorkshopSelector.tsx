import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props {
  onWorkshopSelected: (workshop: { id: string; title: string; contacts: { name: string; phone: string; lead_id: string }[] }) => void;
}

export function WorkshopSelector({ onWorkshopSelected }: Props) {
  const { currentOrganization } = useOrganization();
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: workshops = [] } = useQuery({
    queryKey: ["workshops-for-calling", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("workshops")
        .select("id, title")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization,
  });

  // Fetch leads when workshop selected
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["workshop-leads-for-calling", selectedId],
    queryFn: async () => {
      if (!selectedId || !currentOrganization) return [];
      const { data, error } = await supabase
        .from("lead_assignments")
        .select("lead_id, leads!inner(id, contact_name, phone)")
        .eq("workshop_id", selectedId)
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return (data || [])
        .filter((la: any) => la.leads?.phone)
        .map((la: any) => ({
          name: la.leads.contact_name,
          phone: la.leads.phone,
          lead_id: la.leads.id,
        }));
    },
    enabled: !!selectedId && !!currentOrganization,
  });

  useEffect(() => {
    if (selectedId && contacts.length > 0) {
      const ws = workshops.find((w) => w.id === selectedId);
      if (ws) onWorkshopSelected({ id: ws.id, title: ws.title, contacts });
    }
  }, [selectedId, contacts]);

  return (
    <div className="space-y-3">
      <Label>Select Workshop</Label>
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a workshop..." />
        </SelectTrigger>
        <SelectContent>
          {workshops.map((w) => (
            <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedId && (
        <div className="flex items-center gap-2">
          {loadingContacts ? (
            <span className="text-sm text-muted-foreground">Loading contacts...</span>
          ) : (
            <Badge variant="secondary">{contacts.length} contacts with phone numbers</Badge>
          )}
        </div>
      )}
    </div>
  );
}
