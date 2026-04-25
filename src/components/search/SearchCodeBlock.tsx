import { useState, lazy, Suspense } from "react";
import { Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter/dist/esm/prism").then((mod) => ({ default: mod.default }))
);
const oneDarkPromise = import("react-syntax-highlighter/dist/esm/styles/prism").then((mod) => mod.oneDark);

let cachedStyle: Record<string, any> | null = null;
oneDarkPromise.then((s) => { cachedStyle = s; });

const SearchCodeBlock = ({ language, code }: { language: string; code: string }) => {
  const [copied, setCopied] = useState(false);
  const [style, setStyle] = useState<Record<string, any> | null>(cachedStyle);

  if (!style) {
    oneDarkPromise.then(setStyle);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all z-10"
        title="Copiar código"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      {style ? (
        <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
          <SyntaxHighlighter
            style={style}
            language={language}
            PreTag="div"
            customStyle={{ borderRadius: "0.75rem", fontSize: "0.8rem", margin: 0 }}
          >
            {code}
          </SyntaxHighlighter>
        </Suspense>
      ) : (
        <Skeleton className="h-24 w-full rounded-xl" />
      )}
    </div>
  );
};

export default SearchCodeBlock;
