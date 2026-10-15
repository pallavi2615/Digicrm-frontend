import { defineRoute } from "@/lib/router-compat";
import { diffRolePermissions } from "@/lib/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Eye, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api";

export const Route = defineRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — DigiCRM AI" }] }),
  component: TeamPage,
});

type Role = "super_admin" | "admin" | "sales_manager" | "sales_executive";

/** Mirrors the server-side hierarchy: nobody may grant a role above their own. */
const ROLE_RANK: Record<Role, number> = {
  super_admin: 4, admin: 3, sales_manager: 2, sales_executive: 1,
};

const ALL_ROLES: Role[] = ["super_admin", "admin", "sales_manager", "sales_executive"];

/** Roles that can be granted through the API (super_admin is never grantable). */
const ASSIGNABLE_ROLES: Role[] = ["admin", "sales_manager", "sales_executive"];

/**
 * Backend role strings can differ from the frontend ones
 * (e.g. "manager" vs "sales_manager"). Normalise anything we receive.
 */
function normalizeRole(raw: string | null | undefined): Role {
  const v = (raw ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (v === "super_admin" || v === "superadmin") return "super_admin";
  if (v === "admin") return "admin";
  if (v === "sales_manager" || v === "manager") return "sales_manager";
  return "sales_executive";
}

/** Default strings sent to the API. Must match app/core/constants.py. */
const API_ROLE: Record<Role, string> = {
  super_admin: "super_admin",
  admin: "admin",
  sales_manager: "manager",
  sales_executive: "executive",
};

const roleLabel = (r: string) => r.replace(/_/g, " ");

/* ------------------------------------------------------------------ */
/* API types                                                           */
/* ------------------------------------------------------------------ */

interface Me {
  id: number;
  email: string;
  full_name: string | null;
  phone?: string | null;
  role: string;
}

interface TeamMember {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  status?: string | null;
  manager_id?: number | null;
  created_at?: string | null;
}

interface InviteResponse {
  user_id: number;
  email: string;
  full_name: string | null;
  role: string;
  tenant_id: number | null;
  temp_password: string | null;
  email_sent: boolean;
  email_error: string | null;
}

function TeamPage() {
  const { roles, isAdmin } = useAuth();
  const qc = useQueryClient();

  /* ---------------- Current user (GET /users/me) ---------------- */
  const { data: me } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiFetch<Me>("/api/v1/users/me"),
  });

  const displayRoles: Role[] = (roles.length ? roles : me?.role ? [me.role] : []).map((r) =>
    normalizeRole(r as string)
  );

  /* ---------------- Team members (GET /users) ---------------- */
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members"],
    enabled: isAdmin,
    queryFn: () => apiFetch<TeamMember[]>("/api/v1/users?limit=200"),
  });

  const [pendingRole, setPendingRole] = useState<
    { userId: number; name: string; from: Role; to: Role } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [viewUserId, setViewUserId] = useState<number | null>(null);

  /* ---------------- Change role (PATCH /users/{id}/role) ---------------- */
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Role }) => {
      const apiRole = teamMembers?.find((m) => normalizeRole(m.role) === role)?.role ?? API_ROLE[role];
      return apiFetch<TeamMember>(`/api/v1/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: apiRole }),
      });
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["role-audit"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  /* ---------------- Delete user (DELETE /users/{id}) ---------------- */
  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      try {
        await apiFetch<unknown>(`/api/v1/users/${userId}`, { method: "DELETE" });
      } catch (e) {
        if (e instanceof SyntaxError) return;
        throw e;
      }
    },
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["role-audit"] });
      setPendingDelete(null);
    },
    onError: (e: Error) => {
      setPendingDelete(null);
      notifyPermissionDenied(e);
    },
  });

  const myRank = Math.max(0, ...displayRoles.map((r) => ROLE_RANK[r] ?? 0));
  const isSuperAdmin = displayRoles.includes("super_admin");
  const pendingDelta = pendingRole ? diffRolePermissions(pendingRole.from, pendingRole.to) : [];

  // List of users who can be a manager (role = sales_manager or admin)
  const managers = (teamMembers ?? []).filter(
    (m) =>
      normalizeRole(m.role) === "sales_manager" ||
      normalizeRole(m.role) === "admin"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your team members, roles and reporting lines.
        </p>
      </div>

      {isAdmin ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
          {/* ================= LEFT: TEAM MEMBERS ================= */}
          <Card className="shadow-card min-w-0">
            <CardHeader>
              <CardTitle className="text-base">Team Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(teamMembers ?? []).map((m) => {
                const current = normalizeRole(m.role);
                const isSelf = m.id === me?.id;
                const targetIsSuperAdmin = current === "super_admin";
                const memberName = m.full_name || m.email || "this user";
                const options = ALL_ROLES.filter(
                  (r) => (ASSIGNABLE_ROLES.includes(r) && ROLE_RANK[r] <= myRank) || r === current
                );

                const managerName = m.manager_id
                  ? (teamMembers ?? []).find((x) => x.id === m.manager_id)?.full_name ??
                    `User #${m.manager_id}`
                  : null;

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded border flex-wrap"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(m.full_name || m.email || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{m.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      title="View details"
                      onClick={() => setViewUserId(m.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {/* Role dropdown */}
                    <Select
                      value={current}
                      onValueChange={(v) =>
                        setPendingRole({
                          userId: m.id,
                          name: memberName,
                          from: current,
                          to: v as Role,
                        })
                      }
                      disabled={isSelf || targetIsSuperAdmin || updateRole.isPending}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue>
                          <span className="capitalize">{roleLabel(current)}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((r) => (
                          <SelectItem
                            key={r}
                            value={r}
                            className="capitalize"
                            disabled={r === "super_admin" || ROLE_RANK[r] > myRank}
                          >
                            {roleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Reports To dropdown — only for executives */}
                    {current === "sales_executive" && (isAdmin || isSuperAdmin) && (
                      <ManagerSelectCell
                        member={m}
                        managers={managers}
                        onChanged={() =>
                          qc.invalidateQueries({ queryKey: ["team-members"] })
                        }
                      />
                    )}

                    {/* Static "Reports To" text for non-executive roles */}
                    {current !== "sales_executive" && managerName && (
                      <span className="text-xs text-muted-foreground">
                        Reports to {managerName}
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      title={
                        isSelf
                          ? "You cannot delete yourself"
                          : targetIsSuperAdmin
                          ? "The SuperAdmin cannot be deleted"
                          : "Delete user"
                      }
                      disabled={isSelf || targetIsSuperAdmin || deleteUser.isPending}
                      onClick={() => setPendingDelete({ id: m.id, name: memberName })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              {teamMembers?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No team members yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ================= RIGHT: INVITE FORM ================= */}
          <InviteUserCard isSuperAdmin={isSuperAdmin} myRank={myRank} />
        </div>
      ) : (
        <Card className="shadow-card max-w-4xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-center">
              You don't have permission to manage team members.
            </p>
          </CardContent>
        </Card>
      )}

      {/* View User Dialog */}
      <ViewUserDialog userId={viewUserId} onClose={() => setViewUserId(null)} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              {pendingDelete && (
                <>
                  Permanently delete <strong>{pendingDelete.name}</strong>? This cannot be
                  undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => pendingDelete && deleteUser.mutate(pendingDelete.id)}
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={!!pendingRole} onOpenChange={(o) => !o && setPendingRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm role change</DialogTitle>
            <DialogDescription>
              {pendingRole && (
                <>
                  Change <strong>{pendingRole.name}</strong> from{" "}
                  <span className="capitalize">{roleLabel(pendingRole.from)}</span> to{" "}
                  <span className="capitalize">{roleLabel(pendingRole.to)}</span>? The change
                  is verified again on the server and recorded in the audit log.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {pendingDelta.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {pendingDelta.map((d) => (
                <div key={d.module} className="text-xs flex flex-wrap gap-1 items-center">
                  <span className="font-medium">{d.module}</span>
                  {d.gained.length > 0 && (
                    <span className="rounded bg-success/15 text-success px-1.5 py-0.5">
                      + {d.gained.join(", ")}
                    </span>
                  )}
                  {d.lost.length > 0 && (
                    <span className="rounded bg-destructive/15 text-destructive px-1.5 py-0.5">
                      − {d.lost.join(", ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRole(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateRole.isPending}
              onClick={() => {
                if (!pendingRole) return;
                updateRole.mutate({ userId: pendingRole.userId, role: pendingRole.to });
                setPendingRole(null);
              }}
            >
              {updateRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// MANAGER SELECT CELL — assigns manager to an executive
// ============================================================

function ManagerSelectCell({
  member,
  managers,
  onChanged,
}: {
  member: TeamMember;
  managers: TeamMember[];
  onChanged: () => void;
}) {
  const assignMutation = useMutation({
    mutationFn: (managerId: number | null) =>
      apiFetch(`/api/v1/users/${member.id}/manager`, {
        method: "PATCH",
        body: JSON.stringify({ manager_id: managerId }),
      }),
    onSuccess: () => {
      toast.success("Manager updated");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Select
      value={member.manager_id ? String(member.manager_id) : "none"}
      onValueChange={(v) =>
        assignMutation.mutate(v === "none" ? null : Number(v))
      }
      disabled={assignMutation.isPending}
    >
      <SelectTrigger className="w-44 h-9 text-xs">
        <SelectValue placeholder="Reports to..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No manager</SelectItem>
        {managers
          .filter((m) => m.id !== member.id)
          .map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              {m.full_name || m.email}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================
// INVITE USER CARD — right-side form (POST /users/invite)
// ============================================================

function InviteUserCard({
  isSuperAdmin,
  myRank,
}: {
  isSuperAdmin: boolean;
  myRank: number;
}) {
  const qc = useQueryClient();

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("sales_executive");
  const [tenantId, setTenantId] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [managerId, setManagerId] = useState<string>("none");
  const [result, setResult] = useState<InviteResponse | null>(null);

  const inviteOptions = ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] <= myRank);

  // Fetch managers list (only needed for executives, not for SuperAdmin)
  const { data: managers = [] } = useQuery({
    queryKey: ["assignable-managers"],
    enabled: !isSuperAdmin,
    queryFn: () =>
      apiFetch<{ id: number; full_name: string; email: string; role: string }[]>(
        "/api/v1/users/assignees"
      ),
  });

  const reset = () => {
    setInviteName("");
    setInviteEmail("");
    setInviteRole("sales_executive");
    setTenantId("");
    setSendEmail(true);
    setManagerId("none");
  };

  const invite = useMutation({
    mutationFn: () =>
      apiFetch<InviteResponse>("/api/v1/users/invite", {
        method: "POST",
        body: JSON.stringify({
          full_name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: API_ROLE[inviteRole],
          send_welcome_email: sendEmail,
          ...(isSuperAdmin ? { tenant_id: Number(tenantId) } : {}),
          ...(inviteRole === "sales_executive" && managerId !== "none"
            ? { manager_id: Number(managerId) }
            : {}),
        }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      if (res.email_sent) {
        toast.success(`Invitation emailed to ${res.email}`);
        setResult(null);
      } else {
        toast.warning("User created, but the welcome email was not sent");
        setResult(res);
      }
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    inviteName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(inviteEmail.trim()) &&
    (!isSuperAdmin || Number(tenantId) > 0);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Invite user</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {inviteOptions.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manager select — only for executives, only for Admin */}
        {inviteRole === "sales_executive" && !isSuperAdmin && (
          <div className="space-y-1.5">
            <Label>Assign to Manager (optional)</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {managers
                  .filter((m) => m.role === "manager" || m.role === "admin")
                  .map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.full_name} ({m.role})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isSuperAdmin && (
          <div className="space-y-1.5">
            <Label>Tenant ID</Label>
            <Input
              type="number"
              min={1}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Required for SuperAdmin"
            />
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(c === true)} />
          <span className="text-sm">Send welcome email with login details</span>
        </label>

        <Button
          className="w-full"
          onClick={() => invite.mutate()}
          disabled={!canSubmit || invite.isPending}
        >
          {invite.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          Send invite
        </Button>

        <p className="text-xs text-muted-foreground">
          The user gets a temporary password and must change it on first login.
        </p>

        {/* Temporary password fallback when the welcome email was not sent */}
        {result && (
          <div className="rounded border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              {result.email_error
                ? `The welcome email failed: ${result.email_error}.`
                : "The welcome email was not sent."}{" "}
              Share this temporary password with {result.full_name || result.email} manually. It
              is shown only once.
            </p>
            <div className="flex gap-2">
              <Input
                value={result.temp_password ?? ""}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(result.temp_password ?? "");
                  toast.success("Password copied");
                }}
              >
                Copy
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="w-full" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// VIEW USER DIALOG (GET /users/{user_id})
// ============================================================

function ViewUserDialog({
  userId,
  onClose,
}: {
  userId: number | null;
  onClose: () => void;
}) {
  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: ["users", userId],
    enabled: userId !== null,
    queryFn: () => apiFetch<TeamMember>(`/api/v1/users/${userId}`),
  });

  return (
    <Dialog open={userId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>User details</DialogTitle>
          <DialogDescription>Profile information for this team member.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive py-4">
            {(error as Error)?.message ?? "Could not load user."}
          </p>
        ) : user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(user.full_name || user.email || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium">{user.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Separator />
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">ID</dt>
              <dd className="col-span-2">{user.id}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="col-span-2">
                <Badge variant="secondary" className="capitalize text-xs">
                  {roleLabel(normalizeRole(user.role))}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="col-span-2 capitalize">{user.status ?? "—"}</dd>
              {user.created_at && (
                <>
                  <dt className="text-muted-foreground">Joined</dt>
                  <dd className="col-span-2">
                    {new Date(user.created_at).toLocaleDateString()}
                  </dd>
                </>
              )}
            </dl>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}