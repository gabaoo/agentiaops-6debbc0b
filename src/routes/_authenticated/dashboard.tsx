import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, MessagesSquare, Clock, CheckCircle2, UserCog, Hash, CalendarDays, TrendingUp,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Painel — AgentOps" },
      { name: "description", content: "Métricas em tempo real do agente de IA no WhatsApp: conversas, mensagens, status, intents e fila humana." },
      { property: "og:title", content: "Painel — AgentOps" },
      { property: "og:description", content: "Métricas em tempo real do agente de IA no WhatsApp." },
      { property: "og:url", content: "https://agentiaops.lovable.app/dashboard" },
      { name: "twitter:title", content: "Painel — AgentOps" },
      { name: "twitter:description", content: "Métricas em tempo real do agente de IA no WhatsApp." },
    ],
    links: [{ rel: "canonical", href: "https://agentiaops.lovable.app/dashboard" }],
  }),
});

type Conv = {
  id: string;
  status: string;
  intent: string | null;
  needs_human: boolean;
  message_count: number;
  created_at: string;
};
type Msg = { id: string; created_at: string };

async function fetchAll() {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  const sinceIso = since.toISOString();

  const [convsRes, msgsRes] = await Promise.all([
    supabase.from("conversations").select("id,status,intent,needs_human,message_count,created_at").limit(2000),
    supabase.from("messages").select("id,created_at").gte("created_at", sinceIso).limit(5000),
  ]);
  if (convsRes.error) throw convsRes.error;
  if (msgsRes.error) throw msgsRes.error;
  return { conversations: (convsRes.data as Conv[]) ?? [], messages: (msgsRes.data as Msg[]) ?? [] };
}

function DashboardPage() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: fetchAll });

  // realtime invalidation
  useEffect(() => {
    const ch = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  if (isLoading || !data) return <DashboardSkeleton />;

  const { conversations, messages } = data;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const totalConvs = conversations.length;
  const totalMsgs = conversations.reduce((s, c) => s + (c.message_count || 0), 0);
  const inProgress = conversations.filter((c) => c.status === "in_progress" || c.status === "open").length;
  const closed = conversations.filter((c) => c.status === "closed").length;
  const waitingHuman = conversations.filter((c) => c.needs_human || c.status === "waiting_human").length;
  const avgMsgs = totalConvs ? (totalMsgs / totalConvs).toFixed(1) : "0";
  const todayConvs = conversations.filter((c) => c.created_at >= todayIso).length;

  // last 14 days buckets
  const days: { label: string; key: string; convs: number; msgs: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      convs: 0, msgs: 0,
    });
  }
  const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
  for (const c of conversations) {
    const k = c.created_at.slice(0, 10);
    if (idx[k] !== undefined) days[idx[k]].convs++;
  }
  for (const m of messages) {
    const k = m.created_at.slice(0, 10);
    if (idx[k] !== undefined) days[idx[k]].msgs++;
  }

  const statusData = ["open", "in_progress", "waiting_human", "closed"].map((s) => ({
    name: statusLabel(s),
    value: conversations.filter((c) => c.status === s).length,
  })).filter((d) => d.value > 0);

  const intentMap = new Map<string, number>();
  for (const c of conversations) {
    const k = c.intent ?? "indefinido";
    intentMap.set(k, (intentMap.get(k) ?? 0) + 1);
  }
  const intentData = [...intentMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <main className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral em tempo real do agente IA</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Metric icon={MessagesSquare} label="Conversas" value={totalConvs} />
        <Metric icon={MessageSquare} label="Mensagens" value={totalMsgs} />
        <Metric icon={Clock} label="Em andamento" value={inProgress} />
        <Metric icon={CheckCircle2} label="Encerradas" value={closed} />
        <Metric icon={UserCog} label="Aguardam humano" value={waitingHuman} accent="warning" />
        <Metric icon={Hash} label="Média msgs/conv" value={avgMsgs} />
        <Metric icon={CalendarDays} label="Conversas hoje" value={todayConvs} />
        <Metric icon={TrendingUp} label="Total geral" value={totalConvs + totalMsgs} muted />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none tracking-tight">Conversas por dia</h2>
            <CardDescription>Últimos 14 dias</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="convs" stroke="var(--chart-1)" fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none tracking-tight">Volume de mensagens</h2>
            <CardDescription>Últimos 14 dias</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="msgs" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none tracking-tight">Distribuição por status</h2>
          </CardHeader>
          <CardContent className="h-72">
            {statusData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none tracking-tight">Top intents</h2>
            <CardDescription>Identificadas pelo agente</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {intentData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} width={100} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon, label, value, accent, muted,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; accent?: "warning"; muted?: boolean }) {
  return (
    <Card className="overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accent === "warning" ? "text-warning" : muted ? "text-muted-foreground" : "text-primary"}`} />
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>;
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
      </div>
    </div>
  );
}
