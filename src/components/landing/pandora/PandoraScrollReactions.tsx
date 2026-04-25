import { useEffect, useRef } from "react";

interface Props {
  triggerSectionReaction: (sectionId: string) => void;
}

const SECTION_IDS = ["hero", "problem", "solution", "modules", "pandora", "pricing", "faq", "final"];

export function PandoraScrollReactions({ triggerSectionReaction }: Props) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            triggerSectionReaction(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [triggerSectionReaction]);

  return null;
}
