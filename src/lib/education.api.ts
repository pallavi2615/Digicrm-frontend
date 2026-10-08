// Education AI Setup API — talks to the FastAPI /education routes through the shared apiFetch.
// Replaces: educationSetup (workspace.functions), applyTemplate (workspace-apply), claimIndustry (industry-access)
// and the direct supabase inserts into edu_branches / edu_courses / edu_batches.
import { apiFetch } from "@/lib/api";

const BASE = "/api/v1/education";

const get = <T>(path: string) => apiFetch<T>(`${BASE}${path}`);
const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(`${BASE}${path}`, { method: "POST", body: JSON.stringify(body) });

// ---------- Types ----------
export type Kind = "coaching" | "education" | "study_abroad" | "school" | "edtech" | "skill_training";

export type SetupAnswers = {
  name: string; city: string; branches: number; programs: string; mode: string; feeRange: string; notes: string;
};

export type PlanCourse = { name: string; exam: string | null; fee: number; mode: string; duration_months: number };
export type PlanBranch = { name: string; city: string };
export type PlanBatch = { name: string; course: string; timing: string };
export type PlanField = { key: string; label: string; type: string; options?: string[] };

export type EducationPlan = {
  setupId: number | null;
  subtype: string;
  summary: string;
  courses: PlanCourse[];
  branches: PlanBranch[];
  batches: PlanBatch[];
  extraFields: PlanField[];
};

export type SetupListItem = { id: number; [k: string]: unknown };

// ---------- Normalizers ----------
/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown) => Number(v) || 0;
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

const normPlan = (r: any): EducationPlan => ({
  setupId: r?.setupId ?? r?.setup_id ?? r?.id ?? null,
  subtype: String(r?.subtype ?? ""),
  summary: String(r?.summary ?? ""),
  courses: arr(r?.courses).map((c) => ({
    name: String(c?.name ?? "Program"),
    exam: c?.exam ? String(c.exam) : null,
    fee: num(c?.fee),
    mode: String(c?.mode ?? "Offline"),
    duration_months: num(c?.duration_months ?? c?.durationMonths) || 12,
  })),
  branches: arr(r?.branches).map((b) => ({ name: String(b?.name ?? "Main branch"), city: String(b?.city ?? "") })),
  batches: arr(r?.batches).map((b) => ({ name: String(b?.name ?? "Batch"), course: String(b?.course ?? ""), timing: String(b?.timing ?? "") })),
  extraFields: arr(r?.extraFields ?? r?.extra_fields).filter((f) => f?.key).map((f) => ({
    key: String(f.key), label: String(f.label ?? f.key), type: String(f.type ?? "text"),
    ...(Array.isArray(f.options) ? { options: f.options.map(String) } : {}),
  })),
});

// ---------- Endpoints ----------
export const educationApi = {
  /** POST /education/setup — AI generates the plan (also saves it as a setup row). */
  setup: async (data: SetupAnswers & { businessType: Kind }): Promise<EducationPlan> =>
    normPlan(await post<any>("/setup", data)),

  /** POST /education/apply — creates branches / courses / batches from the (edited) plan. */
  apply: (data: {
    setupId: number | null;
    businessType: Kind;
    name: string;
    notes: string;
    sample: boolean;
    plan: EducationPlan;
  }) => post<{ ok?: boolean; [k: string]: unknown }>("/apply", data),

  /** GET /education/setups */
  list: (limit = 50) => get<SetupListItem[]>(`/setups?limit=${limit}`),

  /** GET /education/setups/{id} */
  get: async (id: number): Promise<EducationPlan> => normPlan(await get<any>(`/setups/${id}`)),

  /** DELETE /education/setups/{id} (returns 204, so apiFetch's json() can't be used). */
  remove: async (id: number): Promise<void> => {
    await apiFetch(`${BASE}/setups/${id}`, { method: "DELETE" }).catch((e: Error) => {
      // 204 has no body, so response.json() throws after a successful delete.
      if (!/JSON|Unexpected end/i.test(e.message)) throw e;
    });
  },
};