import { apiFetch } from "@/lib/api";
import { MODULES, ROLES, type Action } from "@/lib/permissions";
import type { AppRole } from "@/hooks/use-auth";

export interface MatrixRow {
  key: string; label: string; panel: string; route: string | null; description: string; perms: Record<string, Action[]>;
}
export interface MatrixPayload {
  roles: { key: AppRole; label: string; blurb: string }[];
  myRoles: AppRole[];
  full: boolean;
  rows: MatrixRow[];
}

export async function getPermissionMatrix(): Promise<MatrixPayload> {
  const me = await apiFetch<any>("/api/v1/auth/me");
  const myRoles = [String(me?.role ?? "sales_executive") as AppRole];
  const full = myRoles.some((role) => role === "super_admin" || role === "admin");
  const visible = full ? ROLES.map((role) => role.key) : myRoles;
  return {
    roles: ROLES.filter((role) => visible.includes(role.key)),
    myRoles,
    full,
    rows: MODULES.filter((module) => full || visible.some((role) => (module.perms[role] ?? []).length > 0)).map((module) => ({
      key: module.key,
      label: module.label,
      panel: module.panel,
      route: module.route ?? null,
      description: module.description,
      perms: Object.fromEntries(visible.map((role) => [role, module.perms[role] ?? []])),
    })),
  };
}
