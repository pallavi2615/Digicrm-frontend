import { apiFetch } from "@/lib/api";

type AgentInput = {
  group: string;
  slug: string;
  agentKey: string;
  recordId?: string | null;
  question?: string;
};

export async function runPackAgent({ data }: { data: AgentInput }): Promise<{ output: string }> {
  if (!data?.group || !data?.slug || !data?.agentKey) throw new Error("Pick an agent to run");
  const question = data.question?.trim() || `Run the ${data.agentKey} analysis for the ${data.group}/${data.slug} industry pack${data.recordId ? ` on record ${data.recordId}` : ""}. Provide concise, actionable recommendations.`;
  const result = await apiFetch<{ content?: string; grounded?: boolean }>("/api/v1/ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [
      { role: "system", content: `You are the ${data.agentKey} specialist for the ${data.group}/${data.slug} industry pack. Answer in concise, actionable markdown. Do not claim access to records that are not supplied.` },
      { role: "user", content: question },
    ] }),
  });
  return { output: result.content ?? "No output returned by the AI service." };
}
