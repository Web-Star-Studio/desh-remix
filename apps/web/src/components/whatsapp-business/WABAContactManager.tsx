import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Users, Plus, Upload, Loader2, RefreshCw, Tag, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useZernioWhatsApp, WABAContact } from "@/hooks/whatsapp/useZernioWhatsApp";
import { toast } from "@/hooks/use-toast";

interface Props { accountId: string }

export default function WABAContactManager({ accountId }: Props) {
  const { getContacts, createContact, importContacts } = useZernioWhatsApp();
  const [contacts, setContacts] = useState<WABAContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const mountedRef = useRef(true);

  // Single contact
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState("");
  const [adding, setAdding] = useState(false);

  // Bulk import
  const [importText, setImportText] = useState("");
  const [importTags, setImportTags] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getContacts(accountId);
      if (mountedRef.current) setContacts(res.data?.contacts || []);
    } catch (e) {
      console.error("[WABAContactManager] loadContacts error:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [accountId, getContacts]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const handleAdd = useCallback(async () => {
    if (!phone) return;
    setAdding(true);
    try {
      const res = await createContact(accountId, {
        phone,
        name: name || undefined,
        email: email || undefined,
        tags: tags ? tags.split(",").map(t => t.trim()) : undefined,
      });
      if (res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Contato criado" });
        setShowAdd(false);
        setPhone(""); setName(""); setEmail(""); setTags("");
        loadContacts();
      }
    } catch (e: any) {
      toast({ title: "Erro ao criar contato", description: e?.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setAdding(false);
    }
  }, [phone, name, email, tags, accountId, createContact, loadContacts]);

  const handleImport = useCallback(async () => {
    const lines = importText.split("\n").filter(l => l.trim());
    if (lines.length === 0) return;
    const parsed = lines.map(line => {
      const [p, n, e] = line.split(",").map(s => s.trim());
      return { phone: p, name: n || undefined, email: e || undefined };
    });
    setImporting(true);
    try {
      const res = await importContacts(accountId, parsed, importTags ? importTags.split(",").map(t => t.trim()) : undefined);
      if (res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Importação concluída", description: `${res.data?.summary.created || 0} criados, ${res.data?.summary.skipped || 0} ignorados` });
        setShowImport(false);
        setImportText(""); setImportTags("");
        loadContacts();
      }
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e?.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setImporting(false);
    }
  }, [importText, importTags, accountId, importContacts, loadContacts]);

  const filtered = useMemo(() => {
    if (!search) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      c.name?.toLowerCase().includes(q) || c.phone.includes(search)
    );
  }, [contacts, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Contatos WABA
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie contatos com tags, grupos e importação em massa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={loadContacts} className="h-8 w-8"><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setShowImport(!showImport); setShowAdd(false); }} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Importar
          </Button>
          <Button size="sm" onClick={() => { setShowAdd(!showAdd); setShowImport(false); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input placeholder="+5511999999999" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="João Silva" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input placeholder="joao@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input placeholder="vip, newsletter" value={tags} onChange={e => setTags(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={adding || !phone}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Criar Contato
            </Button>
          </div>
        </div>
      )}

      {showImport && (
        <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-4">
          <div className="space-y-2">
            <Label>Contatos (um por linha: telefone, nome, email)</Label>
            <Textarea
              placeholder={"+5511999999999, João Silva, joao@email.com\n+5521888888888, Maria, maria@email.com"}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              rows={5}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">{importText.split("\n").filter(l => l.trim()).length} contatos</p>
          </div>
          <div className="space-y-2">
            <Label>Tags padrão (opcional)</Label>
            <Input placeholder="importado, campanha-2025" value={importTags} onChange={e => setImportTags(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleImport} disabled={importing || !importText.trim()}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Importar Contatos
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar contatos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {contacts.length === 0 ? "Nenhum contato ainda. Adicione ou importe acima." : "Nenhum resultado encontrado."}
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.slice(0, 50).map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
              <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-500 font-semibold text-sm">
                {(c.name?.[0] || c.phone[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name || c.phone}</p>
                <p className="text-[10px] text-muted-foreground">{c.phone} {c.email ? `· ${c.email}` : ""}</p>
              </div>
              {c.tags && c.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {c.tags.slice(0, 3).map(t => (
                    <span key={t} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      <Tag className="w-2.5 h-2.5" />{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filtered.length > 50 && <p className="text-center text-xs text-muted-foreground">Mostrando 50 de {filtered.length}</p>}
        </div>
      )}
    </div>
  );
}