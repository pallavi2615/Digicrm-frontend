import { apiFetch } from "@/lib/api";
import { can, moduleFor, type Action } from "@/lib/permissions";
import type { AppRole } from "@/hooks/use-auth";

const ACTIONS: Action[] = ["view", "create", "edit", "delete"];
const MODULE_ENDPOINT: Record<string, string> = {
  leads: "/api/v1/leads",
  contacts: "/api/v1/contacts",
  companies: "/api/v1/companies",
  tasks: "/api/v1/tasks",
  meetings: "/api/v1/meetings",
  tickets: "/api/v1/tickets",
  automation: "/api/v1/automation",
  fintech: "/api/v1/fintech/applications",
  realestate: "/api/v1/realestate/properties",
  it: "/api/v1/it/projects",
  productsales: "/api/v1/productsales/products",
  affiliates: "/api/v1/lead-sources/affiliates",
  proposals: "/api/v1/proposals",
};

async function currentRoles(): Promise<AppRole[]> {
  try {
    const permissions = await apiFetch<any>("/api/v1/auth/my-permissions");
    const role = permissions?.role ?? permissions?.user_role;
    if (typeof role === "string") return [role as AppRole];
  } catch { /* local profile fallback only supports UI guardrails; APIs enforce access */ }
  try {
    const user = JSON.parse(localStorage.getItem("user") ?? "null");
    const role = user?.role;
    return typeof role === "string" ? [role as AppRole] : [];
  } catch { return []; }
}

function parseAction(value: string): Action {
  if (ACTIONS.includes(value as Action)) return value as Action;
  throw new Error("Invalid action");
}

export async function authorizeAction({ data }: { data: { module: string; action: string; entityId?: string | null } }) {
  const action = parseAction(data.action);
  if (!moduleFor(data.module)) throw new Error(`Unknown module "${data.module}"`);
  const roles = await currentRoles();
  if (!can(roles, data.module, action)) throw new Error(`You do not have permission to ${action} ${data.module}.`);
  return { allowed: true as const, roles };
}

export async function assertCanWrite({ data }: { data: { module: string; action: string; entityId?: string | null } }) {
  const action = parseAction(data.action);
  const roles = await currentRoles();
  if (!can(roles, data.module, action)) throw new Error(`You do not have permission to ${action} ${data.module}.`);
  return { allowed: true as const };
}

export async function deleteRecord({ data }: { data: { module: string; id: string } }) {
  const endpoint = MODULE_ENDPOINT[data.module];
  if (!endpoint) throw new Error(`Deletion is not supported for "${data.module}".`);
  await apiFetch(`${endpoint}/${encodeURIComponent(data.id)}`, { method: "DELETE" });
  return { ok: true as const };
}

export async function changeUserRole({ data }: { data: { userId: string; role: string } }) {
  const roles = await currentRoles();
  if (!can(roles, "user-roles", "edit")) throw new Error("You do not have permission to change roles.");
  const response = await apiFetch<any>(`/api/v1/users/${encodeURIComponent(data.userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role: data.role }),
  });
  return { ok: true as const, previous: response?.previous ?? [], next: response?.role ?? data.role };
}
