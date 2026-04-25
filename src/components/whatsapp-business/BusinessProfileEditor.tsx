import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, Loader2, Save, Globe, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useZernioWhatsApp, WABABusinessProfile } from "@/hooks/whatsapp/useZernioWhatsApp";
import { toast } from "@/hooks/use-toast";

interface Props { accountId: string }

export default function BusinessProfileEditor({ accountId }: Props) {
  const { getBusinessProfile, updateBusinessProfile } = useZernioWhatsApp();
  const [profile, setProfile] = useState<WABABusinessProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [websites, setWebsites] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await getBusinessProfile(accountId);
      if (!mountedRef.current) return;
      if (res.data?.businessProfile) {
        setProfile(res.data.businessProfile);
        setWebsites((res.data.businessProfile.websites || []).join(", "));
      }
    } catch (e) {
      console.error("[BusinessProfileEditor] loadProfile error:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [accountId, getBusinessProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await updateBusinessProfile(accountId, {
        ...profile,
        websites: websites ? websites.split(",").map(w => w.trim()).filter(Boolean) : [],
      });
      if (res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Perfil atualizado!" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao salvar perfil", description: e?.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [accountId, profile, websites, updateBusinessProfile]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[hsl(142,70%,45%)]" /> Perfil Comercial
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Informações visíveis para clientes que abrem seu perfil no WhatsApp</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Sobre</Label>
          <Input
            placeholder="Sua loja de widgets favorita"
            value={profile.about || ""}
            onChange={e => setProfile(p => ({ ...p, about: e.target.value }))}
            maxLength={139}
          />
          <p className="text-[10px] text-muted-foreground">{(profile.about || "").length}/139 caracteres</p>
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            placeholder="Descrição detalhada do seu negócio..."
            value={profile.description || ""}
            onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
            rows={3}
            maxLength={512}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> E-mail</Label>
            <Input
              placeholder="contato@empresa.com"
              value={profile.email || ""}
              onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Endereço</Label>
            <Input
              placeholder="Av. Paulista, 1000"
              value={profile.address || ""}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-muted-foreground" /> Websites (separados por vírgula)</Label>
          <Input
            placeholder="https://exemplo.com, https://loja.exemplo.com"
            value={websites}
            onChange={e => setWebsites(e.target.value)}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Perfil
        </Button>
      </div>
    </div>
  );
}