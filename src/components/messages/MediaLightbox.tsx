/**
 * MediaLightbox — Fullscreen image/video viewer with download.
 */
import { memo, useEffect, useCallback } from "react";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface MediaLightboxProps {
  open: boolean;
  src: string;
  type: "image" | "video";
  fileName?: string;
  onClose: () => void;
  onDownload?: () => void;
}

export const MediaLightbox = memo(function MediaLightbox({
  open, src, type, fileName, onClose, onDownload,
}: MediaLightboxProps) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === "-") setZoom(z => Math.max(z - 0.25, 0.5));
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Toolbar */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Baixar"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Media */}
          <div onClick={e => e.stopPropagation()} className="max-w-[90vw] max-h-[90vh] overflow-auto">
            {type === "image" ? (
              <motion.img
                src={src}
                alt={fileName || "Mídia"}
                className="rounded-lg shadow-2xl select-none"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center", maxHeight: "85vh", maxWidth: "85vw", objectFit: "contain" }}
                draggable={false}
                initial={{ scale: 0.8 }}
                animate={{ scale: zoom }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            ) : (
              <video
                src={src}
                controls
                autoPlay
                className="rounded-lg shadow-2xl max-h-[85vh] max-w-[85vw]"
              />
            )}
          </div>

          {/* File name */}
          {fileName && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <span className="text-xs text-white/60 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                {fileName}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
