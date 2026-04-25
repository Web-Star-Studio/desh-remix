# Spotify — Composio Actions Reference

## Toolkit: `spotify`
**App gerenciado**: Não — requer OAuth customizado no Composio Dashboard

## Configuração

1. Criar app em https://developer.spotify.com/dashboard
2. Configurar redirect URI do Composio
3. Adicionar `authConfigId` no Composio Dashboard

## Actions Mapeadas

| Action | Rota Proxy | Método | Descrição |
|--------|-----------|--------|-----------|
| `SPOTIFY_SEARCH_FOR_ITEM` | `/search` | GET | Buscar tracks/playlists |
| `SPOTIFY_GET_CURRENT_USERS_PLAYLISTS` | `/playlists` | GET | Listar playlists do usuário |
| `SPOTIFY_GET_PLAYLISTS_TRACKS` | `/playlists/{id}/tracks` | GET | Tracks de uma playlist |
| `SPOTIFY_GET_RECOMMENDATIONS` | `/recommendations` | GET | Recomendações baseadas em seeds |

## Parâmetros

### SPOTIFY_SEARCH_FOR_ITEM
- `q` (string) — Query de busca
- `type` (string, default: "track")
- `limit` (number, default: 10)

### SPOTIFY_GET_CURRENT_USERS_PLAYLISTS
- `limit` (number, default: 25)

### SPOTIFY_GET_PLAYLISTS_TRACKS
- `playlist_id` (string) — ID da playlist
- `limit` (number, default: 25)

### SPOTIFY_GET_RECOMMENDATIONS
- `seed_tracks` (string) — IDs de tracks separados por vírgula
- `seed_artists` (string) — IDs de artistas
- `seed_genres` (string) — Gêneros
- `limit` (number, default: 10)

## Uso no Frontend

```typescript
const { callComposioProxy } = useComposioProxy();

// Buscar músicas
const results = await callComposioProxy({
  service: "spotify",
  path: "/search",
  method: "GET",
  params: { q: "lofi beats", type: "track" },
});
```
