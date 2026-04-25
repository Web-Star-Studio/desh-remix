import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Search, Calendar, Clock, TrendingUp } from "lucide-react";
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
  tags: string[];
  author_name: string;
  reading_minutes: number;
  published_at: string | null;
  featured: boolean;
};

const CATEGORIES = [
  { id: "all", label: "Tudo" },
  { id: "produtividade", label: "Produtividade" },
  { id: "ia", label: "IA & Pandora" },
  { id: "financas", label: "Finanças" },
  { id: "automacao", label: "Automação" },
  { id: "deep-work", label: "Deep Work" },
];

function BlogPageInner() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Blog DESH · Produtividade, IA e Vida Operada | DESH";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute(
      "content",
      "Insights práticos sobre Life OS, IA pessoal, Open Banking, automações e produtividade. O blog do DESH para quem opera a própria vida com sofisticação."
    );
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_image, category, tags, author_name, reading_minutes, published_at, featured")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      setPosts((data as Post[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = posts.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const featured = filtered.find((p) => p.featured) || filtered[0];
  const rest = filtered.filter((p) => p.id !== featured?.id);

  // JSON-LD for the Blog
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog DESH",
    description: "Insights sobre Life OS, IA pessoal, Open Banking, automações e produtividade.",
    url: "https://desh.life/blog",
    publisher: {
      "@type": "Organization",
      name: "DESH",
      url: "https://desh.life",
    },
    blogPost: posts.slice(0, 10).map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `https://desh.life/blog/${p.slug}`,
      datePublished: p.published_at,
      author: { "@type": "Person", name: p.author_name },
    })),
  };

  return (
    <div className="min-h-screen text-[#F5F5F7]" style={{ background: "#0A0A0F" }}>
      <ScrollProgressBar />
      <WelcomeNavbar />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />

      {/* Hero */}
      <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-20 overflow-hidden">
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
            background: "radial-gradient(circle, rgba(200,149,108,0.15) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 backdrop-blur-xl"
              style={{ background: "rgba(200,149,108,0.06)", border: "1px solid rgba(200,149,108,0.18)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8956C] animate-pulse" />
              <span className="text-[11px] tracking-[0.25em] uppercase text-[#C8956C] font-mono">
                Blog · Editorial DESH
              </span>
            </div>

            <h1
              className="font-bold leading-[0.95] tracking-[-0.04em] mb-6"
              style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)", fontFamily: "'DM Sans', sans-serif" }}
            >
              Não consumir.<br />
              <span className="italic font-light text-[#8E8E93]">Operar.</span>
            </h1>
            <p className="text-[#8E8E93] text-lg md:text-xl leading-relaxed">
              Ensaios e guias práticos sobre Life OS, IA pessoal, Open Banking e automações.
              Sem fluff. Sem hacks duvidosos. Só o que faz sua vida rodar melhor.
            </p>

            {/* Search */}
            <div className="mt-12 max-w-xl mx-auto relative">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#636366]" />
              <input
                type="text"
                placeholder="Buscar artigos…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-14 pl-14 pr-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#C8956C]/30 transition-colors backdrop-blur-xl"
              />
            </div>

            {/* Category chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {CATEGORIES.map((c) =>
                c.id === "all" ? (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      activeCategory === c.id
                        ? "bg-[#C8956C] text-[#0A0A0F]"
                        : "bg-white/[0.04] text-[#8E8E93] hover:bg-white/[0.08] hover:text-[#F5F5F7] border border-white/[0.06]"
                    }`}
                  >
                    {c.label}
                  </button>
                ) : (
                  <Link
                    key={c.id}
                    to={`/blog/categoria/${c.id}`}
                    className="px-4 py-2 rounded-full text-xs font-medium transition-all bg-white/[0.04] text-[#8E8E93] hover:bg-white/[0.08] hover:text-[#F5F5F7] border border-white/[0.06]"
                  >
                    {c.label}
                  </Link>
                )
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Posts */}
      <section className="relative pb-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.05]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#8E8E93]">Nenhum artigo encontrado.</p>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featured && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                  className="mb-16"
                >
                  <Link to={`/blog/${featured.slug}`} className="group block">
                    <article
                      className="relative overflow-hidden rounded-3xl p-6 sm:p-8 md:p-12 backdrop-blur-xl border border-white/[0.06] hover:border-[#C8956C]/20 transition-all duration-700"
                      style={{ background: "linear-gradient(135deg, rgba(200,149,108,0.04), rgba(191,90,242,0.03))" }}
                    >
                      <div className="grid md:grid-cols-12 gap-6 md:gap-8 items-center">
                        <div className="md:col-span-7">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] tracking-[0.2em] uppercase font-mono mb-4"
                            style={{ background: "rgba(200,149,108,0.1)", border: "1px solid rgba(200,149,108,0.2)", color: "#C8956C" }}>
                            <TrendingUp size={10} /> Em destaque
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#636366] mb-4 font-mono">
                            <span className="uppercase tracking-[0.15em] text-[#C8956C]">{featured.category}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Clock size={11} /> {featured.reading_minutes} min</span>
                          </div>
                          <h2
                            className="text-3xl md:text-5xl font-bold leading-[1.05] tracking-[-0.025em] mb-5 group-hover:text-[#C8956C] transition-colors"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                          >
                            {featured.title}
                          </h2>
                          <p className="text-[#8E8E93] text-base md:text-lg leading-relaxed mb-6">
                            {featured.excerpt}
                          </p>
                          <span className="inline-flex items-center gap-2 text-[#F5F5F7] font-medium">
                            Ler artigo
                            <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </span>
                        </div>
                        <div className="md:col-span-5">
                          {(() => {
                            const cover = resolveBlogCover(featured.slug, featured.cover_image);
                            return cover ? (
                              <img
                                src={cover}
                                alt={featured.title}
                                width={1600}
                                height={900}
                                className="aspect-[4/3] w-full object-cover rounded-2xl border border-white/[0.04]"
                              />
                            ) : (
                              <div
                                className="aspect-[4/3] rounded-2xl flex items-center justify-center text-7xl"
                                style={{ background: "linear-gradient(135deg, rgba(200,149,108,0.1), rgba(191,90,242,0.06))", border: "1px solid rgba(255,255,255,0.04)" }}
                              >
                                ✦
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </article>
                  </Link>
                </motion.div>
              )}

              {/* Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((p, i) => (
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
                            <span className="flex items-center gap-1"><Clock size={10} /> {p.reading_minutes} min</span>
                          </div>
                          <h3
                            className="text-xl font-semibold leading-[1.2] tracking-[-0.015em] mb-3 group-hover:text-[#C8956C] transition-colors"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                          >
                            {p.title}
                          </h3>
                          <p className="text-[#8E8E93] text-sm leading-relaxed mb-5 line-clamp-3 flex-1">{p.excerpt}</p>
                          <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                            <span className="text-xs text-[#636366]">{p.author_name}</span>
                            <ArrowUpRight size={14} className="text-[#636366] group-hover:text-[#C8956C] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </div>
                        </div>
                      </article>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <WelcomeFooter />
    </div>
  );
}

export default function BlogPage() {
  return (
    <WelcomeThemeProvider>
      <BlogPageInner />
    </WelcomeThemeProvider>
  );
}
