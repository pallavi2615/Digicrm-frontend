import axios, { AxiosError, type AxiosRequestConfig, type Method } from "axios";

const API_URL = "https://tucking-reborn-dislodge.ngrok-free.dev".replace(/\/+$/, "");
let refreshPromise: Promise<string | null> | null = null;

const AUTH_ENDPOINTS = [
  "/api/v1/auth/signin",
  "/api/v1/auth/signup",
  "/api/v1/auth/refresh",
];

type ApiRequestConfig = AxiosRequestConfig & { _retried?: boolean };

function extractErrorMessage(data: unknown, status: number): string {
  if (typeof data === "string") {
    try { return extractErrorMessage(JSON.parse(data), status); }
    catch { return data || `API Error: ${status}`; }
  }
  if (data && typeof data === "object") {
    const error = data as Record<string, any>;
    if (typeof error.detail === "string") return error.detail;
    if (Array.isArray(error.detail)) {
      return error.detail.map((item: any) => typeof item === "string" ? item : item?.msg || item?.message || "Invalid input").filter(Boolean).join(", ");
    }
    if (typeof error.message === "string") return error.message;
    if (typeof error.msg === "string") return error.msg;
    if (typeof error.error === "string") return error.error;
    if (error.error && typeof error.error === "object" && typeof error.error.message === "string") return error.error.message;
  }
  return `API Error: ${status}`;
}

function toApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    return new Error(extractErrorMessage(error.response?.data, status || 500));
  }
  return error instanceof Error ? error : new Error("Network error");
}

const http = axios.create({
  baseURL: API_URL,
  headers: { "ngrok-skip-browser-warning": "true" },
  timeout: 60000,
});

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;
  try {
    const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken }, {
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      timeout: 30000,
    });
    const data = response.data;
    if (!data?.access_token) return null;
    localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token as string;
  } catch {
    return null;
  }
}

function logoutAndRedirect() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.location.href = "/auth";
}

async function requestApi<T>(config: ApiRequestConfig, isRetry = false): Promise<T> {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = { ...(config.headers as Record<string, string> | undefined), "ngrok-skip-browser-warning": "true" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const contentTypeExists = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
  if (config.data !== undefined && !(config.data instanceof FormData) && !contentTypeExists) headers["Content-Type"] = "application/json";
  try {
    const response = await http.request<T>({ ...config, headers });
    return response.data;
  } catch (err) {
    const error = err as AxiosError;
    const endpoint = String(config.url ?? "");
    const isAuthEndpoint = AUTH_ENDPOINTS.some((item) => endpoint.startsWith(item));
    if (error.response?.status === 401 && !isRetry && !isAuthEndpoint && !(config as ApiRequestConfig)._retried) {
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      const newToken = await refreshPromise;
      if (newToken) return requestApi<T>({ ...config, _retried: true, headers: { ...(config.headers as object), Authorization: `Bearer ${newToken}` } }, true);
      logoutAndRedirect();
      throw new Error("Session expired. Please log in again.");
    }
    throw toApiError(err);
  }
}

/** Axios-backed JSON request helper retained under the existing API to avoid unrelated component changes. */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  let data: unknown = options.body;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { /* leave non-JSON body as text */ }
  }
  const headers = Object.fromEntries(new Headers(options.headers).entries());
  return requestApi<T>({
    url: endpoint,
    method: (options.method || "GET") as Method,
    data,
    headers,
    signal: options.signal ?? undefined,
  }, isRetry);
}

export async function apiUpload<T = any>(endpoint: string, formData: FormData, isRetry = false): Promise<T> {
  return requestApi<T>({ url: endpoint, method: "POST", data: formData, headers: {} }, isRetry);
}

export async function apiDownload(endpoint: string, filename: string, isRetry = false): Promise<void> {
  const token = localStorage.getItem("access_token");
  try {
    const response = await http.get<Blob>(endpoint, {
      responseType: "blob",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    const error = err as AxiosError;
    if (error.response?.status === 401 && !isRetry) {
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      const newToken = await refreshPromise;
      if (newToken) return apiDownload(endpoint, filename, true);
      logoutAndRedirect();
      throw new Error("Session expired. Please log in again.");
    }
    throw toApiError(err);
  }
}

export { API_URL };
