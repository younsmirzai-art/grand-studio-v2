"use client";

import { useState, useEffect, useCallback } from "react";
import { Music, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/uiStore";
import { getClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  playMusicFromCode,
  stopMusic,
  generateMedievalTheme,
  generateBattleTheme,
  generateHorrorAmbience,
  generateExplorationTheme,
  generateMenuTheme,
} from "@/lib/music/musicEngine";
import { MusicPlayer } from "./MusicPlayer";

interface MusicStudioModalProps {
  projectId: string;
}

interface SavedTrack {
  id: string;
  title: string;
  mood: string;
  tone_code: string;
  created_at: string;
}

const QUICK_THEMES = [
  { key: "medieval", label: "Medieval Theme", fn: generateMedievalTheme },
  { key: "battle", label: "Battle Music", fn: generateBattleTheme },
  { key: "horror", label: "Horror Ambient", fn: generateHorrorAmbience },
  { key: "exploration", label: "Exploration", fn: generateExplorationTheme },
  { key: "menu", label: "Menu Theme", fn: generateMenuTheme },
];

export function MusicStudioModal({ projectId }: MusicStudioModalProps) {
  const open = useUIStore((s) => s.musicModalOpen);
  const setOpen = useUIStore((s) => s.setMusicModalOpen);
  const setChatPresetMessage = useUIStore((s) => s.setChatPresetMessage);

  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ title: string; description: string; code: string } | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    const supabase = getClient();
    const { data } = await supabase
      .from("music_tracks")
      .select("id, title, mood, tone_code, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setSavedTracks((data as SavedTrack[]) ?? []);
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) fetchSaved();
  }, [open, projectId, fetchSaved]);

  const handleQuickGenerate = async (key: string, label: string, fn: () => string) => {
    setLoading(true);
    await stopMusic();
    setPlayingKey(null);
    try {
      const code = fn();
      setCurrentTrack({ title: label, description: "", code });
      await playMusicFromCode(code);
      setPlayingKey(key);
      toast.success(`Playing ${label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Playback failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendToSana = () => {
    setChatPresetMessage?.("@sana ");
    setOpen(false);
    toast.info("Chat opened — type your music request after @sana");
  };

  const handleSaveTrack = useCallback(
    async (title: string, code: string, mood: string) => {
      const supabase = getClient();
      const { error } = await supabase.from("music_tracks").insert({
        project_id: projectId,
        title,
        mood,
        tone_code: code,
        duration_seconds: 30,
        created_by: "sana",
      });
      if (error) {
        toast.error("Failed to save track");
        return;
      }
      toast.success("Track saved to project");
      fetchSaved();
    },
    [projectId, fetchSaved]
  );

  const handlePlaySaved = async (track: SavedTrack) => {
    await stopMusic();
    setPlayingKey(null);
    try {
      await playMusicFromCode(track.tone_code);
      setPlayingKey(track.id);
      setCurrentTrack({ title: track.title, description: track.mood, code: track.tone_code });
    } catch {
      toast.error("Playback failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-boss-surface border-boss-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-primary">
            <Music className="w-5 h-5 text-[#E91E63]" />
            Music Studio
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            Quick-generate music with Tone.js or ask Sana to compose custom tracks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <p className="text-xs text-text-muted mb-2">Quick generate</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_THEMES.map(({ key, label, fn }) => (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => handleQuickGenerate(key, label, fn)}
                  className="border-boss-border text-text-secondary hover:bg-boss-elevated hover:text-text-primary"
                >
                  {loading && playingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : label}
                </Button>
              ))}
            </div>
          </div>

          {currentTrack && (
            <MusicPlayer
              title={currentTrack.title}
              description={currentTrack.description}
              code={currentTrack.code}
              projectId={projectId}
              onSave={handleSaveTrack}
            />
          )}

          <Button
            variant="outline"
            onClick={handleSendToSana}
            className="w-full gap-2 border-[#E91E63]/30 text-[#E91E63] hover:bg-[#E91E63]/10"
          >
            <Send className="w-4 h-4" />
            Send to Sana
          </Button>

          {savedTracks.length > 0 && (
            <div>
              <p className="text-xs text-text-muted mb-2">Saved tracks</p>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {savedTracks.map((track) => (
                  <li
                    key={track.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-boss-elevated/50 px-3 py-2 border border-boss-border"
                  >
                    <span className="text-sm text-text-primary truncate">{track.title}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-text-muted hover:text-text-primary"
                      onClick={() => handlePlaySaved(track)}
                    >
                      Play
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
