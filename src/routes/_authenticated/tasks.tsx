import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { useState, useEffect, useMemo } from "react";
import { apiFetch, apiUpload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Loader2, CheckSquare, Trash2, Calendar, Pencil, Paperclip, X,
  Upload, FileText, Image as ImageIcon, Download, RefreshCw, Search,
  ClipboardList, Clock, PlayCircle, CheckCircle2, AlertTriangle, Users, User,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/datetime-picker";

export const Route = defineRoute("/_authenticated/tasks")({
  validateSearch: (search: Record<string, unknown>) => ({
    filter: (search.filter as string) || "all",
  }),
  head: () => ({
    meta: [
      { title: "Tasks — DigiCRM AI" },
      { name: "description", content: "Track your daily to-dos with priority and due dates." },
    ],
  }),
  component: TasksPage,
});

// ============================================================
// TYPES & CONSTANTS
// ============================================================

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type TaskScope = "my" | "team";

interface TaskAttachment {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface Task {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: number | null;
  assigned_to_name?: string | null; // optional – add to TaskResponse on backend for nicer team view
  created_by: number | null;
  lead_id: number | null;
  contact_id: number | null;
  company_id: number | null;
  deal_id: number | null;
  tags: any[];
  attachments: TaskAttachment[];
  created_at: string;
  updated_at: string;
}

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  due_today: number;
}

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  is_self: boolean;
}

interface TaskCreatePayload {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  assigned_to?: number | null;
}

// Roles that can see the "My Team Tasks" section
const TEAM_ROLES = ["super_admin", "admin", "manager"];

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  medium: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  high: "bg-orange-500 text-white",
  urgent: "bg-red-600 text-white",
};

const statusStyles: Record<TaskStatus, string> = {
  pending: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

const statusLabel: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const avatarColors = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500",
  "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
];

const empty: TaskCreatePayload = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  due_date: null,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Row grid layouts (full literal strings so Tailwind can see them)
const GRID_MY =
  "md:grid-cols-[28px_minmax(0,3fr)_120px_110px_130px_84px]";
const GRID_TEAM =
  "md:grid-cols-[28px_minmax(0,3fr)_120px_110px_130px_150px_84px]";

