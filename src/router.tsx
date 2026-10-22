import React, { createElement } from "react";
import { createBrowserRouter, RouterProvider, isRouteErrorResponse, useRouteError, Link as ReactRouterLink } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { RootLayout } from "./routes/__root";

type CompatRoute = {
  path: string;
  options: Record<string, any>;
};
type RouteModule = { Route?: CompatRoute };
type Entry = {
  sourcePath: string;
  originalPath: string;
  urlPath: string;
  authenticated: boolean;
  route: CompatRoute;
  indexCandidate: boolean;
  parent?: Entry;
  children: Entry[];
};

const routeModules = import.meta.glob<RouteModule>([
  "./routes/**/*.tsx",
  "!./routes/__root.tsx",
  "!./routes/sitemap[.]xml.tsx",
], { eager: true });

const LAYOUT_PATHS = new Set([
  "/products",
  "/industries",
  "/industries/:group",
  "/_authenticated",
  "/_authenticated/brand",
  "/_authenticated/fintech",
  "/_authenticated/it",
  "/_authenticated/productsales",
  "/_authenticated/realestate",
  "/_authenticated/industry/:slug",
]);

function normalizeUrlPath(path: string) {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return trimmed.split("/").map((segment) => {
    if (!segment) return segment;
    const withoutLayoutSuffix = segment.endsWith("_") ? segment.slice(0, -1) : segment;
    return withoutLayoutSuffix.startsWith("$") ? `:${withoutLayoutSuffix.slice(1)}` : withoutLayoutSuffix;
  }).join("/") || "/";
}

function toEntry(sourcePath: string, route: CompatRoute): Entry {
  const originalPath = route.path || "/";
  const authenticated = originalPath === "/_authenticated" || originalPath.startsWith("/_authenticated/");
  const urlPath = normalizeUrlPath(originalPath.replace(/^\/_authenticated(?=\/|$)/, "") || "/");
  return {
    sourcePath,
    originalPath,
    urlPath,
    authenticated,
    route,
    indexCandidate: originalPath.endsWith("/") || originalPath === "/",
    children: [],
  };
}

function parentEligible(entry: Entry) {
  if (entry.indexCandidate) return false; // "/x/" is an index page, never a layout
  return LAYOUT_PATHS.has(entry.originalPath) || LAYOUT_PATHS.has(normalizeUrlPath(entry.originalPath));
}

const entries: Entry[] = Object.entries(routeModules)
  .map(([sourcePath, module]) => module.Route ? toEntry(sourcePath, module.Route) : null)
  .filter((item): item is Entry => Boolean(item && typeof item.route.options.component === "function"));

const authRoot = entries.find((entry) => entry.originalPath === "/_authenticated");
const publicEntries = entries.filter((entry) => !entry.authenticated);
const authEntries = entries.filter((entry) => entry.authenticated && entry !== authRoot);

