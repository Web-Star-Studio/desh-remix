import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, ArrowUpRight, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import WelcomeNavbar from "@/components/welcome/WelcomeNavbar";
import WelcomeFooter from "@/components/welcome/WelcomeFooter";
import { ScrollProgressBar } from "@/components/landing/ui/ScrollProgressBar";
import { WelcomeThemeProvider } from "@/components/welcome/WelcomeThemeContext";
import { resolveBlogCover } from "@/lib/blog/covers";
import { toast } from "sonner";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_md: string;
  cover_image: string | null;
  category: string;
  tags: string[];
  author_name: string;
  author_role: string | null;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string[];
  og_image: string | null;
  reading_minutes: number;
  views_count: number;
  faq: Array<{ question: string; answer: string }>;
  toc: Array<{ id: string; title: string; level: number }>;
  published_at: string | null;
};

function setOrCreateMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
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

function BlogPostPageInner() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Pick<Post, "id" | "slug" | "title" | "excerpt" | "category" | "reading_minutes">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (!data) {
        setLoading(false);
        return;
      }
      setPost(data as unknown as Post);
      setLoading(false);
      window.scrollTo(0, 0);

      // increment view (fire and forget)
      supabase.rpc("increment_blog_view", { _slug: slug }).then(() => {});

      // related
      const { data: rel } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, category, reading_minutes")
        .eq("status", "published")
        .eq("category", data.category)
        .neq("id", data.id)
        .order("published_at", { ascending: false })
        .limit(3);
      setRelated((rel as any) || []);
    })();
  }, [slug]);

  // SEO meta tags
  useEffect(() => {
    if (!post) return;

    const url = `https://desh.life/blog/${post.slug}`;
    document.title = post.meta_title || `${post.title} | Blog DESH`;

    setOrCreateMeta("description", post.meta_description || post.excerpt);
    setOrCreateMeta("keywords", post.keywords.join(", "));
    setOrCreateMeta("author", post.author_name);

    // Open Graph
    setOrCreateMeta("og:type", "article", true);
    setOrCreateMeta("og:title", post.title, true);
    setOrCreateMeta("og:description", post.meta_description || post.excerpt, true);
    setOrCreateMeta("og:url", url, true);
    setOrCreateMeta("og:site_name", "DESH", true);
    if (post.og_image || post.cover_image) {
      setOrCreateMeta("og:image", (post.og_image || post.cover_image)!, true);
    }
    if (post.published_at) {
      setOrCreateMeta("article:published_time", post.published_at, true);
    }
    setOrCreateMeta("article:section", post.category, true);
    post.tags.forEach((t) => setOrCreateMeta("article:tag", t, true));

    // Twitter
    setOrCreateMeta("twitter:card", "summary_large_image");
    setOrCreateMeta("twitter:title", post.title);
    setOrCreateMeta("twitter:description", post.meta_description || post.excerpt);

    setCanonical(url);
  }, [post]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: post?.title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0F" }}>
        <div className="text-[#8E8E93] text-sm">Carregando…</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen text-[#F5F5F7] pt-32" style={{ background: "#0A0A0F" }}>
        <WelcomeNavbar />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Artigo não encontrado</h1>
          <p className="text-[#8E8E93] mb-8">Este artigo pode ter sido removido ou ainda não foi publicado.</p>
          <Link to="/blog" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C8956C] text-[#0A0A0F] font-medium">
            <ArrowLeft size={16} /> Voltar ao blog
          </Link>
        </div>
      </div>
    );
  }

  // JSON-LD: Article + FAQPage + BreadcrumbList
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description || post.excerpt,
    image: post.og_image || post.cover_image || "https://desh.life/og-image.png",
    datePublished: post.published_at,
    dateModified: post.published_at,
    author: { "@type": "Person", name: post.author_name, jobTitle: post.author_role || "Editorial" },
    publisher: {
      "@type": "Organization",
      name: "DESH",
      logo: { "@type": "ImageObject", url: "https://desh.life/icon-512.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://desh.life/blog/${post.slug}` },
    keywords: post.keywords.join(", "),
    articleSection: post.category,
    inLanguage: "pt-BR",
    wordCount: post.content_md.split(/\s+/).length,
  };

  const faqJsonLd = post.faq.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://desh.life" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://desh.life/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: `https://desh.life/blog/${post.slug}` },
    ],
  };

  return (
    <div className="min-h-screen text-[#F5F5F7]" style={{ background: "#0A0A0F" }}>
      <ScrollProgressBar />
      <WelcomeNavbar />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Header */}
      <article className="relative pt-28 sm:pt-32 md:pt-40 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-8">
            <button
              onClick={() => navigate("/blog")}
              className="inline-flex items-center gap-2 text-sm text-[#8E8E93] hover:text-[#C8956C] transition-colors"
            >
              <ArrowLeft size={14} /> Blog
            </button>
          </nav>

          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#636366] mb-6 font-mono">
              <span className="uppercase tracking-[0.2em] text-[#C8956C]">{post.category}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Clock size={11} /> {post.reading_minutes} min</span>
              {post.published_at && (
                <>
                  <span>·</span>
                  <time dateTime={post.published_at} className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(post.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </time>
                </>
              )}
            </div>

            <h1
              className="font-bold leading-[1] tracking-[-0.035em] mb-6"
              style={{ fontSize: "clamp(2rem, 5.5vw, 4.5rem)", fontFamily: "'DM Sans', sans-serif" }}
            >
              {post.title}
            </h1>
            <p className="text-[#8E8E93] text-lg md:text-xl leading-relaxed mb-8">{post.excerpt}</p>

            <div className="flex items-center justify-between pb-10 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #C8956C, #BF5AF2)", color: "#0A0A0F" }}>
                  {post.author_name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#F5F5F7]">{post.author_name}</div>
                  {post.author_role && <div className="text-xs text-[#636366]">{post.author_role}</div>}
                </div>
              </div>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#8E8E93] bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:text-[#F5F5F7] transition-all"
              >
                <Share2 size={14} /> Compartilhar
              </button>
            </div>
          </motion.header>

          {/* Hero cover */}
          {(() => {
            const cover = resolveBlogCover(post.slug, post.cover_image);
            if (!cover) return null;
            return (
              <motion.figure
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="mt-10 -mx-4 md:mx-0"
              >
                <img
                  src={cover}
                  alt={post.title}
                  width={1600}
                  height={900}
                  className="w-full aspect-[16/9] object-cover rounded-2xl border border-white/[0.06]"
                />
              </motion.figure>
            );
          })()}

          {/* TOC */}
          {post.toc.length > 0 && (
            <motion.aside
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="my-12 p-6 rounded-2xl backdrop-blur-xl"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="text-[10px] tracking-[0.25em] uppercase text-[#C8956C] font-mono mb-4">
                Sumário
              </div>
              <ol className="space-y-2">
                {post.toc.map((t, i) => (
                  <li key={t.id || i} className="text-sm text-[#8E8E93]" style={{ paddingLeft: `${(t.level - 2) * 16}px` }}>
                    <a href={`#${t.id}`} className="hover:text-[#C8956C] transition-colors">
                      <span className="text-[#636366] mr-2 font-mono">{String(i + 1).padStart(2, "0")}</span>
                      {t.title}
                    </a>
                  </li>
                ))}
              </ol>
            </motion.aside>
          )}

          {/* Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="prose prose-invert prose-lg max-w-none mt-12 blog-content"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content_md}</ReactMarkdown>
          </motion.div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1.5 rounded-full text-xs font-mono text-[#8E8E93]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* FAQ */}
          {post.faq.length > 0 && (
            <section className="mt-20" aria-labelledby="faq-heading">
              <div className="text-[10px] tracking-[0.25em] uppercase text-[#C8956C] font-mono mb-4">
                Perguntas Frequentes
              </div>
              <h2 id="faq-heading" className="text-3xl font-bold mb-8 tracking-[-0.02em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Dúvidas comuns
              </h2>
              <div className="space-y-3">
                {post.faq.map((f, i) => (
                  <details
                    key={i}
                    className="group p-6 rounded-2xl backdrop-blur-xl"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <summary className="cursor-pointer font-semibold text-[#F5F5F7] flex items-center justify-between">
                      {f.question}
                      <span className="text-[#C8956C] text-xl transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-4 text-[#8E8E93] leading-relaxed">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="mt-24 p-10 rounded-3xl text-center backdrop-blur-xl relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(200,149,108,0.08), rgba(191,90,242,0.05))", border: "1px solid rgba(200,149,108,0.15)" }}>
            <h3 className="text-3xl md:text-4xl font-bold mb-4 tracking-[-0.02em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Pare de operar seu próprio sistema.
            </h3>
            <p className="text-[#8E8E93] mb-8 max-w-xl mx-auto">
              Conheça o DESH e a Pandora IA. 100 créditos de teste por 30 dias, sem cartão.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/auth?tab=signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #C8956C, #BF5AF2)", color: "#0A0A0F" }}
              >
                Começar grátis <ArrowUpRight size={16} />
              </Link>
              <Link to="/pandora" className="px-6 py-4 rounded-2xl text-[#F5F5F7] hover:text-[#C8956C] transition-colors">
                Conhecer a Pandora
              </Link>
            </div>
          </section>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-24">
              <h3 className="text-2xl font-bold mb-8 tracking-[-0.015em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Continue lendo
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link key={r.id} to={`/blog/${r.slug}`} className="group block p-5 rounded-2xl backdrop-blur-xl border border-white/[0.06] hover:border-[#C8956C]/20 transition-all"
                    style={{ background: "rgba(255,255,255,0.025)" }}>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#C8956C] mb-2 font-mono">{r.category}</div>
                    <h4 className="text-base font-semibold leading-snug mb-2 group-hover:text-[#C8956C] transition-colors line-clamp-2">{r.title}</h4>
                    <p className="text-xs text-[#8E8E93] line-clamp-2">{r.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>

      <WelcomeFooter />

      {/* Scoped styles for markdown content */}
      <style>{`
        .blog-content {
          color: #C7C7CC;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.75;
        }
        .blog-content h2 {
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-top: 3rem;
          margin-bottom: 1rem;
          color: #F5F5F7;
          line-height: 1.15;
        }
        .blog-content h3 {
          font-size: 1.4rem;
          font-weight: 600;
          margin-top: 2.25rem;
          margin-bottom: 0.75rem;
          color: #F5F5F7;
          letter-spacing: -0.01em;
        }
        .blog-content p { margin: 1.1rem 0; }
        .blog-content a { color: #C8956C; text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
        .blog-content a:hover { color: #BF5AF2; }
        .blog-content strong { color: #F5F5F7; font-weight: 600; }
        .blog-content em { color: #C8956C; font-style: italic; }
        .blog-content ul, .blog-content ol { padding-left: 1.5rem; margin: 1.25rem 0; }
        .blog-content ul { list-style: none; }
        .blog-content ul li { position: relative; padding-left: 1.25rem; margin: 0.5rem 0; }
        .blog-content ul li::before { content: ""; position: absolute; left: 0; top: 0.7rem; width: 6px; height: 6px; border-radius: 9999px; background: #C8956C; }
        .blog-content ol { list-style: decimal; }
        .blog-content ol li { padding-left: 0.25rem; margin: 0.5rem 0; }
        .blog-content blockquote {
          border-left: 3px solid #C8956C;
          padding: 0.5rem 1.5rem;
          margin: 2rem 0;
          font-style: italic;
          color: #F5F5F7;
          background: rgba(200,149,108,0.04);
          border-radius: 0 12px 12px 0;
        }
        .blog-content code {
          background: rgba(255,255,255,0.06);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-size: 0.9em;
          color: #C8956C;
          font-family: 'JetBrains Mono', monospace;
        }
        .blog-content pre {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 1.25rem;
          border-radius: 12px;
          overflow-x: auto;
          margin: 1.5rem 0;
        }
        .blog-content pre code { background: none; padding: 0; color: #C7C7CC; }
        .blog-content table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9rem; }
        .blog-content th, .blog-content td { border: 1px solid rgba(255,255,255,0.08); padding: 0.65rem 1rem; text-align: left; }
        .blog-content th { background: rgba(200,149,108,0.06); color: #F5F5F7; font-weight: 600; }
        .blog-content hr { border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 3rem 0; }
        .blog-content img { border-radius: 12px; margin: 1.5rem 0; }
      `}</style>
    </div>
  );
}

export default function BlogPostPage() {
  return (
    <WelcomeThemeProvider>
      <BlogPostPageInner />
    </WelcomeThemeProvider>
  );
}
