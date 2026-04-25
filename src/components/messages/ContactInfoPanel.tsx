import { memo, useState, useEffect, useCallback } from "react";
import { X, Phone, Globe, User, Image, FileText, Link2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ContactInfoPanelProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  avatarUrl?: string;
  conversationId: string;
}

export const ContactInfoPanel = memo(function ContactInfoPanel({
  open, onClose, contactId, contactName, avatarUrl, conversationId,
}: ContactInfoPanelProps) {
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [mediaCount, setMediaCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchInfo = useCallback(async () => {
    if (!open || !contactId) return;
    setLoading(true);

    try {
      // Fetch contact info from Evolution API
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-web-proxy/find-contact-info`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
          body: JSON.stringify({ contactId }),
        });
        const result = await res.json();
        if (result.ok) setContactInfo(result.data);
      }
    } catch {}

    // Count media and docs
    try {
      const { count: mCount } = await supabase
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .in("type", ["image", "video"]);
      setMediaCount(mCount ?? 0);

      const { count: dCount } = await supabase
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .eq("type", "document");
      setDocCount(dCount ?? 0);
    } catch {}

    setLoading(false);
  }, [open, contactId, conversationId]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  const isGroup = contactId.endsWith("@g.us");
  const phone = isGroup ? null : contactId.replace(/@.*/, "");
  const formattedPhone = phone ? `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}` : null;

  // Extract contact details from API response
  const contacts = Array.isArray(contactInfo) ? contactInfo : contactInfo ? [contactInfo] : [];
  const contact = contacts[0] as any;
  const statusText = contact?.status ?? contact?.pushName ?? null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[320px] sm:w-[380px] p-0">
        <SheetHeader className="p-4 border-b border-foreground/5">
          <SheetTitle className="text-sm">Info do contato</SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-60px)]">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-foreground/10 flex items-center justify-center text-3xl overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={contactName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <p className="text-lg font-medium">{contactName}</p>
            {statusText && <p className="text-xs text-muted-foreground italic">"{statusText}"</p>}
          </div>

          {/* Phone */}
          {formattedPhone && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-foreground/5">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm">{formattedPhone}</p>
                <p className="text-[10px] text-muted-foreground">Telefone</p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-foreground/5">
              <Image className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{mediaCount}</p>
                <p className="text-[10px] text-muted-foreground">Mídias</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-foreground/5">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{docCount}</p>
                <p className="text-[10px] text-muted-foreground">Documentos</p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
});