function getRelativePath(entry: Entry, parent?: Entry) {
  if (entry.indexCandidate && parent && entry.urlPath === parent.urlPath) return "";
  const base = parent?.urlPath && parent.urlPath !== "/" ? parent.urlPath : "";
  let value = entry.urlPath;
  if (base && value.startsWith(`${base}/`)) value = value.slice(base.length + 1);
  else value = value.replace(/^\//, "");
  return value;
}

function assembleGroup(group: Entry[], auth: boolean): RouteObject[] {
  const layouts = group.filter(parentEligible);
  for (const entry of group) {
    if (entry === authRoot) continue;
    // A slash-ending route becomes an index route beneath a same-path layout.
    const samePathParent = layouts.find((candidate) => candidate !== entry && candidate.authenticated === entry.authenticated && candidate.urlPath === entry.urlPath);
    if (entry.indexCandidate && samePathParent) {
      entry.parent = samePathParent;
      samePathParent.children.push(entry);
      continue;
    }
    const candidateParents = layouts.filter((candidate) => candidate !== entry && candidate.authenticated === entry.authenticated && candidate.urlPath !== "/" && (entry.urlPath === `${candidate.urlPath}/` || entry.urlPath.startsWith(`${candidate.urlPath}/`)));
    // The authenticated root is pathless and acts as the fallback parent for every authenticated page.
    if (auth && authRoot && entry !== authRoot) candidateParents.push(authRoot);
    const parent = candidateParents.sort((a, b) => b.urlPath.length - a.urlPath.length)[0];
    if (parent) {
      entry.parent = parent;
      parent.children.push(entry);
    }
  }

  const seen = new Set<Entry>();
  function toObject(entry: Entry, parent?: Entry): RouteObject {
  seen.add(entry);

  const options = entry.route.options;
  const component = options.component;

  // An index route must never have children.
  const hasChildren = entry.children.length > 0;

  const isIndex = Boolean(
    !hasChildren &&
      (
        (entry.indexCandidate &&
          parent &&
          entry.urlPath === parent.urlPath) ||
        (!parent && entry.urlPath === "/")
      )
  );

  const routeObject: RouteObject = {
    ...(isIndex
      ? { index: true as const }
      : { path: getRelativePath(entry, parent) }),

    element: createElement(component),

    ...(typeof options.loader === "function"
      ? { loader: options.loader }
      : {}),

    ...(typeof options.beforeLoad === "function"
      ? {
          loader: async (args: any) =>
            await options.beforeLoad(args),
        }
      : {}),

    ...(hasChildren
      ? {
          children: entry.children.map((child) =>
            toObject(child, entry)
          ),
        }
      : {}),

    ...(typeof options.head === "function"
      ? { handle: { head: options.head } }
      : {}),

    errorElement: (
      <RouteErrorBoundary
        errorComponent={options.errorComponent}
        notFoundComponent={options.notFoundComponent}
      />
    ),
  };

  return routeObject;
}

  const roots = auth && authRoot ? authRoot.children : group.filter((entry) => !entry.parent && entry !== authRoot);
  return roots.map((entry) => toObject(entry, auth && authRoot ? authRoot : undefined));
}

function RouteErrorBoundary({ errorComponent: ErrorComponent, notFoundComponent: NotFoundComponent }: { errorComponent?: React.ComponentType<any>; notFoundComponent?: React.ComponentType<any> }) {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404 && NotFoundComponent) return createElement(NotFoundComponent);
  if (ErrorComponent) return createElement(ErrorComponent, { error });
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : "Something went wrong.";
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p><button className="mt-6 rounded-md border px-4 py-2" onClick={() => window.location.reload()}>Try again</button> <ReactRouterLink className="ml-2 underline" to="/">Go home</ReactRouterLink></div></div>;
}

const authChildRoutes = authRoot ? assembleGroup(authEntries, true) : [];
const authRoute: RouteObject | null = authRoot ? {
  element: createElement(authRoot.route.options.component),
  loader: typeof authRoot.route.options.beforeLoad === "function" ? async (args) => await authRoot.route.options.beforeLoad(args) : undefined,
  children: authChildRoutes,
  errorElement: <RouteErrorBoundary />,
} : null;

// Authenticated pages are rooted at a pathless protected layout. The rest are public pages.
const publicRoutes = assembleGroup(publicEntries, false);
const routerRoutes: RouteObject[] = [
  {
    element: createElement(RootLayout),
    children: [
      ...publicRoutes,
      ...(authRoute ? [authRoute] : []),
      { path: "*", element: <div className="flex min-h-screen items-center justify-center"><div className="text-center"><h1 className="text-6xl font-bold">404</h1><p className="mt-3 text-muted-foreground">Page not found</p><ReactRouterLink to="/" className="mt-5 inline-block underline">Go home</ReactRouterLink></div></div> },
    ],
  },
];

const browserRouter = createBrowserRouter(routerRoutes);

export default function AppRouter() {
  return <RouterProvider router={browserRouter} />;
}
