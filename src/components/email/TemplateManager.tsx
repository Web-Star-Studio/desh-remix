import { Star, Trash2, Edit3, Download, Upload, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { useEmailTemplates } from "@/hooks/email/useEmailTemplates";

interface TemplateManagerProps {
  hook: ReturnType<typeof useEmailTemplates>;
}

const TemplateManager = ({ hook }: TemplateManagerProps) => (
  <Dialog open={hook.showTemplateManager} onOpenChange={hook.setShowTemplateManager}>
    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Gerenciar Templates</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <input value={hook.newTemplateName} onChange={e => hook.setNewTemplateName(e.target.value)}
            placeholder="Nome do template" className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          <textarea value={hook.newTemplateBody} onChange={e => hook.setNewTemplateBody(e.target.value)}
            placeholder="Corpo do template..." rows={3} className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
          <button onClick={hook.editingTemplateId ? hook.saveEditTemplate : hook.addTemplate}
            disabled={!hook.newTemplateName.trim() || !hook.newTemplateBody.trim()}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {hook.editingTemplateId ? "Atualizar" : "Adicionar Template"}
          </button>
        </div>
        <div className="flex items-center gap-2 border-t border-foreground/5 pt-3">
          <button onClick={hook.exportTemplates} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Download className="w-3 h-3" /> Exportar</button>
          <button onClick={hook.importTemplates} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Upload className="w-3 h-3" /> Importar</button>
        </div>
        <div className="space-y-1.5">
          {hook.filteredTemplates.map(tpl => (
            <div key={tpl.id} className="flex items-start gap-2 p-2 rounded-lg bg-foreground/3 hover:bg-foreground/5 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{tpl.name}</p>
                <p className="text-xs text-muted-foreground truncate">{tpl.body}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => hook.toggleTemplateFavorite(tpl.id)} className="p-1">
                  <Star className={`w-3 h-3 ${tpl.favorited ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                </button>
                <button onClick={() => hook.startEditTemplate(tpl)} className="p-1 text-muted-foreground hover:text-foreground"><Edit3 className="w-3 h-3" /></button>
                <button onClick={() => hook.deleteTemplate(tpl.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          {hook.filteredTemplates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum template encontrado</p>
          )}
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default TemplateManager;
