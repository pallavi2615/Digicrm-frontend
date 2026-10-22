import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

/** Lightweight React-only data cache for the existing app's query/mutation patterns. */
export type QueryKey = readonly unknown[];
type QueryStatus = "pending" | "success" | "error";
type QueryRecord<T = unknown> = {
  queryKey: QueryKey;
  data: T | undefined;
  error: unknown;
  status: QueryStatus;
  isFetching: boolean;
  invalidated: boolean;
  updatedAt: number;
  promise?: Promise<T>;
};

type QueryFilters = { queryKey?: QueryKey; exact?: boolean };

function serialize(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
      }
      return item;
    });
  } catch {
    return String(value);
  }
}

function keyMatches(candidate: QueryKey, filter?: QueryKey, exact = false): boolean {
  if (!filter) return true;
  if (exact) return serialize(candidate) === serialize(filter);
  if (filter.length > candidate.length) return false;
  return filter.every((part, index) => serialize(part) === serialize(candidate[index]));
}

export class QueryClient {
  private records = new Map<string, QueryRecord>();
  private listeners = new Map<string, Set<() => void>>();
  private observers = new Map<string, Set<() => Promise<unknown>>>();

  private hash(key: QueryKey): string {
    return serialize(key);
  }

  ensureQuery<T>(key: QueryKey, initialData?: T): QueryRecord<T> {
    const hash = this.hash(key);
    let record = this.records.get(hash) as QueryRecord<T> | undefined;
    if (!record) {
      record = {
        queryKey: key,
        data: initialData,
        error: null,
        status: initialData === undefined ? "pending" : "success",
        isFetching: false,
        invalidated: initialData === undefined,
        updatedAt: initialData === undefined ? 0 : Date.now(),
      };
      this.records.set(hash, record);
    }
    return record;
  }

  getQueryData<T>(key: QueryKey): T | undefined {
    return this.ensureQuery<T>(key).data;
  }

  setQueryData<T>(key: QueryKey, updater: T | undefined | ((previous: T | undefined) => T | undefined)): T | undefined {
    const record = this.ensureQuery<T>(key);
    const data = typeof updater === "function"
      ? (updater as (previous: T | undefined) => T)(record.data)
      : updater;
    if (data === undefined) return record.data;
    record.data = data;
    record.error = null;
    record.status = "success";
    record.isFetching = false;
    record.invalidated = false;
    record.updatedAt = Date.now();
    this.notify(this.hash(key));
    return data;
  }

  subscribe(key: QueryKey, listener: () => void): () => void {
    const hash = this.hash(key);
    const group = this.listeners.get(hash) ?? new Set<() => void>();
    group.add(listener);
    this.listeners.set(hash, group);
    return () => {
      group.delete(listener);
      if (!group.size) this.listeners.delete(hash);
    };
  }

  observe(key: QueryKey, refetch: () => Promise<unknown>): () => void {
    const hash = this.hash(key);
    const group = this.observers.get(hash) ?? new Set<() => Promise<unknown>>();
    group.add(refetch);
    this.observers.set(hash, group);
    return () => {
      group.delete(refetch);
      if (!group.size) this.observers.delete(hash);
    };
  }

  async fetchQuery<T>(key: QueryKey, queryFn: () => Promise<T> | T, staleTime = 0): Promise<T> {
    const hash = this.hash(key);
    const record = this.ensureQuery<T>(key);
    const fresh = !record.invalidated && record.updatedAt > 0 && Date.now() - record.updatedAt < staleTime;
    if (fresh && record.data !== undefined) return record.data;
    if (record.promise) return record.promise as Promise<T>;

    record.isFetching = true;
    if (record.data === undefined) record.status = "pending";
    this.notify(hash);
    const promise = Promise.resolve().then(queryFn);
    record.promise = promise;
    try {
      const data = await promise;
      record.data = data;
      record.error = null;
      record.status = "success";
      record.invalidated = false;
      record.updatedAt = Date.now();
      return data;
    } catch (error) {
      record.error = error;
      record.status = "error";
      record.invalidated = false;
      throw error;
    } finally {
      record.isFetching = false;
      record.promise = undefined;
      this.notify(hash);
    }
  }

  async invalidateQueries(filters: QueryFilters = {}): Promise<void> {
    const pending: Promise<unknown>[] = [];
    for (const [hash, record] of this.records) {
      if (!keyMatches(record.queryKey, filters.queryKey, filters.exact)) continue;
      record.invalidated = true;
      this.notify(hash);
      const active = this.observers.get(hash);
      if (active?.size) for (const refetch of active) pending.push(refetch().catch(() => undefined));
    }
    await Promise.all(pending);
  }

  async cancelQueries(_filters?: QueryFilters): Promise<void> {
    // Native fetch cancellation is handled by the API helper when a request supports it.
  }

  clear(): void {
    const hashes = [...this.records.keys()];
    this.records.clear();
    for (const hash of hashes) this.notify(hash);
  }

  private notify(hash: string): void {
    this.listeners.get(hash)?.forEach((listener) => listener());
  }
}

const DataClientContext = createContext<QueryClient | null>(null);

