import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Play, Trash2, Plus, Mic, Square, RotateCcw, Download } from "lucide-react";
// @ts-ignore — lamejs has no type declarations
import lamejs from "lamejs";
import { toast } from "sonner";
import type { IvrAudioClip } from "@/types/ivr-campaign";

/** Convert a WebM/Opus blob to WAV (16-bit PCM) using Web Audio API */
async function webmToWav(webmBlob: Blob): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const arrayBuffer = await webmBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const samples = audioBuffer.getChannelData(0);
  const numSamples = samples.length;
  const sampleRate = audioBuffer.sampleRate;
  const dataSize = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true);
  ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  await audioCtx.close();
  return new Blob([buf], { type: "audio/wav" });
}

export default function IvrAudioLibrary() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Record state
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordName, setRecordName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on dialog close
  const resetRecordState = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
    setRecordName("");
  }, [recordedUrl]);

  useEffect(() => {
    if (!recordDialogOpen) resetRecordState();
  }, [recordDialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    } catch {
      toast.error("Microphone access denied. Please allow mic permission.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const reRecord = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

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
      const path = `${currentOrganization.id}/${Date.now()}_broadcast.${ext}`;

      const { error: uploadError } = await supabase.storage.from("ivr-audio").upload(path, selectedFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("ivr-audio").getPublicUrl(path);

      const { error: insertError } = await supabase.from("ivr_audio_library").insert({
        organization_id: currentOrganization.id,
        name: audioName,
        audio_url: urlData.publicUrl,
        audio_type: "opening",
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!recordedBlob || !currentOrganization || !recordName) throw new Error("Missing data");

      // Convert WebM to WAV for VoBiz telephony compatibility
      const wavBlob = await webmToWav(recordedBlob);
      const path = `${currentOrganization.id}/${Date.now()}_recorded.wav`;

      const file = new File([wavBlob], "recording.wav", { type: "audio/wav" });
      const { error: uploadError } = await supabase.storage.from("ivr-audio").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("ivr-audio").getPublicUrl(path);

      const { error: insertError } = await supabase.from("ivr_audio_library").insert({
        organization_id: currentOrganization.id,
        name: recordName,
        audio_url: urlData.publicUrl,
        audio_type: "opening",
        language: "hi",
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("Recording saved to library");
      queryClient.invalidateQueries({ queryKey: ["ivr-audio-library"] });
      setRecordDialogOpen(false);
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Audio Library" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRecordDialogOpen(true)}>
            <Mic className="h-4 w-4 mr-2" /> Record Audio
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Upload Audio
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : clips.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No audio clips yet. Upload or record your first one!</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => (
            <Card key={clip.id}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="font-medium">{clip.name}</p>
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

      {/* Upload Dialog */}
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

      {/* Record Dialog */}
      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Audio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                placeholder="e.g. Workshop Reminder - Hindi"
                value={recordName}
                onChange={(e) => setRecordName(e.target.value)}
                disabled={isRecording}
              />
            </div>

            {/* Recording state */}
            {isRecording && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                    <div className="h-10 w-10 rounded-full bg-destructive/40 animate-pulse flex items-center justify-center">
                      <Mic className="h-5 w-5 text-destructive" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-mono text-muted-foreground">{formatTime(elapsed)}</p>
                <Button variant="destructive" size="sm" onClick={stopRecording}>
                  <Square className="h-3 w-3 mr-1" /> Stop Recording
                </Button>
              </div>
            )}

            {/* Preview state */}
            {recordedUrl && !isRecording && (
              <div className="space-y-3">
                <audio controls src={recordedUrl} className="w-full" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={reRecord}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Re-record
                  </Button>
                </div>
              </div>
            )}

            {/* Initial state - no recording yet */}
            {!isRecording && !recordedUrl && (
              <div className="flex justify-center py-4">
                <Button onClick={startRecording} disabled={!recordName}>
                  <Mic className="h-4 w-4 mr-2" /> Start Recording
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!recordedBlob || !recordName || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save to Library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
