import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserCog, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhone, initials, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversations")({
  component: ConversationsLayout,
});

type Conversation = {
  id: string;
  contact_name: string | null;
  phone: string;
  status: string;
  intent: string | null;
  needs_human: boolean;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
};

function ConversationsLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isDetail = /\/conversations\/[^/]+/.test(path);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as Conversation[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => refetch())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return (
        (c.contact_name ?? "").toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className={`${isDetail ? "hidden md:flex" : "flex"} w-full md:w-[380px] border-r border-border flex-col min-w-0`}>
        <div className="p-4 space-y-3 border-b border-border">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="waiting_human">Aguarda humano</SelectItem>
              <SelectItem value="closed">Encerrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-16 px-6">
              <Inbox className="h-10 w-10 mb-3 opacity-60" />
              <p className="text-sm">Nenhuma conversa encontrada.</p>
              <p className="text-xs mt-1">Conecte o n8n para começar a receber dados.</p>
            </div>
          ) : (
            <ul>
              {filtered.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/conversations/$id"
                    params={{ id: c.id }}
                    className="block border-b border-border px-4 py-3 hover:bg-accent/50 transition-colors"
                    activeProps={{ className: "bg-accent border-l-2 border-l-primary" }}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs">{initials(c.contact_name, c.phone)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{c.contact_name || formatPhone(c.phone)}</span>
                          {c.last_message_at && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: ptBR })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message || "Sem mensagens"}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <StatusBadge status={c.status} />
                          {c.needs_human && <Badge variant="outline" className="border-warning/50 text-warning text-[10px] gap-1"><UserCog className="h-3 w-3" />Humano</Badge>}
                          {c.intent && <Badge variant="secondary" className="text-[10px]">{c.intent}</Badge>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      <section className={`${isDetail ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
        {isDetail ? <Outlet /> : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Inbox className="h-10 w-10 mx-auto opacity-50 mb-2" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-info/15 text-info border-info/30",
    in_progress: "bg-primary/15 text-primary border-primary/30",
    closed: "bg-muted text-muted-foreground border-border",
    waiting_human: "bg-warning/15 text-warning border-warning/30",
  };
  return <Badge variant="outline" className={`text-[10px] ${map[status] ?? ""}`}>{statusLabel(status)}</Badge>;
}
