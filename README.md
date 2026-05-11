# AgentOps — Painel de Conversas IA + WhatsApp

Painel operacional para monitorar, em tempo real, um agente de IA que atende no WhatsApp via Evolution API + n8n. Visualize conversas, métricas, intents, sentimento e identifique automaticamente os atendimentos que precisam de um humano.

> Estilo SaaS moderno (Linear / Vercel / Notion). Tema dark por padrão com toggle. Realtime ponta-a-ponta. Sem mock — tudo conectado ao banco real.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | TanStack Start (React 19 + Vite 7 + SSR/Edge) |
| Linguagem | TypeScript estrito |
| Estilo | Tailwind CSS v4 + design tokens em `oklch` |
| UI | shadcn/ui + Radix + lucide-react |
| Gráficos | Recharts |
| Estado servidor | TanStack Query |
| Backend | Lovable Cloud (Postgres + Auth + Realtime) |
| Validação | Zod |
| Deploy | Lovable (Cloudflare Workers / Edge) |

---

## Arquitetura

```
src/
├─ routes/
│  ├─ __root.tsx              # shell HTML + providers (Theme, Auth, Query, Toast)
│  ├─ index.tsx               # redireciona para /dashboard
│  ├─ login.tsx | signup.tsx  # autenticação
│  ├─ _authenticated.tsx      # layout protegido (sidebar + header)
│  ├─ _authenticated/
│  │  ├─ dashboard.tsx        # métricas + gráficos
│  │  ├─ conversations.tsx    # lista + filtros (layout com Outlet)
│  │  ├─ conversations.$id.tsx# chat estilo WhatsApp
│  │  └─ integration.tsx      # docs do webhook n8n
│  └─ api/public/n8n.ts       # webhook seguro para o n8n
├─ components/
│  ├─ app-sidebar.tsx
│  ├─ theme-toggle.tsx
│  └─ ui/                     # shadcn primitives
├─ hooks/
│  ├─ use-auth.tsx            # contexto de sessão Supabase
│  └─ use-theme.tsx           # dark/light persistido
├─ lib/format.ts              # helpers (telefone, iniciais, status)
├─ integrations/supabase/     # cliente browser, admin (server) e tipos gerados
└─ styles.css                 # design system (oklch)
```

### Decisões

- **TanStack Start** em vez de Next.js: SSR moderno, edge-ready, file-based routing tipado.
- **Layout protegido** via `_authenticated.tsx`: redireciona para `/login` quando não há sessão.
- **Lista + detalhe na mesma rota** (`conversations.tsx` + `conversations.$id.tsx`): UX igual ao WhatsApp, sem duplicar fetch.
- **Triggers no banco** para manter agregados (`message_count`, `last_message`, `metrics_daily`) consistentes mesmo se vier de qualquer fonte.
- **Realtime do Lovable Cloud** no dashboard, na lista e no chat aberto — sem polling.
- **Webhook público com `X-Webhook-Secret`** (não anon key) para isolar o n8n da camada de autenticação do app.

---

## Banco de dados

```text
conversations  ── 1:N ──  messages
metrics_daily  (agregados diários, atualizados por trigger)
```

| Tabela | Campos principais |
|--------|-------------------|
| `conversations` | `contact_name`, `phone`, `status`, `intent`, `sentiment`, `needs_human`, `fallback_count`, `last_message`, `last_message_at`, `message_count` |
| `messages` | `conversation_id`, `sender` (user/ai/human), `content`, `message_type`, `is_fallback`, `metadata` |
| `metrics_daily` | `day`, `total_messages`, `total_conversations` |

RLS ativada em todas as tabelas; somente usuários autenticados leem/escrevem pelo painel. O webhook usa service role e ignora RLS.

---

## Como rodar localmente

```bash
bun install
bun run dev
```

A integração com Lovable Cloud (Supabase) já está configurada via variáveis de ambiente injetadas pelo Lovable. Para rodar fora do Lovable, defina:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
N8N_WEBHOOK_SECRET=...
```

---

## Como conectar o n8n

No fluxo do n8n, depois de processar a mensagem com o Gemini, adicione um node **HTTP Request**:

- **Method**: `POST`
- **URL**: `https://SEU-DOMINIO/api/public/n8n`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Webhook-Secret: <valor de N8N_WEBHOOK_SECRET>`
- **Body**:

```json
{
  "phone": "5511988887777",
  "contact_name": "Maria Silva",
  "sender": "user",
  "content": "Olá, queria um orçamento",
  "message_type": "text",
  "intent": "orçamento",
  "sentiment": "neutral",
  "needs_human": false,
  "is_fallback": false,
  "status": "in_progress"
}
```

Envie um POST por mensagem (do cliente E do agente). O endpoint:

1. Procura a conversa pelo telefone (cria se não existir).
2. Atualiza `intent`, `sentiment`, `needs_human`, `status` se vierem.
3. Insere a mensagem; triggers atualizam contadores e `metrics_daily`.
4. O painel reflete tudo em tempo real.

A página **Integração n8n** dentro do app mostra a URL e o exemplo prontos para copiar.

---

## Deploy

Clique em **Publish** no Lovable. As tabelas, triggers, RLS e o secret `N8N_WEBHOOK_SECRET` já estão provisionados no Cloud. A URL pública do webhook fica `https://<projeto>.lovable.app/api/public/n8n`.

---

## Melhorias futuras

- [ ] Resposta manual do operador a partir do chat (envia de volta pro n8n)
- [ ] Filtros avançados por intent, sentimento e período custom
- [ ] Exportação CSV das conversas
- [ ] Roles (admin / operador) com `user_roles`
- [ ] Notificações push quando `needs_human` virar `true`

---

## Vibe Coding Journal

Este projeto foi construído com auxílio do Lovable AI (vibe coding).

**Prompts principais**
- "Painel de monitoramento de conversas IA + WhatsApp via Evolution + n8n, real, sem mock, estilo SaaS moderno"
- Iterações pedindo realtime, tema dark estilo Linear, e endpoint público seguro

**Como a IA ajudou**
- Schema completo (enums, triggers de agregados, RLS, realtime publication) em uma migration
- Design system em `oklch` com tokens semânticos
- Layout responsivo lista/detalhe estilo WhatsApp
- Validação Zod no webhook + verificação de secret

**Dificuldades / decisões manuais**
- O template é TanStack Start, não Next.js — adaptei a stack mantendo o mesmo escopo
- RLS "true para autenticados" foi escolha consciente (painel multi-operador). Em produção com múltiplos clientes finais, trocar para policies por `tenant_id`
- `ScrollArea` da shadcn não expõe ref do viewport; troquei por `<div overflow-y-auto>` para auto-scroll do chat

**Correções manuais**
- Ajuste do auto-scroll do chat com `useRef` no container
- Timezone das métricas diárias mantida como `UTC` via `CURRENT_DATE` no Postgres