// ============================================================
// HELPERS
// ============================================================

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localToday() {
  return toDateInput(new Date().toISOString());
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ============================================================
// SMALL UI PIECES
// ============================================================

function StatCard({
  label, value, icon: Icon, tint, iconBg,
}: {
  label: string;
  value: number;
  icon: any;
  tint: string;
  iconBg: string;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${tint}`}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-3xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

function TasksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { filter: filterParam } = Route.useSearch();

  const role = String((user as any)?.role ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  const canViewTeam = TEAM_ROLES.includes(role);

  const [scope, setScope] = useState<TaskScope>("my"); // "My Tasks" is the default
  const effectiveScope: TaskScope = canViewTeam ? scope : "my";

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskCreatePayload>(empty);
  const [filter, setFilter] = useState<string>(filterParam ?? "all");
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (filterParam) setFilter(filterParam);
  }, [filterParam]);

  // -------- Fetch tasks (scoped) --------
  const {
    data: tasks,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["tasks", effectiveScope],
    queryFn: () =>
      apiFetch<Task[]>(`/api/v1/tasks?scope=${effectiveScope}&limit=500`),
  });

  // -------- Fetch stats (scoped) --------
  const { data: stats } = useQuery({
    queryKey: ["task-stats", effectiveScope],
    queryFn: () =>
      apiFetch<TaskStats>(`/api/v1/tasks/stats?scope=${effectiveScope}`),
  });

  // -------- Team members (assignee dropdown + names in team view) --------
  const {
    data: members,
    isLoading: membersLoading,
    isError: membersError,
  } = useQuery({
    queryKey: ["task-team-members"],
    queryFn: () => apiFetch<TeamMember[]>("/api/v1/tasks/team-members"),
    enabled: canViewTeam,
  });
  const teamOnly = (members ?? []).filter((m) => !m.is_self);

  const nameOf = (id: number | null) => {
    if (!id) return "Unassigned";
    const m = (members ?? []).find((x) => x.id === id);
    if (m) return m.name.replace(/\s*\(You\)$/, "");
    return id === user?.id ? "You" : `User #${id}`;
  };

  const visibleTasks = useMemo(() => {
    const today = localToday();
    const q = search.trim().toLowerCase();
    return (tasks ?? []).filter((t) => {
      if (filter === "open" && !["pending", "in_progress"].includes(t.status)) return false;
      if (filter === "done" && t.status !== "completed") return false;
      if (filter === "today") {
        if (!t.due_date || toDateInput(t.due_date) !== today) return false;
      }
      if (
        effectiveScope === "team" &&
        memberFilter !== "all" &&
        String(t.assigned_to) !== memberFilter
      )
        return false;
      if (q) {
        const hay = `${t.title} ${t.description ?? ""} ${t.assigned_to_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filter, search, effectiveScope, memberFilter]);

  const detail = (tasks ?? []).find((t) => t.id === detailId) ?? null;
  const detailAttachments = detail?.attachments ?? [];

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["task-stats"] });
  };

  // -------- File handlers --------
  const handleFilesPicked = (files: FileList | null) => {
    if (!files) return;
    const valid: File[] = [];
    const errors: string[] = [];
    Array.from(files).forEach((f) => {
      if (f.size > MAX_FILE_SIZE) errors.push(`${f.name} is over 10 MB`);
      else valid.push(f);
    });
    if (errors.length) toast.error(errors.join("\n"));
    setPickedFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index: number) =>
    setPickedFiles((prev) => prev.filter((_, i) => i !== index));

  const openNew = () => {
    setEditingId(null);
    setForm(empty);
    setPickedFiles([]);
    setOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description ?? "",
      status: t.status,
      priority: t.priority,
      due_date: toDateInput(t.due_date),
      assigned_to: t.assigned_to,
    });
    setPickedFiles([]);
    setOpen(true);
  };

  const uploadAttachments = async (taskId: number, files: File[]) => {
    if (!files.length) return;
    const formData = new FormData();
    if (files.length === 1) {
      formData.append("file", files[0]);
      await apiUpload(`/api/v1/tasks/${taskId}/attachments`, formData);
    } else {
      files.forEach((f) => formData.append("files", f));
      await apiUpload(`/api/v1/tasks/${taskId}/attachments/bulk`, formData);
    }
  };

  // -------- Create / Update --------
  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Please give the task a title.");

      const payload: any = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to ?? user?.id ?? null,
      };

      let taskId: number;
      if (editingId) {
        await apiFetch(`/api/v1/tasks/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        taskId = editingId;
      } else {
        const created = await apiFetch<Task>("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        taskId = created.id;
      }

      if (pickedFiles.length > 0) await uploadAttachments(taskId, pickedFiles);
      return { taskId, attachmentsCount: pickedFiles.length };
    },
    onSuccess: (result) => {
      const verb = editingId ? "updated" : "created";
      toast.success(
        result.attachmentsCount
          ? `Task ${verb} with ${result.attachmentsCount} attachment${result.attachmentsCount > 1 ? "s" : ""}`
          : `Task ${verb}`
      );
      refreshAll();
      setOpen(false);
      setForm(empty);
      setPickedFiles([]);
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Toggle status --------
  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const newStatus: TaskStatus = t.status === "completed" ? "pending" : "completed";
      await apiFetch(`/api/v1/tasks/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
    },
    onSuccess: refreshAll,
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Delete task --------
  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Task deleted");
      setDetailId(null);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Delete attachment --------
  const deleteAttachment = useMutation({
    mutationFn: ({ taskId, attachmentId }: { taskId: number; attachmentId: number }) =>
      apiFetch(`/api/v1/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Attachment deleted");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Upload from detail dialog --------
  const [detailUploading, setDetailUploading] = useState(false);
  const handleDetailUpload = async (taskId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid: File[] = [];
    const errors: string[] = [];
    Array.from(files).forEach((f) => {
      if (f.size > MAX_FILE_SIZE) errors.push(`${f.name} is over 10 MB`);
      else valid.push(f);
    });
    if (errors.length) toast.error(errors.join("\n"));
    if (!valid.length) return;

    setDetailUploading(true);
    try {
      await uploadAttachments(taskId, valid);
      toast.success(`${valid.length} file${valid.length > 1 ? "s" : ""} uploaded`);
      refreshAll();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setDetailUploading(false);
    }
  };

  const showAssignee = effectiveScope === "team";
  const gridCols = showAssignee ? GRID_TEAM : GRID_MY;
  const todayStr = localToday();

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-blue-50 text-blue-600 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-400">
            <CheckSquare className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tasks?.length ?? 0} tasks · {effectiveScope === "team"
                ? "Track what your team is working on."
                : "Track your daily to-dos and deadlines."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-xl px-5 shadow-sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            className="h-11 rounded-xl bg-blue-600 px-5 text-white shadow-sm hover:bg-blue-700"
            onClick={openNew}
          >
            <Plus className="mr-2 h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      {/* ---------- Scope buttons (Admin / Manager only) ---------- */}
      {canViewTeam && (
        <div className="inline-flex rounded-2xl border bg-card p-1.5 shadow-sm">
          {(
            [
              { key: "my", label: "My Tasks", icon: User },
              { key: "team", label: "My Team Tasks", icon: Users },
            ] as { key: TaskScope; label: string; icon: any }[]
          ).map(({ key, label, icon: Icon }) => {
            const active = effectiveScope === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setScope(key);
                  setMemberFilter("all");
                }}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total"
          value={stats?.total ?? 0}
          icon={ClipboardList}
          tint="bg-gradient-to-br from-blue-50 to-white border-blue-100 dark:from-blue-950/50 dark:to-slate-950 dark:border-blue-900/40"
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
        />
        <StatCard
          label="Pending"
          value={stats?.pending ?? 0}
          icon={Clock}
          tint="bg-gradient-to-br from-orange-50 to-white border-orange-100 dark:from-orange-950/40 dark:to-slate-950 dark:border-orange-900/40"
          iconBg="bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
        />
        <StatCard
          label="In Progress"
          value={stats?.in_progress ?? 0}
          icon={PlayCircle}
          tint="bg-gradient-to-br from-violet-50 to-white border-violet-100 dark:from-violet-950/40 dark:to-slate-950 dark:border-violet-900/40"
          iconBg="bg-violet-500 text-white"
        />
        <StatCard
          label="Completed"
          value={stats?.completed ?? 0}
          icon={CheckCircle2}
          tint="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 dark:from-emerald-950/40 dark:to-slate-950 dark:border-emerald-900/40"
          iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
        />
        <StatCard
          label="Overdue"
          value={stats?.overdue ?? 0}
          icon={AlertTriangle}
          tint="bg-gradient-to-br from-red-50 to-white border-red-100 dark:from-red-950/40 dark:to-slate-950 dark:border-red-900/40"
          iconBg="bg-red-500 text-white"
        />
      </div>

      {/* ---------- Search + filter + list ---------- */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-55 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={showAssignee ? "Search task, description, assignee…" : "Search task or description…"}
              className="h-11 rounded-xl pl-10"
            />
          </div>
          {showAssignee && (
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="h-11 w-48 rounded-xl">
                <SelectValue placeholder="All members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {teamOnly.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-11 w-40 rounded-xl border-0 bg-blue-600 text-white shadow-sm hover:bg-blue-700 [&>svg]:text-white [&>svg]:opacity-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border">
          {/* column header */}
          <div
            className={`hidden items-center gap-3 border-b bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground md:grid ${gridCols}`}
          >
            <span />
            <span>Task</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Due Date</span>
            {showAssignee && <span>Assigned To</span>}
            <span className="text-right">Actions</span>
          </div>

          {isLoading && (
            <div className="py-14 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          )}

          {!isLoading && visibleTasks.length === 0 && (
            <div className="py-16 text-center">
              <CheckSquare className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {filter === "today"
                  ? "No tasks due today."
                  : showAssignee
                  ? "No tasks assigned to your team members yet."
                  : "No tasks. Create your first one."}
              </p>
            </div>
          )}

          {visibleTasks.map((t) => {
            const done = t.status === "completed";
            const dueStr = t.due_date ? toDateInput(t.due_date) : "";
            const overdue = !!dueStr && dueStr < todayStr && !done && t.status !== "cancelled";
            const attachCount = Array.isArray(t.attachments) ? t.attachments.length : 0;
            const assigneeName = t.assigned_to_name || nameOf(t.assigned_to);

            return (
              <div
                key={t.id}
                className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b px-4 py-3.5 transition-colors last:border-b-0 hover:bg-muted/30 ${gridCols} ${
                  done ? "opacity-60" : ""
                }`}
              >
                <Checkbox checked={done} onCheckedChange={() => toggle.mutate(t)} />

                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => setDetailId(t.id)}
                >
                  <p className={`truncate text-sm font-semibold ${done ? "line-through" : ""}`}>
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  {attachCount > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {attachCount}
                    </span>
                  )}
                </button>

                {/* mobile: actions sit in the 3rd column; desktop: ordered by grid below */}
                <div className="flex items-center justify-end gap-1 md:order-last">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => del.mutate(t.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>

                <span
                  className={`col-start-2 w-fit rounded-full px-2.5 py-1 text-xs font-medium md:col-auto ${statusStyles[t.status]}`}
                >
                  {statusLabel[t.status] ?? t.status}
                </span>

                <span
                  className={`col-start-2 w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize md:col-auto ${
                    priorityStyles[t.priority] ?? priorityStyles.low
                  }`}
                >
                  {t.priority}
                </span>

                <span
                  className={`col-start-2 flex items-center gap-1.5 text-sm md:col-auto ${
                    overdue ? "font-medium text-destructive" : "text-muted-foreground"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                </span>

                {showAssignee && (
                  <span className="col-start-2 flex min-w-0 items-center gap-2 text-sm md:col-auto">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                        avatarColors[(t.assigned_to ?? 0) % avatarColors.length]
                      }`}
                    >
                      {initials(assigneeName === "Unassigned" ? "?" : assigneeName.replace("#", ""))}
                    </span>
                    <span className="truncate">{assigneeName}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Create / Edit dialog ---------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                className="rounded-xl"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                className="rounded-xl"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <DatePicker
                value={form.due_date ?? ""}
                onChange={(val) => setForm({ ...form, due_date: val })}
                placeholder="Select Due Date"
              />
            </div>

            {canViewTeam && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Assign To
                </Label>
                <Select
                  value={String(form.assigned_to ?? user?.id ?? "")}
                  onValueChange={(v) => setForm({ ...form, assigned_to: Number(v) })}
                  disabled={membersLoading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={membersLoading ? "Loading team…" : "Select assignee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(members && members.length > 0
                      ? members
                      : user
                      ? [{ id: user.id, name: "Me (You)", email: "", role: "", is_self: true }]
                      : []
                    ).map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {membersError && (
                  <p className="text-xs text-destructive">
                    Couldn't load team members. Check that GET /tasks/team-members is registered
                    above /tasks/{"{task_id}"}.
                  </p>
                )}
                {!membersLoading && !membersError && (members ?? []).length <= 1 && (
                  <p className="text-xs text-muted-foreground">
                    No team members found — users must be invited by you or have you as their manager.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments (max 10 MB each)
              </Label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => document.getElementById("task-file-input")?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose Files
              </Button>
              <input
                id="task-file-input"
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                className="hidden"
                onChange={(e) => {
                  handleFilesPicked(e.target.files);
                  e.target.value = "";
                }}
              />

              {pickedFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {pickedFiles.map((file, i) => {
                    const isImage = file.type.startsWith("image/");
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-xl border p-2 text-xs"
                      >
                        {isImage ? (
                          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                        )}
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => removeFile(i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Detail dialog ---------- */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.title}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[detail.status]}`}
                  >
                    {statusLabel[detail.status]}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${priorityStyles[detail.priority]}`}
                  >
                    {detail.priority}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="mb-1 text-xs text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap">{detail.description || "—"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Assigned to</p>
                    <p className="font-medium">
                      {detail.assigned_to_name || nameOf(detail.assigned_to)}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Due date</p>
                    <p className="font-medium">
                      {detail.due_date ? new Date(detail.due_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(detail.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments ({detailAttachments.length})
                  </p>

                  <div className="mb-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => document.getElementById("detail-file-input")?.click()}
                      disabled={detailUploading}
                    >
                      {detailUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload
                    </Button>
                    <input
                      id="detail-file-input"
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      className="hidden"
                      onChange={(e) => {
                        handleDetailUpload(detail.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {detailAttachments.length === 0 && (
                    <p className="text-xs italic text-muted-foreground">No attachments yet.</p>
                  )}

                  <div className="space-y-1.5">
                    {detailAttachments.map((a) => {
                      const isImage = a.file_type?.startsWith("image/");
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 rounded-xl border p-2 text-xs"
                        >
                          {isImage ? (
                            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                          )}
                          <span className="flex-1 truncate">{a.file_name}</span>
                          <span className="text-muted-foreground">{formatFileSize(a.file_size)}</span>
                          <a
                            href={a.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() =>
                              deleteAttachment.mutate({ taskId: detail.id, attachmentId: a.id })
                            }
                            disabled={deleteAttachment.isPending}
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setDetailId(null)}>
                  Close
                </Button>
                <Button
                  className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    setDetailId(null);
                    openEdit(detail);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  onClick={() => del.mutate(detail.id)}
                  disabled={del.isPending}
                >
                  {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}