export function QueryClientProvider({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return <DataClientContext.Provider value={client}>{children}</DataClientContext.Provider>;
}

export function useQueryClient(): QueryClient {
  const client = useContext(DataClientContext);
  if (!client) throw new Error("Data hooks must be rendered inside QueryClientProvider.");
  return client;
}

export function keepPreviousData<T>(previousData: T | undefined): T | undefined {
  return previousData;
}

type UseQueryOptions<T> = {
  queryKey: QueryKey;
  queryFn: () => Promise<T> | T;
  enabled?: boolean;
  initialData?: T | (() => T);
  initialDataUpdatedAt?: number;
  staleTime?: number;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  placeholderData?: any;
  retry?: boolean | number;
};

export function useQuery<T = unknown>(options: UseQueryOptions<T>) {
  const client = useQueryClient();
  const hash = serialize(options.queryKey);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const initialData = typeof options.initialData === "function"
    ? (options.initialData as () => T)()
    : options.initialData;
  const record = useMemo(
    () => client.ensureQuery<T>(options.queryKey, initialData),
    // The key hash is the semantic identity of this cache entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, hash],
  );
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const previousData = useRef<T | undefined>(record.data);

  const refetch = useCallback(async () => {
    const current = optionsRef.current;
    return client.fetchQuery(current.queryKey, current.queryFn, current.staleTime ?? 0);
  }, [client, hash]);

  useEffect(() => {
    const unsubscribe = client.subscribe(optionsRef.current.queryKey, rerender);
    const unobserve = client.observe(optionsRef.current.queryKey, refetch);
    const current = optionsRef.current;
    if (current.enabled !== false) {
      const nowRecord = client.ensureQuery<T>(current.queryKey);
      const isFresh = !nowRecord.invalidated && nowRecord.updatedAt > 0 &&
        Date.now() - nowRecord.updatedAt < (current.staleTime ?? 0);
      if (nowRecord.data === undefined || !isFresh || nowRecord.invalidated) {
        void refetch().catch(() => undefined);
      }
    }
    return () => {
      unsubscribe();
      unobserve();
    };
  }, [client, hash, options.enabled, refetch]);

  useEffect(() => {
    if (!options.refetchInterval || options.enabled === false) return;
    const id = window.setInterval(() => { void refetch().catch(() => undefined); }, options.refetchInterval);
    return () => window.clearInterval(id);
  }, [options.refetchInterval, options.enabled, refetch]);

  useEffect(() => {
    if (options.refetchOnWindowFocus === false || options.enabled === false) return;
    const onFocus = () => { if (document.visibilityState === "visible") void refetch().catch(() => undefined); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [options.refetchOnWindowFocus, options.enabled, refetch]);

  const cached = client.ensureQuery<T>(options.queryKey);
  let data = cached.data;
  if (data !== undefined) previousData.current = data;
  if (data === undefined && options.placeholderData !== undefined) {
    data = typeof options.placeholderData === "function"
      ? (options.placeholderData as (previousData: T | undefined) => T | undefined)(previousData.current)
      : options.placeholderData;
  }

  return {
    data,
    error: cached.error as Error | null,
    status: cached.status,
    isLoading: options.enabled !== false && cached.status === "pending" && cached.data === undefined,
    isFetching: cached.isFetching,
    isError: cached.status === "error",
    isSuccess: cached.status === "success",
    isPending: cached.status === "pending",
    refetch,
  };
}

type MutationOptions<TData, TVariables, TContext> = {
  mutationFn: (variables: TVariables) => Promise<TData> | TData;
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => unknown;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => unknown;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => unknown;
};

type MutationCallbacks<TData, TVariables, TContext> = {
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => unknown;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => unknown;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => unknown;
};

export function useMutation<TData = unknown, TVariables = void, TContext = unknown>(
  options: MutationOptions<TData, TVariables, TContext>,
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [state, setState] = useState<{
    status: "idle" | "pending" | "success" | "error";
    data: TData | undefined;
    error: Error | null;
    variables: TVariables | undefined;
  }>({ status: "idle", data: undefined, error: null, variables: undefined });

  const mutateAsync = useCallback(async (
    variables: TVariables,
    callbacks?: MutationCallbacks<TData, TVariables, TContext>,
  ): Promise<TData> => {
    const current = optionsRef.current;
    setState({ status: "pending", data: undefined, error: null, variables });
    let context: TContext | undefined;
    let data: TData | undefined;
    let caught: Error | null = null;
    try {
      context = await current.onMutate?.(variables) as TContext | undefined;
      data = await current.mutationFn(variables);
      setState({ status: "success", data, error: null, variables });
      await current.onSuccess?.(data, variables, context);
      await callbacks?.onSuccess?.(data, variables, context);
      await current.onSettled?.(data, null, variables, context);
      await callbacks?.onSettled?.(data, null, variables, context);
      return data;
    } catch (value) {
      caught = value instanceof Error ? value : new Error(String(value));
      setState({ status: "error", data: undefined, error: caught, variables });
      try { await current.onError?.(caught, variables, context); } catch { /* preserve the mutation error */ }
      try { await callbacks?.onError?.(caught, variables, context); } catch { /* preserve the mutation error */ }
      try { await current.onSettled?.(undefined, caught, variables, context); } catch { /* preserve the mutation error */ }
      try { await callbacks?.onSettled?.(undefined, caught, variables, context); } catch { /* preserve the mutation error */ }
      throw caught;
    }
  }, []);

  const mutate = useCallback((variables?: TVariables, callbacks?: MutationCallbacks<TData, TVariables, TContext>) => {
    void mutateAsync(variables as TVariables, callbacks).catch(() => undefined);
  }, [mutateAsync]);

  const reset = useCallback(() => setState({ status: "idle", data: undefined, error: null, variables: undefined }), []);

  return {
    ...state,
    isPending: state.status === "pending",
    isLoading: state.status === "pending",
    isSuccess: state.status === "success",
    isError: state.status === "error",
    mutate,
    mutateAsync,
    reset,
  };
}
