

## Entrega: Código TSX do UI do Dashboard DESH

Vou empacotar o **código real e atual** dos componentes que compõem o dashboard (`/dashboard`), exatamente como estão no repositório, em um único arquivo `.md` para download.

### Arquivos incluídos (na ordem de leitura)

**Página & Layout**
1. `src/pages/Index.tsx` — orquestrador da rota `/`
2. `src/components/dashboard/PageLayout.tsx` — wrapper com wallpaper + safe-area
3. `src/components/dashboard/GlassCard.tsx` — card glassmorphism com 6 sizes
4. `src/components/dashboard/AnimatedItem.tsx` — wrapper de animação stagger

**Header**
5. `src/components/dashboard/GreetingHeader.tsx` — saudação + briefing matinal
6. `src/components/dashboard/HeaderActions.tsx` — workspace, créditos, notifs, perfil
7. `src/components/dashboard/GlobalSearchBar.tsx` — busca Ctrl+K com dropdown agrupado

**Navegação**
8. `src/components/dashboard/SideNav.tsx` — sidebar desktop + bottom nav mobile

**Widgets (grid)**
9. `src/components/dashboard/WidgetGrid.tsx` — grid responsivo + drag-to-reorder
10. `src/components/dashboard/DashboardSkeleton.tsx` — skeleton shimmer
11. `src/components/dashboard/WidgetErrorBoundary.tsx` — error boundary por widget
12. `src/components/dashboard/WidgetTitle.tsx` — título de widget com expand

**Tokens visuais**
13. Recorte de `src/index.css` com as classes essenciais: `:root` tokens, `.glass-card`, `.glass-card-interactive`, `.widget-title`, `.text-overlay*`, `.safe-area-*`, `.mobile-scroll`, animação `shimmer`

### Formato

- Cada arquivo em bloco ` ```tsx ` (ou ` ```css `) com cabeçalho indicando o caminho
- Código **literal do repositório**, sem trechos resumidos nem `// ...`
- Índice no topo com links âncora
- Nota final listando dependências externas que cada arquivo usa (contexts, hooks) para você saber o que precisa stub-ar/portar se for replicar fora do DESH

### Saída

Arquivo único pronto pra download:
`/mnt/documents/desh-dashboard-ui-source.md`

### Fora do escopo

- Não vou incluir os widgets internos (CalendarWidget, TasksWidget, etc.) — são 9 componentes pesados com lógica de domínio. Se quiser depois, peço separadamente.
- Não vou incluir banners (`BroadcastBanner`, `DemoBanner`, etc.) por serem secundários ao "UI do dashboard" — posso adicionar se quiser.
- Não vou alterar nenhum arquivo do projeto. Apenas geração do `.md` para download.

