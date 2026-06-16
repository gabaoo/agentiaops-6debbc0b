import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, UserCog, AlertTriangle, CheckCircle2 } from "lucide-react";

const URL = "https://agentiaops.lovable.app/blog/routing-whatsapp-ai-to-human";
const TITLE = "Como rotear conversas de agentes de IA no WhatsApp para humanos";
const DESCRIPTION =
  "Guia prático para monitorar interações de agentes de IA no WhatsApp e transferir a conversa para um atendente humano no momento certo, usando o sinal needs_human do AgentOps.";
const PUBLISHED = "2026-06-16";

export const Route = createFileRoute("/blog/routing-whatsapp-ai-to-human")({
  component: Article,
  head: () => ({
    meta: [
      { title: `${TITLE} — AgentOps` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "article:published_time", content: PUBLISHED },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          datePublished: PUBLISHED,
          dateModified: PUBLISHED,
          mainEntityOfPage: URL,
          author: { "@type": "Organization", name: "AgentOps" },
          publisher: { "@type": "Organization", name: "AgentOps" },
        }),
      },
    ],
  }),
});

function Article() {
  return (
    <main className="min-h-screen bg-background">
      <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para o início
        </Link>

        <header className="mt-6 space-y-3">
          <p className="text-xs uppercase tracking-wider text-primary font-medium">Guia · WhatsApp + IA</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">{TITLE}</h1>
          <p className="text-sm text-muted-foreground">
            Publicado em 16 de junho de 2026 · Leitura de 6 minutos
          </p>
        </header>

        <div className="mt-10 space-y-8 text-foreground leading-relaxed">
          <section className="space-y-3">
            <p className="text-lg text-muted-foreground">
              Agentes de IA no WhatsApp resolvem a maior parte das conversas sozinhos, mas há momentos em que o cliente
              precisa de uma pessoa. Este guia mostra como detectar esses momentos automaticamente e rotear a conversa
              para um atendente humano sem perder contexto.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Por que o roteamento humano importa</h2>
            <p>
              Confiar 100% em um agente de IA leva a fallback silencioso: o cliente repete a pergunta, perde a paciência
              e abandona. Por outro lado, encaminhar tudo para humanos elimina o ganho de automação. O equilíbrio está
              em monitorar sinais de qualidade e transferir só quando faz sentido.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Os sinais que disparam a transferência</h2>
            <ul className="space-y-3">
              <Item icon={AlertTriangle} title="Fallbacks consecutivos">
                Quando o agente responde &quot;não entendi&quot; mais de duas vezes seguidas, a confiança caiu. O AgentOps
                conta isso em <code className="text-xs bg-muted px-1.5 py-0.5 rounded">fallback_count</code> por conversa.
              </Item>
              <Item icon={Bot} title="Sentimento negativo">
                Mensagens com sentimento negativo persistente indicam frustração. Use o campo{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">sentiment</code> para escalar antes do cliente
                desistir.
              </Item>
              <Item icon={UserCog} title="Pedido explícito do cliente">
                Frases como &quot;quero falar com um atendente&quot; ou &quot;chama uma pessoa&quot; devem virar gatilho
                imediato — sem tentar uma resposta automática extra.
              </Item>
              <Item icon={CheckCircle2} title="Intenções de alto valor">
                Reembolsos, cancelamentos e fechamento de venda costumam render mais com um humano. Mapeie esses{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">intent</code> para roteamento direto.
              </Item>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Como implementar com Evolution API + n8n</h2>
            <ol className="space-y-3 list-decimal pl-5">
              <li>
                <strong>Receba a mensagem.</strong> O n8n escuta o webhook da Evolution API e envia o texto para o
                agente de IA (OpenAI, Gemini, Claude — o que preferir).
              </li>
              <li>
                <strong>Classifique a resposta.</strong> Peça ao modelo para devolver, além da resposta, três campos:
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded mx-1">intent</code>,
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded mx-1">sentiment</code> e
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded mx-1">needs_human</code> (boolean).
              </li>
              <li>
                <strong>Aplique as regras.</strong> Em um nó IF do n8n, marque
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded mx-1">needs_human = true</code> sempre que:
                fallback_count ≥ 2, sentimento for negativo, ou a intenção for &quot;reembolso&quot;, &quot;cancelamento&quot; ou
                &quot;falar_com_humano&quot;.
              </li>
              <li>
                <strong>Persista no AgentOps.</strong> Envie o payload para o webhook
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded mx-1">/api/public/n8n</code> com o
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded mx-1">evolution_instance_id</code> e os campos
                classificados. A conversa aparece em tempo real no painel marcada como &quot;Aguarda humano&quot;.
              </li>
              <li>
                <strong>Notifique o time.</strong> Quando <code className="text-xs bg-muted px-1.5 py-0.5 rounded">needs_human</code> for verdadeiro,
                dispare um aviso (Slack, e-mail, push) com o link direto para a conversa no AgentOps.
              </li>
              <li>
                <strong>Pause a IA.</strong> Enquanto o status for <code className="text-xs bg-muted px-1.5 py-0.5 rounded">waiting_human</code>
                ou <code className="text-xs bg-muted px-1.5 py-0.5 rounded">in_progress</code> com atendente conectado, o
                fluxo do n8n deve ignorar novas mensagens daquela conversa para evitar a IA responder por cima do humano.
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Como o AgentOps mostra esse fluxo</h2>
            <p>
              No painel você vê em tempo real o cartão <strong>Aguardam humano</strong> com o total de conversas na fila.
              Cada conversa expõe os badges de status, sentimento, intent e contador de fallback, dando ao atendente o
              contexto completo antes mesmo de abrir o histórico de mensagens.
            </p>
            <p>
              Quando o atendente assume, o sender da mensagem muda para <code className="text-xs bg-muted px-1.5 py-0.5 rounded">human</code> e
              o painel atualiza por Realtime — sem polling, sem F5.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Boas práticas</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Transfira sempre com um resumo da conversa, não comece do zero.</li>
              <li>Defina SLA: se ninguém atender em X minutos, escalar para o gestor.</li>
              <li>Revise semanalmente as conversas com fallback alto — sinal de treino do agente.</li>
              <li>Não use IA para responder após o humano assumir; volte o controle só com confirmação explícita.</li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-border pt-8">
            <h2 className="text-xl font-semibold tracking-tight">Resumo</h2>
            <p>
              Rotear conversas de WhatsApp do agente de IA para humanos é uma decisão baseada em sinais — não em achismo.
              Classifique cada mensagem, persista o sinal <code className="text-xs bg-muted px-1.5 py-0.5 rounded">needs_human</code>,
              notifique o time e pause a IA quando o humano entrar. O AgentOps centraliza esse fluxo no painel
              multi-instância para que você acompanhe tudo em tempo real.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

function Item({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{children}</p>
      </div>
    </li>
  );
}