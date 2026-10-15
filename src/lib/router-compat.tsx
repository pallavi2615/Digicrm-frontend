import React from "react";
import {
  Link as ReactRouterLink,
  Outlet,
  redirect as reactRouterRedirect,
  useLocation,
  useLoaderData,
  useNavigate as useReactRouterNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";

type NavigationTarget = string | {
  to: string;
  params?: Record<string, string | number | null | undefined>;
  search?: Record<string, unknown>;
  replace?: boolean;
  state?: unknown;
};
type AnyRecord = Record<string, any>;

function buildPath(to: string, params?: Record<string, string | number | null | undefined>, search?: Record<string, unknown>) {
  let pathname = to;
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) {
      pathname = pathname.replaceAll(`$${key}`, encodeURIComponent(String(value))).replaceAll(`:${key}`, encodeURIComponent(String(value)));
    }
  }
  if (search && Object.keys(search).length) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) value.forEach((item) => query.append(key, String(item)));
      else query.set(key, String(value));
    }
    const serialized = query.toString();
    if (serialized) pathname += `${pathname.includes("?") ? "&" : "?"}${serialized}`;
  }
  return pathname;
}

export function useNavigate() {
  const navigate = useReactRouterNavigate();
  return React.useCallback((target: NavigationTarget, options?: { replace?: boolean; state?: unknown }) => {
    if (typeof target === "string") {
      navigate(target, options);
      return;
    }
    navigate(buildPath(target.to, target.params, target.search), {
      replace: target.replace ?? options?.replace,
      state: target.state ?? options?.state,
    });
  }, [navigate]);
}

export const Link = React.forwardRef<HTMLAnchorElement, AnyRecord>(function CompatLink(props, ref) {
  const { to, params, search, from: _from, activeProps: _activeProps, inactiveProps: _inactiveProps, ...rest } = props;
  return <ReactRouterLink ref={ref} to={buildPath(String(to ?? "/"), params, search)} {...rest} />;
});

export { Outlet };

export function useRouterState<T = AnyRecord>(options?: { select?: (state: AnyRecord) => T }): T {
  const location = useLocation();
  const search = Object.fromEntries(new URLSearchParams(location.search).entries());
  const state = {
    location: {
      pathname: location.pathname,
      search: search,
      searchStr: location.search,
      hash: location.hash,
      href: `${location.pathname}${location.search}${location.hash}`,
    },
    status: "idle",
  };
  return (options?.select ? options.select(state) : state) as T;
}

export function useRouter() {
  const navigate = useNavigate();
  const state = useRouterState();
  return { navigate, state, invalidate: () => window.location.reload() };
}

function currentSearch() {
  const [params] = useSearchParams();
  return Object.fromEntries(params.entries());
}

export function defineRoute(path: string) {
  return (options: AnyRecord = {}) => ({
    path,
    options,
    useParams: () => useParams() as any,
    useSearch: () => {
      const raw = currentSearch();
      return typeof options.validateSearch === "function" ? options.validateSearch(raw) : raw;
    },
    useLoaderData: () => useLoaderData() as any,
    useRouteContext: () => (useOutletContext() ?? {}) as any,
  });
}

export function notFound(): Response {
  return new Response("Not Found", { status: 404, statusText: "Not Found" });
}

export function redirect(target: AnyRecord): Response {
  const status = target.statusCode ?? target.status ?? 302;
  return reactRouterRedirect(buildPath(target.to ?? "/", target.params, target.search), { status });
}

