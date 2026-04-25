import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/common/useAuthSession";
import { toast } from "sonner";

export default function BlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const user = session?.user;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [post, setPost] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!role);
      if (!role) { setLoading(false); return; }
      const { data } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
      setPost(data);
      setLoading(false);
    })();
  }, [id, user]);

  const save = async () => {
    if (!post) return;
    setSaving(true);
    const { error } = await supabase.from("blog_posts").update({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content_md: post.content_md,
      meta_title: post.meta_title,
      meta_description: post.meta_description,
      category: post.category,
      tags: post.tags,
      keywords: post.keywords,
      reading_minutes: post.reading_minutes,
      featured: post.featured,
      cover_image: post.cover_image,
      og_image: post.og_image,
      faq: post.faq,
      toc: post.toc,
    }).eq("id", post.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Salvo");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0F", color: "#8E8E93" }}>Carregando…</div>;
  if (isAdmin === false) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0F", color: "#F5F5F7" }}>Acesso restrito</div>;
  if (!post) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0F", color: "#F5F5F7" }}>Não encontrado</div>;

  const update = (k: string, v: any) => setPost({ ...post, [k]: v });

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: "#0A0A0F", color: "#F5F5F7" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate("/blog-admin")} className="inline-flex items-center gap-2 text-sm text-[#8E8E93] hover:text-[#C8956C]">
            <ArrowLeft size={14} /> Voltar
          </button>
          <div className="flex items-center gap-2">
            <Link to={`/blog/${post.slug}`} target="_blank" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08]">
              <Eye size={14} /> Preview
            </Link>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl font-semibold disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #C8956C, #BF5AF2)", color: "#0A0A0F" }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Título">
            <input className={inputCls} value={post.title} onChange={(e) => update("title", e.target.value)} />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Slug">
              <input className={inputCls} value={post.slug} onChange={(e) => update("slug", e.target.value)} />
            </Field>
            <Field label="Categoria">
              <select className={inputCls} value={post.category} onChange={(e) => update("category", e.target.value)}>
                <option value="produtividade">Produtividade</option>
                <option value="ia">IA & Pandora</option>
                <option value="financas">Finanças</option>
                <option value="automacao">Automação</option>
                <option value="deep-work">Deep Work</option>
              </select>
            </Field>
          </div>
          <Field label="Resumo">
            <textarea className={`${inputCls} min-h-[80px]`} value={post.excerpt} onChange={(e) => update("excerpt", e.target.value)} />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Meta title (50-60 chars)">
              <input className={inputCls} value={post.meta_title || ""} onChange={(e) => update("meta_title", e.target.value)} />
            </Field>
            <Field label="Meta description (140-155 chars)">
              <input className={inputCls} value={post.meta_description || ""} onChange={(e) => update("meta_description", e.target.value)} />
            </Field>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Tags (vírgula)">
              <input className={inputCls} value={post.tags?.join(", ") || ""} onChange={(e) => update("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </Field>
            <Field label="Keywords (vírgula)">
              <input className={inputCls} value={post.keywords?.join(", ") || ""} onChange={(e) => update("keywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </Field>
            <Field label="Tempo de leitura (min)">
              <input type="number" className={inputCls} value={post.reading_minutes} onChange={(e) => update("reading_minutes", parseInt(e.target.value) || 5)} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="featured" checked={post.featured} onChange={(e) => update("featured", e.target.checked)} />
            <label htmlFor="featured" className="text-sm text-[#8E8E93]">Em destaque na home do blog</label>
          </div>
          <Field label="Conteúdo (Markdown)">
            <textarea className={`${inputCls} min-h-[600px] font-mono text-sm`} value={post.content_md} onChange={(e) => update("content_md", e.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#C8956C]/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] tracking-[0.2em] uppercase text-[#636366] font-mono mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
