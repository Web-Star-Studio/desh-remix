import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Sparkles, FileText, Eye, Pencil, CheckCircle2, Trash2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/common/useAuthSession";
import { toast } from "sonner";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  status: "draft" | "published" | "archived";
  views_count: number;
  reading_minutes: number;
  published_at: string | null;
  created_at: string;
};

export default function BlogAdminPage() {
  const { session } = useAuthSession();
  const user = session?.user;
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("produtividade");
  const [angle, setAngle] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    document.title = "Blog Admin · DESH";
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
      if (!data) { setLoading(false); return; }
      await loadPosts();
    })();
  }, [user]);

  const loadPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, category, status, views_count, reading_minutes, published_at, created_at")
      .order("created_at", { ascending: false });
    setPosts((data as Post[]) || []);
    setLoading(false);
  };

  const generateDraft = async () => {
    if (!topic.trim()) { toast.error("Tópico obrigatório"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-draft", {
        body: { topic, target_keyword: keyword, category, angle },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Rascunho gerado");
      setTopic(""); setKeyword(""); setAngle("");
      await loadPosts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar");
    } finally {
      setGenerating(false);
    }
  };

  const togglePublish = async (p: Post) => {
    const newStatus = p.status === "published" ? "draft" : "published";
    const updates: any = { status: newStatus };
    if (newStatus === "published" && !p.published_at) updates.published_at = new Date().toISOString();
    const { error } = await supabase.from("blog_posts").update(updates).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "published" ? "Publicado" : "Despublicado");
    await loadPosts();
  };

  const deletePost = async (p: Post) => {
    if (!confirm(`Excluir "${p.title}"?`)) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    await loadPosts();
  };

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6" style={{ background: "#0A0A0F", color: "#F5F5F7" }}>
        <div>
          <h1 className="text-2xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-[#8E8E93] mb-6">Apenas administradores podem gerenciar o blog.</p>
          <Link to="/" className="text-[#C8956C]">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: "#0A0A0F", color: "#F5F5F7" }}>
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-[#8E8E93] hover:text-[#C8956C] mb-8">
          <ArrowLeft size={14} /> Voltar
        </button>

        <h1 className="text-4xl font-bold mb-2 tracking-[-0.02em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Blog Admin
        </h1>
        <p className="text-[#8E8E93] mb-10">Gere rascunhos com IA, edite e publique.</p>

        {/* Generator */}
        <section className="p-6 rounded-2xl mb-10 backdrop-blur-xl"
          style={{ background: "linear-gradient(135deg, rgba(200,149,108,0.06), rgba(191,90,242,0.04))", border: "1px solid rgba(200,149,108,0.15)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-[#C8956C]" />
            <h2 className="text-lg font-semibold">Gerar rascunho com IA</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="text" placeholder="Tópico (ex: Como organizar finanças com Open Banking)"
              value={topic} onChange={(e) => setTopic(e.target.value)}
              className="h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#C8956C]/30"
            />
            <input
              type="text" placeholder="Keyword principal (ex: open banking pessoal)"
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
              className="h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#C8956C]/30"
            />
            <select
              value={category} onChange={(e) => setCategory(e.target.value)}
              className="h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#F5F5F7] focus:outline-none focus:border-[#C8956C]/30"
            >
              <option value="produtividade">Produtividade</option>
              <option value="ia">IA & Pandora</option>
              <option value="financas">Finanças</option>
              <option value="automacao">Automação</option>
              <option value="deep-work">Deep Work</option>
            </select>
            <input
              type="text" placeholder="Ângulo editorial (opcional)"
              value={angle} onChange={(e) => setAngle(e.target.value)}
              className="h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#C8956C]/30"
            />
          </div>
          <button
            onClick={generateDraft} disabled={generating || !topic.trim()}
            className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #C8956C, #BF5AF2)", color: "#0A0A0F" }}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Gerando…" : "Gerar rascunho"}
          </button>
        </section>

        {/* List */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText size={18} /> Artigos ({posts.length})
          </h2>
          {loading ? (
            <div className="text-[#8E8E93]">Carregando…</div>
          ) : posts.length === 0 ? (
            <div className="text-[#8E8E93] py-10 text-center">Nenhum artigo ainda. Gere um acima.</div>
          ) : (
            <div className="space-y-2">
              {posts.map((p) => (
                <div key={p.id} className="p-4 rounded-xl flex items-center gap-4 backdrop-blur-xl border border-white/[0.06]"
                  style={{ background: "rgba(255,255,255,0.025)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] uppercase tracking-[0.15em] font-mono px-2 py-0.5 rounded ${
                        p.status === "published" ? "bg-[#30D158]/10 text-[#30D158]" :
                        p.status === "draft" ? "bg-[#FFD60A]/10 text-[#FFD60A]" : "bg-white/5 text-[#636366]"
                      }`}>
                        {p.status}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[#C8956C] font-mono">{p.category}</span>
                      <span className="text-xs text-[#636366]">· {p.reading_minutes} min · {p.views_count} views</span>
                    </div>
                    <div className="font-medium text-[#F5F5F7] truncate">{p.title}</div>
                    <div className="text-xs text-[#8E8E93] truncate">{p.excerpt}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link to={`/blog/${p.slug}`} target="_blank"
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-[#8E8E93]" title="Ver">
                      <Eye size={16} />
                    </Link>
                    <Link to={`/blog-admin/edit/${p.id}`}
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-[#8E8E93]" title="Editar">
                      <Pencil size={16} />
                    </Link>
                    <button onClick={() => togglePublish(p)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-[#8E8E93]"
                      title={p.status === "published" ? "Despublicar" : "Publicar"}>
                      <CheckCircle2 size={16} className={p.status === "published" ? "text-[#30D158]" : ""} />
                    </button>
                    <button onClick={() => deletePost(p)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-[#8E8E93] hover:text-red-400" title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
