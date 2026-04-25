# Plano de Integração SerpAPI — Engines Especializados

## Visão Geral

Expandir o módulo de busca do Desh com 6 engines especializados do SerpAPI, cada um com UI diferenciada e resultados inteligentes organizados.

---

## 🏗️ Arquitetura

### Backend (Edge Function `serp-search`)
- Já suporta roteamento por `engine` — expandir `normalizeResponse()` com handlers específicos
- Cada engine terá seu próprio bloco de normalização
- Parâmetros específicos por engine enviados no body da requisição

### Frontend
- Hook `useSerpSearch` já genérico — aceita qualquer engine
- Cada engine terá:
  - **Componente de resultados dedicado** (`SerpFinanceCard`, `SerpFlightsCard`, etc.)
  - **Formulário de parâmetros específico** (datas, destinos, ticker, etc.)
  - **Tab/filtro na SearchPage** ou widget standalone

### Créditos
| Engine | Ação | Custo |
|--------|------|-------|
| Google Finance | `serp_finance` | 3 créditos |
| Google Flights | `serp_flights` | 5 créditos |
| Google Hotels | `serp_hotels` | 5 créditos |
| Google Shopping | `serp_shopping` | 3 créditos (já existe) |
| Google Jobs | `serp_jobs` | 3 créditos |
| Google Events | `serp_events` | 3 créditos |
| Google Scholar | `serp_scholar` | 3 créditos |

---

## 📊 1. Google Finance (`google_finance`)

