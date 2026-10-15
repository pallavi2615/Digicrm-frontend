import axios, { AxiosError } from "axios";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variable.");
  }

  const headers: Record<string, string> = { apikey: SUPABASE_PUBLISHABLE_KEY };
  // Legacy anon keys are JWTs and can be sent as Bearer tokens. New sb_* keys are opaque
  // and should only be sent in the apikey header, matching the existing Supabase client setup.
  if (!SUPABASE_PUBLISHABLE_KEY.startsWith("sb_")) {
    headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }

  return axios.create({
    baseURL: `${SUPABASE_URL}/rest/v1/`,
    headers: { ...headers, "Content-Type": "application/json" },
    timeout: 30000,
  });
}

function getRestError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const response = error as AxiosError<any>;
    const body = response.response?.data;
    const message = body?.message || body?.details || body?.hint || body?.error_description;
    return new Error(typeof message === "string" ? message : `Supabase request failed (${response.response?.status ?? "network error"}).`);
  }
  return error instanceof Error ? error : new Error("Supabase request failed.");
}

export async function supabaseRestGet<T>(
  table: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<T[]> {
  try {
    const response = await getClient().get<T[]>(table, { params });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    throw getRestError(error);
  }
}

export async function supabaseRestInsert<T>(
  table: string,
  row: Record<string, unknown>,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T | null> {
  try {
    const response = await getClient().post<T[]>(table, row, {
      params,
      headers: { Prefer: "return=representation" },
    });
    return Array.isArray(response.data) ? response.data[0] ?? null : null;
  } catch (error) {
    throw getRestError(error);
  }
}
