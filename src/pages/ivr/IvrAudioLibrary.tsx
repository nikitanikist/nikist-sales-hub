import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Play, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { IvrAudioClip, IvrAudioType } from "@/types/ivr-campaign";

export default function IvrAudioLibrary() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState("");
  const [audioType, setAudioType] = useState<string>("opening");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data: clips = [], isLoading } = useQuery({
    queryKey: ["ivr-audio-library", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("ivr_audio_library")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as IvrAudioClip[];
    },
    enabled: !!currentOrganization,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !currentOrganization || !audioName) throw new Error("Missing data");
      const ext = selectedFile.name.split(".").pop() || "mp3";
      const path = `${currentOrganization.id}/${Date.now()}_${audioType}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("ivr-audio").upload(path, selectedFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("ivr-audio").getPublicUrl(path);

      const { error: insertError } = await supabase.from("ivr_audio_library").insert({
        organization_id: currentOrganization.id,
        name: audioName,
        audio_url: urlData.publicUrl,
        audio_type: audioType,
        language: "hi",
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("Audio uploaded");
      queryClient.invalidateQueries({ queryKey: ["ivr-audio-library"] });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setAudioName("");
    },
    onError: (err) => toast.error(`Upload failed: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (clipId: string) => {
      const { error } = await supabase.from("ivr_audio_library").delete().eq("id", clipId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Audio deleted");
      queryClient.invalidateQueries({ queryKey: ["ivr-audio-library"] });
    },
  });

  const typeLabels: Record<string, string> = {
    opening: "Opening Message",
    thankyou: "Thank You",
    not_interested: "Not Interested",
    repeat: "Repeat/Retry",
    goodbye: "Goodbye",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Audio Library" />
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Upload Audio
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : clips.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No audio clips yet. Upload your first one!</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => (
            <Card key={clip.id}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{clip.name}</p>
                    <Badge variant="secondary" className="mt-1">{typeLabels[clip.audio_type] || clip.audio_type}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(clip.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (playingId === clip.id) {
                        setPlayingId(null);
                      } else {
                        setPlayingId(clip.id);
                        const audio = new Audio(clip.audio_url);
                        audio.play();
                        audio.onended = () => setPlayingId(null);
                      }
                    }}
                  >
                    <Play className="h-3 w-3 mr-1" /> {playingId === clip.id ? "Playing..." : "Play"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Audio Clip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input placeholder="e.g. Workshop Invite - Hindi" value={audioName} onChange={(e) => setAudioName(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={audioType} onValueChange={setAudioType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Audio File (MP3)</Label>
              <Input type="file" accept="audio/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => uploadMutation.mutate()} disabled={!selectedFile || !audioName || uploadMutation.isPending}>
              <Upload className="h-4 w-4 mr-2" /> {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
