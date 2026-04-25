import { lazy, Suspense } from "react";
import { ContactRow } from "@/components/contacts/ContactRow";
import ScopeRequestBanner from "@/components/dashboard/ScopeRequestBanner";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import GlassCard from "@/components/dashboard/GlassCard";
import ConnectionBadge from "@/components/dashboard/ConnectionBadge";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import {
  Search, Phone, Mail, Building2, X, Plus, Star, Trash2,
  Edit3, Tag, Sparkles, Loader2, Filter, Users, MessageSquare,
  Calendar, ChevronRight, AlertTriangle,
  Download, CheckSquare, Square, Lightbulb, BarChart3,
  ArrowRightLeft, Trophy, TrendingDown, TrendingUp, ChevronDown, MoreHorizontal,
  Globe, MapPin, MessageCircle, Eye, Copy, Smartphone, Clock,
} from "lucide-react";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";
import GoogleSyncBadge from "@/components/dashboard/GoogleSyncBadge";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Sparkline } from "@/components/dashboard/ContactSparkline";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Lazy-load heavy conditional panels
// ContactDetailPanel is now rendered inside ContactRow
const ContactAddForm = lazy(() => import("@/components/contacts/ContactAddForm"));
const ContactImportPreview = lazy(() => import("@/components/contacts/ContactImportPreview"));
const ContactExportModal = lazy(() => import("@/components/dashboard/ContactExportModal"));
const CRMHealthPanel = lazy(() => import("@/components/dashboard/CRMHealthPanel"));

import {
  useContactsPageState,
  computeCompleteness, getCompletenessLabel, highlightMatch,
  getInitials, getAvatarPalette, interactionTypes,
} from "@/hooks/contacts/useContactsPageState";
import { getScoreLabel } from "@/lib/contactScoring";

