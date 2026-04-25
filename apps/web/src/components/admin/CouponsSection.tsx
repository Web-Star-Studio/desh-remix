import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, Plus, Trash2, Save, X, Loader2, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
}

export default function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: "", type: "credits", value: "", max_uses: "", expires_at: "" });
  const [saving, setSaving] = useState(false);

  const fetchCoupons = useCallback(async () => {
    const { data } = await supabase
      .from("coupons" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setCoupons((data as any as Coupon[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const handleCreate = async () => {
    if (!form.code || !form.value) return;
    setSaving(true);
    try {
      if (form.type === "percent") {
        // Use Edge Function for percent coupons (Stripe sync)
        const { data, error } = await supabase.functions.invoke("billing", {
          body: {
            type: "coupons",
            action: "create",
            code: form.code.toUpperCase(),
            coupon_type: form.type,
            value: parseFloat(form.value),
            max_uses: form.max_uses || null,
            expires_at: form.expires_at || null,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "Cupom criado", description: `${form.code.toUpperCase()} — sincronizado com Stripe` });
      } else {
        // Credits coupons: insert directly (no Stripe needed)
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("coupons" as any).insert({
          code: form.code.toUpperCase(),
          type: form.type,
          value: parseFloat(form.value),
          max_uses: form.max_uses ? parseInt(form.max_uses) : null,
          expires_at: form.expires_at || null,
          created_by: user!.id,
        } as any);
        if (error) throw error;
        toast({ title: "Cupom criado", description: form.code.toUpperCase() });
      }
      setCreating(false);
      setForm({ code: "", type: "credits", value: "", max_uses: "", expires_at: "" });
      fetchCoupons();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (coupon: Coupon, active: boolean) => {
    if (coupon.stripe_promotion_code_id) {
      // Sync with Stripe
      const { data, error } = await supabase.functions.invoke("billing", {
        body: { type: "coupons", action: "toggle", id: coupon.id, active },
      });
      if (error || data?.error) {
        toast({ title: "Erro ao sincronizar com Stripe", variant: "destructive" });
        return;
      }
    } else {
      await supabase.from("coupons" as any).update({ active } as any).eq("id", coupon.id);
    }
    fetchCoupons();
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm("Remover este cupom?")) return;
    if (coupon.stripe_promotion_code_id) {
      const { data, error } = await supabase.functions.invoke("billing", {
        body: { type: "coupons", action: "delete", id: coupon.id },
      });
      if (error || data?.error) {
        toast({ title: "Erro ao remover", variant: "destructive" });
        return;
      }
    } else {
      await supabase.from("coupons" as any).delete().eq("id", coupon.id);
    }
    toast({ title: "Cupom removido" });
    fetchCoupons();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copiado", description: code });
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Ticket className="w-4 h-4 text-primary" /> Cupons de Desconto
        </h3>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Cupom
          </button>
        )}
      </div>

      {creating && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">Código</label>
              <Input placeholder="BEMVINDO50" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="text-xs uppercase" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">Tipo</label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credits">Créditos</SelectItem>
                  <SelectItem value="percent">Desconto %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">
                {form.type === "credits" ? "Créditos" : "Percentual (%)"}
              </label>
              <Input type="number" min="1" max={form.type === "percent" ? "100" : undefined} placeholder={form.type === "credits" ? "100" : "20"} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">Max usos (vazio = ilimitado)</label>
              <Input type="number" min="1" placeholder="∞" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} className="text-xs" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] text-muted-foreground font-medium">Expira em (opcional)</label>
              <Input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} className="text-xs" />
            </div>
          </div>
          {form.type === "percent" && (
            <p className="text-[10px] text-primary/70">⚡ Cupons percentuais são sincronizados automaticamente com o Stripe.</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving || !form.code || !form.value} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Criar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)} className="text-xs">
              <X className="w-3 h-3 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {coupons.map(c => {
          const expired = c.expires_at && new Date(c.expires_at) < new Date();
          const maxed = c.max_uses !== null && c.used_count >= c.max_uses;
          return (
            <div key={c.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
              c.active && !expired && !maxed ? "bg-foreground/[0.02] border-border/50" : "bg-destructive/[0.03] border-destructive/20 opacity-60"
            }`}>
              <div className="flex items-center gap-3 min-w-0 flex-wrap">
                <button onClick={() => copyCode(c.code)} className="flex items-center gap-1 hover:opacity-70">
                  <span className="font-mono font-bold text-sm text-foreground">{c.code}</span>
                  <Copy className="w-3 h-3 text-muted-foreground" />
                </button>
                <Badge variant="outline" className="text-[10px]">
                  {c.type === "credits" ? `${c.value} créditos` : `${c.value}% off`}
                </Badge>
                {c.stripe_promotion_code_id && (
                  <Badge variant="outline" className="text-[9px] text-primary border-primary/30">Stripe</Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {c.used_count}/{c.max_uses ?? "∞"} usos
                </span>
                {expired && <Badge variant="destructive" className="text-[9px]">Expirado</Badge>}
                {maxed && <Badge variant="destructive" className="text-[9px]">Esgotado</Badge>}
                {c.expires_at && !expired && (
                  <span className="text-[10px] text-muted-foreground">
                    até {format(new Date(c.expires_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={c.active} onCheckedChange={v => handleToggle(c, v)} />
                <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3 h-3 text-destructive/60" />
                </button>
              </div>
            </div>
          );
        })}
        {coupons.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum cupom cadastrado.</p>
        )}
      </div>
    </div>
  );
}
