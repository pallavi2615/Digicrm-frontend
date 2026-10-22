import { apiFetch } from "@/lib/api";
import { z } from "zod";

const createTicketSchema = z.object({
  tenantId: z.string().optional().nullable(),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  urgency: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  requester_email: z.string().trim().email().max(255),
  requester_name: z.string().trim().max(200).optional().nullable(),
  industryGroup: z.string().trim().max(60).nullable().optional(),
});
const replySchema = z.object({ ticketId: z.union([z.string(), z.number()]), body: z.string().trim().min(1).max(10000), isPublic: z.boolean().default(true) });

export async function createTicketFn({ data: raw }: { data: unknown }) {
  const data = createTicketSchema.parse(raw);
  const tenantId = data.tenantId ?? undefined;
  return apiFetch("/api/v1/tickets", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: tenantId,
      subject: data.subject,
      description: data.description ?? null,
      priority: data.priority,
      urgency: data.urgency,
      requester_email: data.requester_email,
      requester_name: data.requester_name ?? null,
      industry_group: data.industryGroup ?? null,
      channel: "portal",
    }),
  });
}

export async function createTicketReplyFn({ data: raw }: { data: unknown }) {
  const data = replySchema.parse(raw);
  return apiFetch(`/api/v1/tickets/${encodeURIComponent(String(data.ticketId))}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: data.body, is_public: data.isPublic }),
  });
}
