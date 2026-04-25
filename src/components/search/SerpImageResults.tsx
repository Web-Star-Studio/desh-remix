import { ImageIcon, ExternalLink, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect } from "react";

interface ImageResult {
  title: string;
  link: string;
  thumbnail: string;
  original: string;
  source: string;
}

interface Props {
  items: ImageResult[];
}

const SerpImageResults = ({ items }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const visible = showAll ? items : items.slice(0, 8);

  const navigate = useCallback((dir: 1 | -1) => {
    if (lightboxIdx === null) return;
    setLightboxIdx((lightboxIdx + dir + items.length) % items.length);
  }, [lightboxIdx, items.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxIdx, navigate]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxIdx !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [lightboxIdx]);

  if (!items.length) return null;

  return (
    <>
      <GlassCard size="auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            <p className="widget-title">Imagens do Google ({items.length})</p>
          </div>
          {items.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-[10px] text-primary hover:text-primary/80 transition-colors"
            >
              {showAll ? "Ver menos" : `Ver todas (${items.length})`}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {visible.map((img, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setLightboxIdx(i)}
              className="group relative rounded-xl overflow-hidden bg-foreground/[0.02] border border-foreground/5 hover:border-primary/20 transition-all text-left"
            >
              <div className="aspect-square">
                <img
                  src={img.thumbnail}
                  alt={img.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute top-2 right-2">
                  <ZoomIn className="w-4 h-4 text-white/70" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-[10px] text-white line-clamp-2 leading-tight">{img.title}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] text-white/60 truncate">{img.source}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-white/60 shrink-0" />
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </GlassCard>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxIdx(null)}
          >
            {/* Top bar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <span className="text-xs text-white/50 font-medium">
                {lightboxIdx + 1} / {items.length}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={items[lightboxIdx].original || items[lightboxIdx].link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                  onClick={(e) => e.stopPropagation()}
                  title="Abrir original"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                  onClick={() => setLightboxIdx(null)}
                  title="Fechar (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation arrows */}
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all z-10"
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              title="Anterior (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all z-10"
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              title="Próxima (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Image */}
            <motion.div
              key={lightboxIdx}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={items[lightboxIdx].original || items[lightboxIdx].thumbnail}
                alt={items[lightboxIdx].title}
                className="max-w-full max-h-[75vh] rounded-xl object-contain shadow-2xl"
              />
              <div className="text-center space-y-1">
                <p className="text-sm text-white/90 line-clamp-2">{items[lightboxIdx].title}</p>
                <a
                  href={items[lightboxIdx].link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors"
                >
                  {items[lightboxIdx].source} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>

            {/* Keyboard hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 text-[10px] text-white/30">
              <span>← → navegar</span>
              <span>Esc fechar</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SerpImageResults;
