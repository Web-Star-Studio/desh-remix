import { ExternalLink } from "lucide-react";
import SearchCodeBlock from "./SearchCodeBlock";

export const markdownComponents = {
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
      {children}
      <ExternalLink className="w-3 h-3 inline-block" />
    </a>
  ),
  img: ({ src, alt }: any) => (
    <img src={src} alt={alt || ""} loading="lazy" className="rounded-xl max-h-72 object-cover shadow-md hover:shadow-lg transition-shadow cursor-zoom-in" />
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-foreground/10 shadow-sm">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-primary/10 text-foreground font-semibold">{children}</thead>
  ),
  th: ({ children }: any) => (
    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider border-b border-foreground/10">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="px-3 py-2 border-b border-foreground/5 text-foreground/80">{children}</td>
  ),
  tr: ({ children, ...props }: any) => (
    <tr className="hover:bg-primary/5 transition-colors even:bg-muted/30" {...props}>{children}</tr>
  ),
  hr: () => (
    <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
  ),
  code: ({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    const codeStr = String(children).replace(/\n$/, "");
    if (match) {
      return <SearchCodeBlock language={match[1]} code={codeStr} />;
    }
    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
};
