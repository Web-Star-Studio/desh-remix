/**
 * Reusable media download utility for WhatsApp messages.
 * Extracted from ChatView.tsx to DRY up duplicated download logic.
 */
import { toast } from "@/hooks/use-toast";

interface DownloadResult {
  base64: string;
  mimetype: string;
}

/** Download media via the waDownloadMedia function and trigger a browser download */
export async function downloadWhatsAppMedia(
  messageId: string,
  waDownloadMedia: (id: string) => Promise<any>,
  opts: {
    defaultMimetype?: string;
    fileName?: string;
    label?: string;
  } = {}
): Promise<DownloadResult | null> {
  const { defaultMimetype = "application/octet-stream", fileName, label = "Mídia" } = opts;

  try {
    toast({ title: `Baixando ${label.toLowerCase()}...` });
    const result = await waDownloadMedia(messageId);
    const mediaResult = result?.data as any;
    const base64Data = mediaResult?.base64 ?? mediaResult?.data?.base64;
    const mimetype = mediaResult?.mimetype ?? mediaResult?.data?.mimetype ?? defaultMimetype;

    if (!base64Data) {
      toast({ title: "Mídia indisponível", description: "O arquivo pode ter expirado.", variant: "destructive" });
      return null;
    }

    // Trigger browser download
    const link = document.createElement("a");
    link.href = `data:${mimetype};base64,${base64Data}`;
    const ext = mimetype.split("/")[1] || "bin";
    link.download = fileName || `whatsapp-${label.toLowerCase()}-${Date.now()}.${ext}`;
    link.click();

    toast({ title: `${label} baixado(a)!` });
    return { base64: base64Data, mimetype };
  } catch (err: any) {
    toast({ title: "Erro ao baixar", description: err?.message, variant: "destructive" });
    return null;
  }
}
