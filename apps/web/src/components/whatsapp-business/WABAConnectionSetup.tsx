import { useEffect, useState } from "react";
import { Building2, Key, Globe, CheckCircle2, Loader2, ExternalLink, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useZernioWhatsApp, WABAAccount } from "@/hooks/whatsapp/useZernioWhatsApp";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { zernioClient } from "@/services/zernio/client";
import { useZernioSyncAccounts } from "@/hooks/whatsapp/useZernioSyncAccounts";
import { toast } from "@/hooks/use-toast";

interface Props {
  profileId?: string;
  onConnected?: (account: WABAAccount) => void;
}

interface LateProfile {
  id: string;
  name?: string;
}

export default function WABAConnectionSetup({ profileId: profileIdProp, onConnected }: Props) {
  const { connectCredentials, getAuthUrl } = useZernioWhatsApp();
  const { sync } = useZernioSyncAccounts();
  const { activeWorkspaceId } = useWorkspace();
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

  // Ensure this workspace has a Zernio profile. New workspaces usually get one
  // during creation; older workspaces and failed async mints recover here.
  useEffect(() => {
    if (profileIdProp) return; // explicit prop wins
    let cancelled = false;
    (async () => {
      setProfilesLoading(true);
      setProfilesError(null);
      try {
        if (!activeWorkspaceId) {
          throw new Error("Selecione um workspace antes de conectar o WhatsApp Business.");
        }
        const status = await zernioClient.forWorkspace(activeWorkspaceId).status();
        if (cancelled) return;
        if (!status.configured) {
          throw new Error("ZERNIO_API_KEY não está configurada no servidor.");
        }
        const profileId = status.profileId;
        if (!profileId) {
          throw new Error(
            "Workspace ainda não tem profile Zernio. O profile é criado automaticamente no momento da criação do workspace — aguarde alguns segundos e recarregue.",
          );
        }
        if (cancelled) return;
        setProfiles([{ id: profileId, name: "Workspace" }]);
        setProfileId(profileId);
      } catch (e) {
        if (!cancelled) setProfilesError((e as Error)?.message || "Falha ao carregar perfil Zernio.");
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileIdProp, activeWorkspaceId]);

  const handleEmbeddedSignup = async () => {
    if (!profileId) {
      toast({
        title: "Perfil não encontrado",
        description: profilesError || "Aguardando criação do perfil Zernio.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/whatsapp-business`;
      const res = await getAuthUrl(redirectUrl);
      if (res.error || !res.data?.authUrl) throw new Error(res.error || "Falha ao gerar URL de conexão");
      window.location.assign(res.data.authUrl);
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
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
      await sync();
      toast({ title: "Conectado!", description: "WhatsApp Business conectado com sucesso." });
      if (res.data?.account) onConnected?.(res.data.account);
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
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
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
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
