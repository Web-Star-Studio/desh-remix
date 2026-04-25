import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import DeshTooltip from "@/components/ui/DeshTooltip";
import type { Friend } from "@/types/auth";
import {
  Users, Search, UserPlus, Copy, Check, Mail, Hash, X,
  AlertTriangle, Sparkles,
} from "lucide-react";
import { stagger, fadeUp } from "./animations";

interface FriendsTabProps {
  friends: Friend[];
  myFriendCode: string;
  findByCode: (code: string) => Promise<any>;
  findByEmail: (email: string) => Promise<any>;
  sendRequest: (userId: string) => void;
  removeFriend: (userId: string) => void;
}

export default function FriendsTab({
  friends, myFriendCode, findByCode, findByEmail, sendRequest, removeFriend,
}: FriendsTabProps) {
  const [searchMode, setSearchMode] = useState<"code" | "email">("code");
  const [searchValue, setSearchValue] = useState("");
  const [searchResult, setSearchResult] = useState<{ user_id: string; display_name: string; avatar_url: string; email?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    setSearching(true); setSearchResult(null);
    const result = searchMode === "code"
      ? await findByCode(searchValue.trim())
      : await findByEmail(searchValue.trim());
    if (result) setSearchResult(result);
    else toast.error(searchMode === "code" ? "Código não encontrado" : "Email não encontrado");
    setSearching(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myFriendCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveFriend = (userId: string) => {
    if (confirmRemove === userId) {
      removeFriend(userId);
      setConfirmRemove(null);
    } else {
      setConfirmRemove(userId);
      setTimeout(() => setConfirmRemove(null), 3000);
    }
  };

  const filteredFriends = useMemo(() => {
    if (!friendSearch.trim()) return friends;
    const q = friendSearch.toLowerCase();
    return friends.filter(f =>
      (f.display_name || "").toLowerCase().includes(q) ||
      (f.email || "").toLowerCase().includes(q)
    );
  }, [friends, friendSearch]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My friend code */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Hash className="w-3.5 h-3.5 text-primary" />
            </div>
            Meu Código de Amigo
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-foreground/5 rounded-xl px-4 py-3.5 text-lg font-mono font-bold text-foreground tracking-[0.25em] text-center border border-foreground/5">
              {myFriendCode || "..."}
            </div>
            <DeshTooltip label={copied ? "Copiado!" : "Copiar código"}>
              <button onClick={handleCopyCode} className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all active:scale-95">
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </DeshTooltip>
          </div>
          <p className="text-xs text-muted-foreground mt-2.5">Compartilhe este código para seus amigos te adicionarem</p>
        </motion.div>

        {/* Search for friends */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-3.5 h-3.5 text-primary" />
            </div>
            Adicionar Amigo
          </h3>
          <div className="flex gap-2 mb-3">
            <button onClick={() => { setSearchMode("code"); setSearchResult(null); setSearchValue(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchMode === "code" ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent hover:bg-foreground/10"}`}>
              <Hash className="w-3 h-3 inline mr-1" />Código
            </button>
            <button onClick={() => { setSearchMode("email"); setSearchResult(null); setSearchValue(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchMode === "email" ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent hover:bg-foreground/10"}`}>
              <Mail className="w-3 h-3 inline mr-1" />Email
            </button>
          </div>
          <div className="flex gap-2">
            <input value={searchValue} onChange={e => setSearchValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={searchMode === "code" ? "Digite o código do amigo" : "Digite o email"}
              className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow" />
            <button onClick={handleSearch} disabled={searching}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95">
              {searching ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {searchResult && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 p-3 rounded-xl bg-foreground/5 border border-border/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                {searchResult.avatar_url ? <img src={searchResult.avatar_url} loading="lazy" className="w-10 h-10 rounded-full object-cover" alt="" /> : "👤"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{searchResult.display_name || searchResult.email || "Usuário"}</p>
                {searchResult.email && searchResult.display_name && <p className="text-[10px] text-muted-foreground truncate">{searchResult.email}</p>}
              </div>
              <button onClick={() => { sendRequest(searchResult.user_id); setSearchResult(null); setSearchValue(""); }}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all active:scale-95">
                <UserPlus className="w-3 h-3 inline mr-1" />Adicionar
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Friends list */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-primary" />
            </div>
            Amigos
            <span className="text-xs text-muted-foreground font-normal">({friends.length})</span>
          </h3>
          {friends.length > 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-foreground/5 border border-foreground/10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-40 transition-shadow"
              />
            </div>
          )}
        </div>
        {friends.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Nenhum amigo ainda</p>
            <p className="text-xs text-muted-foreground/60">Use o código ou email acima para convidar!</p>
          </div>
        ) : filteredFriends.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum amigo encontrado para "{friendSearch}"</p>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-1.5">
            {filteredFriends.map(f => (
              <motion.div key={f.user_id} variants={fadeUp}
                className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.02] hover:bg-foreground/[0.05] border border-transparent hover:border-border/20 transition-all group">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0 ring-2 ring-background">
                  {f.avatar_url ? <img src={f.avatar_url} loading="lazy" className="w-10 h-10 rounded-full object-cover" alt="" /> : "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.display_name || f.email || "Usuário"}</p>
                  {f.email && f.display_name && f.email !== f.display_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{f.email}</p>
                  )}
                </div>
                <DeshTooltip label={confirmRemove === f.user_id ? "Clique de novo para confirmar" : "Remover amigo"}>
                  <button onClick={() => handleRemoveFriend(f.user_id)}
                    className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                      confirmRemove === f.user_id
                        ? "text-destructive bg-destructive/10 !opacity-100"
                        : "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                    }`}>
                    {confirmRemove === f.user_id ? <AlertTriangle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                </DeshTooltip>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
