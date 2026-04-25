import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface SearchImageGalleryProps {
  images: string[];
}

const SearchImageGallery = ({ images }: SearchImageGalleryProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!images.length) return null;

  // Deduplicate
  const uniqueImages = [...new Set(images)];

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-foreground/10">
        {uniqueImages.map((src, i) => (
          <button
            key={i}
            onClick={() => setSelectedImage(src)}
            className="flex-shrink-0 rounded-xl overflow-hidden border border-foreground/10 hover:border-primary/40 transition-all hover:scale-[1.02] active:scale-95"
          >
            <img
              src={src}
              alt={`Resultado ${i + 1}`}
              className="h-32 w-auto max-w-[200px] object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = "none";
              }}
            />
          </button>
        ))}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background/95 backdrop-blur-xl border-foreground/10">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Imagem ampliada"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SearchImageGallery;
