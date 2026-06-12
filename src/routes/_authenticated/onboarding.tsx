import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useInstances } from "@/hooks/use-instances";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Cadastrar instância — AgentOps" },
      { name: "description", content: "Cadastre sua instância da Evolution API para começar a usar o painel multi-tenant do AgentOps." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const Schema = z.object({
  instance_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60),
  whatsapp_number: z.string().trim().min(8, "Número inválido").max(20),
  evolution_instance_id: z.string().trim().min(1, "Obrigatório").max(120),
});

function OnboardingPage() {
  const { user } = useAuth();
  const { instances, setCurrentId, refetch } = useInstances();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ instance_name: "", whatsapp_number: "", evolution_instance_id: "" });

  const isFirstInstance = instances.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const phone = parsed.data.whatsapp_number.replace(/\D/g, "");
    const { data, error } = await supabase
      .from("instances")
      .insert({
        user_id: user.id,
        instance_name: parsed.data.instance_name,
        whatsapp_number: phone,
        evolution_instance_id: parsed.data.evolution_instance_id,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error || !data) {
      toast.error(error?.message ?? "Falha ao criar instância");
      return;
    }
    await refetch();
    setCurrentId(data.id);
    toast.success("Instância criada!");
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{isFirstInstance ? "Cadastre sua primeira instância" : "Nova instância"}</h1>
              <CardDescription>{isFirstInstance ? "Vincule uma instância da Evolution API para começar." : "Adicione outra instância à sua conta."}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="instance_name">Nome da instância</Label>
              <Input id="instance_name" placeholder="Atendimento Principal"
                value={form.instance_name} onChange={(e) => setForm({ ...form, instance_name: e.target.value })} required />
              <p className="text-xs text-muted-foreground">Como você vai identificá-la no painel.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp_number">Número do WhatsApp</Label>
              <Input id="whatsapp_number" placeholder="5511988887777" inputMode="numeric"
                value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} required />
              <p className="text-xs text-muted-foreground">Apenas dígitos, com DDI e DDD.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evolution_instance_id">ID da instância na Evolution API</Label>
              <Input id="evolution_instance_id" placeholder="empresa-x-prod"
                value={form.evolution_instance_id} onChange={(e) => setForm({ ...form, evolution_instance_id: e.target.value })} required />
              <p className="text-xs text-muted-foreground">Identificador único enviado pelo n8n no payload.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar instância
            </Button>
            {!isFirstInstance && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate({ to: "/dashboard" })}>
                Cancelar
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}