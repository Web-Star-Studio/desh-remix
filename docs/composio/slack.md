# Slack — Composio Actions Reference

## Toolkit: `slack` (managed app ✓)

### Actions mapeadas

| Route | Action | Descrição |
|-------|--------|-----------|
| `POST /send` | `SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL` | Enviar mensagem a um canal |
| `GET /conversations` | `SLACK_LIST_CONVERSATIONS` | Listar canais |
| `GET /members` | `SLACK_LIST_MEMBERS` | Listar membros |
| `GET /history` | `SLACK_GET_CHANNEL_HISTORY` | Histórico do canal |

### Hook: `useComposioSlack`
- `listChannels()` — lista canais
- `getChannelHistory(channelId)` — mensagens de um canal
- `sendMessage(channel, text)` — enviar mensagem para canal específico
- `listMembers()` — listar membros