### Parâmetros
- `q`: Ticker do ativo (ex: `PETR4:BVMF`, `TSLA:NASDAQ`, `BTC-USD`)
- `window`: Período do gráfico (`1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, `5Y`, `MAX`)

### Dados retornados
- `summary`: Preço atual, variação, market cap, P/E, volume
- `graph`: Dados de preço para gráfico (timestamp + price)
- `financials`: Receita, lucro, balanço (quarters)
- `news`: Notícias relacionadas ao ativo
- `markets`: Índices (quando busca geral)

### UI: `SerpFinanceCard`
- **Header**: Logo + nome da empresa + ticker + preço atual com variação colorida (verde/vermelho)
- **Gráfico interativo**: Recharts AreaChart com dados do `graph`, seletor de período
- **Grid de métricas**: Market Cap, P/E, Volume, 52w High/Low em cards compactos
- **Notícias relacionadas**: Lista horizontal scrollável
- **Ação rápida**: Botão "Adicionar ao portfólio" (integra com Finance module)

### Trigger
- Detecção automática de tickers no query (regex: `[A-Z]{3,5}:[A-Z]+` ou prefixos como `$TSLA`)
- Tab "Finanças" na SearchPage com input de ticker

---

## ✈️ 2. Google Flights (`google_flights`)

### Parâmetros
- `departure_id`: Código aeroporto origem (ex: `GRU`, `GIG`)
- `arrival_id`: Código destino (ex: `JFK`, `LIS`)
- `outbound_date`: Data ida (YYYY-MM-DD)
- `return_date`: Data volta (opcional)
- `type`: `1` (ida e volta), `2` (só ida), `3` (multi-city)
- `travel_class`: `1` (econômica), `2` (premium), `3` (executiva), `4` (primeira)
- `adults`, `children`, `infants_in_seat`
- `currency`: `BRL`
- `stops`: `0` (direto), `1` (1 parada), `2` (2+)

### Dados retornados
- `best_flights`: Voos recomendados com preço, duração, escalas
- `other_flights`: Alternativas
- `price_insights`: Preço típico, se está barato/caro
- `airports`: Info dos aeroportos

### UI: `SerpFlightsCard`
- **Formulário inline**: Origem → Destino, Datas, Classe, Passageiros
- **Price Insight Banner**: "Preço está BAIXO comparado ao usual" (badge verde/amarelo/vermelho)
- **Cards de voo**: Companhia (logo) + horários + duração + escalas + preço
  - Layout horizontal: `[Logo] GRU 08:30 ──── 2h30 ──── GIG 11:00 | R$ 450`
  - Expansível para detalhes de escalas
- **Gráfico de preço**: Variação de preço nos próximos dias (se disponível)
- **Ação**: "Ver no Google Flights" link direto

---

## 🏨 3. Google Hotels (`google_hotels`)

### Parâmetros
- `q`: Destino (ex: `Hotéis em Gramado`)
- `check_in_date`, `check_out_date`: Datas
- `adults`, `children`
- `currency`: `BRL`
- `sort_by`: `3` (menor preço), `8` (mais relevante), `13` (avaliação)
- `rating`: Filtro de estrelas mínimas
- `amenities`: `1` (piscina), `2` (wifi), `5` (spa), etc.
- `property_type`: `1` (hotel), `3` (pousada), `9` (hostel)

### Dados retornados
- `properties`: Lista de hotéis com nome, preço, avaliação, amenidades, fotos
- `brands`: Redes hoteleiras disponíveis
- `nearby_places`: Pontos de interesse próximos

### UI: `SerpHotelsCard`
- **Filtros rápidos**: Datas + Hóspedes + Estrelas + Tipo + Ordenação
- **Grid de propriedades**: Cards com foto, nome, estrelas, preço/noite, amenidades (ícones)
  - Badge "Ótimo preço" se preço abaixo da média
  - Rating com cor semântica (verde >8, amarelo >6, vermelho)
- **Mapa**: Integração com MapBox mostrando localização dos hotéis
- **Comparativo**: Tabela side-by-side dos top 3
- **Ação**: "Ver no Google Hotels" + "Salvar" (favoritos)

---

## 💼 4. Google Jobs (`google_jobs`)

### Parâmetros
- `q`: Cargo/área (ex: `Desenvolvedor React São Paulo`)
- `location`: Localização
- `ltype`: `1` (tempo integral), `2` (meio período), `3` (contrato), `4` (estágio)
- `chips`: Filtros avançados (remote, salary range)

### Dados retornados
- `jobs_results`: Lista com título, empresa, localização, descrição, data, salário
- `chips`: Filtros sugeridos

### UI: `SerpJobsCard`
- **Header com filtros**: Tipo (CLT, PJ, Estágio, Remoto) como chips
- **Lista de vagas**: 
  - Logo da empresa + Cargo + Empresa + Local + Salário
  - Tags: "Remoto", "Há 2 dias", "Fácil candidatura"
  - Descrição expandível
- **Sidebar**: Filtros de salário, tipo, data de postagem
- **Ação**: "Candidatar-se" (link externo) + "Salvar vaga" (favoritos locais)
- **Integração**: Criar tarefa "Candidatar-se a [vaga]" no task manager

---

## 🎉 5. Google Events (`google_events`)

### Parâmetros
- `q`: Tipo de evento (ex: `Shows em São Paulo`, `Tech conferences`)
- `location`: Localização
- `htichips`: Filtros de data (`date:today`, `date:tomorrow`, `date:week`, `date:month`)

### Dados retornados
- `events_results`: Lista com título, data, local, link, thumbnail, descrição
- `events_results[].venue`: Nome e endereço do local
- `events_results[].ticket_info`: Preço e link de ingressos

### UI: `SerpEventsCard`
- **Timeline visual**: Eventos organizados por data
  - Card: Thumbnail + Título + Local + Data/Hora + Preço
  - Badge de categoria (Show, Conferência, Esporte, etc.)
- **Filtros**: Hoje, Esta semana, Este mês, Personalizado
- **Mapa**: Localização dos eventos no MapBox
- **Ação**: "Adicionar ao calendário" (integra com Calendar module) + "Comprar ingresso"

---

## 🎓 6. Google Scholar (`google_scholar`)

### Parâmetros
- `q`: Termo de pesquisa acadêmica
- `as_ylo`, `as_yhi`: Filtro de ano
- `scisbd`: Ordenar por data (`1`) ou relevância (`0`)
- `as_sdt`: Tipo (artigos, patentes, jurisprudência)

### Dados retornados
- `organic_results`: Artigos com título, autores, citações, link, snippet, PDF
- `cited_by`: Número de citações
- `related_articles_link`: Link para artigos relacionados
- `profiles`: Perfis de autores

### UI: `SerpScholarCard`
- **Lista acadêmica**: 
  - Título (link para artigo) + Autores + Publicação + Ano
  - Badge de citações (cor por relevância: >100 = ouro, >10 = prata)
  - Ícone PDF quando disponível
- **Filtros**: Ano, Ordenação, Tipo
- **Métricas**: Total de resultados, publicações mais citadas
- **Ação**: "Exportar BibTeX" + "Salvar na base de conhecimento"

---

## 🔧 Implementação Técnica

### Fase 1 — Backend (Edge Function)
1. Expandir `ENGINE_CREDIT_MAP` com novos engines
2. Adicionar parâmetros específicos por engine no builder de query
3. Criar normalizers especializados para cada response format
4. Adicionar custos na tabela `CREDIT_TABLE`

### Fase 2 — Hooks e Tipos  
1. Expandir `SerpResult` interface com tipos de cada engine
2. Criar hooks especializados onde necessário (ex: `useSerpFlights` com estado de formulário)

### Fase 3 — Componentes UI
1. Criar cada componente de resultado com design diferenciado
2. Adicionar detecção inteligente de query (ex: ticker → Finance, aeroporto → Flights)
3. Integrar na SearchPage com tabs/filtros expandidos

### Fase 4 — Integrações Cruzadas
1. Finance → Módulo de Finanças (adicionar ativo ao portfólio)
2. Events → Calendário (adicionar evento)
3. Jobs → Tasks (criar tarefa de candidatura)
4. Scholar → Base de Conhecimento (salvar artigo)
5. Hotels/Flights → Notas (salvar pesquisa de viagem)

---

## 📱 Considerações Mobile/PWA
- Todos os componentes devem ser 100% responsivos
- Cards de voo e hotel em layout vertical no mobile
- Formulários de filtro em Sheet/Drawer no mobile
- Lazy loading de imagens (thumbnails de hotéis, eventos)

## 🎨 Design System
- Cada engine tem uma cor accent distinta:
  - Finance: `emerald` (verde dinheiro)
  - Flights: `sky` (azul céu)
  - Hotels: `amber` (dourado aconchego)
  - Shopping: `rose` (rosa compras)
  - Jobs: `indigo` (azul profissional)
  - Events: `violet` (roxo criativo)
  - Scholar: `slate` (cinza acadêmico)
