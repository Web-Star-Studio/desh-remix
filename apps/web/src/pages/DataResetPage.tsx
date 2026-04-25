import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Mail, StickyNote, CheckSquare, Users, DollarSign, FolderOpen, Brain, Share2, AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface ResetModule {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  confirmText: string;
  color: string;
}

const MODULES: ResetModule[] = [
  { id: "whatsapp", label: "WhatsApp", description: "Conversas, mensagens, sessões e configurações de IA", icon: <MessageSquare className="h-5 w-5" />, confirmText: "WHATSAPP", color: "text-green-500" },
  { id: "email_cache", label: "E-mail (Cache)", description: "Cache de e-mails, snoozes e sessões de limpeza", icon: <Mail className="h-5 w-5" />, confirmText: "EMAIL_CACHE", color: "text-blue-500" },
  { id: "notes", label: "Notas", description: "Todas as notas salvas", icon: <StickyNote className="h-5 w-5" />, confirmText: "NOTES", color: "text-yellow-500" },
  { id: "tasks", label: "Tarefas", description: "Todas as tarefas e seus status", icon: <CheckSquare className="h-5 w-5" />, confirmText: "TASKS", color: "text-purple-500" },
  { id: "contacts", label: "Contatos", description: "Contatos e histórico de interações", icon: <Users className="h-5 w-5" />, confirmText: "CONTACTS", color: "text-pink-500" },
  { id: "finances", label: "Finanças", description: "Transações, metas, orçamentos e recorrências", icon: <DollarSign className="h-5 w-5" />, confirmText: "FINANCES", color: "text-emerald-500" },
  { id: "files", label: "Arquivos", description: "Todos os arquivos, pastas e links de compartilhamento", icon: <FolderOpen className="h-5 w-5" />, confirmText: "FILES", color: "text-orange-500" },
  { id: "ai", label: "Pandora (IA)", description: "Conversas, memórias e base de conhecimento", icon: <Brain className="h-5 w-5" />, confirmText: "AI", color: "text-violet-500" },
  { id: "social", label: "Redes Sociais", description: "Contas sociais conectadas via Late/Zernio", icon: <Share2 className="h-5 w-5" />, confirmText: "SOCIAL", color: "text-cyan-500" },
];

export default function DataResetPage() {
  const [selectedModule, setSelectedModule] = useState<ResetModule | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!selectedModule || confirmInput !== selectedModule.confirmText) return;

    setIsResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/data-reset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            module: selectedModule.id,
            confirmation: selectedModule.confirmText,
          }),
        }
      );

      const result = await resp.json();

      if (!resp.ok) {
        throw new Error(result.error || "Erro ao resetar dados");
      }

      toast({
        title: "Dados removidos com sucesso",
        description: `${result.records_deleted} registros do módulo ${selectedModule.label} foram excluídos.`,
      });

      setSelectedModule(null);
      setConfirmInput("");
    } catch (err: any) {
      toast({
        title: "Erro ao resetar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resetar Dados por Módulo</h1>
        <p className="text-muted-foreground mt-1">
          Exclua permanentemente os dados de um módulo específico. Esta ação não pode ser desfeita.
        </p>
      </div>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm text-destructive">
            <strong>Atenção:</strong> A exclusão é permanente e irreversível. Todos os dados do módulo selecionado serão removidos do sistema. Certifique-se de fazer backup antes de prosseguir.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <Card
            key={mod.id}
            className="cursor-pointer hover:border-destructive/50 transition-colors group"
            onClick={() => { setSelectedModule(mod); setConfirmInput(""); }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className={mod.color}>{mod.icon}</span>
                <CardTitle className="text-base">{mod.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">{mod.description}</CardDescription>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-destructive hover:text-destructive hover:bg-destructive/10 w-full gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Resetar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedModule} onOpenChange={(open) => { if (!open) { setSelectedModule(null); setConfirmInput(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar exclusão: {selectedModule?.label}
            </DialogTitle>
            <DialogDescription>
              Todos os dados de <strong>{selectedModule?.label}</strong> serão permanentemente excluídos.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Para confirmar, digite <strong className="text-foreground">{selectedModule?.confirmText}</strong> no campo abaixo:
            </p>
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={`Digite ${selectedModule?.confirmText} para confirmar`}
              className="font-mono"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedModule(null); setConfirmInput(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmInput !== selectedModule?.confirmText || isResetting}
              onClick={handleReset}
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Excluindo…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir permanentemente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
