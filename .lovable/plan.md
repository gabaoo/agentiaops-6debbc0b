
## Sobre "exportar para Supabase próprio"

O Lovable Cloud **é** Supabase — toda migração, RLS, Realtime e secrets que eu aplico aqui rodam contra um Postgres/Supabase Auth real. Quando você quiser migrar para um projeto Supabase fora da Lovable, basta:

1. Criar o projeto no supabase.com
2. Rodar o SQL final desta refatoração lá (vou deixar como migration única e versionada)
3. Trocar `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` nas envs

**Durante o desenvolvimento eu continuo aplicando tudo no backend atual** (porque as ferramentas de migration/secret só falam com ele). O schema fica 100% portátil — quando você quiser cortar o cordão, é só rodar o SQL no seu projeto e trocar 3 variáveis.

## Mudanças

### 1. Schema (migration única)

```text
instances
  id, user_id (auth.users), instance_name, whatsapp_number,
  evolution_instance_id, status, created_at, updated_at
  UNIQUE(user_id, evolution_instance_id)

conversations
  + instance_id (FK NOT NULL → instances)
  + UNIQUE(instance_id, phone)
  índice (instance_id, last_message_at DESC)

messages
  conversation_id já existe (ligação indireta ao tenant via conversations)

metrics_daily
  + instance_id (FK NOT NULL)
  PK lógica: UNIQUE(instance_id, day)
```

**Wipe** das tabelas atuais (`TRUNCATE conversations, messages, metrics_daily RESTART IDENTITY CASCADE`) antes de adicionar `instance_id NOT NULL`.

### 2. RLS por tenant

Helper SECURITY DEFINER:
```sql
public.user_owns_instance(_instance_id uuid) returns boolean
public.user_owns_conversation(_conversation_id uuid) returns boolean
```

Políticas (substituem as atuais `USING (true)`):
- `instances`: `user_id = auth.uid()` (todas operações)
- `conversations`: `user_owns_instance(instance_id)`
- `messages`: `user_owns_conversation(conversation_id)`
- `metrics_daily`: `user_owns_instance(instance_id)`

Triggers `handle_new_message` / `handle_new_conversation` ajustados para escrever em `metrics_daily` por `instance_id`.

### 3. Onboarding obrigatório

- Nova rota `/_authenticated/onboarding` (cadastra primeira instância)
- Gate em `_authenticated.tsx`: se `instances.count = 0` → redirect para `/onboarding`
- Formulário: `instance_name`, `whatsapp_number`, `evolution_instance_id`

### 4. Seletor de instância (sidebar)

- Hook `useCurrentInstance()` com persistência em `localStorage` (`current_instance_id`)
- Dropdown na sidebar mostrando nome + número + status de conexão
- Botão "+ Nova instância" → modal
- Todas as queries (dashboard, conversations, messages, metrics, realtime channels) filtradas por `instance_id` ativo
- Realtime channels rebindam quando troca instância

### 5. Webhook `/api/public/n8n`

Payload novo obrigatório: `evolution_instance_id` (em vez de inferir tenant pelo phone). Lookup:
```
instances.evolution_instance_id → instance_id → conversations(instance_id, phone)
```
Mantém validação `X-Webhook-Secret` e Zod schema.

### 6. UI / telas afetadas

- `dashboard.tsx`, `conversations.tsx`, `conversations.$id.tsx`, `integration.tsx`: filtram por `instance_id`
- `integration.tsx`: mostra cURL com `evolution_instance_id` da instância atual
- Sidebar: novo `InstanceSwitcher` acima do menu

### 7. Segurança

- RLS cobre todo isolamento (impossível um cliente ver dados de outro mesmo com SQL direto via anon key)
- Webhook continua com secret; valida `evolution_instance_id` existe antes de processar
- `supabaseAdmin` permanece restrito ao webhook

## Fora de escopo (avise se quiser)

- Convite de membros / orgs multi-usuário por instância (hoje: 1 user = N instâncias, sem compartilhamento)
- Conexão real com Evolution API (QR code, status live) — hoje só armazena `evolution_instance_id` para o n8n
- Billing / planos
