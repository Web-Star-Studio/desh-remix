# Zernio Client

Typed, browser-safe façade over the Zernio REST API.

## Why no `zernio-node` package?

1. **Not on npm** — `npm view zernio-node` returns 404. Only the GitHub repo exists.
2. **Server-only by design** — even if it were published, a Node SDK cannot run
   in the browser without leaking `ZERNIO_API_KEY` and would hit CORS errors.
3. **We already have the right architecture**:

```text
Browser (React)
   └─ zernioClient (this folder)
        └─ supabase.functions.invoke("late-proxy")
             └─ HTTPS → https://zernio.com/api/v1
                       Authorization: Bearer ZERNIO_API_KEY (edge-only secret)
```

The API key never leaves the edge function. Credit metering, workspace
isolation, and account-ownership checks all happen in `late-proxy`.

## Usage

```ts
import { zernioClient, ZernioApiError } from "@/services/zernio/client";

// Free-text WhatsApp message (24h window)
await zernioClient.whatsapp.sendText({
  accountId: "wa_acc_xxx",
  to: "+5511999999999",
  text: "Olá!",
  workspaceId: activeWorkspaceId,
});

// Pre-approved template (works outside the 24h window)
await zernioClient.whatsapp.sendTemplate({
  accountId: "wa_acc_xxx",
  to: "+5511999999999",
  templateName: "appointment_reminder",
  language: "pt_BR",
  variables: ["João", "14h"],
  workspaceId: activeWorkspaceId,
});
```

For TanStack-Query mutations with toast feedback and DB logging, prefer the
ready-made hook:

```ts
import { useSendWhatsAppMessage } from "@/hooks/whatsapp/useSendWhatsAppMessage";

const { mutate, isPending } = useSendWhatsAppMessage();
mutate({ kind: "text", accountId, to, text, contactId });
```

## Error handling

All failures throw a `ZernioApiError` carrying:

| Field       | Meaning                                                       |
| ----------- | ------------------------------------------------------------- |
| `code`      | Stable machine-readable code (`rate_limited`, `timeout`, ...) |
| `status`    | Upstream HTTP status (when applicable)                        |
| `retryable` | Whether the call may succeed on retry                         |
| `details`   | Raw upstream payload for debugging                            |

The client itself **already retries** transient failures (`rate_limited`,
`upstream_unavailable`, `timeout`, `network_error`) with exponential backoff
+ jitter. GETs retry up to 3 times, mutations only once and only for codes
where the upstream definitely did not accept the request — preventing
duplicate sends.

`402 insufficient_credits` is intentionally surfaced as-is so the global
`CreditErrorGate` can open the upgrade modal.

## Security model

- `ZERNIO_API_KEY` is configured as a Supabase edge-function secret, never
  shipped to the browser.
- Every call is scoped by the authenticated `user_id` and (optionally)
  `workspace_id`. The proxy verifies the JWT and rejects requests for
  `accountId`s the user does not own (403).
- Credit-metered routes (`wa_message_send`, `wa_broadcast_send`,
  `wa_contact_import`, ...) deduct credits **before** forwarding to Zernio.

## Files

| File                      | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `client.ts`               | Typed client + `ZernioApiError` + retry logic    |
| `types.ts`                | Shared input/output contracts                    |
| `examples.ts`             | Ready-to-use payload/response fixtures (typed)   |
| `../../hooks/whatsapp/useSendWhatsAppMessage.ts` | Mutation hook with toasts + logging |
| `../../../supabase/functions/late-proxy/index.ts` | Edge-side gateway + credit metering |

## Typed Examples

Pronto-para-uso: payloads e respostas tipadas para cada operação. Todos vivem
em [`./examples.ts`](./examples.ts) e usam os tipos reais de `./types.ts` —
qualquer drift quebra o build.

```ts
import {
  sendTextPayload,
  sendTemplatePayload,
  sendMediaImagePayload,
  sendResultSuccess,
  templateApprovedExample,
  templateListExample,
  contactExample,
  contactImportPayload,
  contactImportResultExample,
  createBroadcastByTagsPayload,
  broadcastSentExample,
  errorExamples,
} from "@/services/zernio/examples";
```

| Operação                  | Payload (request)                  | Resposta (response)                                |
| ------------------------- | ---------------------------------- | -------------------------------------------------- |
| Enviar texto              | `sendTextPayload`                  | `sendResultSuccess`                                |
| Enviar template           | `sendTemplatePayload`              | `sendResultSuccess`                                |
| Enviar mídia (imagem)     | `sendMediaImagePayload`            | `sendResultSuccess`                                |
| Enviar mídia (documento)  | `sendMediaDocumentPayload`         | `sendResultSuccess`                                |
| Webhook inbound           | —                                  | `inboundMessageExample`                            |
| Mensagem outbound salva   | —                                  | `outboundTemplateMessageExample`                   |
| Listar templates          | —                                  | `templateListExample`                              |
| Importar contatos         | `contactImportPayload`             | `contactImportResultExample`                       |
| Criar broadcast (tags)    | `createBroadcastByTagsPayload`     | `broadcastDraftExample`                            |
| Criar broadcast (ids)     | `createBroadcastByContactsPayload` | `broadcastDraftExample`                            |
| Disparar broadcast        | `sendBroadcastPayload`             | `broadcastSendingExample` → `broadcastSentExample` |
| Erros                     | —                                  | `errorExamples[code]` (cobre todos `ZernioErrorCode`) |

**Convenções**: telefones em E.164 (`+55…`), `templateName` + `language`
obrigatórios fora da janela de 24h, `workspaceId` opcional mas recomendado
para isolamento e medição de créditos.
