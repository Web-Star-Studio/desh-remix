import { useState, useEffect, useMemo } from "react";
import { Palette, Globe, Lock, Sparkles, Share2, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeContext } from "@/contexts/ThemeContext";
import { themeColors, type ThemeColor, type ThemeMode } from "@/hooks/ui/useTheme";
import { type WallpaperId } from "@/hooks/ui/useWallpaper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseHSL, toHSLString, hslToCSS, SEASONAL_THEMES, type SharedTheme } from "@/lib/themeUtils";

const ThemeEditorInline = () => {
  const { theme, setMode, setColor, wallpaperId, setWallpaper } = useThemeContext();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"editor" | "community" | "seasonal">("editor");
  const [customH, setCustomH] = useState(220);
  const [customS, setCustomS] = useState(10);
  const [customL, setCustomL] = useState(35);
  const [editorMode, setEditorMode] = useState<ThemeMode>(theme.mode);
  const [themeName, setThemeName] = useState("");
  const [themeDesc, setThemeDesc] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tc = themeColors.find(c => c.id === theme.color);
    if (tc) {
      const p = parseHSL(tc.preview);
      setCustomH(p.h); setCustomS(p.s); setCustomL(p.l);
    }
    setEditorMode(theme.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.color, theme.mode]);

  useEffect(() => {
    const root = document.documentElement;
    const hsl = toHSLString(customH, customS, customL);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--accent", hsl);
    root.style.setProperty("--ring", hsl);
    if (customL > 60 || (customS < 20 && customL > 50)) {
      root.style.setProperty("--primary-foreground", "0 0% 10%");
      root.style.setProperty("--accent-foreground", "0 0% 10%");
    } else {
      root.style.setProperty("--primary-foreground", "0 0% 100%");
      root.style.setProperty("--accent-foreground", "0 0% 100%");
    }
  }, [customH, customS, customL]);

  useEffect(() => {
    if (editorMode !== theme.mode) setMode(editorMode);
  }, [editorMode, theme.mode, setMode]);

  const applyAsPreset = () => {
    let closest: ThemeColor = "graphite";
    let minDist = Infinity;
    for (const tc of themeColors) {
      const p = parseHSL(tc.preview);
      const dist = Math.abs(p.h - customH) * 2 + Math.abs(p.s - customS) + Math.abs(p.l - customL);
      if (dist < minDist) { minDist = dist; closest = tc.id; }
    }
    setColor(closest);
    toast({ title: "Tema aplicado", description: `Cor mais próxima: ${themeColors.find(c => c.id === closest)?.label}` });
  };

  const handleSave = async () => {
    if (!user || !themeName.trim()) return;
    setSaving(true);
    try {
      const hsl = toHSLString(customH, customS, customL);
      const { error } = await supabase.from("shared_themes").insert({
        user_id: user.id, name: themeName.trim(), description: themeDesc.trim(),
        mode: editorMode, primary_hsl: hsl, accent_hsl: hsl,
        wallpaper_id: wallpaperId, is_public: isPublic,
      } as any);
      if (error) throw error;
      toast({ title: "✅ Tema salvo!", description: isPublic ? "Compartilhado com a comunidade" : "Salvo em seus temas" });
      setThemeName(""); setThemeDesc("");
      qc.invalidateQueries({ queryKey: ["shared_themes"] });
      qc.invalidateQueries({ queryKey: ["my_themes"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const { data: communityThemes = [] } = useQuery({
    queryKey: ["shared_themes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shared_themes").select("*").eq("is_public", true).order("downloads", { ascending: false }).limit(50);
      if (error) throw error;
      return data as SharedTheme[];
    },
  });

  const { data: myThemes = [] } = useQuery({
    queryKey: ["my_themes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("shared_themes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as SharedTheme[];
    },
    enabled: !!user,
  });

  const applySharedTheme = async (t: SharedTheme) => {
    const parsed = parseHSL(t.primary_hsl);
    setCustomH(parsed.h); setCustomS(parsed.s); setCustomL(parsed.l);
    setEditorMode(t.mode as ThemeMode);
    if (t.wallpaper_id) setWallpaper(t.wallpaper_id as WallpaperId);
    await supabase.from("shared_themes").update({ downloads: (t.downloads || 0) + 1 } as any).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["shared_themes"] });
    toast({ title: `Tema "${t.name}" aplicado!` });
  };

  const deleteTheme = async (id: string) => {
    await supabase.from("shared_themes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["my_themes"] });
    toast({ title: "Tema excluído" });
  };

  const applySeasonalTheme = (s: typeof SEASONAL_THEMES[number]) => {
    const p = parseHSL(s.primary);
    setCustomH(p.h); setCustomS(p.s); setCustomL(p.l);
    setEditorMode(s.mode);
    setWallpaper(s.wallpaper);
    toast({ title: `Tema ${s.name} aplicado!` });
  };

  const previewHSL = useMemo(() => toHSLString(customH, customS, customL), [customH, customS, customL]);

  return (
    <div className="mt-4 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { id: "editor" as const, label: "Editor", icon: Palette },
          { id: "community" as const, label: "Comunidade", icon: Globe },
          { id: "seasonal" as const, label: "Sazonais", icon: Sparkles },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground/70 hover:text-foreground hover:bg-foreground/15"
            }`}>
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "editor" && (
        <div className="space-y-4">
          {/* Live Preview */}
          <div className="p-4 rounded-xl border border-foreground/10 bg-foreground/3">
            <p className="text-xs font-semibold text-foreground mb-3">Preview</p>
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] p-3 rounded-xl border border-foreground/10"
                style={{ background: editorMode === "dark" ? "hsl(225 15% 12%)" : "hsl(30 15% 93%)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full" style={{ background: hslToCSS(previewHSL) }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: editorMode === "dark" ? "hsl(210 20% 92%)" : "hsl(30 10% 15%)" }}>Meu Dashboard</p>
                    <p className="text-[9px]" style={{ color: editorMode === "dark" ? "hsl(215 10% 65%)" : "hsl(30 6% 45%)" }}>Prévia do tema</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <button className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                    style={{ background: hslToCSS(previewHSL), color: customL > 60 ? "hsl(0 0% 10%)" : "white" }}>
                    Primário
                  </button>
                  <button className="px-2.5 py-1 rounded-lg text-[10px]"
                    style={{ background: editorMode === "dark" ? "hsl(225 10% 20%)" : "hsl(30 8% 86%)", color: editorMode === "dark" ? "hsl(210 15% 80%)" : "hsl(30 10% 25%)" }}>
                    Secundário
                  </button>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: editorMode === "dark" ? "hsl(225 10% 18%)" : "hsl(30 6% 89%)" }}>
                  <div className="h-full w-2/3 rounded-full" style={{ background: hslToCSS(previewHSL) }} />
                </div>
              </div>
            </div>
          </div>

          {/* HSL Sliders */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">Cor do Tema (HSL)</p>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-muted-foreground">Matiz (H)</p>
                <span className="text-[11px] font-mono text-foreground">{customH}°</span>
              </div>
              <input type="range" min={0} max={360} value={customH} onChange={e => setCustomH(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: "linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))" }} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-muted-foreground">Saturação (S)</p>
                <span className="text-[11px] font-mono text-foreground">{customS}%</span>
              </div>
              <input type="range" min={0} max={100} value={customS} onChange={e => setCustomS(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, hsl(${customH},0%,${customL}%), hsl(${customH},100%,${customL}%))` }} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-muted-foreground">Luminosidade (L)</p>
                <span className="text-[11px] font-mono text-foreground">{customL}%</span>
              </div>
              <input type="range" min={10} max={90} value={customL} onChange={e => setCustomL(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, hsl(${customH},${customS}%,10%), hsl(${customH},${customS}%,50%), hsl(${customH},${customS}%,90%))` }} />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shadow border border-foreground/10 flex-shrink-0" style={{ background: hslToCSS(previewHSL) }} />
              <p className="text-[10px] font-mono text-foreground">{previewHSL}</p>
            </div>

            <p className="text-[11px] text-muted-foreground">Cores pré-definidas</p>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
              {themeColors.map(c => {
                const p = parseHSL(c.preview);
                return (
                  <button key={c.id} onClick={() => { setCustomH(p.h); setCustomS(p.s); setCustomL(p.l); }}
                    className="w-8 h-8 rounded-full transition-all hover:scale-110 border-2 border-transparent hover:border-foreground/30"
                    style={{ background: hslToCSS(c.preview) }} title={c.label} />
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-foreground/10">
              <p className="text-xs text-muted-foreground">Modo</p>
              <div className="flex gap-2">
                <button onClick={() => setEditorMode("light")}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${editorMode === "light" ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-foreground/70"}`}>
                  ☀️ Claro
                </button>
                <button onClick={() => setEditorMode("dark")}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${editorMode === "dark" ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-foreground/70"}`}>
                  🌙 Escuro
                </button>
              </div>
            </div>
          </div>

          {/* Save & Share */}
          <div className="pt-3 border-t border-foreground/10 space-y-3">
            <p className="text-xs font-semibold text-foreground">Salvar & Compartilhar</p>
            <input value={themeName} onChange={e => setThemeName(e.target.value)} placeholder="Nome do tema"
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground" />
            <input value={themeDesc} onChange={e => setThemeDesc(e.target.value)} placeholder="Descrição (opcional)"
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <button onClick={() => setIsPublic(!isPublic)}
                  className={`w-10 h-6 rounded-full transition-all relative ${isPublic ? "bg-primary" : "bg-foreground/20"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-primary-foreground shadow transition-transform ${isPublic ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <span className="text-xs text-foreground flex items-center gap-1">
                  {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {isPublic ? "Público (comunidade)" : "Privado"}
                </span>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!themeName.trim() || saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                <Share2 className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar tema"}
              </button>
              <button onClick={applyAsPreset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground/10 text-foreground text-xs hover:bg-foreground/15 transition-colors">
                <Eye className="w-3.5 h-3.5" /> Aplicar como preset
              </button>
            </div>
          </div>

          {/* My Themes */}
          {myThemes.length > 0 && (
            <div className="pt-3 border-t border-foreground/10">
              <p className="text-xs font-semibold text-foreground mb-3">Meus Temas ({myThemes.length})</p>
              <div className="space-y-2">
                {myThemes.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-foreground/5 group">
                    <div className="w-7 h-7 rounded-full flex-shrink-0 shadow" style={{ background: hslToCSS(t.primary_hsl) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                        {t.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {t.mode === "dark" ? "🌙" : "☀️"} · {t.downloads} downloads
                      </p>
                    </div>
                    <button onClick={() => applySharedTheme(t)} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Usar</button>
                    <button onClick={() => deleteTheme(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "community" && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">Temas criados e compartilhados por outros usuários</p>
          {communityThemes.length === 0 ? (
            <div className="text-center py-6">
              <Globe className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum tema compartilhado ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {communityThemes.map(t => (
                <button key={t.id} onClick={() => applySharedTheme(t)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-left group">
                  <div className="w-9 h-9 rounded-full flex-shrink-0 shadow-lg" style={{ background: hslToCSS(t.primary_hsl) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {t.mode === "dark" ? "🌙 Escuro" : "☀️ Claro"} · {t.downloads} downloads
                    </p>
                  </div>
                  <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">Aplicar</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "seasonal" && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">Temas inspirados nas estações do ano</p>
          <div className="grid grid-cols-2 gap-3">
            {SEASONAL_THEMES.map((s, i) => (
              <button key={i} onClick={() => applySeasonalTheme(s)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors">
                <div className="w-10 h-10 rounded-full shadow-lg" style={{ background: hslToCSS(s.primary) }} />
                <span className="text-xs font-medium text-foreground">{s.name}</span>
                <span className="text-[9px] text-muted-foreground">{s.mode === "dark" ? "🌙 Escuro" : "☀️ Claro"}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeEditorInline;
