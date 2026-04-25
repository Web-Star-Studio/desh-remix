import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://desh.life";

const STATIC_URLS: { loc: string; priority: string; changefreq: string }[] = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/blog", priority: "0.9", changefreq: "daily" },
  { loc: "/pandora", priority: "0.9", changefreq: "monthly" },
  { loc: "/pricing", priority: "0.8", changefreq: "monthly" },
  { loc: "/auth", priority: "0.6", changefreq: "monthly" },
  { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
  { loc: "/terms", priority: "0.3", changefreq: "yearly" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at, category")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    const categories = new Set<string>();
    (posts || []).forEach((p: any) => p.category && categories.add(p.category));

    const urls: string[] = [];

    STATIC_URLS.forEach((u) => {
      urls.push(
        `<url><loc>${SITE_URL}${u.loc}</loc><priority>${u.priority}</priority><changefreq>${u.changefreq}</changefreq></url>`
      );
    });

    Array.from(categories).forEach((cat) => {
      urls.push(
        `<url><loc>${SITE_URL}/blog?categoria=${encodeURIComponent(cat)}</loc><priority>0.7</priority><changefreq>weekly</changefreq></url>`
      );
    });

    (posts || []).forEach((p: any) => {
      const lastmod = (p.updated_at || p.published_at || new Date().toISOString()).slice(0, 10);
      urls.push(
        `<url><loc>${SITE_URL}/blog/${p.slug}</loc><lastmod>${lastmod}</lastmod><priority>0.8</priority><changefreq>monthly</changefreq></url>`
      );
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><error>${(e as Error).message}</error>`,
      { status: 500, headers: { "Content-Type": "application/xml" } }
    );
  }
});
