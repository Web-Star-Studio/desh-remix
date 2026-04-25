import { Share2 } from "lucide-react";
import * as LucideIcons from "lucide-react";

/** Dynamically get a Lucide icon by name */
export function DynamicIcon({ name, className, color }: { name: string; className?: string; color?: string }) {
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("") as keyof typeof LucideIcons;
  const Icon = (LucideIcons as any)[pascalName];
  if (!Icon) return <Share2 className={className} style={color ? { color } : undefined} />;
  return <Icon className={className} style={color ? { color } : undefined} />;
}
