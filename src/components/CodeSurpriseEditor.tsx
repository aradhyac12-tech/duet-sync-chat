import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Code2, Eye, Palette, Braces, Save, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

const CodeSurpriseEditor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [surprises, setSurprises] = useState<Surprise[]>([]);
  const [editing, setEditing] = useState<Surprise | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState("Surprise");
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [js, setJs] = useState("");
  const [maxViews, setMaxViews] = useState(1);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!user) return;
    loadSurprises();
  }, [user]);

  const loadSurprises = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("code_surprises")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false }) as any;
    if (data) setSurprises(data);
  };

  const startNew = () => {
    hapticLight();
    setEditing(null);
    setTitle("Surprise");
    setHtml('<div class="container">\n  <h1>💐</h1>\n  <p>I love you!</p>\n</div>');
    setCss('body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #fce4ec, #f8bbd0); font-family: system-ui; }\n.container { text-align: center; animation: fadeIn 1s ease; }\nh1 { font-size: 4rem; margin: 0; }\np { font-size: 1.2rem; color: #ad1457; }\n@keyframes fadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }');
    setJs("");
    setMaxViews(1);
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
      is_active: true,
    };

    if (editing) {
      await supabase.from("code_surprises").update(payload as any).eq("id", editing.id);
    } else {
      await supabase.from("code_surprises").insert(payload as any);
    }

    toast({ title: editing ? "Updated" : "Surprise created!" });
    setShowEditor(false);
    loadSurprises();
  };

  const deleteSurprise = async (id: string) => {
    hapticMedium();
    await supabase.from("code_surprises").delete().eq("id", id);
    toast({ title: "Deleted" });
    loadSurprises();
  };

  const toggleActive = async (s: Surprise) => {
    hapticLight();
    await supabase.from("code_surprises").update({ is_active: !s.is_active } as any).eq("id", s.id);
    loadSurprises();
  };

  const runPreview = () => {
    if (!previewRef.current) return;
    const doc = previewRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`);
      doc.close();
    }
    setShowPreview(true);
  };

  return (
    <section>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Code Surprises</p>
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
                <button onClick={runPreview} className="h-8 w-8 rounded-full bg-accent/50 flex items-center justify-center">
                  <Play className="h-3.5 w-3.5 text-foreground" />
                </button>
                <button onClick={saveSurprise} className="h-8 px-3 rounded-full bg-foreground text-background flex items-center gap-1 text-xs font-medium">
                  <Save className="h-3 w-3" /> Save
                </button>
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
                    <iframe ref={previewRef} title="preview" sandbox="allow-scripts"
                      className="w-full h-full rounded-2xl border border-border/30 bg-white" />
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
