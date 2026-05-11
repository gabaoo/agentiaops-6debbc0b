import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, User, UserCog, AlertTriangle, Image as ImageIcon, Mic, FileText, Video } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPhone, initials } from "@/lib/format";
import { StatusBadge } from "./conversations";

export const Route = createFileRoute("/_authenticated/conversations/$id")({
  component: ConversationDetail,
});

type Msg = {
  id: string;
  conversation_id: string;
  sender: "user" | "ai" | "human";
  content: string;
  message_type: "text" | "audio" | "image" | "video" | "document";
  is_fallback: boolean;
  created_at: string;
};

type Conv = {
  id: string;
  contact_name: string | null;
  phone: string;
  status: string;
  intent: string | null;
  sentiment: string | null;
  needs_human: boolean;
  fallback_count: number;
  message_count: number;
};

function ConversationDetail() {
  const { id } = useParams({ from: "/_authenticated/conversations/$id" });
  const scrollRef = useRef<HTMLDivElement>(null);

  const conv = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Conv | null;
    },
  });

  const msgs = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages").select("*").eq("conversation_id", id)
        .order("created_at", { ascending: true }).limit(1000);
      if (error) throw error;
      return (data as Msg[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`conv-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => msgs.refetch())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${id}` },
        () => conv.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, msgs, conv]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.data]);

  if (conv.isLoading) return <div className="p-6 flex-1"><Skeleton className="h-full w-full" /></div>;
  if (!conv.data) return <div className="p-6 text-muted-foreground">Conversa não encontrada.</div>;

  const c = conv.data;

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 bg-card/40">
        <Link to="/conversations" className="md:hidden text-muted-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/15 text-primary text-xs">{initials(c.contact_name, c.phone)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{c.contact_name || formatPhone(c.phone)}</div>
          <div className="text-xs text-muted-foreground truncate">{formatPhone(c.phone)} · {c.message_count} mensagens</div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
          <StatusBadge status={c.status} />
          {c.needs_human && <Badge variant="outline" className="border-warning/50 text-warning gap-1 text-[10px]"><UserCog className="h-3 w-3" />Humano</Badge>}
          {c.intent && <Badge variant="secondary" className="text-[10px]">{c.intent}</Badge>}
          {c.sentiment && <SentimentBadge sentiment={c.sentiment} />}
          {c.fallback_count > 0 && (
            <Badge variant="outline" className="border-destructive/40 text-destructive gap-1 text-[10px]">
              <AlertTriangle className="h-3 w-3" />{c.fallback_count} fallback
            </Badge>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-3 max-w-3xl mx-auto">
          {msgs.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (msgs.data ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma mensagem nesta conversa.</p>
          ) : (
            (msgs.data ?? []).map((m) => <Bubble key={m.id} m={m} />)
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const fromUser = m.sender === "user";
  return (
    <div className={`flex ${fromUser ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
        fromUser ? "bg-card border border-border" :
        m.sender === "ai" ? "bg-primary text-primary-foreground" : "bg-info text-info-foreground"
      }`} style={fromUser ? {} : { boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-1.5 mb-1 text-[10px] opacity-80 uppercase tracking-wide">
          {m.sender === "user" && <><User className="h-3 w-3" />Cliente</>}
          {m.sender === "ai" && <><Bot className="h-3 w-3" />Agente IA</>}
          {m.sender === "human" && <><UserCog className="h-3 w-3" />Atendente</>}
          {m.is_fallback && <span className="ml-1 px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-medium">FALLBACK</span>}
        </div>
        <MessageBody m={m} />
        <div className="text-[10px] mt-1 opacity-70 text-right">
          {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
        </div>
      </div>
    </div>
  );
}

function MessageBody({ m }: { m: Msg }) {
  if (m.message_type === "text") return <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>;
  const Icon = { audio: Mic, image: ImageIcon, video: Video, document: FileText }[m.message_type];
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4" />
      <span className="capitalize">{m.message_type}</span>
      {m.content && <span className="opacity-70 truncate">— {m.content}</span>}
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, string> = {
    positive: "bg-success/15 text-success border-success/30",
    neutral: "bg-muted text-muted-foreground border-border",
    negative: "bg-destructive/15 text-destructive border-destructive/30",
  };
  const label = { positive: "Positivo", neutral: "Neutro", negative: "Negativo" }[sentiment] ?? sentiment;
  return <Badge variant="outline" className={`text-[10px] ${map[sentiment] ?? ""}`}>{label}</Badge>;
}