const ContactsPage = () => {
  const s = useContactsPageState();

  return (
    <PageLayout maxWidth="full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <PageHeader
        title="Contatos"
        icon={<Users className="w-5 h-5 text-primary" />}
        subtitle={<span className="text-xs text-white/60">{s.filtered.length} contatos</span>}
        actions={
          <div className="flex items-center gap-2">
            <ConnectionBadge isConnected={s.isConnected} isLoading={s.isLoading} sourceNames={s.googleContactsConnected ? s.googleContactsNames : undefined} size="lg" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 bg-white/10 text-white/90 px-3 py-2 rounded-xl text-xs font-medium hover:bg-white/20 transition-colors backdrop-blur-sm" aria-label="Mais ações">
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Mais</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={s.handleAiFindDuplicates} disabled={!!s.aiLoading || s.contacts.length < 2}>
                  {s.aiLoading === "duplicates" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                  Buscar duplicatas
                </DropdownMenuItem>
                {s.googleContactsConnected && (
                  <DropdownMenuItem onClick={s.handleImportGoogleContacts} disabled={s.importingGoogle || !s.googleContacts || s.googleContacts.length === 0}>
                    {s.importingGoogle ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                    Importar Google
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={s.handleExportCsv} disabled={s.filtered.length === 0}>
                  <Download className="w-4 h-4 mr-2" /> Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => s.vcardInputRef.current?.click()}>
                  <Smartphone className="w-4 h-4 mr-2" /> Importar iPhone (.vcf)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { s.setSelectMode(!s.selectMode); s.setSelectedIds(new Set()); }}>
                  <CheckSquare className="w-4 h-4 mr-2" /> {s.selectMode ? "Cancelar seleção" : "Selecionar"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button onClick={() => s.setShowAddForm(!s.showAddForm)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              {s.showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline">{s.showAddForm ? "Cancelar" : "Novo contato"}</span>
            </button>
          </div>
        }
      />

      {s.contactsNeedsScope && <ScopeRequestBanner service="people" onRequest={s.contactsRequestScope} />}

      {/* Add form */}
      <AnimatePresence>
        {s.showAddForm && (
          <AnimatedItem index={0}>
            <GlassCard className="mb-4">
              <Suspense fallback={<div className="h-20 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}><ContactAddForm onSubmit={s.handleAdd} onCancel={() => s.setShowAddForm(false)} /></Suspense>
            </GlassCard>
          </AnimatedItem>
        )}
      </AnimatePresence>

      {/* Summary Stats */}
      <AnimatedItem index={0}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {[
            { label: "Total", value: s.summaryStats.total, icon: Users, bg: "bg-orange-500/15", ring: "ring-orange-500/20", iconColor: "text-orange-400" },
            { label: "Pessoas", value: s.summaryStats.people, icon: Users, bg: "bg-sky-500/15", ring: "ring-sky-500/20", iconColor: "text-sky-400" },
            { label: "Empresas", value: s.summaryStats.companies, icon: Building2, bg: "bg-violet-500/15", ring: "ring-violet-500/20", iconColor: "text-violet-400" },
            { label: "Favoritos", value: s.summaryStats.favorites, icon: Star, bg: "bg-amber-500/15", ring: "ring-amber-500/20", iconColor: "text-amber-400" },
            { label: "Com interações", value: s.summaryStats.withInteractions, icon: MessageSquare, bg: "bg-emerald-500/15", ring: "ring-emerald-500/20", iconColor: "text-emerald-400" },
            { label: "Score médio", value: s.summaryStats.avgScore, icon: BarChart3, bg: "bg-rose-500/15", ring: "ring-rose-500/20", iconColor: "text-rose-400" },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} backdrop-blur-md ring-1 ${stat.ring} rounded-xl p-2.5 text-center`}>
              <stat.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${stat.iconColor}`} />
              <p className="text-base font-bold text-foreground tabular-nums">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </AnimatedItem>

      {/* Search + Filters + Contact List */}
      <AnimatedItem index={0}>
        <GlassCard size="auto" className="mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input ref={s.searchInputRef} type="text" placeholder="Buscar por nome, email, telefone... ( / )" value={s.searchQuery} onChange={e => { s.setSearchQuery(e.target.value); s.setContactPage(1); }}
                className="w-full bg-foreground/5 rounded-xl pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-primary/50 transition-colors" />
            </div>
            <button onClick={() => s.setShowFilters(!s.showFilters)}
              className={`p-2 rounded-xl transition-colors relative ${s.showFilters ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              aria-label="Filtros">
              <Filter className="w-4 h-4" />
              {s.activeFiltersCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-medium">{s.activeFiltersCount}</span>}
            </button>
            <div className="flex items-center gap-1">
              {(["alpha", "company", "tag"] as const).map(g => (
                <button key={g} onClick={() => s.setGroupBy(g)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs transition-colors ${s.groupBy === g ? "bg-foreground/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                  {g === "alpha" ? "A-Z" : g === "company" ? "Empresa" : "Tag"}
                </button>
              ))}
            </div>
            <select value={s.sortBy} onChange={e => { s.setSortBy(e.target.value as any); s.setContactPage(1); }}
              className="bg-foreground/5 rounded-xl px-2.5 py-2 text-xs text-foreground border border-border/30 outline-none focus:border-primary/50">
              <option value="name">Nome</option>
              <option value="score">Score</option>
              <option value="recent">Interação recente</option>
              <option value="created">Data de criação</option>
            </select>
          </div>

          <AnimatePresence>
            {s.showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30 flex-wrap">
                  <button onClick={() => s.setFilterFav(!s.filterFav)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${s.filterFav ? "bg-yellow-500/20 text-yellow-500" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>
                    <Star className="w-3 h-3" /> Favoritos
                  </button>
                  <span className="text-border">|</span>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Tipo:</span>
                  {(["all", "person", "company"] as const).map(t => (
                    <button key={t} onClick={() => { s.setFilterType(t); s.setContactPage(1); }}
                      className={`px-2.5 py-1 rounded-full text-xs transition-colors ${s.filterType === t ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground"}`}>
                      {t === "all" ? "Todos" : t === "person" ? "Pessoas" : "Empresas"}
                    </button>
                  ))}
                  {s.allCompanies.length > 0 && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Empresa:</span>
                      <button onClick={() => s.setFilterCompany("all")}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors ${s.filterCompany === "all" ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground"}`}>Todas</button>
                      {s.allCompanies.slice(0, 8).map(c => (
                        <button key={c} onClick={() => s.setFilterCompany(c)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${s.filterCompany === c ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground"}`}>{c}</button>
                      ))}
                    </>
                  )}
                  {s.allTags.length > 0 && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Tag:</span>
                      <button onClick={() => s.setFilterTag("all")}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors ${s.filterTag === "all" ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground"}`}>Todas</button>
                      {s.allTags.slice(0, 10).map(t => (
                        <button key={t} onClick={() => s.setFilterTag(t)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${s.filterTag === t ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground"}`}>{t}</button>
                      ))}
                    </>
                  )}
                  {s.activeFiltersCount > 0 && (
                    <button onClick={s.clearFilters}
                      className="px-2.5 py-1 rounded-full text-xs text-destructive hover:bg-destructive/10 transition-colors">Limpar</button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inline contact list */}
          <div className="mt-3 pt-3 border-t border-border/30 max-h-[60vh] overflow-y-auto">
            {s.grouped.map(([group, groupContacts]) => (
              <div key={group} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold text-primary mb-2 px-1">{group}</p>
                <div className="space-y-0.5">
                  {groupContacts.map(contact => {
                    const cached = s.scoreMap.get(contact.id);
                    const summary = cached?.summary ?? { count: 0, lastDate: null, typeCounts: {} };
                    const score = cached?.score ?? 0;
                    const isSelected = s.selectedId === contact.id;
                    return (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        score={score}
                        summary={summary}
                        isSelected={isSelected}
                        selectMode={s.selectMode}
                        searchQuery={s.searchQuery}
                        isChecked={s.selectedIds.has(contact.id)}
                        googleContactsConnected={s.googleContactsConnected}
                        lastInteractionType={s.lastInteractionTypeMap[contact.id]}
                        allInteractionsRaw={s.allInteractionsRaw}
                        aiFollowup={s.aiFollowup[contact.id]}
                        selectedContact={isSelected ? s.selectedContact : null}
                        interactions={s.interactions}
                        loadingInteractions={s.loadingInteractions}
                        interactionSummary={s.interactionSummaryMap[contact.id] ?? { count: 0, lastDate: null, typeCounts: {} }}
                        aiLoading={s.aiLoading}
                        aiNextAction={s.aiNextAction}
                        onSelect={(id) => { s.setSelectedId(id || null); s.setAiNextAction(null); }}
                        onToggleSelect={s.toggleSelect}
                        onToggleFavorite={s.toggleFavorite}
                        onDelete={s.deleteContact}
                        onAiEnrich={s.handleAiEnrich}
                        onAiSuggestAction={s.handleAiSuggestAction}
                        onAiSummarize={s.handleAiSummarize}
                        onSetAiNextAction={s.setAiNextAction}
                        onNavigate={s.navigate}
                        onSyncContactToGoogle={s.syncContactToGoogle}
                        onUpdateContact={s.handleUpdateContact}
                        onAddInteraction={s.addInteraction}
                        onDeleteInteraction={s.handleDeleteInteraction}
                        onExport={() => s.setShowExportModal(true)}
                        onConfirmDelete={async () => {
                          if (s.googleContactsConnected && (s.selectedContact as any)?.google_resource_name) {
                            await s.syncContactToGoogle("delete", { resourceName: (s.selectedContact as any).google_resource_name });
                          }
                          await s.deleteContact(contact.id);
                          s.setSelectedId(null);
                        }}
                        computeRelationshipScore={s.computeRelationshipScore}
                        computeScoreComponents={s.computeScoreComponents}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            {s.filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Users className="w-10 h-10 opacity-30" />
                <p className="text-sm">Nenhum contato encontrado</p>
                {s.searchQuery && <p className="text-xs opacity-60">Tente uma busca diferente</p>}
              </div>
            )}
            {/* Pagination */}
            {s.totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground">
                  {s.filtered.length} contato{s.filtered.length !== 1 ? "s" : ""} · Página {s.safeContactPage} de {s.totalPages}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => s.setContactPage(p => Math.max(1, p - 1))} disabled={s.safeContactPage <= 1}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 disabled:opacity-40 transition-colors">Anterior</button>
                  <button onClick={() => s.setContactPage(p => Math.min(s.totalPages, p + 1))} disabled={s.safeContactPage >= s.totalPages}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-foreground/5 text-foreground hover:bg-foreground/10 disabled:opacity-40 transition-colors">Próxima</button>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </AnimatedItem>

      {/* ── Upcoming Birthdays ──────────────────────────────────────────── */}
      {s.upcomingBirthdays.length > 0 && (
        <AnimatedItem index={1}>
          <GlassCard size="auto" className="mb-4">
            <button onClick={() => s.setShowBirthdays(!s.showBirthdays)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🎂</span>
                <span className="text-sm font-semibold text-foreground">Aniversários Próximos</span>
                <span className="text-xs text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">{s.upcomingBirthdays.length}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${s.showBirthdays ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {s.showBirthdays && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                    {s.upcomingBirthdays.map(({ contact, daysUntil }) => (
                      <div key={contact.id} onClick={() => s.setSelectedId(contact.id)}
                        className="flex items-center gap-3 p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 cursor-pointer transition-colors">
                        {(() => { const pal = getAvatarPalette(contact.name); return (
                        <div className={`w-8 h-8 rounded-full ${pal.bg} ${pal.text} ring-1 ${pal.ring} backdrop-blur-sm flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                          {contact.avatar_url
                            ? <img src={contact.avatar_url} className="w-8 h-8 rounded-full object-cover" alt={contact.name} referrerPolicy="no-referrer" />
                            : getInitials(contact.name)}
                        </div>
                        ); })()}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(contact.birthday + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          daysUntil === 0 ? "bg-primary/20 text-primary" : daysUntil <= 3 ? "bg-amber-500/15 text-amber-400" : "bg-foreground/5 text-muted-foreground"
                        }`}>
                          {daysUntil === 0 ? "Hoje! 🎉" : daysUntil === 1 ? "Amanhã" : `Em ${daysUntil}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </AnimatedItem>
      )}

      {/* ── Relationship Ranking Panel ──────────────────────────────────── */}
      <AnimatedItem index={1}>
        <GlassCard size="auto" className="mb-4">
          <button onClick={() => s.setShowRanking(!s.showRanking)} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Ranking de Relacionamentos</span>
              <span className="text-xs text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">
                {s.contactsWithScores.filter(x => x.score > 0).length} com dados
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${s.showRanking ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {s.showRanking && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/30">
                  {/* Top 5 */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                      <p className="text-xs font-semibold text-foreground">Top 5 — Vínculos mais fortes</p>
                    </div>
                    <div className="space-y-2">
                      {s.topContacts.length === 0 && (
                        <p className="text-xs text-muted-foreground italic py-2">Registre interações para gerar o ranking.</p>
                      )}
                      {s.topContacts.map(({ contact, score, summary }, idx) => {
                        const meta = getScoreLabel(score);
                        const medals = ["🥇", "🥈", "🥉", "4°", "5°"];
                        const daysSince = summary.lastDate
                          ? Math.floor((Date.now() - new Date(summary.lastDate).getTime()) / 86400000)
                          : null;
                        return (
                          <div key={contact.id} onClick={() => { s.setSelectedId(contact.id); s.setShowRanking(false); }}
                            className="flex items-center gap-3 p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 cursor-pointer transition-colors group">
                            <span className="text-sm w-5 text-center flex-shrink-0">{medals[idx]}</span>
                            {(() => { const pal = getAvatarPalette(contact.name); return (
                            <div className={`w-8 h-8 rounded-full ${pal.bg} ${pal.text} ring-1 ${pal.ring} backdrop-blur-sm flex items-center justify-center text-xs font-bold flex-shrink-0 relative`}>
                              {contact.avatar_url
                                ? <img src={contact.avatar_url} className="w-8 h-8 rounded-full object-cover" alt={contact.name} referrerPolicy="no-referrer" />
                                : getInitials(contact.name)}
                              <svg className="absolute inset-0 w-8 h-8 -rotate-90 pointer-events-none" viewBox="0 0 32 32">
                                <circle cx="16" cy="16" r="14" fill="none" strokeWidth="2" stroke="currentColor" className="text-foreground/10" />
                                <circle cx="16" cy="16" r="14" fill="none" strokeWidth="2"
                                  stroke={score >= 80 ? "hsl(var(--primary))" : score >= 55 ? "hsl(var(--primary))" : "hsl(38 92% 50%)"}
                                  strokeDasharray={`${(score / 100) * 87.96} 87.96`}
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                            ); })()}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{contact.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {summary.count} interação{summary.count !== 1 ? "ões" : ""}
                                {daysSince !== null && ` • ${daysSince === 0 ? "hoje" : daysSince === 1 ? "ontem" : `há ${daysSince}d`}`}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0 w-16">
                              <span className={`text-xs font-bold tabular-nums ${meta.color}`}>{score}</span>
                              <div className="w-full h-1 bg-foreground/10 rounded-full overflow-hidden">
                                <div className={`h-full ${meta.bg} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom 5 */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                      <p className="text-xs font-semibold text-foreground">5 que precisam de atenção</p>
                    </div>
                    <div className="space-y-2">
                      {s.atRiskContacts.length === 0 && (
                        <p className="text-xs text-muted-foreground italic py-2">Sem contatos em risco por agora.</p>
                      )}
                      {s.atRiskContacts.map(({ contact, score, summary }) => {
                        const meta = getScoreLabel(score);
                        const daysSince = summary.lastDate
                          ? Math.floor((Date.now() - new Date(summary.lastDate).getTime()) / 86400000)
                          : null;
                        const isUrgent = daysSince !== null && daysSince > 30;
                        return (
                          <div key={contact.id} onClick={() => { s.setSelectedId(contact.id); s.setShowRanking(false); }}
                            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors group ${
                              isUrgent ? "bg-destructive/8 hover:bg-destructive/15 border border-destructive/15" : "bg-foreground/5 hover:bg-foreground/10"
                            }`}>
                            <div className="w-5 flex-shrink-0 flex justify-center">
                              {isUrgent ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                            {(() => { const pal = getAvatarPalette(contact.name); return (
                            <div className={`w-8 h-8 rounded-full ${pal.bg} ${pal.text} ring-1 ${pal.ring} backdrop-blur-sm flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                              {contact.avatar_url
                                ? <img src={contact.avatar_url} className="w-8 h-8 rounded-full object-cover" alt={contact.name} referrerPolicy="no-referrer" />
                                : getInitials(contact.name)}
                            </div>
                            ); })()}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{contact.name}</p>
                              <p className={`text-xs ${isUrgent ? "text-destructive/70" : "text-muted-foreground"}`}>
                                {daysSince !== null ? `Último contato há ${daysSince}d` : "Sem interações"}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0 w-16">
                              <span className={`text-xs font-bold tabular-nums ${meta.color}`}>{score}</span>
                              <div className="w-full h-1 bg-foreground/10 rounded-full overflow-hidden">
                                <div className={`h-full ${meta.bg} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {s.contactsWithScores.length > 0 && (
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30 flex-wrap">
                    {[
                      { label: "Fortes (≥80)", count: s.contactsWithScores.filter(x => x.score >= 80).length, color: "text-green-400" },
                      { label: "Bons (55-79)", count: s.contactsWithScores.filter(x => x.score >= 55 && x.score < 80).length, color: "text-primary" },
                      { label: "Fracos (30-54)", count: s.contactsWithScores.filter(x => x.score >= 30 && x.score < 55).length, color: "text-amber-400" },
                      { label: "Em risco (<30)", count: s.contactsWithScores.filter(x => x.score > 0 && x.score < 30).length, color: "text-destructive" },
                      { label: "Sem dados", count: s.contactsWithScores.filter(x => x.score === 0).length, color: "text-muted-foreground" },
                    ].map(stat => (
                      <div key={stat.label} className="flex items-center gap-1">
                        <span className={`text-sm font-bold tabular-nums ${stat.color}`}>{stat.count}</span>
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </AnimatedItem>

      {/* ── CRM Health Panel ──────────────────────────────────────────── */}
      <AnimatedItem index={2}>
        <Suspense fallback={<div className="h-16" />}>
          <CRMHealthPanel
            contacts={s.contacts.map(c => ({ id: c.id, name: c.name }))}
            interactionSummaryMap={s.interactionSummaryMap}
            allInteractions={s.allInteractionsRaw}
          />
        </Suspense>
      </AnimatedItem>

      {/* Batch action bar */}
      <AnimatePresence>
        {s.selectMode && s.selectedIds.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <GlassCard size="auto" className="mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-foreground">{s.selectedIds.size} selecionado(s)</span>
                <button onClick={s.selectAll} className="text-xs text-primary hover:underline">Selecionar todos</button>
                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  <div className="flex items-center gap-1">
                    <input value={s.batchTagInput} onChange={e => s.setBatchTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") s.handleBatchAddTag(); }}
                      placeholder="Tag..." className="bg-foreground/5 rounded-lg px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none border border-border/30 w-20" />
                    <button onClick={s.handleBatchAddTag} disabled={!s.batchTagInput.trim()} className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-foreground/5 text-xs text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-50">
                      <Tag className="w-3 h-3" /> Aplicar
                    </button>
                  </div>
                  <button onClick={s.handleBatchEnrich} disabled={!!s.aiLoading} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/10 text-xs text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                    {s.aiLoading === "batch-enrich" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Enriquecer IA
                  </button>
                  <button onClick={s.handleBatchFavorite} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-foreground/5 text-xs text-foreground hover:bg-foreground/10 transition-colors">
                    <Star className="w-3.5 h-3.5" /> Favoritar
                  </button>
                  <button onClick={s.handleExportCsv} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-foreground/5 text-xs text-foreground hover:bg-foreground/10 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Exportar
                  </button>
                  <button onClick={s.handleBatchDelete} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-destructive/10 text-xs text-destructive hover:bg-destructive/20 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {s.confirmDialog}

      {/* Hidden vCard file input */}
      <input ref={s.vcardInputRef} type="file" accept=".vcf" className="hidden" onChange={s.handleVcardFileChange} />

      {/* vCard Import Preview */}
      {s.vcardContacts && (
        <Suspense fallback={null}>
          <ContactImportPreview
            contacts={s.vcardContacts}
            onConfirm={s.handleVcardImportConfirm}
            onCancel={() => s.setVcardContacts(null)}
          />
        </Suspense>
      )}

      {/* Export Modal */}
      {s.showExportModal && s.selectedContact && (() => {
        const cached = s.scoreMap.get(s.selectedContact.id);
        const summary = cached?.summary ?? { count: 0, lastDate: null, typeCounts: {} };
        const score = cached?.score ?? 0;
        return (
          <Suspense fallback={null}>
            <ContactExportModal
              contact={s.selectedContact}
              summary={summary}
              score={score}
              interactions={s.interactions}
              allInteractions={s.allInteractionsRaw}
              aiSuggestion={s.aiNextAction || s.aiFollowup[s.selectedContact.id] || null}
              onClose={() => s.setShowExportModal(false)}
            />
          </Suspense>
        );
      })()}
    </PageLayout>
  );
};

export default ContactsPage;
