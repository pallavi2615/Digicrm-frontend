import { apiFetch } from "@/lib/api";

export type TimelineEntry = { ts: string; type: string; message?: string | null; ok?: boolean; attempt?: number };

export async function retryWebhookEvent({ data }: { data: { logId: string } }) {
  return apiFetch(`/api/v1/webhook-events/${encodeURIComponent(data.logId)}/retry`, { method: "POST" });
}

export async function markWebhookDeadLetter({ data }: { data: { logId: string; dead: boolean } }) {
  // Do not delete a webhook event to imitate a dead-letter status; no status-toggle endpoint exists yet.
  if (data.dead) {
    throw new Error("The backend does not provide a dead-letter state toggle endpoint.");
  }
  return apiFetch(`/api/v1/webhook-events/${encodeURIComponent(data.logId)}/retry`, { method: "POST" });
}

export async function updateWebhookRetryConfig({ data }: { data: { tenantId: string; maxAttempts: number; baseMinutes: number; factor: number } }) {
  if (data.maxAttempts < 1 || data.maxAttempts > 20) throw new Error("maxAttempts 1..20");
  if (data.baseMinutes < 1 || data.baseMinutes > 1440) throw new Error("baseMinutes 1..1440");
  if (data.factor < 1 || data.factor > 10) throw new Error("factor 1..10");
  return apiFetch(`/api/v1/webhook-settings/retry/${encodeURIComponent(data.tenantId)}`, {
    method: "PUT",
    body: JSON.stringify({ max_attempts: data.maxAttempts, base_minutes: data.baseMinutes, factor: data.factor }),
  });
}
