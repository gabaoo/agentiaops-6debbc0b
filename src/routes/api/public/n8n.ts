import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesUpdate, Json } from "@/integrations/supabase/types";

const PayloadSchema = z.object({
  evolution_instance_id: z.string().min(1).max(120),
  phone: z.string().min(5).max(32),
  contact_name: z.string().max(120).optional().nullable(),
  sender: z.enum(["user", "ai", "human"]).default("user"),
  content: z.string().min(1).max(8000),
  message_type: z.enum(["text", "audio", "image", "video", "document"]).default("text"),
  intent: z.string().max(80).optional().nullable(),
  sentiment: z.enum(["positive", "neutral", "negative"]).optional().nullable(),
  needs_human: z.boolean().optional(),
  is_fallback: z.boolean().optional(),
  status: z.enum(["open", "in_progress", "closed", "waiting_human"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
  };
}

export const Route = createFileRoute("/api/public/n8n")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        const expected = process.env.N8N_WEBHOOK_SECRET;
        const got = request.headers.get("x-webhook-secret");
        if (!expected || !got || got !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders() },
          });
        }

        let raw: unknown;
        try { raw = await request.json(); } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
        }

        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400, headers: corsHeaders() }
          );
        }

        const p = parsed.data;
        const phone = p.phone.replace(/\D/g, "");

        // Resolve tenant via evolution_instance_id
        const { data: instance, error: iErr } = await supabaseAdmin
          .from("instances")
          .select("id")
          .eq("evolution_instance_id", p.evolution_instance_id)
          .maybeSingle();
        if (iErr) {
          return Response.json({ error: iErr.message }, { status: 500, headers: corsHeaders() });
        }
        if (!instance) {
          return Response.json(
            { error: "Unknown evolution_instance_id" },
            { status: 404, headers: corsHeaders() }
          );
        }
        const instanceId = instance.id;

        // Find or create conversation scoped to instance
        const { data: existing, error: findErr } = await supabaseAdmin
          .from("conversations")
          .select("id, contact_name, status")
          .eq("instance_id", instanceId)
          .eq("phone", phone)
          .maybeSingle();
        if (findErr) {
          return Response.json({ error: findErr.message }, { status: 500, headers: corsHeaders() });
        }

        let conversationId: string;
        if (!existing) {
          const { data: created, error: cErr } = await supabaseAdmin
            .from("conversations")
            .insert({
              instance_id: instanceId,
              phone,
              contact_name: p.contact_name ?? null,
              status: p.status ?? "open",
              intent: p.intent ?? null,
              sentiment: p.sentiment ?? null,
              needs_human: p.needs_human ?? false,
            })
            .select("id")
            .single();
          if (cErr || !created) {
            return Response.json({ error: cErr?.message ?? "Failed to create" }, { status: 500, headers: corsHeaders() });
          }
          conversationId = created.id;
        } else {
          conversationId = existing.id;
          const updates: TablesUpdate<"conversations"> = {};
          if (p.contact_name && !existing.contact_name) updates.contact_name = p.contact_name;
          if (p.status) updates.status = p.status;
          if (p.intent) updates.intent = p.intent;
          if (p.sentiment) updates.sentiment = p.sentiment;
          if (typeof p.needs_human === "boolean") updates.needs_human = p.needs_human;
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from("conversations").update(updates).eq("id", conversationId);
          }
        }

        const { data: msg, error: mErr } = await supabaseAdmin
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender: p.sender,
            content: p.content,
            message_type: p.message_type,
            is_fallback: p.is_fallback ?? false,
            metadata: (p.metadata ?? {}) as Json,
          })
          .select("id")
          .single();

        if (mErr) {
          return Response.json({ error: mErr.message }, { status: 500, headers: corsHeaders() });
        }

        return Response.json(
          { ok: true, conversation_id: conversationId, message_id: msg!.id },
          { headers: corsHeaders() }
        );
      },
    },
  },
});
