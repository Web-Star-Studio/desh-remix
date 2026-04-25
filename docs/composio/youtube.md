# YouTube — Composio Actions Reference

## Toolkit: `youtube`
**App gerenciado**: Sim (zero-config)

## Actions Mapeadas

| Action | Rota Proxy | Método | Descrição |
|--------|-----------|--------|-----------|
| `YOUTUBE_SEARCH` | `/search` | GET | Buscar vídeos por query |
| `YOUTUBE_LIST_PLAYLISTS` | `/playlists` | GET | Listar playlists do usuário |
| `YOUTUBE_PLAYLIST_ITEMS` | `/playlistItems` | GET | Listar itens de uma playlist |
| `YOUTUBE_VIDEO_DETAILS` | `/videos/{id}` | GET | Detalhes de um vídeo |

## Parâmetros

### YOUTUBE_SEARCH
- `q` (string) — Query de busca
- `maxResults` (number, default: 10)
- `type` (string, default: "video")

### YOUTUBE_LIST_PLAYLISTS
- `mine` (boolean, default: true)
- `maxResults` (number, default: 25)

### YOUTUBE_PLAYLIST_ITEMS
- `playlistId` (string) — ID da playlist
- `maxResults` (number, default: 25)

### YOUTUBE_VIDEO_DETAILS
- `id` (string) — ID do vídeo

## Uso no Frontend

```typescript
const { callComposioProxy } = useComposioProxy();

// Buscar vídeos
const results = await callComposioProxy({
  service: "youtube",
  path: "/search",
  method: "GET",
  params: { q: "lofi hip hop" },
});
```
