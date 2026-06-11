import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/integration")({
  component: IntegrationPage,
  head: () => ({
    meta: [
      { title: "Integração n8n — AgentOps" },
      { name: "description", content: "Configure o webhook do n8n no AgentOps: endpoint seguro, headers obrigatórios e payload de exemplo para conectar o agente de IA do WhatsApp." },
      { property: "og:title", content: "Integração n8n — AgentOps" },
      { property: "og:description", content: "Configure o webhook do n8n no AgentOps em poucos passos." },
      { property: "og:url", content: "https://agentiaops.lovable.app/integration" },
      { name: "twitter:title", content: "Integração n8n — AgentOps" },
      { name: "twitter:description", content: "Configure o webhook do n8n no AgentOps em poucos passos." },
    ],
    links: [{ rel: "canonical", href: "https://agentiaops.lovable.app/integration" }],
  }),
});

const samplePayload = `{
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
}`;

function IntegrationPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/n8n`;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Integração com n8n</h1>
        <p className="text-sm text-muted-foreground mt-1">Envie eventos do seu fluxo do n8n para o painel.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5 text-primary" />Endpoint do webhook</CardTitle>
          <CardDescription>Configure um node HTTP Request no seu fluxo n8n.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="URL" value={webhookUrl} onCopy={() => copy(webhookUrl, "url")} copied={copied === "url"} />
          <Field label="Método" value="POST" />
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Headers obrigatórios</span>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono space-y-1">
              <div>Content-Type: application/json</div>
              <div>X-Webhook-Secret: <Badge variant="secondary" className="font-mono text-[10px]">N8N_WEBHOOK_SECRET</Badge></div>
            </div>
            <p className="text-xs text-muted-foreground">O segredo está configurado no painel; coloque o mesmo valor no header do n8n.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payload esperado</CardTitle>
          <CardDescription>Envie um POST a cada nova mensagem (do cliente ou do agente).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="rounded-md border border-border bg-muted/40 p-4 overflow-x-auto text-xs font-mono">{samplePayload}</pre>
          <Button variant="outline" size="sm" onClick={() => copy(samplePayload, "json")}>
            {copied === "json" ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copiar exemplo
          </Button>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <FieldDoc name="phone" required>Telefone do contato (somente dígitos com DDI).</FieldDoc>
            <FieldDoc name="sender" required>"user" (cliente), "ai" (agente) ou "human".</FieldDoc>
            <FieldDoc name="content" required>Texto da mensagem ou descrição da mídia.</FieldDoc>
            <FieldDoc name="message_type">"text" | "audio" | "image" | "video" | "document".</FieldDoc>
            <FieldDoc name="contact_name">Nome do contato (opcional).</FieldDoc>
            <FieldDoc name="intent">Intent classificada pela IA.</FieldDoc>
            <FieldDoc name="sentiment">"positive" | "neutral" | "negative".</FieldDoc>
            <FieldDoc name="needs_human">Boolean — sinaliza necessidade de humano.</FieldDoc>
            <FieldDoc name="is_fallback">Boolean — IA caiu em fallback.</FieldDoc>
            <FieldDoc name="status">Estado da conversa após esta mensagem.</FieldDoc>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. O endpoint procura uma conversa pelo <code className="text-foreground">phone</code> ou cria uma nova.</p>
          <p>2. A mensagem é inserida e os agregados (contagem, última mensagem, métricas diárias) são atualizados via triggers.</p>
          <p>3. O painel recebe a atualização em tempo real (Realtime do Lovable Cloud).</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono break-all">{value}</code>
        {onCopy && (
          <Button variant="outline" size="icon" onClick={onCopy} aria-label={`Copiar ${label}`}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function FieldDoc({ name, required, children }: { name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <code className="font-mono text-xs text-primary">{name}</code>
        {required && <Badge variant="outline" className="text-[9px] border-warning/40 text-warning">obrigatório</Badge>}
      </div>
      <p className="text-muted-foreground mt-1 text-[11px]">{children}</p>
    </div>
  );
}
