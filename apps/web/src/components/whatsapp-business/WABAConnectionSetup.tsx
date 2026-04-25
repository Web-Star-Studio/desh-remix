import { useEffect, useState } from "react";
import { Building2, Key, Globe, CheckCircle2, Loader2, ExternalLink, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useZernioWhatsApp, WABAAccount } from "@/hooks/whatsapp/useZernioWhatsApp";
import { useLateProxy } from "@/hooks/messages/useLateProxy";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  profileId?: string;
  onConnected?: (account: WABAAccount) => void;
}

interface LateProfile {
  _id?: string;
  id?: string;
  name?: string;
  color?: string;
}

export default function WABAConnectionSetup({ profileId: profileIdProp, onConnected }: Props) {
  const { connectCredentials, getSdkConfig } = useZernioWhatsApp();
  const { lateInvoke } = useLateProxy();
  const { activeWorkspace } = useWorkspace();
  const [mode, setMode] = useState<"choose" | "embedded" | "headless">("choose");
  const [loading, setLoading] = useState(false);

  // Late profile resolution
  const [profileId, setProfileId] = useState<string>(profileIdProp || "");
  const [profiles, setProfiles] = useState<LateProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  // Headless fields
  const [accessToken, setAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");

  // Fetch (or auto-create) the Late profile that the WABA connection will be attached to.
  useEffect(() => {
    if (profileIdProp) return; // explicit prop wins
    let cancelled = false;
    (async () => {
      setProfilesLoading(true);
      setProfilesError(null);
      try {
        // 1) Prefer a profile already linked locally to the active workspace
        if (activeWorkspace?.id) {
          const { data: localProfile } = await supabase
            .from("social_profiles")
            .select("late_profile_id, name")
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();
          if (cancelled) return;
          if (localProfile?.late_profile_id) {
            const lp: LateProfile = { _id: localProfile.late_profile_id, name: localProfile.name || "Workspace" };
            setProfiles([lp]);
            setProfileId(localProfile.late_profile_id);
            setProfilesLoading(false);
            return;
          }
        }

        // 2) Otherwise list profiles from Zernio and use the first one
        const res = await lateInvoke<{ profiles?: LateProfile[] } | LateProfile[]>("/profiles", "GET");
        if (cancelled) return;
        if (res.error) throw new Error(res.error);
        const list: LateProfile[] = Array.isArray(res.data)
          ? res.data
          : (res.data?.profiles || []);
        if (list.length > 0) {
          setProfiles(list);
          const first = list[0];
          setProfileId(first._id || first.id || "");
        } else {
          // Auto-create a default profile so the user can proceed without leaving the screen
          const created = await lateInvoke<{ profile?: LateProfile } | LateProfile>("/profiles", "POST", {
            name: "Default",
            color: "#25D366",
          });
          if (cancelled) return;
          if (created.error) throw new Error(created.error);
          const cp: any = created.data;
          const profile: LateProfile = cp?.profile || cp;
          const id = profile?._id || profile?.id || "";
          if (!id) throw new Error("Não foi possível criar o perfil padrão.");
          setProfiles([profile]);
          setProfileId(id);
        }
      } catch (e: any) {
        if (!cancelled) setProfilesError(e?.message || "Falha ao carregar perfis.");
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileIdProp, lateInvoke, activeWorkspace?.id]);

  const handleEmbeddedSignup = async () => {
    setLoading(true);
    try {
      const res = await getSdkConfig();
      if (res.error || !res.data) throw new Error(res.error || "Falha ao carregar configuração");
      toast({ title: "Embedded Signup", description: "Abra o popup do Facebook para conectar sua conta WABA. (Implementação do popup requer o SDK do Facebook)" });
      // In production, this would load the FB SDK and open the popup
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleHeadless = async () => {
    if (!profileId) {
      toast({
        title: "Perfil não encontrado",
        description: profilesError || "Aguardando criação do perfil padrão. Tente novamente em alguns segundos.",
        variant: "destructive",
      });
      return;
    }
    if (!accessToken || !wabaId || !phoneNumberId) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await connectCredentials(profileId, accessToken, wabaId, phoneNumberId);
      if (res.error) throw new Error(res.error);
      toast({ title: "Conectado!", description: "WhatsApp Business conectado com sucesso." });
      if (res.data?.account) onConnected?.(res.data.account);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (mode === "choose") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setMode("embedded")}
          className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/30 hover:border-primary/30 transition-all duration-300 text-left"
        >
          <div className="w-14 h-14 rounded-2xl bg-[hsl(142,70%,45%)]/10 flex items-center justify-center">
            <Globe className="w-7 h-7 text-[hsl(142,70%,45%)]" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">Embedded Signup</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Conecte via popup do Facebook. Ideal para quem não tem credenciais Meta configuradas.
            </p>
          </div>
          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Selecionar <ArrowRight className="w-3 h-3" />
          </span>
        </button>

        <button
          onClick={() => setMode("headless")}
          className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/30 hover:border-primary/30 transition-all duration-300 text-left"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Key className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">Credenciais Diretas</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use seu System User Token, WABA ID e Phone Number ID. Ideal para automação servidor-a-servidor.
            </p>
          </div>
          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Selecionar <ArrowRight className="w-3 h-3" />
          </span>
        </button>
      </div>
    );
  }

  if (mode === "embedded") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setMode("choose")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Voltar</button>
          <h3 className="font-semibold text-foreground">Embedded Signup</h3>
        </div>
        <div className="p-6 rounded-xl border border-border/50 bg-card/30 space-y-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p>O Embedded Signup abre um popup do Facebook onde você:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Faz login na sua conta Meta Business</li>
                <li>Seleciona ou cria um WhatsApp Business Account</li>
                <li>Escolhe um número de telefone</li>
              </ol>
            </div>
          </div>
          <Button onClick={handleEmbeddedSignup} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
            Iniciar Embedded Signup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setMode("choose")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Voltar</button>
        <h3 className="font-semibold text-foreground">Credenciais Diretas</h3>
      </div>

      <div className="p-4 rounded-xl border border-border/50 bg-card/30 text-sm text-muted-foreground flex items-start gap-3">
        <Key className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <div>
          <p>Crie um <strong>System User</strong> em <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">Meta Business Suite <ExternalLink className="w-3 h-3" /></a> com permissões <code className="text-xs bg-muted px-1 py-0.5 rounded">whatsapp_business_management</code> e <code className="text-xs bg-muted px-1 py-0.5 rounded">whatsapp_business_messaging</code>.</p>
        </div>
      </div>

      {/* Late profile resolver status */}
      {profilesLoading ? (
        <div className="p-3 rounded-xl border border-border/50 bg-card/30 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Preparando perfil de conexão...
        </div>
      ) : profilesError ? (
        <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Não foi possível preparar o perfil de conexão.</p>
            <p className="opacity-80">{profilesError}</p>
          </div>
        </div>
      ) : profiles.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="waba-profile">Perfil de conexão</Label>
          <select
            id="waba-profile"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {profiles.map((p) => {
              const id = p._id || p.id || "";
              return <option key={id} value={id}>{p.name || id}</option>;
            })}
          </select>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="waba-token">Access Token do System User</Label>
          <Input id="waba-token" placeholder="EAAx..." value={accessToken} onChange={e => setAccessToken(e.target.value)} type="password" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="waba-id">WABA ID</Label>
            <Input id="waba-id" placeholder="1234567890" value={wabaId} onChange={e => setWabaId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waba-phone">Phone Number ID</Label>
            <Input id="waba-phone" placeholder="9876543210" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={handleHeadless}
          disabled={loading || profilesLoading || !profileId || !accessToken || !wabaId || !phoneNumberId}
          className="w-full"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Conectar WhatsApp Business
        </Button>
      </div>
    </div>
  );
}
