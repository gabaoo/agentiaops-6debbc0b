import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Entrar — AgentOps" },
      { name: "description", content: "Acesse sua conta no AgentOps para monitorar conversas do agente de IA no WhatsApp em tempo real." },
      { property: "og:title", content: "Entrar — AgentOps" },
      { property: "og:description", content: "Acesse sua conta no AgentOps para monitorar conversas do agente de IA no WhatsApp." },
      { property: "og:url", content: "https://agentiaops.lovable.app/login" },
      { name: "twitter:title", content: "Entrar — AgentOps" },
      { name: "twitter:description", content: "Acesse sua conta no AgentOps para monitorar conversas do agente de IA no WhatsApp." },
    ],
    links: [{ rel: "canonical", href: "https://agentiaops.lovable.app/login" }],
  }),
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ background: "radial-gradient(800px 400px at 50% -10%, var(--primary), transparent 60%)" }}
      />
      <Card className="w-full max-w-md relative" style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot className="h-6 w-6" />
          </div>
          <CardTitle asChild className="text-2xl"><h1>Entrar no AgentOps</h1></CardTitle>
          <CardDescription>Painel de monitoramento de conversas IA</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Ainda não tem conta? <Link to="/signup" className="text-primary hover:underline">Criar conta</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
