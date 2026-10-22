import { useEffect } from "react";
import { useMatches } from "react-router-dom";

type HeadDescriptor = {
  meta?: Array<Record<string, string>>;
  links?: Array<Record<string, string>>;
  scripts?: Array<{ type?: string; children?: string }>;
};

/** Applies the metadata previously supplied by route `head()` callbacks in the client router. */
export function RouteHeadSync() {
  const matches = useMatches();
  const active = [...matches].reverse().find((match) => typeof (match.handle as any)?.head === "function");
  const headFn = (active?.handle as any)?.head as ((args: { loaderData: unknown; params: Record<string, string | undefined> }) => HeadDescriptor) | undefined;
  const descriptor = active && headFn
    ? (() => {
        try {
          return headFn({ loaderData: active.data, params: active.params });
        } catch {
          return undefined;
        }
      })()
    : undefined;

  useEffect(() => {
    const meta = descriptor?.meta ?? [];
    const titleMeta = meta.find((item) => typeof item.title === "string");
    document.title = titleMeta?.title ?? "DigiCRM AI — The AI-native CRM for modern sales teams";

    document.head.querySelectorAll("[data-route-head='true']").forEach((node) => node.remove());

    for (const item of meta) {
      if (item.title) continue;
      const element = document.createElement("meta");
      for (const [key, value] of Object.entries(item)) element.setAttribute(key, value);
      element.dataset.routeHead = "true";
      document.head.appendChild(element);
    }

    for (const item of descriptor?.links ?? []) {
      const element = document.createElement("link");
      for (const [key, value] of Object.entries(item)) element.setAttribute(key, value);
      element.dataset.routeHead = "true";
      document.head.appendChild(element);
    }

    for (const item of descriptor?.scripts ?? []) {
      const element = document.createElement("script");
      if (item.type) element.type = item.type;
      element.textContent = item.children ?? "";
      element.dataset.routeHead = "true";
      document.head.appendChild(element);
    }
  }, [active?.id, descriptor]);

  return null;
}
