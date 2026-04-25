# Notion — Composio Actions Reference

## Toolkit: `notion` (managed app ✓)

### Actions mapeadas

| Route | Action | Descrição |
|-------|--------|-----------|
| `GET /pages/search` | `NOTION_SEARCH_NOTION_PAGE` | Buscar páginas |
| `POST /pages` | `NOTION_CREATE_NOTION_PAGE` | Criar página |
| `GET /pages/{id}` | `NOTION_GET_PAGE` | Obter página |
| `GET /databases/list` | `NOTION_LIST_DATABASES` | Listar databases |
| `POST /databases/{id}/query` | `NOTION_QUERY_A_DATABASE` | Consultar database |

### Hook: `useComposioNotion`
- `searchPages(query)` — buscar páginas
- `getPage(pageId)` — obter página
- `createPage(properties)` — criar página
- `listDatabases()` — listar databases
- `queryDatabase(databaseId, filter?)` — consultar database
