import { apiFetch } from "@/lib/api";

export interface Msg { role: "user" | "assistant" | "system"; content: string }
export interface EntityRef { type: "leads" | "contacts" | "companies"; id: string }
export interface PackRef { group: string; slug: string }

export type AIChatInput = {
  accessToken?: string;
  messages: Msg[];
  context?: EntityRef[];
  pack?: PackRef;
  tenantId?: string | number | null;
};

export async function aiChat({ data }: { data: AIChatInput }): Promise<{ content: string; grounded: boolean; permitted_count?: number }> {
  if (!data?.messages || !Array.isArray(data.messages)) throw new Error("messages required");
  return apiFetch("/api/v1/ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages: data.messages }),
  });
}
