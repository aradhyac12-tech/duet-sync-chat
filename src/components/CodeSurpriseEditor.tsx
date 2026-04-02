import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Code2, Eye, Palette, Braces, Save, Plus, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CodeSurpriseFrame from "@/components/CodeSurpriseFrame";
import { buildSurpriseDocument, defaultSurprisePreset, surprisePresets } from "@/lib/codeSurprises";

interface Surprise {
  id: string;
  title: string;
  html_content: string;
  css_content: string;
  js_content: string;
  max_views: number;
  views_used: number;
  is_active: boolean;
  created_at: string;
}

interface CodeSurpriseEditorProps {
  partnerId?: string | null;
}

const CodeSurpriseEditor = ({ partnerId }: CodeSurpriseEditorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [surprises, setSurprises] = useState<Surprise[]>([]);
  const [editing, setEditing] = useState<Surprise | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState(defaultSurprisePreset.title);
  const [html, setHtml] = useState(defaultSurprisePreset.html_content);
  const [css, setCss] = useState(defaultSurprisePreset.css_content);
  const [js, setJs] = useState(defaultSurprisePreset.js_content);
  const [maxViews, setMaxViews] = useState(1);

  const previewDocument = useMemo(() => buildSurpriseDocument({
    title,
    html_content: html,
    css_content: css,
    js_content: js,
    max_views: maxViews,
  }), [css, html, js, maxViews, title]);

  useEffect(() => {
    if (!user) return;
    loadSurprises();
  }, [user]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "code-surprise-error" && event.data?.message) {
        toast({ title: "Preview error", description: event.data.message, variant: "destructive" });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast]);

  const loadSurprises = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("code_surprises")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false }) as any;
    if (error) {
      toast({ title: "Couldn't load surprises", description: error.message, variant: "destructive" });
      return;
    }
    if (data) setSurprises(data);
  };

  const applyPreset = (presetId: string) => {
    const preset = surprisePresets.find((item) => item.id === presetId);
    if (!preset) return;

    hapticLight();
    setEditing(null);
    setTitle(preset.title);
    setHtml(preset.html_content);
    setCss(preset.css_content);
    setJs(preset.js_content);
    setMaxViews(preset.max_views);
  };

  const startNew = () => {
    hapticLight();
    setEditing(null);
    applyPreset(defaultSurprisePreset.id);
    setShowEditor(true);
  };

  const editSurprise = (s: Surprise) => {
    hapticLight();
    setEditing(s);
    setTitle(s.title);
    setHtml(s.html_content);
    setCss(s.css_content);
    setJs(s.js_content);
    setMaxViews(s.max_views);
    setShowEditor(true);
  };

  const saveSurprise = async () => {
    if (!user) return;
    hapticMedium();

    const payload = {
      creator_id: user.id,
      title,
      html_content: html,
      css_content: css,
      js_content: js,
      max_views: maxViews,
      views_used: 0,
      is_active: true,
    };

    const { error } = editing
      ? await supabase.from("code_surprises").update(payload as any).eq("id", editing.id)
      : await supabase.from("code_surprises").insert(payload as any);

    if (error) {
      toast({ title: "Couldn't save surprise", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: editing ? "Updated" : "Surprise created!",
      description: partnerId ? "Ready to show on your partner's app." : "Connect your partner to deliver it live.",
    });
    setShowEditor(false);
    loadSurprises();
  };

  const deleteSurprise = async (id: string) => {
    hapticMedium();
    const { error } = await supabase.from("code_surprises").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete surprise", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    loadSurprises();
  };

  const toggleActive = async (s: Surprise) => {
    hapticLight();
    const { error } = await supabase.from("code_surprises").update({ is_active: !s.is_active } as any).eq("id", s.id);
    if (error) {
      toast({ title: "Couldn't update surprise", description: error.message, variant: "destructive" });
      return;
    }
    loadSurprises();
  };

  const runPreview = () => {
    hapticLight();
    setShowPreview(true);
  };

  return (
    <section>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Code Surprises</p>
      <div className="bg-card rounded-2xl border border-border/60 p-3 mb-2.5">
        <p className="text-sm font-medium">Full-screen partner surprises</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Use presets or custom HTML/CSS/JS, test them in-app, then send them live.
          {partnerId ? " Your current partner can receive active surprises." : " Connect your partner first to deliver them."}
        </p>
      </div>
      <div className="space-y-2">
        {surprises.map(s => (
          <div key={s.id} className="bg-card rounded-2xl border border-border/60 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/50 flex items-center justify-center">
              <Code2 className="h-4 w-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.title}</p>
              <p className="text-[10px] text-muted-foreground">{s.views_used}/{s.max_views} views • {s.is_active ? "Active" : "Paused"}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggleActive(s)} className={`h-7 w-7 rounded-full flex items-center justify-center ${s.is_active ? "bg-primary/10" : "bg-muted"}`}>
                <Eye className={`h-3 w-3 ${s.is_active ? "text-primary" : "text-muted-foreground"}`} />
              </button>
              <button onClick={() => editSurprise(s)} className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                <Code2 className="h-3 w-3 text-muted-foreground" />
              </button>
              <button onClick={() => deleteSurprise(s.id)} className="h-7 w-7 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="h-3 w-3 text-destructive" />
              </button>
            </div>
          </div>
        ))}
        <button onClick={startNew}
          className="w-full bg-card rounded-2xl border border-dashed border-border/60 p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground active:scale-[0.98] transition-transform">
          <Plus className="h-4 w-4" /> New Surprise
        </button>
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-background flex flex-col"
          >
            <div className="safe-top px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/30">
              <button onClick={() => setShowEditor(false)} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                className="mx-3 h-8 rounded-full text-sm text-center flex-1" placeholder="Title" />
              <div className="flex gap-1.5">
                <button onClick={runPreview} className="h-8 px-3 rounded-full bg-accent/60 flex items-center justify-center gap-1 text-xs font-medium text-foreground">
                  <Play className="h-3.5 w-3.5" /> Test
                </button>
                <button onClick={saveSurprise} className="h-8 px-3 rounded-full bg-foreground text-background flex items-center gap-1 text-xs font-medium">
                  <Save className="h-3 w-3" /> Save
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-border/20 space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Wand2 className="h-3.5 w-3.5" /> Presets
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {surprisePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    className="shrink-0 rounded-full border border-border/50 bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-foreground active:scale-95 transition-transform"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
              <span className="text-[10px] text-muted-foreground">Max views:</span>
              {[1, 3, 5, 10, 999].map(n => (
                <button key={n} onClick={() => { hapticLight(); setMaxViews(n); }}
                  className={`h-6 px-2 rounded-full text-[10px] font-medium ${maxViews === n ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                  {n === 999 ? "∞" : n}
                </button>
              ))}
            </div>

            <Tabs defaultValue="html" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-4 mt-2 bg-muted/50 rounded-xl h-8">
                <TabsTrigger value="html" className="text-[10px] flex-1 gap-1"><Code2 className="h-3 w-3" />HTML</TabsTrigger>
                <TabsTrigger value="css" className="text-[10px] flex-1 gap-1"><Palette className="h-3 w-3" />CSS</TabsTrigger>
                <TabsTrigger value="js" className="text-[10px] flex-1 gap-1"><Braces className="h-3 w-3" />JS</TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="flex-1 px-4 pb-4 mt-2 min-h-0">
                <textarea value={html} onChange={(e) => setHtml(e.target.value)}
                  className="w-full h-full rounded-xl bg-card border border-border/30 p-3 text-xs font-mono resize-none outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="<div>Your HTML here</div>" spellCheck={false} />
              </TabsContent>
              <TabsContent value="css" className="flex-1 px-4 pb-4 mt-2 min-h-0">
                <textarea value={css} onChange={(e) => setCss(e.target.value)}
                  className="w-full h-full rounded-xl bg-card border border-border/30 p-3 text-xs font-mono resize-none outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="body { ... }" spellCheck={false} />
              </TabsContent>
              <TabsContent value="js" className="flex-1 px-4 pb-4 mt-2 min-h-0">
                <textarea value={js} onChange={(e) => setJs(e.target.value)}
                  className="w-full h-full rounded-xl bg-card border border-border/30 p-3 text-xs font-mono resize-none outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="// Your JavaScript here" spellCheck={false} />
              </TabsContent>
            </Tabs>

            {/* Preview overlay */}
            <AnimatePresence>
              {showPreview && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-background flex flex-col">
                  <div className="safe-top px-4 pt-3 pb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Preview</p>
                    <button onClick={() => setShowPreview(false)} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex-1 p-4">
                    <CodeSurpriseFrame documentHtml={previewDocument} title={`${title} preview`} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default CodeSurpriseEditor;
