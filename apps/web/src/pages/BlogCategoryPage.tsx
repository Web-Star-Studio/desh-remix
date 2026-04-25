import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import WelcomeNavbar from "@/components/welcome/WelcomeNavbar";
import WelcomeFooter from "@/components/welcome/WelcomeFooter";
import { ScrollProgressBar } from "@/components/landing/ui/ScrollProgressBar";
import { WelcomeThemeProvider } from "@/components/welcome/WelcomeThemeContext";
import { resolveBlogCover } from "@/lib/blog/covers";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string | null;
  category: string;
  author_name: string;
  reading_minutes: number;
  published_at: string | null;
};

const CATEGORY_META: Record<string, { label: string; tagline: string; description: string }> = {
  produtividade: {
    label: "Produtividade",
    tagline: "Operar mais. Reagir menos.",
    description:
      "Métodos práticos de Life OS, deep work e gestão de atenção. Para quem quer trocar listas infinitas por sistemas que rodam sozinhos.",
  },
  ia: {
    label: "IA & Pandora",
    tagline: "Inteligência que executa, não só responde.",
    description:
      "Como usar IA pessoal — e a Pandora especificamente — para organizar e-mail, calendário, tarefas e finanças sem virar refém de mais um chat.",
  },
  financas: {
    label: "Finanças",
    tagline: "Dinheiro consciente, automação no comando.",
    description:
      "Open Banking, automações financeiras e métodos para entender, categorizar e fazer seu dinheiro trabalhar sem planilhas.",
  },
  automacao: {
    label: "Automação",
    tagline: "Vida operada, não administrada.",
    description:
      "Receitas e padrões de automação pessoal: do gatilho ao resultado, integrando WhatsApp, Gmail, Calendar e além.",
  },
  "deep-work": {
    label: "Deep Work",
    tagline: "Foco em era de notificações.",
    description:
      "Ensaios e protocolos para trabalhar profundo em 2025: ambiente, hábitos, ritual e o papel da IA como guarda-costas da atenção.",
  },
};

function setMeta(name: string, content: string, property = false) {
  const attr = property ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}

function BlogCategoryPageInner() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = (slug && CATEGORY_META[slug]) || null;

  useEffect(() => {
    if (!slug) return;
    const label = meta?.label ?? slug;
    document.title = `${label} · Blog DESH`;
    setMeta(
      "description",
      meta?.description ?? `Artigos da categoria ${label} no blog do DESH.`
    );
    setMeta("og:title", `${label} · Blog DESH`, true);
    setMeta("og:description", meta?.description ?? "", true);
    setMeta("og:type", "website", true);
    setCanonical(`https://desh.life/blog/categoria/${slug}`);
    window.scrollTo(0, 0);
  }, [slug, meta]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_image, category, author_name, reading_minutes, published_at")
        .eq("status", "published")
        .eq("category", slug)
        .order("published_at", { ascending: false });
      setPosts((data as Post[]) || []);
      setLoading(false);
    })();
  }, [slug]);

  // ItemList JSON-LD for category SEO
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${meta?.label ?? slug} · Blog DESH`,
    itemListElement: posts.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://desh.life/blog/${p.slug}`,
      name: p.title,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://desh.life" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://desh.life/blog" },
      {
        "@type": "ListItem",
        position: 3,
        name: meta?.label ?? slug ?? "",
        item: `https://desh.life/blog/categoria/${slug}`,
      },
    ],
  };

  return (
    <div className="min-h-screen text-[#F5F5F7]" style={{ background: "#0A0A0F" }}>
      <ScrollProgressBar />
      <WelcomeNavbar />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Hero */}
      <section className="relative pt-32 sm:pt-40 pb-12 sm:pb-16 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#C8956C 1px, transparent 1px), linear-gradient(90deg, #C8956C 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(200,149,108,0.12) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
          <button
            onClick={() => navigate("/blog")}
            className="inline-flex items-center gap-2 text-sm text-[#8E8E93] hover:text-[#C8956C] transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Blog
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 backdrop-blur-xl"
              style={{ background: "rgba(200,149,108,0.06)", border: "1px solid rgba(200,149,108,0.18)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8956C] animate-pulse" />
              <span className="text-[11px] tracking-[0.25em] uppercase text-[#C8956C] font-mono">
                Categoria · {meta?.label ?? slug}
              </span>
            </div>

            <h1
              className="font-bold leading-[0.95] tracking-[-0.04em] mb-5"
              style={{ fontSize: "clamp(2.25rem, 6vw, 5rem)", fontFamily: "'DM Sans', sans-serif" }}
            >
              {meta?.label ?? slug}
              <br />
              <span className="italic font-light text-[#8E8E93]">{meta?.tagline ?? ""}</span>
            </h1>
            <p className="text-[#8E8E93] text-lg leading-relaxed max-w-2xl">
              {meta?.description ?? `Artigos publicados na categoria ${slug}.`}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Posts */}
      <section className="relative pb-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.05]" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#8E8E93] mb-6">Ainda não há artigos publicados nesta categoria.</p>
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium bg-[#C8956C] text-[#0A0A0F] hover:bg-[#C8956C]/90 transition-colors"
              >
                Ver todos os artigos <ArrowUpRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                >
                  <Link to={`/blog/${p.slug}`} className="group block h-full">
                    <article
                      className="h-full flex flex-col rounded-2xl overflow-hidden backdrop-blur-xl border border-white/[0.06] hover:border-[#C8956C]/20 hover:-translate-y-1 transition-all duration-500"
                      style={{ background: "rgba(255,255,255,0.025)" }}
                    >
                      {(() => {
                        const cover = resolveBlogCover(p.slug, p.cover_image);
                        return cover ? (
                          <img
                            src={cover}
                            alt={p.title}
                            loading="lazy"
                            width={1600}
                            height={900}
                            className="w-full aspect-[16/10] object-cover"
                          />
                        ) : null;
                      })()}
                      <div className="p-7 flex flex-col flex-1">
                        <div className="flex items-center gap-2 text-[10px] text-[#636366] mb-4 font-mono uppercase tracking-[0.15em]">
                          <span className="text-[#C8956C]">{p.category}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {p.reading_minutes} min
                          </span>
                        </div>
                        <h2
                          className="text-xl font-semibold leading-[1.2] tracking-[-0.015em] mb-3 group-hover:text-[#C8956C] transition-colors"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          {p.title}
                        </h2>
                        <p className="text-[#8E8E93] text-sm leading-relaxed mb-5 line-clamp-3 flex-1">{p.excerpt}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                          <span className="text-xs text-[#636366]">{p.author_name}</span>
                          <ArrowUpRight
                            size={14}
                            className="text-[#636366] group-hover:text-[#C8956C] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          />
                        </div>
                      </div>
                    </article>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <WelcomeFooter />
    </div>
  );
}

export default function BlogCategoryPage() {
  return (
    <WelcomeThemeProvider>
      <BlogCategoryPageInner />
    </WelcomeThemeProvider>
  );
}
