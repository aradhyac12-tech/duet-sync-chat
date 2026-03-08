import PageHeader from "@/components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Music, Play, Pause, ExternalLink, Link2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Song {
  id: string;
  title: string;
  artist: string;
  song_url: string;
  platform: string;
  thumbnail_url: string | null;
  added_by: string;
  created_at: string;
}

const detectPlatform = (url: string): string => {
  if (url.includes("spotify")) return "spotify";
  if (url.includes("youtube") || url.includes("youtu.be")) return "youtube";
  if (url.includes("soundcloud")) return "soundcloud";
  if (url.includes("apple")) return "apple-music";
  return "other";
};

const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const getSpotifyId = (url: string): { type: string; id: string } | null => {
  const match = url.match(/spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
  return match ? { type: match[1], id: match[2] } : null;
};

const Playlist = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSong, setNewSong] = useState({ title: "", artist: "", url: "" });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("playlist_songs").select("*").order("created_at", { ascending: false });
      if (data) setSongs(data as Song[]);

      // Load profile names
      const { data: p } = await supabase.from("profiles").select("user_id, display_name, pet_name");
      if (p) {
        const map: Record<string, string> = {};
        p.forEach((prof: any) => { map[prof.user_id] = prof.pet_name || prof.display_name; });
        setProfiles(map);
      }
    };
    load();
  }, [user]);

  const addSong = async () => {
    if (!user || !newSong.url.trim()) return;
    const platform = detectPlatform(newSong.url);
    let title = newSong.title.trim();
    let thumbnail: string | null = null;

    // Auto-detect YouTube thumbnail
    if (platform === "youtube") {
      const ytId = getYouTubeId(newSong.url);
      if (ytId) {
        thumbnail = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
        if (!title) title = "YouTube Track";
      }
    }

    if (!title) title = "Untitled Song";

    const { data, error } = await supabase.from("playlist_songs").insert({
      added_by: user.id,
      title,
      artist: newSong.artist.trim() || "Unknown",
      song_url: newSong.url.trim(),
      platform,
      thumbnail_url: thumbnail,
    }).select().single();

    if (error) {
      toast({ title: "Couldn't add song", description: error.message, variant: "destructive" });
    } else if (data) {
      setSongs(prev => [data as Song, ...prev]);
      setShowAddDialog(false);
      setNewSong({ title: "", artist: "", url: "" });
      toast({ title: "Song added! 🎵" });
    }
  };

  const deleteSong = async (id: string) => {
    await supabase.from("playlist_songs").delete().eq("id", id);
    setSongs(prev => prev.filter(s => s.id !== id));
  };

  const platformIcon = (platform: string) => {
    switch (platform) {
      case "spotify": return "🟢";
      case "youtube": return "🔴";
      case "soundcloud": return "🟠";
      case "apple-music": return "🍎";
      default: return "🎵";
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24">
      <PageHeader title="Our Playlist" subtitle="Songs we love together">
        <button onClick={() => setShowAddDialog(true)} className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
          <Plus className="h-5 w-5 text-foreground" />
        </button>
      </PageHeader>

      <div className="px-5 space-y-3">
        {songs.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No songs yet. Add your first song!</p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline" className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> Add a Song
            </Button>
          </div>
        ) : (
          <AnimatePresence>
            {songs.map((song, i) => {
              const ytId = song.platform === "youtube" ? getYouTubeId(song.song_url) : null;
              const spotifyData = song.platform === "spotify" ? getSpotifyId(song.song_url) : null;

              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm"
                >
                  {/* Embedded player */}
                  {playingId === song.id && (
                    <div className="w-full">
                      {ytId && (
                        <iframe
                          src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                          className="w-full aspect-video"
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                        />
                      )}
                      {spotifyData && (
                        <iframe
                          src={`https://open.spotify.com/embed/${spotifyData.type}/${spotifyData.id}`}
                          className="w-full h-20 rounded-none"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        />
                      )}
                      {!ytId && !spotifyData && (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          <a href={song.song_url} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 text-primary">
                            <ExternalLink className="h-4 w-4" /> Open in browser
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3">
                    {/* Thumbnail */}
                    <button
                      onClick={() => setPlayingId(playingId === song.id ? null : song.id)}
                      className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center shrink-0 overflow-hidden relative"
                    >
                      {song.thumbnail_url ? (
                        <img src={song.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg">{platformIcon(song.platform)}</span>
                      )}
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        {playingId === song.id ? (
                          <Pause className="h-4 w-4 text-white" />
                        ) : (
                          <Play className="h-4 w-4 text-white ml-0.5" />
                        )}
                      </div>
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{song.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{song.artist}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Added by {profiles[song.added_by] || "Unknown"}
                      </p>
                    </div>

                    {song.added_by === user?.id && (
                      <button onClick={() => deleteSong(song.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Add song dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" /> Add a Song
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Song Link *</label>
              <Input
                value={newSong.url}
                onChange={(e) => setNewSong({ ...newSong, url: e.target.value })}
                placeholder="Paste YouTube, Spotify, or any URL"
                className="rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">Supports YouTube, Spotify, SoundCloud, Apple Music</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Song Title</label>
              <Input
                value={newSong.title}
                onChange={(e) => setNewSong({ ...newSong, title: e.target.value })}
                placeholder="e.g. Perfect"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Artist</label>
              <Input
                value={newSong.artist}
                onChange={(e) => setNewSong({ ...newSong, artist: e.target.value })}
                placeholder="e.g. Ed Sheeran"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addSong} disabled={!newSong.url.trim()} className="rounded-xl bg-foreground text-background w-full">
              Add Song
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Playlist;
