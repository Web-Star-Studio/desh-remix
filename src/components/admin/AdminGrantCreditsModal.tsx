import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Search, Coins } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AdminUser[];
  onSuccess: () => void;
}

export default function AdminGrantCreditsModal({ open, onOpenChange, users, onSuccess }: Props) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = search.length >= 2
    ? users.filter(u =>
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.display_name?.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleGrant = async () => {
    if (!selectedUser || !amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("admin_grant_credits", {
        _target_user_id: selectedUser.id,
        _amount: parseFloat(amount),
        _reason: reason || "Créditos adicionados pelo admin",
      } as any);
      if (error) throw error;
      toast({ title: "Créditos adicionados", description: `${amount} créditos para ${selectedUser.display_name || selectedUser.email}` });
      onSuccess();
      onOpenChange(false);
      setSelectedUser(null);
      setAmount("");
      setReason("");
      setSearch("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" /> Adicionar Créditos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* User search */}
          <div className="space-y-2">
            <Label className="text-xs">Usuário</Label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedUser.display_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setSearch(""); }}>Trocar</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email ou nome..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {filtered.length > 0 && (
                  <div className="border border-border rounded-xl max-h-48 overflow-y-auto divide-y divide-border/30">
                    {filtered.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedUser(u); setSearch(""); }}
                        className="w-full text-left px-3 py-2 hover:bg-foreground/5 transition-colors"
                      >
                        <p className="text-xs font-medium text-foreground">{u.display_name || "Sem nome"}</p>
                        <p className="text-[10px] text-muted-foreground">{u.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-xs">Quantidade de créditos</Label>
            <Input
              type="number"
              min="1"
              step="any"
              placeholder="Ex: 100"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Input
              placeholder="Ex: Compensação por erro, bônus..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <Button
            onClick={handleGrant}
            disabled={!selectedUser || !amount || parseFloat(amount) <= 0 || loading}
            className="w-full gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
            Adicionar {amount || "0"} créditos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
